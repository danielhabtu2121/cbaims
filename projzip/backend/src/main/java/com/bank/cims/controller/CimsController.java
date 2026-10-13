package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.ExposureCalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CimsController {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OwnershipTransferRepository ownershipTransferRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private com.bank.cims.service.InsuranceRequirementService insuranceRequirementService;

    @Autowired
    private com.bank.cims.service.CollateralFacilityRelationshipService collateralFacilityRelationshipService;

    @GetMapping("/state")
    public ResponseEntity<Map<String, Object>> getState() {
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @GetMapping("/config/system-date")
    public ResponseEntity<Map<String, String>> getSystemDate() {
        return ResponseEntity.ok(Map.of("systemDate", cimsService.getSimulatedSystemDate()));
    }

    @PostMapping("/config/system-date")
    public ResponseEntity<Map<String, String>> setSystemDate(@RequestBody(required = false) Map<String, String> payload) {
        String d = payload != null ? payload.get("systemDate") : null;
        cimsService.setSimulatedSystemDate(d);
        return ResponseEntity.ok(Map.of("systemDate", cimsService.getSimulatedSystemDate()));
    }

    // --- Business Segments ---
    @PostMapping("/segments/add")
    public ResponseEntity<Map<String, Object>> addSegment(
            @RequestBody BusinessSegment segment,
            @RequestParam(defaultValue = "SYSADMIN") String userId) {
        cimsService.addBusinessSegment(segment, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/segments/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleSegmentStatus(
            @RequestParam String segmentId,
            @RequestParam boolean active,
            @RequestParam(defaultValue = "SYSADMIN") String userId) {
        cimsService.toggleSegmentActiveStatus(segmentId, active, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Ownership Transfers ---
    @PostMapping("/transfers/initiate")
    public ResponseEntity<Map<String, Object>> initiateTransfer(
            @RequestParam String collateralId,
            @RequestParam String destinationSegment,
            @RequestParam String reason,
            @RequestParam String userId) {
        Optional<Collateral> colOpt = collateralRepository.findById(collateralId);
        if (colOpt.isPresent()) {
            Collateral col = colOpt.get();
            OwnershipTransfer transfer = new OwnershipTransfer(
                "trf-" + System.currentTimeMillis(),
                collateralId,
                col.getOwningSegment(),
                destinationSegment,
                reason,
                userId,
                java.time.LocalDate.now().toString(),
                "Pending",
                "Initiated by " + userId
            );
            ownershipTransferRepository.save(transfer);
            cimsService.logAudit(userId, "CRO", "INITIATE_OWNERSHIP_TRANSFER", "Collateral", collateralId, "Segment", col.getOwningSegment(), destinationSegment, reason);
        }
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/transfers/approve")
    public ResponseEntity<Map<String, Object>> approveTransfer(
            @RequestParam String transferId,
            @RequestParam String userId) {
        ownershipTransferRepository.findById(transferId).ifPresent(trf -> {
            trf.setStatus("Approved");
            trf.setApprovedBy(userId);
            trf.setApprovedAt(java.time.LocalDate.now().toString());
            ownershipTransferRepository.save(trf);

            collateralRepository.findById(trf.getCollateralId()).ifPresent(col -> {
                String oldSeg = col.getOwningSegment();
                col.setOwningSegment(trf.getDestinationSegment());
                collateralRepository.save(col);
                cimsService.logAudit(userId, "HODEPT", "APPROVE_OWNERSHIP_TRANSFER", "Collateral", col.getId(), "Segment", oldSeg, trf.getDestinationSegment(), "Approved segment transfer");
            });
        });
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/transfers/reject")
    public ResponseEntity<Map<String, Object>> rejectTransfer(
            @RequestParam String transferId,
            @RequestParam String remarks,
            @RequestParam String userId) {
        ownershipTransferRepository.findById(transferId).ifPresent(trf -> {
            trf.setStatus("Rejected");
            trf.setApprovedBy(userId);
            trf.setApprovedAt(java.time.LocalDate.now().toString());
            trf.setRemarks(remarks);
            ownershipTransferRepository.save(trf);
            cimsService.logAudit(userId, "HODEPT", "REJECT_OWNERSHIP_TRANSFER", "OwnershipTransfer", transferId, "Status", "Pending", "Rejected", remarks);
        });
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Customers ---
    // Accepts both paths: /customers/add is what the CIMS front-end calls; the original
    // /customers/register-manual path is kept working too in case anything else targets it.
    @PostMapping({"/customers/add", "/customers/register-manual"})
    public ResponseEntity<Map<String, Object>> registerManualCustomer(
            @RequestBody Customer customer,
            @RequestParam String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to register a customer."));
        }
        if (customer.getId() == null || customer.getId().isBlank()) {
            customer.setId("cust-" + System.currentTimeMillis());
        }
        customer.setSource("Manual");
        customer.setRecordStat("U");
        customer.setAuthStat("U");
        customer.setMakerId(userId);
        customer.setMakerDtStamp(java.time.LocalDateTime.now().toString());
        customerRepository.save(customer);

        String approverRole = cimsService.resolveCustomerApproverRole();
        cimsService.submitToWorkflow("PROC_CUSTOMER_REGISTRATION", "Customer", customer.getId(), "Register Customer Manually", "{}", "Manual customer registration", userId, approverRole);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Customer Maintain (post-registration edits, maker-checker) ---
    @PostMapping("/customers/{id}/update")
    public ResponseEntity<Map<String, Object>> updateCustomer(
            @PathVariable String id,
            @RequestBody Map<String, Object> changes,
            @RequestParam String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required."));
        }
        try {
            cimsService.requestCustomerMaintenance(id, changes, userId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Change submitted for checker approval."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // --- Collateral Maintain (post-registration edits, maker-checker) ---
    @PostMapping("/collateral/{id}/update")
    public ResponseEntity<Map<String, Object>> updateCollateral(
            @PathVariable String id,
            @RequestBody Map<String, Object> changes,
            @RequestParam String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required."));
        }
        try {
            cimsService.requestCollateralMaintenance(id, changes, userId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Change submitted for checker approval."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // --- Collateral Ownership Change (Historical retention & supporting document) ---
    @PostMapping("/collateral/{id}/change-ownership")
    public ResponseEntity<Map<String, Object>> changeCollateralOwnership(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.changeCollateralOwnership(id, payload, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Collateral Master & 360 Endpoints ---
    @GetMapping({"/collateral", "/collaterals"})
    public ResponseEntity<List<Collateral>> getAllCollateral() {
        return ResponseEntity.ok(collateralRepository.findAll());
    }

    @GetMapping("/collateral/{id}")
    public ResponseEntity<Collateral> getCollateralById(@PathVariable String id) {
        return collateralRepository.findById(id)
                .or(() -> collateralRepository.findByCode(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/collateral/{id}/360")
    public ResponseEntity<Collateral360Dto> getCollateral360(@PathVariable String id) {
        return ResponseEntity.ok(cimsService.getCollateral360(id));
    }

    @GetMapping("/collateral/{id}/document-checklist")
    public ResponseEntity<List<Collateral360Dto.DocumentChecklistItemDto>> getCollateralDocumentChecklist(@PathVariable String id) {
        return ResponseEntity.ok(cimsService.getMandatoryDocumentChecklist(id));
    }

    @GetMapping("/collateral/taxonomy")
    public ResponseEntity<List<CollateralTaxonomy>> getCollateralTaxonomy() {
        return ResponseEntity.ok(cimsService.getCollateralTaxonomy());
    }

    @GetMapping("/collateral/{id}/facilities")
    public ResponseEntity<List<Collateral360Dto.LinkedFacilityDetailDto>> getLinkedFacilitiesForCollateral(@PathVariable String id) {
        Collateral360Dto dto = cimsService.getCollateral360(id);
        return ResponseEntity.ok(dto.getLinkedFacilities());
    }

    @GetMapping("/collateral/{id}/owners")
    public ResponseEntity<Map<String, Object>> getCollateralOwners(@PathVariable String id) {
        Collateral360Dto dto = cimsService.getCollateral360(id);
        return ResponseEntity.ok(Map.of(
                "activeOwners", dto.getActiveOwners(),
                "historicalOwners", dto.getHistoricalOwners()
        ));
    }

    @PostMapping("/collateral/{id}/verify-owner")
    public ResponseEntity<Map<String, Object>> verifyCollateralOwner(
            @PathVariable String id,
            @RequestParam String ownerId,
            @RequestParam(defaultValue = "Verified") String status,
            @RequestParam(required = false) String comments,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.verifyCollateralOwner(id, ownerId, status, comments, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/collateral/{id}/add-owner")
    public ResponseEntity<Map<String, Object>> addCollateralOwner(
            @PathVariable String id,
            @RequestBody CollateralOwner owner,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.addCollateralOwner(id, owner, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/collateral/{id}/update-owner")
    public ResponseEntity<Map<String, Object>> updateCollateralOwner(
            @PathVariable String id,
            @RequestParam String ownerId,
            @RequestBody CollateralOwner owner,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.updateCollateralOwner(id, ownerId, owner, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/customers/{customerId}/collateral")
    public ResponseEntity<List<Collateral>> getCollateralsForCustomer(@PathVariable String customerId) {
        return ResponseEntity.ok(collateralRepository.findByCustomerId(customerId));
    }

    @GetMapping("/facilities/{facilityId}/collateral")
    public ResponseEntity<List<Collateral>> getCollateralsForFacility(@PathVariable String facilityId) {
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByLoanAccountId(facilityId);
        List<String> colIds = links.stream().map(LoanCollateralLink::getCollateralId).distinct().toList();
        return ResponseEntity.ok(collateralRepository.findAllById(colIds));
    }

    @GetMapping("/collateral/validate-release")
    public ResponseEntity<Map<String, Object>> validateRelease(@RequestParam String collateralId) {
        return ResponseEntity.ok(cimsService.validateCollateralRelease(collateralId));
    }

    @PostMapping("/collateral/register-native")
    public ResponseEntity<Map<String, Object>> registerNativeCollateral(
            @RequestBody Collateral collateral,
            @RequestParam String userId) {
        cimsService.registerNativeCollateral(collateral, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Junction Links ---
    @PostMapping("/links/add")
    public ResponseEntity<Map<String, Object>> addLink(
            @RequestParam String loanId,
            @RequestParam String collateralId,
            @RequestParam double amount,
            @RequestParam String userId,
            @RequestParam(required = false) String linkageType,
            @RequestParam(required = false) String effectiveDate,
            @RequestParam(required = false) String endDate) {
        cimsService.addLink(loanId, collateralId, amount, userId, linkageType, effectiveDate, endDate);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/links/remove")
    public ResponseEntity<Map<String, Object>> removeLink(
            @RequestParam String linkId,
            @RequestParam String userId) {
        cimsService.removeLink(linkId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Policy Operations ---
    @PostMapping("/policies/add")
    public ResponseEntity<Map<String, Object>> addPolicy(
            @RequestBody InsurancePolicy policy,
            @RequestParam String userId) {
        cimsService.addPolicy(policy, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/submit")
    public ResponseEntity<Map<String, Object>> submitPolicy(
            @RequestParam String policyId,
            @RequestParam String userId) {
        cimsService.submitPolicyForApproval(policyId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/approve")
    public ResponseEntity<Map<String, Object>> approvePolicy(
            @RequestParam String policyId,
            @RequestParam String userId) {
        cimsService.approvePolicy(policyId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/reject")
    public ResponseEntity<Map<String, Object>> rejectPolicy(
            @RequestParam String policyId,
            @RequestParam String comments,
            @RequestParam String userId) {
        cimsService.rejectPolicy(policyId, comments, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/amend")
    public ResponseEntity<Map<String, Object>> amendPolicy(
            @RequestParam String policyId,
            @RequestBody InsurancePolicy policy,
            @RequestParam(defaultValue = "Policy terms amended by maker") String reason,
            @RequestParam String userId) {
        cimsService.amendPolicy(policyId, policy, reason, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/renew")
    public ResponseEntity<Map<String, Object>> renewPolicy(
            @RequestParam String policyId,
            @RequestParam(defaultValue = "0") double newAmount,
            @RequestParam(defaultValue = "0") double newPremium,
            @RequestParam String newExpiryDate,
            @RequestParam String userId) {
        cimsService.renewPolicy(policyId, newAmount, newPremium, newExpiryDate, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }



    // --- Customer 360 Endpoint ---
    @GetMapping("/customers/{id}/360")
    public ResponseEntity<Customer360Dto> getCustomer360(@PathVariable String id) {
        return ResponseEntity.ok(cimsService.getCustomer360(id));
    }

    // --- Collateral Exposure Breakdown ---
    @GetMapping("/collateral/{id}/exposure-summary")
    public ResponseEntity<ExposureAdequacySummaryDto> getCollateralExposureSummary(@PathVariable String id) {
        return ResponseEntity.ok(exposureCalculationService.calculateExposureAndAdequacy(id));
    }

    // --- Collateral Registration with Multi-Facility Allocations ---
    public static class CollateralRegistrationRequest {
        private Collateral collateral;
        private List<Map<String, Object>> allocations;
        private List<Map<String, Object>> documents;

        public Collateral getCollateral() { return collateral; }
        public void setCollateral(Collateral collateral) { this.collateral = collateral; }
        public List<Map<String, Object>> getAllocations() { return allocations; }
        public void setAllocations(List<Map<String, Object>> allocations) { this.allocations = allocations; }
        public List<Map<String, Object>> getDocuments() { return documents; }
        public void setDocuments(List<Map<String, Object>> documents) { this.documents = documents; }
    }

    @PostMapping("/collateral/register-with-allocations")
    public ResponseEntity<Map<String, Object>> registerCollateralWithAllocations(
            @RequestBody CollateralRegistrationRequest request,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.registerCollateralWithAllocations(
                    request.getCollateral(), request.getAllocations(), request.getDocuments(), userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/collateral/pre-validate")
    public ResponseEntity<PolicyPreValidationResultDto> preValidateCollateral(@RequestBody Map<String, Object> payload) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        Collateral collateral = null;
        List<Map<String, Object>> documents = null;
        List<Map<String, Object>> allocations = null;
        List<Map<String, Object>> owners = null;

        if (payload.containsKey("collateral")) {
            collateral = mapper.convertValue(payload.get("collateral"), Collateral.class);
            if (payload.containsKey("documents")) {
                documents = (List<Map<String, Object>>) payload.get("documents");
            }
            if (payload.containsKey("allocations")) {
                allocations = (List<Map<String, Object>>) payload.get("allocations");
            }
            if (payload.containsKey("owners")) {
                owners = (List<Map<String, Object>>) payload.get("owners");
            }
        } else {
            collateral = mapper.convertValue(payload, Collateral.class);
            if (payload.containsKey("documents")) {
                documents = (List<Map<String, Object>>) payload.get("documents");
            }
            if (payload.containsKey("allocations")) {
                allocations = (List<Map<String, Object>>) payload.get("allocations");
            }
            if (payload.containsKey("owners")) {
                owners = (List<Map<String, Object>>) payload.get("owners");
            }
        }
        return ResponseEntity.ok(cimsService.preValidateCollateralRegistration(collateral, documents, allocations, owners));
    }

    @PostMapping("/collateral/submit-exception-request")
    public ResponseEntity<?> submitCollateralExceptionRequest(
            @RequestBody EntryTimeExceptionRequest request,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.submitEntryTimeException(request, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Exception request submission failed"));
        }
    }

    @PostMapping("/collateral/{id}/allocate-facilities")
    public ResponseEntity<Map<String, Object>> allocateCollateralFacilities(
            @PathVariable String id,
            @RequestBody List<Map<String, Object>> allocations,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.allocateCollateralFacilities(id, allocations, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/collateral/{id}/request-release")
    public ResponseEntity<Map<String, Object>> requestCollateralRelease(
            @PathVariable String id,
            @RequestParam(defaultValue = "Facility settled") String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.requestCollateralRelease(id, reason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }


    // --- Enhanced Insurance Policy Lifecycle Endpoints ---
    public static class InsurancePolicyRegistrationRequest {
        private InsurancePolicy policy;
        private List<Map<String, Object>> documents;

        public InsurancePolicy getPolicy() { return policy; }
        public void setPolicy(InsurancePolicy policy) { this.policy = policy; }
        public List<Map<String, Object>> getDocuments() { return documents; }
        public void setDocuments(List<Map<String, Object>> documents) { this.documents = documents; }
    }

    @PostMapping("/policies/register")
    public ResponseEntity<Map<String, Object>> registerPolicy(
            @RequestBody Map<String, Object> payload,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            InsurancePolicy policy;
            List<Map<String, Object>> documents = null;

            if (payload.containsKey("policy")) {
                policy = mapper.convertValue(payload.get("policy"), InsurancePolicy.class);
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            } else {
                policy = mapper.convertValue(payload, InsurancePolicy.class);
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            }
            return ResponseEntity.ok(cimsService.registerInsurancePolicy(policy, documents, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Policy registration failed"));
        }
    }

    @PostMapping("/policies/pre-validate")
    public ResponseEntity<PolicyPreValidationResultDto> preValidatePolicy(@RequestBody Map<String, Object> payload) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        InsurancePolicy policy = null;
        List<Map<String, Object>> documents = null;
        if (payload.containsKey("policy")) {
            policy = mapper.convertValue(payload.get("policy"), InsurancePolicy.class);
            if (payload.containsKey("documents")) {
                documents = (List<Map<String, Object>>) payload.get("documents");
            }
        } else {
            policy = mapper.convertValue(payload, InsurancePolicy.class);
            if (payload.containsKey("documents")) {
                documents = (List<Map<String, Object>>) payload.get("documents");
            }
        }
        return ResponseEntity.ok(cimsService.preValidatePolicyRegistration(policy, documents));
    }

    @PostMapping("/policies/submit-exception-request")
    public ResponseEntity<?> submitPolicyExceptionRequest(
            @RequestBody EntryTimeExceptionRequest request,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.submitEntryTimeException(request, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Exception request submission failed"));
        }
    }

    @PostMapping("/policies/evaluate-compliance")
    public ResponseEntity<InsuranceComplianceDto> evaluateCompliance(
            @RequestParam String collateralId,
            @RequestBody(required = false) InsurancePolicy policy,
            @RequestParam(required = false) String loanAccountId) {
        InsuranceComplianceDto dto = insuranceRequirementService.evaluateCompliance(collateralId, policy, loanAccountId);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/policies/evaluate-compliance")
    public ResponseEntity<InsuranceComplianceDto> evaluateComplianceGet(
            @RequestParam String collateralId,
            @RequestParam(required = false) Double insuredAmount,
            @RequestParam(required = false) String insurerName,
            @RequestParam(required = false) String coverageType,
            @RequestParam(required = false) String effectiveDate,
            @RequestParam(required = false) String expiryDate,
            @RequestParam(required = false) String loanAccountId) {
        InsurancePolicy temp = new InsurancePolicy();
        if (insuredAmount != null) temp.setInsuredAmount(insuredAmount);
        temp.setInsurerName(insurerName);
        temp.setCoverageType(coverageType);
        temp.setEffectiveDate(effectiveDate);
        temp.setExpiryDate(expiryDate);
        InsuranceComplianceDto dto = insuranceRequirementService.evaluateCompliance(collateralId, temp, loanAccountId);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/policies/{id}/history")
    public ResponseEntity<Map<String, Object>> getPolicyHistory(@PathVariable String id) {
        try {
            return ResponseEntity.ok(cimsService.getPolicyHistory(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/amend")
    public ResponseEntity<Map<String, Object>> amendPolicyPath(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload,
            @RequestParam(required = false) String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            InsurancePolicy policy;
            List<Map<String, Object>> documents = null;
            String effectiveReason = reason;

            if (payload.containsKey("policy")) {
                policy = mapper.convertValue(payload.get("policy"), InsurancePolicy.class);
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
                if ((effectiveReason == null || effectiveReason.isBlank()) && payload.containsKey("reason")) {
                    effectiveReason = (String) payload.get("reason");
                }
            } else {
                policy = mapper.convertValue(payload, InsurancePolicy.class);
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            }
            if (effectiveReason == null || effectiveReason.isBlank()) {
                effectiveReason = "Policy terms amended by maker";
            }
            return ResponseEntity.ok(cimsService.amendPolicy(id, policy, documents, effectiveReason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/renew")
    public ResponseEntity<Map<String, Object>> renewPolicyPath(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) Double newAmount,
            @RequestParam(required = false) Double newPremium,
            @RequestParam(required = false) String newExpiryDate,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            InsurancePolicy policyToRenew = new InsurancePolicy();
            List<Map<String, Object>> documents = null;

            if (payload != null) {
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
                if (payload.containsKey("policy")) {
                    policyToRenew = mapper.convertValue(payload.get("policy"), InsurancePolicy.class);
                } else {
                    policyToRenew = mapper.convertValue(payload, InsurancePolicy.class);
                }
                if (payload.containsKey("newAmount")) {
                    policyToRenew.setInsuredAmount(((Number) payload.get("newAmount")).doubleValue());
                }
                if (payload.containsKey("newPremium")) {
                    policyToRenew.setPremium(((Number) payload.get("newPremium")).doubleValue());
                }
                if (payload.containsKey("newExpiryDate")) {
                    policyToRenew.setExpiryDate((String) payload.get("newExpiryDate"));
                }
            }

            if (newAmount != null && newAmount > 0) policyToRenew.setInsuredAmount(newAmount);
            if (newPremium != null && newPremium > 0) policyToRenew.setPremium(newPremium);
            if (newExpiryDate != null && !newExpiryDate.isBlank()) policyToRenew.setExpiryDate(newExpiryDate);
            return ResponseEntity.ok(cimsService.renewPolicy(id, policyToRenew, documents, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/endorse")
    public ResponseEntity<Map<String, Object>> endorsePolicy(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) String endorsementNo,
            @RequestParam(defaultValue = "Standard endorsement") String description,
            @RequestParam(required = false) String effectiveDate,
            @RequestParam(required = false) String documentId,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            String effNo = endorsementNo;
            String effDesc = description;
            String effDate = effectiveDate;
            String effDocId = documentId;
            List<Map<String, Object>> documents = null;

            if (payload != null) {
                if (payload.containsKey("endorsementNo")) effNo = (String) payload.get("endorsementNo");
                if (payload.containsKey("description")) effDesc = (String) payload.get("description");
                if (payload.containsKey("effectiveDate")) effDate = (String) payload.get("effectiveDate");
                if (payload.containsKey("documentId")) effDocId = (String) payload.get("documentId");
                if (payload.containsKey("documents")) documents = (List<Map<String, Object>>) payload.get("documents");
            }

            return ResponseEntity.ok(cimsService.endorsePolicy(id, effNo, effDesc, effDate, effDocId, documents, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/replace")
    public ResponseEntity<Map<String, Object>> replacePolicy(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload,
            @RequestParam(required = false) String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            InsurancePolicy replacement;
            List<Map<String, Object>> documents = null;
            String effReason = reason;

            if (payload.containsKey("replacement")) {
                replacement = mapper.convertValue(payload.get("replacement"), InsurancePolicy.class);
                if (payload.containsKey("documents")) documents = (List<Map<String, Object>>) payload.get("documents");
                if ((effReason == null || effReason.isBlank()) && payload.containsKey("reason")) {
                    effReason = (String) payload.get("reason");
                }
            } else {
                replacement = mapper.convertValue(payload, InsurancePolicy.class);
                if (payload.containsKey("documents")) documents = (List<Map<String, Object>>) payload.get("documents");
            }
            if (effReason == null || effReason.isBlank()) effReason = "Policy replacement";
            return ResponseEntity.ok(cimsService.replacePolicy(id, replacement, documents, effReason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelPolicy(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            String effReason = reason;
            List<Map<String, Object>> documents = null;
            if (payload != null) {
                if ((effReason == null || effReason.isBlank()) && payload.containsKey("reason")) {
                    effReason = (String) payload.get("reason");
                }
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            }
            if (effReason == null || effReason.isBlank()) effReason = "Borrower requested cancellation";
            return ResponseEntity.ok(cimsService.cancelPolicy(id, documents, effReason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/close")
    public ResponseEntity<Map<String, Object>> closePolicy(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            String effReason = reason;
            List<Map<String, Object>> documents = null;
            if (payload != null) {
                if ((effReason == null || effReason.isBlank()) && payload.containsKey("reason")) {
                    effReason = (String) payload.get("reason");
                }
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            }
            if (effReason == null || effReason.isBlank()) effReason = "Facility matured without claim";
            return ResponseEntity.ok(cimsService.closePolicy(id, documents, effReason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/policies/{id}/reopen")
    public ResponseEntity<Map<String, Object>> reopenPolicy(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) String reason,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            String effReason = reason;
            List<Map<String, Object>> documents = null;
            if (payload != null) {
                if ((effReason == null || effReason.isBlank()) && payload.containsKey("reason")) {
                    effReason = (String) payload.get("reason");
                }
                if (payload.containsKey("documents")) {
                    documents = (List<Map<String, Object>>) payload.get("documents");
                }
            }
            if (effReason == null || effReason.isBlank()) effReason = "Reopened for active facility coverage";
            return ResponseEntity.ok(cimsService.reopenPolicy(id, documents, effReason, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Cron / Scanning ---
    @PostMapping("/cron/run")
    public ResponseEntity<Map<String, Object>> runCron(
            @RequestParam int days,
            @RequestParam String userId) {
        cimsService.scanAndGenerateExceptions();
        return ResponseEntity.ok(Map.of("success", true, "message", "Cron executed for day offset " + days));
    }
}
