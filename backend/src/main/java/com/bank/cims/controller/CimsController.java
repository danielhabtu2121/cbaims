package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.ExposureCalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
    private com.bank.cims.service.cbs.CbsGateway cbsGateway;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OwnershipTransferRepository ownershipTransferRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private com.bank.cims.service.InsuranceRequirementService insuranceRequirementService;

    @Autowired
    private com.bank.cims.service.CollateralFacilityRelationshipService collateralFacilityRelationshipService;

    @Autowired
    private com.bank.cims.service.AuthorizationScopeService authorizationScopeService;

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    private String currentActorUsername() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()) {
            throw new IllegalArgumentException("Authentication required: a valid signed-in user could not be identified.");
        }
        return actor.getUsername();
    }

    @Autowired(required = false)
    private com.bank.cims.service.DashboardService dashboardService;

    private record PagedScope(String segment, boolean applyBranchFilter, List<String> branches) {}

    private PagedScope resolvePagedScope(jakarta.servlet.http.HttpServletRequest request, String requestedSegment) {
        String seg = (requestedSegment != null && !"ALL".equalsIgnoreCase(requestedSegment.trim()) && !requestedSegment.isBlank())
                ? requestedSegment.trim() : null;
        if (request == null || dashboardService == null) {
            return new PagedScope(seg, false, List.of("__NONE__"));
        }
        User authUser = (User) request.getAttribute("authenticatedUser");
        String userId = authUser != null ? authUser.getId() : request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            return new PagedScope(seg, false, List.of("__NONE__"));
        }
        try {
            com.bank.cims.service.DashboardService.ResolvedScope scope = dashboardService.resolveUserScope(userId, seg, null, null);
            String effSeg = scope.effectiveSegment;
            // Lock non-privileged segment/officer users to their assigned segment if they have one
            String roleUpper = scope.role != null ? scope.role.toUpperCase() : "";
            boolean isPrivilegedAllSeg = List.of("EXEC", "SRMGMT", "SYSADMIN", "AUDITOR", "COMPLIANCE", "RISK", "MGRCOLLDOC", "DISTDIR", "BRMGR").contains(roleUpper);
            if (!isPrivilegedAllSeg && scope.user != null && scope.user.getSegment() != null
                    && !scope.user.getSegment().isBlank() && !"ALL".equalsIgnoreCase(scope.user.getSegment().trim())) {
                effSeg = scope.user.getSegment().trim();
            }
            if (scope.isBankWide()) {
                return new PagedScope(effSeg, false, List.of("__NONE__"));
            }
            if (scope.effectiveBranch != null && !scope.effectiveBranch.isBlank()) {
                return new PagedScope(effSeg, true, List.of(scope.effectiveBranch.trim().toUpperCase()));
            }
            if (scope.allowedBranches != null && !scope.allowedBranches.isEmpty()) {
                List<String> upperBranches = scope.allowedBranches.stream()
                        .filter(b -> b != null && !b.isBlank())
                        .map(b -> b.trim().toUpperCase())
                        .toList();
                if (!upperBranches.isEmpty()) {
                    return new PagedScope(effSeg, true, upperBranches);
                }
            }
            return new PagedScope(effSeg, false, List.of("__NONE__"));
        } catch (IllegalArgumentException ex) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, ex.getMessage());
        }
    }

    @GetMapping("/state")
    public ResponseEntity<Map<String, Object>> getState() {
        return ResponseEntity.ok(cimsService.getAuthorizedState());
    }

    @GetMapping("/customers/paged")
    public ResponseEntity<Page<Customer>> getPagedCustomers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String segment,
            jakarta.servlet.http.HttpServletRequest request) {
        PagedScope pScope = resolvePagedScope(request, segment);
        String q = (search != null && !search.isBlank()) ? search.trim() : null;
        int safeSize = Math.min(Math.max(size, 1), 200);
        return ResponseEntity.ok(customerRepository.findPaged(
                q, pScope.segment(), pScope.applyBranchFilter(), pScope.branches(),
                PageRequest.of(Math.max(page, 0), safeSize)));
    }

    @GetMapping("/facilities/paged")
    public ResponseEntity<Page<LoanAccount>> getPagedFacilities(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String segment,
            jakarta.servlet.http.HttpServletRequest request) {
        PagedScope pScope = resolvePagedScope(request, segment);
        String q = (search != null && !search.isBlank()) ? search.trim() : null;
        int safeSize = Math.min(Math.max(size, 1), 200);
        Page<LoanAccount> result = loanAccountRepository.findPaged(
                q, pScope.segment(), pScope.applyBranchFilter(), pScope.branches(),
                PageRequest.of(Math.max(page, 0), safeSize));
        List<LoanAccount> items = result.getContent();
        if (!items.isEmpty()) {
            List<String> loanIds = items.stream().map(LoanAccount::getId).toList();
            Map<String, Integer> countByLoanId = new java.util.HashMap<>();
            for (Object[] row : loanCollateralLinkRepository.countActiveCollateralsByLoanAccountIds(loanIds)) {
                if (row[0] != null && row[1] != null) {
                    countByLoanId.put(row[0].toString(), ((Number) row[1]).intValue());
                }
            }
            java.util.Set<String> custIds = items.stream()
                    .map(LoanAccount::getCustomerId)
                    .filter(id -> id != null && !id.isBlank())
                    .collect(java.util.stream.Collectors.toSet());
            Map<String, String> custNameById = new java.util.HashMap<>();
            if (!custIds.isEmpty()) {
                for (Customer c : customerRepository.findAllById(custIds)) {
                    custNameById.put(c.getId(), c.getName());
                }
            }
            for (LoanAccount la : items) {
                la.setLinkedAssetCount(countByLoanId.getOrDefault(la.getId(), 0));
                if (la.getCustomerId() != null && custNameById.containsKey(la.getCustomerId())) {
                    la.setCustomerName(custNameById.get(la.getCustomerId()));
                }
            }
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/collaterals/paged")
    public ResponseEntity<Page<Collateral>> getPagedCollaterals(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String origin,
            jakarta.servlet.http.HttpServletRequest request) {
        PagedScope pScope = resolvePagedScope(request, segment);
        String orig = (origin != null && !"ALL".equalsIgnoreCase(origin)) ? origin.trim() : null;
        String q = (search != null && !search.isBlank()) ? search.trim() : null;
        int safeSize = Math.min(Math.max(size, 1), 200);
        return ResponseEntity.ok(collateralRepository.findPaged(
                q, pScope.segment(), orig, pScope.applyBranchFilter(), pScope.branches(),
                PageRequest.of(Math.max(page, 0), safeSize)));
    }

    @GetMapping("/config/system-date")
    public ResponseEntity<Map<String, String>> getSystemDate() {
        return ResponseEntity.ok(Map.of("systemDate", cimsService.getSimulatedSystemDate()));
    }

    @PostMapping("/config/system-date")
    public ResponseEntity<Map<String, String>> setSystemDate(
            @RequestBody(required = false) Map<String, String> payload,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.assertUserPermission(userId, "System Settings", "EDIT");
        String d = payload != null ? payload.get("systemDate") : null;
        cimsService.setSimulatedSystemDate(d);
        return ResponseEntity.ok(Map.of("systemDate", cimsService.getSimulatedSystemDate()));
    }

    // --- Business Segments ---
    @PostMapping("/segments/add")
    public ResponseEntity<Map<String, Object>> addSegment(
            @RequestBody BusinessSegment segment,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.assertUserPermission(userId, "Business Segments", "EDIT");
        cimsService.addBusinessSegment(segment, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/segments/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleSegmentStatus(
            @RequestParam String segmentId,
            @RequestParam boolean active,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.assertUserPermission(userId, "Business Segments", "EDIT");
        cimsService.toggleSegmentActiveStatus(segmentId, active, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Ownership Transfers ---
    @PostMapping("/transfers/initiate")
    public ResponseEntity<Map<String, Object>> initiateTransfer(
            @RequestParam String collateralId,
            @RequestParam String destinationSegment,
            @RequestParam String reason,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
    public ResponseEntity<?> approveTransfer(
            @RequestParam String transferId,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        final String actor = userId;
        cimsService.assertUserPermission(userId, "Collateral", "APPROVE");
        OwnershipTransfer trf = ownershipTransferRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("Ownership transfer request not found: " + transferId));
        if (!"Pending".equalsIgnoreCase(trf.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Only transfers in Pending status can be approved. Current status: " + trf.getStatus()));
        }
        if (trf.getRequestedBy() != null && trf.getRequestedBy().equalsIgnoreCase(userId)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Dual control violation: Requester (" + trf.getRequestedBy() + ") cannot approve their own segment transfer."));
        }
        boolean destActive = businessSegmentRepository.findById(trf.getDestinationSegment())
                .or(() -> businessSegmentRepository.findAll().stream().filter(s -> trf.getDestinationSegment().equalsIgnoreCase(s.getName()) || trf.getDestinationSegment().equalsIgnoreCase(s.getCode())).findFirst())
                .map(BusinessSegment::isActive)
                .orElse(false);
        if (!destActive) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Destination segment '" + trf.getDestinationSegment() + "' is inactive or not found."));
        }

        trf.setStatus("Approved");
        trf.setApprovedBy(userId);
        trf.setApprovedAt(java.time.LocalDate.now().toString());
        ownershipTransferRepository.save(trf);

        collateralRepository.findById(trf.getCollateralId()).ifPresent(col -> {
            String oldSeg = col.getOwningSegment();
            col.setOwningSegment(trf.getDestinationSegment());
            collateralRepository.save(col);
            cimsService.logAudit(actor, "HODEPT", "APPROVE_OWNERSHIP_TRANSFER", "Collateral", col.getId(), "Segment", oldSeg, trf.getDestinationSegment(), "Approved segment transfer");
        });
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/transfers/reject")
    public ResponseEntity<?> rejectTransfer(
            @RequestParam String transferId,
            @RequestParam String remarks,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.assertUserPermission(userId, "Collateral", "APPROVE");
        OwnershipTransfer trf = ownershipTransferRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("Ownership transfer request not found: " + transferId));
        if (!"Pending".equalsIgnoreCase(trf.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Only transfers in Pending status can be rejected. Current status: " + trf.getStatus()));
        }
        if (trf.getRequestedBy() != null && trf.getRequestedBy().equalsIgnoreCase(userId)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Dual control violation: Requester (" + trf.getRequestedBy() + ") cannot reject their own segment transfer."));
        }
        trf.setStatus("Rejected");
        trf.setApprovedBy(userId);
        trf.setApprovedAt(java.time.LocalDate.now().toString());
        trf.setRemarks(remarks);
        ownershipTransferRepository.save(trf);
        cimsService.logAudit(userId, "HODEPT", "REJECT_OWNERSHIP_TRANSFER", "OwnershipTransfer", transferId, "Status", "Pending", "Rejected", remarks);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Customers ---
    // Accepts both paths: /customers/add is what the CIMS front-end calls; the original
    // /customers/register-manual path is kept working too in case anything else targets it.
    @PostMapping({"/customers/add", "/customers/register-manual"})
    public ResponseEntity<Map<String, Object>> registerManualCustomer(
            @RequestBody Customer customer,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        String effUserId = currentActorUsername();

        if (customer == null || customer.getName() == null || customer.getName().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Customer name is mandatory."));
        }
        if (customer.getSegment() == null || customer.getSegment().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Business segment is mandatory."));
        }

        String suppliedCif = customer.getCif() != null ? customer.getCif().trim() : "";
        if (!suppliedCif.isBlank()) {
            // 1. CBS Sourced CIF validation & duplicate check
            if (customerRepository.findByCif(suppliedCif).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Duplicate Customer: A customer with CIF '" + suppliedCif + "' already exists in CIMS."
                ));
            }
            try {
                var cbsCustOpt = cbsGateway.fetchCustomerByCif(suppliedCif);
                if (cbsCustOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "error", "Invalid CIF: Customer with CIF '" + suppliedCif + "' was not found in Core Banking System."
                    ));
                }
            } catch (Exception e) {
                // If CBS simulator/adapter threw an exception, fail closed
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "Core Banking System CIF verification error: " + e.getMessage()
                    ));
            }
        } else {
            // 2. Third-Party Owner / Non-CIF Customer Duplicate Detection (Audit Finding 20)
            if (customer.getNationalId() != null && !customer.getNationalId().trim().isBlank()) {
                var dup = customerRepository.findFirstByNationalIdIgnoreCase(customer.getNationalId().trim());
                if (dup.isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "error", "Duplicate Customer: A customer with National ID '" + customer.getNationalId() + "' already exists (" + dup.get().getName() + ")."
                    ));
                }
            }
            if (customer.getTaxIdNo() != null && !customer.getTaxIdNo().trim().isBlank()) {
                var dup = customerRepository.findFirstByTaxIdNoIgnoreCase(customer.getTaxIdNo().trim());
                if (dup.isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "error", "Duplicate Customer: A customer with Tax ID '" + customer.getTaxIdNo() + "' already exists (" + dup.get().getName() + ")."
                    ));
                }
            }
            if (customer.getBusinessRegNo() != null && !customer.getBusinessRegNo().trim().isBlank()) {
                var dup = customerRepository.findFirstByBusinessRegNoIgnoreCase(customer.getBusinessRegNo().trim());
                if (dup.isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "error", "Duplicate Customer: A customer with Business Reg No '" + customer.getBusinessRegNo() + "' already exists (" + dup.get().getName() + ")."
                    ));
                }
            }
        }

        if (customer.getId() == null || customer.getId().isBlank()) {
            customer.setId("cust-" + System.currentTimeMillis());
        }
        if (suppliedCif.isBlank()) {
            customer.setCif(null);
            customer.setIdentificationType("UNREGISTERED_THIRD_PARTY");
        } else {
            customer.setCif(suppliedCif);
            customer.setIdentificationType("CBS_CIF");
        }
        customer.setStatus("Pending Approval");
        customer.setSource(suppliedCif.isBlank() ? "Manual_ThirdParty" : "Manual_CBS");
        customer.setRecordStat("U");
        customer.setAuthStat("U");
        customer.setMakerId(effUserId);
        customer.setMakerDtStamp(java.time.LocalDateTime.now().toString());
        customerRepository.save(customer);

        String approverRole = cimsService.resolveCustomerApproverRole();
        cimsService.submitToWorkflow("PROC_CUSTOMER_REGISTRATION", "Customer", customer.getId(), "Register Customer Manually", "{}", "Manual customer registration", effUserId, approverRole);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Customer Maintain (post-registration edits, maker-checker) ---
    @PostMapping("/customers/{id}/update")
    public ResponseEntity<Map<String, Object>> updateCustomer(
            @PathVariable String id,
            @RequestBody Map<String, Object> changes,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        try {
            return ResponseEntity.ok(cimsService.changeCollateralOwnership(id, payload, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Collateral Master & 360 Endpoints ---
    @GetMapping({"/collateral", "/collaterals"})
    public ResponseEntity<List<Collateral>> getAllCollateral(@RequestParam(required = false) String origin) {
        com.bank.cims.service.AuthorizationScopeService.Scope scope = authorizationScopeService.currentScope();
        List<Collateral> source = (origin != null && !origin.isBlank() && !"ALL".equalsIgnoreCase(origin))
                ? collateralRepository.findByOriginType(origin.toUpperCase())
                : collateralRepository.findAll();
        if (scope == null || scope.isBankWide()) {
            return ResponseEntity.ok(source);
        }
        Set<String> customerIds = customerRepository.findAll().stream()
                .filter(scope::allowsCustomer)
                .flatMap(c -> java.util.stream.Stream.of(c.getId(), c.getCif()))
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        return ResponseEntity.ok(source.stream()
                .filter(c -> scope.allowsCollateral(c, customerIds))
                .toList());
    }

    @GetMapping("/collateral/{id}")
    public ResponseEntity<Collateral> getCollateralById(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
        return collateralRepository.findById(id)
                .or(() -> collateralRepository.findByCode(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/collateral/{id}/360")
    public ResponseEntity<Collateral360Dto> getCollateral360(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
        return ResponseEntity.ok(cimsService.getCollateral360(id));
    }

    @GetMapping("/collateral/{id}/document-checklist")
    public ResponseEntity<List<Collateral360Dto.DocumentChecklistItemDto>> getCollateralDocumentChecklist(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
        return ResponseEntity.ok(cimsService.getMandatoryDocumentChecklist(id));
    }

    @GetMapping({"/collateral/taxonomy", "/collateral/taxonomies"})
    public ResponseEntity<List<CollateralTaxonomy>> getCollateralTaxonomy() {
        return ResponseEntity.ok(cimsService.getCollateralTaxonomy());
    }

    @GetMapping({"/collateral/document-matrix", "/collateral/mandatory-document-rules"})
    public ResponseEntity<List<MandatoryDocumentRule>> getMandatoryDocumentRules() {
        return ResponseEntity.ok(cimsService.getMandatoryDocumentRules());
    }

    @GetMapping("/collateral/{id}/facilities")
    public ResponseEntity<List<Collateral360Dto.LinkedFacilityDetailDto>> getLinkedFacilitiesForCollateral(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
        Collateral360Dto dto = cimsService.getCollateral360(id);
        return ResponseEntity.ok(dto.getLinkedFacilities());
    }

    @GetMapping("/collateral/{id}/owners")
    public ResponseEntity<Map<String, Object>> getCollateralOwners(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        try {
            return ResponseEntity.ok(cimsService.updateCollateralOwner(id, ownerId, owner, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/customers/{customerId}/collateral")
    public ResponseEntity<List<Collateral>> getCollateralsForCustomer(@PathVariable String customerId) {
        cimsService.assertCustomerAccess(customerId);
        return ResponseEntity.ok(collateralRepository.findByCustomerId(customerId));
    }

    @GetMapping("/facilities/{facilityId}/collateral")
    public ResponseEntity<List<Collateral>> getCollateralsForFacility(@PathVariable String facilityId) {
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByLoanAccountId(facilityId);
        List<String> colIds = links.stream().map(LoanCollateralLink::getCollateralId).distinct().toList();
        return ResponseEntity.ok(collateralRepository.findAllById(colIds).stream()
                .filter(c -> {
                    try {
                        cimsService.assertCollateralAccess(c.getId());
                        return true;
                    } catch (RuntimeException denied) {
                        return false;
                    }
                })
                .toList());
    }

    @GetMapping("/collateral/validate-release")
    public ResponseEntity<Map<String, Object>> validateRelease(@RequestParam String collateralId) {
        cimsService.assertCollateralAccess(collateralId);
        return ResponseEntity.ok(cimsService.validateCollateralRelease(collateralId));
    }

    @PostMapping("/collateral/register-native")
    public ResponseEntity<Map<String, Object>> registerNativeCollateral(
            @RequestBody Collateral collateral,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.registerNativeCollateral(collateral, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Junction Links ---
    @PostMapping("/links/add")
    public ResponseEntity<Map<String, Object>> addLink(
            @RequestParam String loanId,
            @RequestParam String collateralId,
            @RequestParam double amount,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String linkageType,
            @RequestParam(required = false) String effectiveDate,
            @RequestParam(required = false) String endDate) {
        userId = currentActorUsername();
        cimsService.addLink(loanId, collateralId, amount, userId, linkageType, effectiveDate, endDate);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/links/remove")
    public ResponseEntity<Map<String, Object>> removeLink(
            @RequestParam String linkId,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.removeLink(linkId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    // --- Policy Operations ---
    @PostMapping("/policies/add")
    public ResponseEntity<Map<String, Object>> addPolicy(
            @RequestBody InsurancePolicy policy,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.addPolicy(policy, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/submit")
    public ResponseEntity<Map<String, Object>> submitPolicy(
            @RequestParam String policyId,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.submitPolicyForApproval(policyId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/approve")
    public ResponseEntity<Map<String, Object>> approvePolicy(
            @RequestParam String policyId,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.approvePolicy(policyId, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/reject")
    public ResponseEntity<Map<String, Object>> rejectPolicy(
            @RequestParam String policyId,
            @RequestParam String comments,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.rejectPolicy(policyId, comments, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/amend")
    public ResponseEntity<Map<String, Object>> amendPolicy(
            @RequestParam String policyId,
            @RequestBody InsurancePolicy policy,
            @RequestParam(defaultValue = "Policy terms amended by maker") String reason,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.amendPolicy(policyId, policy, reason, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }

    @PostMapping("/policies/renew")
    public ResponseEntity<Map<String, Object>> renewPolicy(
            @RequestParam String policyId,
            @RequestParam(defaultValue = "0") double newAmount,
            @RequestParam(defaultValue = "0") double newPremium,
            @RequestParam String newExpiryDate,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.renewPolicy(policyId, newAmount, newPremium, newExpiryDate, userId);
        return ResponseEntity.ok(cimsService.getFullState());
    }



    // --- Customer 360 Endpoint ---
    @GetMapping("/customers/{id}/360")
    public ResponseEntity<Customer360Dto> getCustomer360(@PathVariable String id) {
        cimsService.assertCustomerAccess(id);
        return ResponseEntity.ok(cimsService.getCustomer360(id));
    }

    // --- Collateral Exposure Breakdown ---
    @GetMapping("/collateral/{id}/exposure-summary")
    public ResponseEntity<ExposureAdequacySummaryDto> getCollateralExposureSummary(@PathVariable String id) {
        cimsService.assertCollateralAccess(id);
        return ResponseEntity.ok(exposureCalculationService.calculateExposureAndAdequacy(id));
    }

    // --- Collateral Registration with Multi-Facility Allocations ---
    public static class CollateralRegistrationRequest {
        private Collateral collateral;
        private List<Map<String, Object>> allocations;
        private List<Map<String, Object>> documents;
        private List<Map<String, Object>> exceptions;
        private boolean isDraft;

        public Collateral getCollateral() { return collateral; }
        public void setCollateral(Collateral collateral) { this.collateral = collateral; }
        public List<Map<String, Object>> getAllocations() { return allocations; }
        public void setAllocations(List<Map<String, Object>> allocations) { this.allocations = allocations; }
        public List<Map<String, Object>> getDocuments() { return documents; }
        public void setDocuments(List<Map<String, Object>> documents) { this.documents = documents; }
        public List<Map<String, Object>> getExceptions() { return exceptions; }
        public void setExceptions(List<Map<String, Object>> exceptions) { this.exceptions = exceptions; }
        @com.fasterxml.jackson.annotation.JsonProperty("isDraft")
        public boolean isDraft() { return isDraft; }
        @com.fasterxml.jackson.annotation.JsonProperty("isDraft")
        public void setDraft(boolean isDraft) { this.isDraft = isDraft; }
        public void setIsDraft(boolean isDraft) { this.isDraft = isDraft; }
    }

    @PostMapping("/collateral/register-with-allocations")
    public ResponseEntity<Map<String, Object>> registerCollateralWithAllocations(
            @RequestBody CollateralRegistrationRequest request,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        try {
            return ResponseEntity.ok(cimsService.registerCollateralWithAllocations(
                    request.getCollateral(), request.getAllocations(), request.getDocuments(),
                    request.getExceptions(), request.isDraft(), userId));
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
        List<Map<String, Object>> exceptions = null;

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
            if (payload.containsKey("exceptions")) {
                exceptions = (List<Map<String, Object>>) payload.get("exceptions");
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
            if (payload.containsKey("exceptions")) {
                exceptions = (List<Map<String, Object>>) payload.get("exceptions");
            }
        }
        return ResponseEntity.ok(cimsService.preValidateCollateralRegistration(collateral, documents, allocations, owners, exceptions));
    }

    @PostMapping("/collateral/submit-exception-request")
    public ResponseEntity<?> submitCollateralExceptionRequest(
            @RequestBody EntryTimeExceptionRequest request,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(defaultValue = "false") boolean fullReplacement,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        try {
            return ResponseEntity.ok(collateralFacilityRelationshipService.allocateCollateralFacilities(id, allocations, fullReplacement, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/collateral/{id}/request-release")
    public ResponseEntity<Map<String, Object>> requestCollateralRelease(
            @PathVariable String id,
            @RequestParam(defaultValue = "Facility settled") String reason,
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
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
            @RequestParam(required = false) String userId) {
        userId = currentActorUsername();
        cimsService.scanAndGenerateExceptions();
        return ResponseEntity.ok(Map.of("success", true, "message", "Cron executed for day offset " + days));
    }
}
