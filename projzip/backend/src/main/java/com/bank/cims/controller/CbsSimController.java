package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CbsSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CbsSimController {

    @Autowired
    private CbsCustomerRepository cbsCustomerRepository;

    @Autowired
    private CbsFacilityRepository cbsFacilityRepository;

    @Autowired
    private CbsCollateralRepository cbsCollateralRepository;

    @Autowired
    private CbsAccCollLinkDtlsRepository cbsAccCollLinkDtlsRepository;

    @Autowired
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Autowired
    private CbsSyncService cbsSyncService;

    // --- CBS Customers ---
    @GetMapping("/cbs-sim/customers")
    public ResponseEntity<List<CbsCustomer>> getCbsCustomers() {
        return ResponseEntity.ok(cbsCustomerRepository.findAll());
    }

    @PostMapping("/cbs-sim/customers")
    public ResponseEntity<?> saveCbsCustomer(@RequestBody CbsCustomer customer) {
        if (customer.getCif() == null || customer.getCif().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer CIF is required."));
        }
        String cleanCif = customer.getCif().trim();
        customer.setCif(cleanCif);

        if (customer.getFullName() == null || customer.getFullName().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer Full Name is required."));
        }

        // Uniqueness check for new customer
        if (customer.getId() == null || customer.getId().isBlank()) {
            if (cbsCustomerRepository.findByCifIgnoreCase(cleanCif).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Customer with CIF " + cleanCif + " already exists."));
            }
            customer.setId("cbs-cust-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (customer.getCustomerType() == null || customer.getCustomerType().isBlank()) {
            customer.setCustomerType("Individual");
        }
        if (customer.getBusinessSegment() == null || customer.getBusinessSegment().isBlank()) {
            customer.setBusinessSegment("Retail Banking");
        }
        if (customer.getBranch() == null || customer.getBranch().isBlank()) {
            customer.setBranch("Main Branch");
        }
        if (customer.getCustomerStatus() == null || customer.getCustomerStatus().isBlank()) {
            customer.setCustomerStatus("Active");
        }

        customer.setSyncStatus("Not Synced");
        return ResponseEntity.ok(cbsCustomerRepository.save(customer));
    }

    // --- CBS Facilities ---
    @GetMapping("/cbs-sim/facilities")
    public ResponseEntity<List<CbsFacility>> getCbsFacilities() {
        return ResponseEntity.ok(cbsFacilityRepository.findAll());
    }

    @PostMapping("/cbs-sim/facilities")
    public ResponseEntity<?> saveCbsFacility(@RequestBody CbsFacility facility) {
        if (facility.getCustomerCif() == null || facility.getCustomerCif().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer CIF is required for facility."));
        }
        String cleanCif = facility.getCustomerCif().trim();
        facility.setCustomerCif(cleanCif);

        // Realistic foreign validation: Customer CIF must exist in CBS
        if (cbsCustomerRepository.findByCifIgnoreCase(cleanCif).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer CIF '" + cleanCif + "' does not exist in CBS. Register the customer first."));
        }

        if (facility.getLoanRefNo() == null || facility.getLoanRefNo().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Loan Reference Number is required."));
        }
        String cleanLoanRef = facility.getLoanRefNo().trim();
        facility.setLoanRefNo(cleanLoanRef);

        if (facility.getApprovedLimit() < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Approved Limit cannot be negative."));
        }
        if (facility.getOutstandingAmount() < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Outstanding Amount cannot be negative."));
        }

        if (facility.getId() == null || facility.getId().isBlank()) {
            if (cbsFacilityRepository.findByLoanRefNo(cleanLoanRef).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Facility with Loan Reference " + cleanLoanRef + " already exists."));
            }
            facility.setId("cbs-fac-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (facility.getLineCode() == null || facility.getLineCode().isBlank()) {
            facility.setLineCode("FAC-" + cleanLoanRef);
        }
        if (facility.getFacilityType() == null || facility.getFacilityType().isBlank()) {
            facility.setFacilityType("Term Loan");
        }
        if (facility.getBusinessSegment() == null || facility.getBusinessSegment().isBlank()) {
            facility.setBusinessSegment("Corporate Banking");
        }
        if (facility.getBranch() == null || facility.getBranch().isBlank()) {
            facility.setBranch("Main Branch");
        }
        if (facility.getLineStartDate() == null || facility.getLineStartDate().isBlank()) {
            facility.setLineStartDate("2026-01-01");
        }
        if (facility.getLineExpiryDate() == null || facility.getLineExpiryDate().isBlank()) {
            facility.setLineExpiryDate("2029-01-01");
        }
        if (facility.getLimitStatus() == null || facility.getLimitStatus().isBlank()) {
            facility.setLimitStatus("Active");
        }

        facility.setAvailableAmount(Math.max(0, facility.getApprovedLimit() - facility.getOutstandingAmount()));
        facility.setSyncStatus("Not Synced");
        return ResponseEntity.ok(cbsFacilityRepository.save(facility));
    }

    // --- CBS Collaterals ---
    @GetMapping("/cbs-sim/collaterals")
    public ResponseEntity<List<CbsCollateral>> getCbsCollaterals() {
        return ResponseEntity.ok(cbsCollateralRepository.findAll());
    }

    @PostMapping("/cbs-sim/collaterals")
    public ResponseEntity<?> saveCbsCollateral(@RequestBody CbsCollateral collateral) {
        if (collateral.getCustomerCif() == null || collateral.getCustomerCif().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer CIF is required for collateral."));
        }
        String cleanCif = collateral.getCustomerCif().trim();
        collateral.setCustomerCif(cleanCif);

        // Realistic foreign validation: Customer CIF must exist in CBS
        if (cbsCustomerRepository.findByCifIgnoreCase(cleanCif).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Customer CIF '" + cleanCif + "' does not exist in CBS. Register the customer first."));
        }

        if (collateral.getCollateralCode() == null || collateral.getCollateralCode().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Collateral Code is required."));
        }
        String cleanCode = collateral.getCollateralCode().trim();
        collateral.setCollateralCode(cleanCode);

        if (collateral.getCollateralValue() < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Collateral Value cannot be negative."));
        }
        if (collateral.getHaircut() < 0 || collateral.getHaircut() > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "Haircut percentage must be between 0 and 100."));
        }

        if (collateral.getId() == null || collateral.getId().isBlank()) {
            if (cbsCollateralRepository.findByCollateralCode(cleanCode).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Collateral with Code " + cleanCode + " already exists."));
            }
            collateral.setId("cbs-col-" + UUID.randomUUID().toString().substring(0, 8));
        }

        if (collateral.getDescription() == null || collateral.getDescription().isBlank()) {
            collateral.setDescription("Pledged Collateral Asset " + cleanCode);
        }
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) {
            collateral.setCategory("Immovable Properties");
        }
        if (collateral.getCollateralType() == null || collateral.getCollateralType().isBlank()) {
            collateral.setCollateralType("Building");
        }
        if (collateral.getOwnershipType() == null || collateral.getOwnershipType().isBlank()) {
            collateral.setOwnershipType("Borrower-owned");
        }
        if (collateral.getCurrency() == null || collateral.getCurrency().isBlank()) {
            collateral.setCurrency("ETB");
        }
        if (collateral.getBusinessSegment() == null || collateral.getBusinessSegment().isBlank()) {
            collateral.setBusinessSegment("Corporate Banking");
        }
        if (collateral.getBranch() == null || collateral.getBranch().isBlank()) {
            collateral.setBranch("Main Branch");
        }
        if (collateral.getStartDate() == null || collateral.getStartDate().isBlank()) {
            collateral.setStartDate("2026-01-01");
        }
        if (collateral.getLinkageType() == null || collateral.getLinkageType().isBlank()) {
            collateral.setLinkageType("Primary");
        }

        collateral.setLimitContribution(collateral.getCollateralValue() * (1.0 - (collateral.getHaircut() / 100.0)));
        collateral.setSyncStatus("Not Synced");
        return ResponseEntity.ok(cbsCollateralRepository.save(collateral));
    }

    // --- CBS Linkages ---
    @GetMapping("/cbs-sim/links")
    public ResponseEntity<List<CbsAccCollLinkDtls>> getCbsLinks() {
        return ResponseEntity.ok(cbsAccCollLinkDtlsRepository.findAll());
    }

    @PostMapping("/cbs-sim/links")
    public ResponseEntity<?> saveCbsLink(@RequestBody CbsAccCollLinkDtls link) {
        if (link.getAccountNumber() == null || link.getAccountNumber().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Account number / loan reference is required for linkage."));
        }
        if (link.getLinkedReferenceNo() == null || link.getLinkedReferenceNo().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Linked reference / collateral code is required for linkage."));
        }
        if (link.getId() == null || link.getId().isBlank()) {
            link.setId("cbs-lnk-" + UUID.randomUUID().toString().substring(0, 8));
        }
        link.setSyncStatus("Not Synced");
        return ResponseEntity.ok(cbsAccCollLinkDtlsRepository.save(link));
    }

    // --- Sync Engine Endpoints (Forward to Authoritative CbsSyncService) ---
    @PostMapping("/cbs-integration/sync/{entityType}/{id}")
    public ResponseEntity<?> syncEntity(
            @PathVariable String entityType,
            @PathVariable String id,
            @RequestParam(defaultValue = "SYSADMIN") String userId) {

        try {
            if ("Customer".equalsIgnoreCase(entityType)) {
                return ResponseEntity.ok(cbsSyncService.syncCustomerFromCbs(id, userId));
            } else if ("Facility".equalsIgnoreCase(entityType) || "Loan".equalsIgnoreCase(entityType)) {
                return ResponseEntity.ok(cbsSyncService.syncFacilityFromCbs(id, userId));
            } else if ("Collateral".equalsIgnoreCase(entityType)) {
                return ResponseEntity.ok(cbsSyncService.syncCollateralFromCbs(id, userId));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Unknown entity type: " + entityType));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/cbs-integration/sync-all")
    public ResponseEntity<?> syncAll(@RequestParam(defaultValue = "SYSADMIN") String userId) {
        try {
            return ResponseEntity.ok(cbsSyncService.syncAllFromCbs(userId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cbs-sim/sync-logs")
    public ResponseEntity<List<CbsSyncLog>> getSyncLogs() {
        return ResponseEntity.ok(cbsSyncLogRepository.findAllByOrderByTimestampDesc());
    }
}
