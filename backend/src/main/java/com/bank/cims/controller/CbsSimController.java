package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
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
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Autowired
    private CimsService cimsService;

    // --- CBS Customers ---
    @GetMapping("/cbs-sim/customers")
    public ResponseEntity<List<CbsCustomer>> getCbsCustomers() {
        return ResponseEntity.ok(cbsCustomerRepository.findAll());
    }

    @PostMapping("/cbs-sim/customers")
    public ResponseEntity<CbsCustomer> saveCbsCustomer(@RequestBody CbsCustomer customer) {
        if (customer.getId() == null || customer.getId().isBlank()) {
            customer.setId("cbs-cust-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (customer.getCif() == null || customer.getCif().isBlank()) {
            customer.setCif("CIF-" + (System.currentTimeMillis() % 1000000));
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
    public ResponseEntity<CbsFacility> saveCbsFacility(@RequestBody CbsFacility facility) {
        if (facility.getId() == null || facility.getId().isBlank()) {
            facility.setId("cbs-fac-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (facility.getLineCode() == null || facility.getLineCode().isBlank()) {
            facility.setLineCode("FAC-" + (System.currentTimeMillis() % 1000000));
        }
        if (facility.getLoanRefNo() == null || facility.getLoanRefNo().isBlank()) {
            facility.setLoanRefNo("LN-" + (System.currentTimeMillis() % 1000000));
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
    public ResponseEntity<CbsCollateral> saveCbsCollateral(@RequestBody CbsCollateral collateral) {
        if (collateral.getId() == null || collateral.getId().isBlank()) {
            collateral.setId("cbs-col-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (collateral.getCollateralCode() == null || collateral.getCollateralCode().isBlank()) {
            collateral.setCollateralCode("COL-" + (System.currentTimeMillis() % 1000000));
        }
        if (collateral.getDescription() == null || collateral.getDescription().isBlank()) {
            collateral.setDescription("Pledged Collateral Asset " + collateral.getCollateralCode());
        }
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) {
            collateral.setCategory("Immovable Properties");
        }
        if (collateral.getCollateralType() == null || collateral.getCollateralType().isBlank()) {
            collateral.setCollateralType("Borrower-owned");
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

    // --- Sync Engine Endpoints ---
    @PostMapping("/cbs-integration/sync/{entityType}/{id}")
    public ResponseEntity<Map<String, Object>> syncEntity(
            @PathVariable String entityType,
            @PathVariable String id,
            @RequestParam(defaultValue = "SYSADMIN") String userId) {
        
        if ("Customer".equalsIgnoreCase(entityType)) {
            return ResponseEntity.ok(cimsService.syncCbsCustomer(id, userId));
        } else if ("Facility".equalsIgnoreCase(entityType) || "Loan".equalsIgnoreCase(entityType)) {
            return ResponseEntity.ok(cimsService.syncCbsFacility(id, userId));
        } else if ("Collateral".equalsIgnoreCase(entityType)) {
            return ResponseEntity.ok(cimsService.syncCbsCollateral(id, userId));
        }
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Unknown entity type: " + entityType));
    }

    @PostMapping("/cbs-integration/sync-all")
    public ResponseEntity<Map<String, Object>> syncAll(@RequestParam(defaultValue = "SYSADMIN") String userId) {
        return ResponseEntity.ok(cimsService.syncAllPendingCbs(userId));
    }

    @GetMapping("/cbs-sim/sync-logs")
    public ResponseEntity<List<CbsSyncLog>> getSyncLogs() {
        return ResponseEntity.ok(cbsSyncLogRepository.findAllByOrderByTimestampDesc());
    }
}
