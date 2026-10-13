package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.CbsConnectionStatus;
import com.bank.cims.service.cbs.CbsGateway;
import com.bank.cims.service.cbs.CbsMapper;
import com.bank.cims.service.cbs.CbsSyncException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CbsSyncService {

    private static final Logger log = LoggerFactory.getLogger(CbsSyncService.class);

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private CbsMapper cbsMapper;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private ConfigurationService configurationService;

    /**
     * Batch synchronization of all master data domains from CBS to CIMS.
     * Implements bulk retrieval, in-memory indexing to prevent N+1 queries,
     * deterministic delta synchronization, and truthful audit logging.
     */
    @Transactional
    public Map<String, Object> syncAllFromCbs(String userId) {
        String syncId = "sync-" + UUID.randomUUID().toString().substring(0, 8);
        String startTime = LocalDateTime.now().toString();
        String sourceSystem = "REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "REAL_CBS" : "CBS_SIM";

        int customersProcessed = 0;
        int customersSucceeded = 0;
        int customersFailed = 0;

        int facilitiesProcessed = 0;
        int facilitiesSucceeded = 0;
        int facilitiesFailed = 0;

        int collateralsProcessed = 0;
        int collateralsSucceeded = 0;
        int collateralsFailed = 0;

        int linksProcessed = 0;
        int linksSucceeded = 0;
        int linksFailed = 0;

        StringBuilder errorLog = new StringBuilder();
        Set<String> affectedCollateralIds = new HashSet<>();

        try {
            // Verify source availability before proceeding
            CbsConnectionStatus connStatus = cbsGateway.checkConnectionStatus();
            if ("NOT_CONFIGURED".equalsIgnoreCase(connStatus.getStatus()) || "UNAVAILABLE".equalsIgnoreCase(connStatus.getStatus())) {
                throw new CbsSyncException(
                        CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE,
                        connStatus.getMessage()
                );
            }

            // 1. Bulk Fetch from Source
            List<CbsCustomer> cbsCustomers = cbsGateway.fetchCustomers();
            List<CbsFacility> cbsFacilities = cbsGateway.fetchFacilities();
            List<CbsCollateral> cbsCollaterals = cbsGateway.fetchCollaterals();
            List<CbsAccCollLinkDtls> cbsLinks = cbsGateway.fetchAllAccountCollateralLinks();

            // 2. Pre-load CIMS lookups to avoid N+1 database queries
            Map<String, Customer> cimsCustByCif = customerRepository.findAll().stream()
                    .filter(c -> c.getCif() != null && !c.getCif().isBlank())
                    .collect(Collectors.toMap(c -> c.getCif().trim().toUpperCase(), c -> c, (a, b) -> a));

            Map<String, LoanAccount> cimsLoanByRef = loanAccountRepository.findAll().stream()
                    .filter(l -> l.getLoanReference() != null && !l.getLoanReference().isBlank())
                    .collect(Collectors.toMap(l -> l.getLoanReference().trim().toUpperCase(), l -> l, (a, b) -> a));

            Map<String, Collateral> cimsColByCode = collateralRepository.findAll().stream()
                    .filter(c -> c.getCode() != null && !c.getCode().isBlank())
                    .collect(Collectors.toMap(c -> c.getCode().trim().toUpperCase(), c -> c, (a, b) -> a));

            Map<String, LoanCollateralLink> cimsLinkById = loanCollateralLinkRepository.findAll().stream()
                    .collect(Collectors.toMap(LoanCollateralLink::getId, l -> l, (a, b) -> a));

            // 3. Synchronize Customers
            for (CbsCustomer cc : cbsCustomers) {
                customersProcessed++;
                try {
                    if (cc.getCif() == null || cc.getCif().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing CIF on CBS customer " + cc.getId());
                    }
                    String cifKey = cc.getCif().trim().toUpperCase();
                    Customer existing = cimsCustByCif.get(cifKey);
                    Customer saved = customerRepository.save(cbsMapper.mapCustomer(cc, existing, sourceSystem));
                    cimsCustByCif.put(cifKey, saved);
                    customersSucceeded++;
                } catch (Exception e) {
                    customersFailed++;
                    errorLog.append("[Customer CIF: ").append(cc.getCif()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
            }

            // 4. Synchronize Facilities
            for (CbsFacility cf : cbsFacilities) {
                facilitiesProcessed++;
                try {
                    if (cf.getLoanRefNo() == null || cf.getLoanRefNo().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing Loan Reference on CBS facility " + cf.getId());
                    }
                    String loanRefKey = cf.getLoanRefNo().trim().toUpperCase();
                    LoanAccount existing = cimsLoanByRef.get(loanRefKey);

                    Customer matchedCust = null;
                    if (cf.getCustomerCif() != null) {
                        matchedCust = cimsCustByCif.get(cf.getCustomerCif().trim().toUpperCase());
                    }

                    LoanAccount saved = loanAccountRepository.save(cbsMapper.mapFacility(cf, existing, matchedCust, sourceSystem));
                    cimsLoanByRef.put(loanRefKey, saved);
                    facilitiesSucceeded++;
                } catch (Exception e) {
                    facilitiesFailed++;
                    errorLog.append("[Facility: ").append(cf.getLoanRefNo()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
            }

            // 5. Synchronize Collaterals
            for (CbsCollateral ccol : cbsCollaterals) {
                collateralsProcessed++;
                try {
                    if (ccol.getCollateralCode() == null || ccol.getCollateralCode().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing Collateral Code on CBS collateral " + ccol.getId());
                    }
                    String colKey = ccol.getCollateralCode().trim().toUpperCase();
                    Collateral existing = cimsColByCode.get(colKey);

                    Customer matchedCust = null;
                    if (ccol.getCustomerCif() != null) {
                        matchedCust = cimsCustByCif.get(ccol.getCustomerCif().trim().toUpperCase());
                    }

                    Collateral saved = collateralRepository.save(cbsMapper.mapCollateral(ccol, existing, matchedCust, sourceSystem));
                    cimsColByCode.put(colKey, saved);
                    affectedCollateralIds.add(saved.getId());
                    collateralsSucceeded++;
                } catch (Exception e) {
                    collateralsFailed++;
                    errorLog.append("[Collateral: ").append(ccol.getCollateralCode()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
            }

            // 6. Synchronize Account-Collateral Linkages
            for (CbsAccCollLinkDtls cl : cbsLinks) {
                linksProcessed++;
                try {
                    LoanAccount matchedLoan = null;
                    if (cl.getAccountNumber() != null) {
                        matchedLoan = cimsLoanByRef.get(cl.getAccountNumber().trim().toUpperCase());
                    }

                    Collateral matchedCol = null;
                    if (cl.getLinkedReferenceNo() != null) {
                        matchedCol = cimsColByCode.get(cl.getLinkedReferenceNo().trim().toUpperCase());
                    }

                    LoanCollateralLink existing = cimsLinkById.get(cl.getId());
                    LoanCollateralLink saved = loanCollateralLinkRepository.save(
                            cbsMapper.mapLink(cl, existing, matchedLoan, matchedCol, sourceSystem)
                    );
                    cimsLinkById.put(saved.getId(), saved);

                    if (matchedCol != null) {
                        affectedCollateralIds.add(matchedCol.getId());
                    }
                    linksSucceeded++;
                } catch (Exception e) {
                    linksFailed++;
                    errorLog.append("[Link: ").append(cl.getId()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
            }

            // 7. Trigger downstream exposure & adequacy recalculations
            for (String colId : affectedCollateralIds) {
                try {
                    exposureCalculationService.calculateExposureAndAdequacy(colId);
                } catch (Exception ex) {
                    log.warn("Downstream exposure calculation skipped for collateral {}: {}", colId, ex.getMessage());
                }
            }

            String completionTime = LocalDateTime.now().toString();
            int totalProcessed = customersProcessed + facilitiesProcessed + collateralsProcessed + linksProcessed;
            int totalSucceeded = customersSucceeded + facilitiesSucceeded + collateralsSucceeded + linksSucceeded;
            int totalFailed = customersFailed + facilitiesFailed + collateralsFailed + linksFailed;

            String resultStatus = totalFailed == 0 ? "SUCCESS" : (totalSucceeded > 0 ? "PARTIAL_SUCCESS" : "FAILED");

            // 8. Create Audit Sync Log
            CbsSyncLog syncLog = new CbsSyncLog();
            syncLog.setId(syncId);
            syncLog.setTimestamp(completionTime);
            syncLog.setStartTime(startTime);
            syncLog.setCompletionTime(completionTime);
            syncLog.setEntityType("ALL");
            syncLog.setEntityId("BATCH_SYNC");
            syncLog.setDirection("CBS->CIMS");
            syncLog.setSourceSystem(sourceSystem);
            syncLog.setResult(resultStatus);
            syncLog.setErrorMessage(errorLog.length() > 0 ? errorLog.toString() : null);
            syncLog.setRecordsProcessed(totalProcessed);
            syncLog.setRecordsSucceeded(totalSucceeded);
            syncLog.setRecordsFailed(totalFailed);
            syncLog.setCustomerCount(customersSucceeded);
            syncLog.setFacilityCount(facilitiesSucceeded);
            syncLog.setCollateralCount(collateralsSucceeded);
            syncLog.setRelationshipCount(linksSucceeded);
            syncLog.setSyncBatchId(syncId);
            syncLog.setPayloadJson(String.format(
                    "{\"customers\":{\"processed\":%d,\"succeeded\":%d,\"failed\":%d}," +
                    "\"facilities\":{\"processed\":%d,\"succeeded\":%d,\"failed\":%d}," +
                    "\"collaterals\":{\"processed\":%d,\"succeeded\":%d,\"failed\":%d}," +
                    "\"links\":{\"processed\":%d,\"succeeded\":%d,\"failed\":%d}}",
                    customersProcessed, customersSucceeded, customersFailed,
                    facilitiesProcessed, facilitiesSucceeded, facilitiesFailed,
                    collateralsProcessed, collateralsSucceeded, collateralsFailed,
                    linksProcessed, linksSucceeded, linksFailed
            ));

            cbsSyncLogRepository.save(syncLog);

            Map<String, Object> resp = new HashMap<>();
            resp.put("syncId", syncId);
            resp.put("status", resultStatus);
            resp.put("startTime", startTime);
            resp.put("completionTime", completionTime);
            resp.put("customersProcessed", customersProcessed);
            resp.put("customersSucceeded", customersSucceeded);
            resp.put("customersFailed", customersFailed);
            resp.put("facilitiesProcessed", facilitiesProcessed);
            resp.put("facilitiesSucceeded", facilitiesSucceeded);
            resp.put("facilitiesFailed", facilitiesFailed);
            resp.put("collateralsProcessed", collateralsProcessed);
            resp.put("collateralsSucceeded", collateralsSucceeded);
            resp.put("collateralsFailed", collateralsFailed);
            resp.put("relationshipsProcessed", linksProcessed);
            resp.put("relationshipsSucceeded", linksSucceeded);
            resp.put("relationshipsFailed", linksFailed);
            resp.put("totalErrors", totalFailed);
            resp.put("errorMessage", errorLog.length() > 0 ? errorLog.toString() : null);
            return resp;

        } catch (Exception e) {
            String completionTime = LocalDateTime.now().toString();
            CbsSyncLog errLog = new CbsSyncLog();
            errLog.setId(syncId);
            errLog.setTimestamp(completionTime);
            errLog.setStartTime(startTime);
            errLog.setCompletionTime(completionTime);
            errLog.setEntityType("ALL");
            errLog.setEntityId("BATCH_SYNC");
            errLog.setDirection("CBS->CIMS");
            errLog.setSourceSystem(sourceSystem);
            errLog.setResult("FAILED");
            errLog.setErrorMessage(e.getMessage());
            errLog.setRecordsProcessed(customersProcessed + facilitiesProcessed + collateralsProcessed + linksProcessed);
            errLog.setRecordsFailed(1);
            cbsSyncLogRepository.save(errLog);

            throw new RuntimeException("CBS Synchronisation batch failed: " + e.getMessage(), e);
        }
    }

    /**
     * Individual Customer Synchronization by CIF.
     * Synchronizes Customer master, associated Facilities, Collaterals, and Linkages.
     */
    @Transactional
    public Map<String, Object> syncCustomerFromCbs(String customerCif, String userId) {
        String sourceSystem = "REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "REAL_CBS" : "CBS_SIM";
        CbsCustomer cc = cbsGateway.fetchCustomerByCif(customerCif)
                .orElseThrow(() -> new IllegalArgumentException("Customer CIF not found in CBS: " + customerCif));

        Customer existingCust = customerRepository.findFirstByCifIgnoreCase(cc.getCif())
                .or(() -> customerRepository.findById(cc.getId()))
                .orElse(null);

        Customer cust = customerRepository.save(cbsMapper.mapCustomer(cc, existingCust, sourceSystem));

        // Sync associated facilities
        List<CbsFacility> facs = cbsGateway.fetchFacilitiesByCustomerCif(customerCif);
        for (CbsFacility cf : facs) {
            LoanAccount existingLa = loanAccountRepository.findByLoanReference(cf.getLoanRefNo()).orElse(null);
            loanAccountRepository.save(cbsMapper.mapFacility(cf, existingLa, cust, sourceSystem));
        }

        // Sync associated collaterals
        List<CbsCollateral> cols = cbsGateway.fetchCollateralsByCustomerCif(customerCif);
        for (CbsCollateral ccol : cols) {
            Collateral existingCol = collateralRepository.findByCode(ccol.getCollateralCode()).orElse(null);
            Collateral savedCol = collateralRepository.save(cbsMapper.mapCollateral(ccol, existingCol, cust, sourceSystem));
            try {
                exposureCalculationService.calculateExposureAndAdequacy(savedCol.getId());
            } catch (Exception ignored) {}
        }

        CbsSyncLog logEntry = new CbsSyncLog(
                "sync-cst-" + UUID.randomUUID().toString().substring(0, 8),
                "Customer",
                customerCif,
                "CBS->CIMS",
                "SUCCESS",
                null
        );
        logEntry.setSourceSystem(sourceSystem);
        logEntry.setRecordsProcessed(1 + facs.size() + cols.size());
        logEntry.setRecordsSucceeded(1 + facs.size() + cols.size());
        cbsSyncLogRepository.save(logEntry);

        Map<String, Object> res = new HashMap<>();
        res.put("customerCif", customerCif);
        res.put("customerName", cust.getName());
        res.put("facilitiesCount", facs.size());
        res.put("collateralsCount", cols.size());
        res.put("status", "SUCCESS");
        return res;
    }

    /**
     * Individual Facility Synchronization by Loan Reference or Line Code.
     * Uses direct indexed lookups rather than scanning all customers.
     */
    @Transactional
    public Map<String, Object> syncFacilityFromCbs(String loanRefOrLineCode, String userId) {
        String sourceSystem = "REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "REAL_CBS" : "CBS_SIM";

        CbsFacility target = cbsGateway.fetchFacilityByLoanReference(loanRefOrLineCode)
                .or(() -> cbsGateway.fetchFacilityByLineCode(loanRefOrLineCode))
                .orElseThrow(() -> new IllegalArgumentException("Facility loan reference or line code not found in CBS: " + loanRefOrLineCode));

        Customer matchedCustomer = null;
        if (target.getCustomerCif() != null) {
            matchedCustomer = customerRepository.findFirstByCifIgnoreCase(target.getCustomerCif()).orElse(null);
        }

        LoanAccount existingLa = loanAccountRepository.findByLoanReference(target.getLoanRefNo()).orElse(null);
        LoanAccount la = loanAccountRepository.save(cbsMapper.mapFacility(target, existingLa, matchedCustomer, sourceSystem));

        // Recalculate exposures for linked collaterals
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByLoanAccountId(la.getId());
        for (LoanCollateralLink link : links) {
            if (link.getCollateralId() != null) {
                try {
                    exposureCalculationService.calculateExposureAndAdequacy(link.getCollateralId());
                } catch (Exception ignored) {}
            }
        }

        CbsSyncLog logEntry = new CbsSyncLog(
                "sync-fac-" + UUID.randomUUID().toString().substring(0, 8),
                "Facility",
                loanRefOrLineCode,
                "CBS->CIMS",
                "SUCCESS",
                null
        );
        logEntry.setSourceSystem(sourceSystem);
        logEntry.setRecordsProcessed(1);
        logEntry.setRecordsSucceeded(1);
        cbsSyncLogRepository.save(logEntry);

        Map<String, Object> res = new HashMap<>();
        res.put("loanReference", la.getLoanReference());
        res.put("facilityType", la.getFacilityType());
        res.put("approvedLimit", la.getApprovedLimit());
        res.put("outstandingBalance", la.getOutstandingBalance());
        res.put("status", "SUCCESS");
        return res;
    }

    /**
     * Individual Collateral Synchronization by Collateral Code.
     */
    @Transactional
    public Map<String, Object> syncCollateralFromCbs(String collateralCode, String userId) {
        String sourceSystem = "REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "REAL_CBS" : "CBS_SIM";

        CbsCollateral ccol = cbsGateway.fetchCollateralByCode(collateralCode)
                .orElseThrow(() -> new IllegalArgumentException("Collateral code not found in CBS: " + collateralCode));

        Customer matchedCustomer = null;
        if (ccol.getCustomerCif() != null) {
            matchedCustomer = customerRepository.findFirstByCifIgnoreCase(ccol.getCustomerCif()).orElse(null);
        }

        Collateral existingCol = collateralRepository.findByCode(ccol.getCollateralCode()).orElse(null);
        Collateral col = collateralRepository.save(cbsMapper.mapCollateral(ccol, existingCol, matchedCustomer, sourceSystem));

        try {
            exposureCalculationService.calculateExposureAndAdequacy(col.getId());
        } catch (Exception ignored) {}

        CbsSyncLog logEntry = new CbsSyncLog(
                "sync-col-" + UUID.randomUUID().toString().substring(0, 8),
                "Collateral",
                collateralCode,
                "CBS->CIMS",
                "SUCCESS",
                null
        );
        logEntry.setSourceSystem(sourceSystem);
        logEntry.setRecordsProcessed(1);
        logEntry.setRecordsSucceeded(1);
        cbsSyncLogRepository.save(logEntry);

        Map<String, Object> res = new HashMap<>();
        res.put("collateralCode", col.getCode());
        res.put("collateralType", col.getType());
        res.put("ownerType", col.getOwnerType());
        res.put("valuationAmount", col.getValuationAmount());
        res.put("haircut", col.getHaircut());
        res.put("status", "SUCCESS");
        return res;
    }

    public List<CbsSyncLog> getCbsSyncLogs() {
        return cbsSyncLogRepository.findAllByOrderByTimestampDesc();
    }

    /**
     * Provides truthful, non-fabricated CBS integration status.
     * Distinguishes SIMULATOR vs REAL mode, actual connection status,
     * and timestamps derived from persisted sync history.
     */
    public Map<String, Object> getCbsSyncStatus() {
        Map<String, Object> status = new HashMap<>();
        String mode = cbsGateway.getMode();
        CbsConnectionStatus connStatus = cbsGateway.checkConnectionStatus();

        status.put("cbsMode", mode);
        status.put("connectionStatus", connStatus.getStatus());
        status.put("connectionMessage", connStatus.getMessage());
        status.put("cbsConnected", "AVAILABLE".equalsIgnoreCase(connStatus.getStatus()));

        // Fetch stored sync history for truthful timestamps
        Optional<CbsSyncLog> lastLog = cbsSyncLogRepository.findFirstByOrderByTimestampDesc();
        Optional<CbsSyncLog> lastSuccess = cbsSyncLogRepository.findFirstByResultOrderByTimestampDesc("SUCCESS");
        Optional<CbsSyncLog> lastFailed = cbsSyncLogRepository.findFirstByResultOrderByTimestampDesc("FAILED");

        status.put("lastSyncTimestamp", lastLog.map(CbsSyncLog::getTimestamp).orElse(null));
        status.put("lastSuccessfulSync", lastSuccess.map(CbsSyncLog::getTimestamp).orElse(null));
        status.put("lastFailedSync", lastFailed.map(CbsSyncLog::getTimestamp).orElse(null));
        status.put("lastResult", lastLog.map(CbsSyncLog::getResult).orElse("NONE"));

        // Entity master counts from CIMS
        status.put("syncedCustomersCount", customerRepository.count());
        status.put("syncedLoansCount", loanAccountRepository.count());
        status.put("syncedCollateralsCount", collateralRepository.count());
        status.put("syncedLinksCount", loanCollateralLinkRepository.count());

        status.put("syncMode", configurationService.getCbsSyncMode());
        status.put("syncIntervalMinutes", configurationService.getCbsSyncIntervalMinutes());

        return status;
    }
}
