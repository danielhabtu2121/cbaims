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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
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

    @Autowired(required = false)
    private BranchRepository branchRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private final java.util.concurrent.atomic.AtomicBoolean isSyncInProgress = new java.util.concurrent.atomic.AtomicBoolean(false);
    private volatile String currentRunningSyncId = null;

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

        if (!isSyncInProgress.compareAndSet(false, true)) {
            log.warn("CBS batch synchronization requested but already in progress (activeSyncId={})", currentRunningSyncId);
            Map<String, Object> busyResp = new LinkedHashMap<>();
            busyResp.put("status", "IN_PROGRESS");
            busyResp.put("message", "A CBS batch synchronization is already running in background (syncId: " + currentRunningSyncId + "). Please wait for it to complete.");
            busyResp.put("syncId", currentRunningSyncId);
            busyResp.put("success", true);
            return busyResp;
        }
        currentRunningSyncId = syncId;
        if (branchRepository != null) {
            cbsMapper.refreshBranchCache(branchRepository.findAll());
        }

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
        long totalStart = System.currentTimeMillis();

        log.info("Starting CBS batch synchronization: syncId={}, userId={}, mode={}", syncId, userId, cbsGateway.getMode());

        try {
            // Verify source availability before proceeding
            CbsConnectionStatus connStatus = cbsGateway.checkConnectionStatus();
            if ("NOT_CONFIGURED".equalsIgnoreCase(connStatus.getStatus()) || "UNAVAILABLE".equalsIgnoreCase(connStatus.getStatus())) {
                throw new CbsSyncException(
                        CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE,
                        connStatus.getMessage()
                );
            }

            // 1. Concurrent Bulk Fetch from Source Views to minimize Oracle wait time
            // Facilities and Collaterals are fetched concurrently first to isolate required CIFs
            log.info("Initiating concurrent fetch of CBS Facility and Collateral views...");
            long fetchStart = System.currentTimeMillis();
            CompletableFuture<List<CbsFacility>> facFuture = CompletableFuture.supplyAsync(() -> cbsGateway.fetchFacilities());
            CompletableFuture<List<CbsCollateral>> colFuture = CompletableFuture.supplyAsync(() -> cbsGateway.fetchCollaterals());

            List<CbsFacility> cbsFacilities;
            List<CbsCollateral> cbsCollaterals;

            try {
                CompletableFuture.allOf(facFuture, colFuture).join();
                cbsFacilities = facFuture.join();
                cbsCollaterals = colFuture.join();
                log.info("Fetched CBS Facility ({}) and Collateral ({}) views in {}ms",
                        cbsFacilities.size(), cbsCollaterals.size(), (System.currentTimeMillis() - fetchStart));
            } catch (CompletionException ce) {
                Throwable cause = ce.getCause() != null ? ce.getCause() : ce;
                if (cause instanceof CbsSyncException cbsEx) {
                    throw cbsEx;
                } else if (cause instanceof RuntimeException re) {
                    throw re;
                } else {
                    throw new RuntimeException(cause.getMessage(), cause);
                }
            }

            // Extract all distinct CIFs required by facilities and collaterals
            Set<String> neededCifs = new HashSet<>();
            for (CbsFacility f : cbsFacilities) {
                if (f.getCustomerCif() != null && !f.getCustomerCif().isBlank()) {
                    neededCifs.add(f.getCustomerCif().trim());
                }
            }
            for (CbsCollateral c : cbsCollaterals) {
                if (c.getCustomerCif() != null && !c.getCustomerCif().isBlank()) {
                    neededCifs.add(c.getCustomerCif().trim());
                }
            }

            List<CbsCustomer> cbsCustomers;
            if (!neededCifs.isEmpty()) {
                log.info("Targeting {} distinct CIFs from credit facilities/collaterals for customer query...", neededCifs.size());
                cbsCustomers = cbsGateway.fetchCustomersByCifs(neededCifs);
                if (cbsCustomers == null || cbsCustomers.isEmpty()) {
                    log.info("Targeted CIF query returned empty; falling back to full customer query...");
                    cbsCustomers = cbsGateway.fetchCustomers();
                }
            } else {
                log.info("No credit CIFs identified in facilities/collaterals; querying customer view...");
                cbsCustomers = cbsGateway.fetchCustomers();
            }
            log.info("Completed CBS data fetch: {} customers, {} facilities, {} collaterals in {}ms",
                    cbsCustomers.size(), cbsFacilities.size(), cbsCollaterals.size(), (System.currentTimeMillis() - fetchStart));

            List<CbsAccCollLinkDtls> cbsLinks = cbsGateway.fetchAllAccountCollateralLinks();

            // 2. Pre-populate CIMS Lookups in bulk to eliminate 380,000+ individual SQL queries
            log.info("Pre-loading existing CIMS records into memory for fast zero-query matching...");
            Map<String, Customer> cimsCustByCif = new HashMap<>();
            try {
                for (Customer c : customerRepository.findAll()) {
                    if (c.getCif() != null && !c.getCif().isBlank()) {
                        cimsCustByCif.put(c.getCif().trim().toUpperCase(), c);
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not pre-load customers: {}", ex.getMessage());
            }

            Map<String, LoanAccount> cimsLoanByRef = new HashMap<>();
            try {
                for (LoanAccount la : loanAccountRepository.findAll()) {
                    if (la.getLoanReference() != null && !la.getLoanReference().isBlank()) {
                        cimsLoanByRef.put(la.getLoanReference().trim().toUpperCase(), la);
                    }
                    if (la.getId() != null && !la.getId().isBlank()) {
                        cimsLoanByRef.put(la.getId().trim().toUpperCase(), la);
                    }
                    if (la.getLineCode() != null && !la.getLineCode().isBlank()) {
                        cimsLoanByRef.put(la.getLineCode().trim().toUpperCase(), la);
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not pre-load loan accounts: {}", ex.getMessage());
            }

            Map<String, Collateral> cimsColByCode = new HashMap<>();
            try {
                for (Collateral col : collateralRepository.findAll()) {
                    if (col.getCode() != null && !col.getCode().isBlank()) {
                        cimsColByCode.put(col.getCode().trim().toUpperCase(), col);
                    }
                    if (col.getId() != null && !col.getId().isBlank()) {
                        cimsColByCode.put(col.getId().trim().toUpperCase(), col);
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not pre-load collaterals: {}", ex.getMessage());
            }

            Map<String, LoanCollateralLink> cimsLinkById = new HashMap<>();
            Map<String, LoanCollateralLink> cimsLinkByPair = new HashMap<>();
            try {
                for (LoanCollateralLink lnk : loanCollateralLinkRepository.findAll()) {
                    if (lnk.getId() != null && !lnk.getId().isBlank()) {
                        cimsLinkById.put(lnk.getId().trim().toUpperCase(), lnk);
                    }
                    if (lnk.getCollateralId() != null && !lnk.getCollateralId().isBlank()
                            && lnk.getLoanAccountId() != null && !lnk.getLoanAccountId().isBlank()
                            && "Active".equalsIgnoreCase(lnk.getStatus())) {
                        String pairKey = (lnk.getCollateralId().trim() + ":" + lnk.getLoanAccountId().trim()).toUpperCase();
                        cimsLinkByPair.put(pairKey, lnk);
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not pre-load linkages: {}", ex.getMessage());
            }
            log.info("Pre-loaded existing entities: {} customers, {} loans, {} collaterals, {} links ({} active pairs)",
                    cimsCustByCif.size(), cimsLoanByRef.size(), cimsColByCode.size(), cimsLinkById.size(), cimsLinkByPair.size());

            // 3. Synchronize Customers
            for (CbsCustomer cc : cbsCustomers) {
                customersProcessed++;
                try {
                    if (cc.getCif() == null || cc.getCif().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing CIF on CBS customer " + cc.getId());
                    }
                    Customer existing = findExistingCustomer(cc.getCif(), cimsCustByCif);
                    Customer mapped = cbsMapper.mapCustomer(cc, existing, sourceSystem);
                    if (mapped.getName() == null || mapped.getName().isBlank()) {
                        mapped.setName("CBS Customer " + cc.getCif().trim());
                    }
                    if (mapped.getSegment() == null || mapped.getSegment().isBlank()) {
                        mapped.setSegment("General");
                    }
                    if (entityManager != null) {
                        if (existing == null) {
                            entityManager.persist(mapped);
                        } else {
                            mapped = entityManager.merge(mapped);
                        }
                    } else {
                        mapped = customerRepository.save(mapped);
                    }
                    cimsCustByCif.put(cc.getCif().trim().toUpperCase(), mapped);
                    customersSucceeded++;
                } catch (Exception e) {
                    customersFailed++;
                    errorLog.append("[Customer CIF: ").append(cc.getCif()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
                if (customersProcessed % 500 == 0 && entityManager != null) {
                    entityManager.flush();
                    entityManager.clear();
                }
                if (customersProcessed % 10000 == 0) {
                    log.info("Synchronized {}/{} customers...", customersProcessed, cbsCustomers.size());
                }
            }
            log.info("Completed customer synchronization: {}/{} succeeded in {}ms", customersSucceeded, cbsCustomers.size(), (System.currentTimeMillis() - totalStart));

            // 4. Synchronize Facilities
            for (CbsFacility cf : cbsFacilities) {
                facilitiesProcessed++;
                try {
                    if (cf.getLoanRefNo() == null || cf.getLoanRefNo().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing Loan Reference on CBS facility " + cf.getId());
                    }
                    LoanAccount existing = findExistingLoan(cf.getLoanRefNo(), cimsLoanByRef);
                    Customer matchedCust = (cf.getCustomerCif() != null && !cf.getCustomerCif().isBlank())
                            ? findExistingCustomer(cf.getCustomerCif(), cimsCustByCif)
                            : null;

                    LoanAccount mapped = cbsMapper.mapFacility(cf, existing, matchedCust, sourceSystem);
                    if (mapped.getSegment() == null || mapped.getSegment().isBlank()) {
                        mapped.setSegment(matchedCust != null && matchedCust.getSegment() != null && !matchedCust.getSegment().isBlank()
                                ? matchedCust.getSegment()
                                : "Corporate Banking");
                    }
                    if (mapped.getBranch() == null || mapped.getBranch().isBlank()) {
                        mapped.setBranch(matchedCust != null && matchedCust.getBranch() != null && !matchedCust.getBranch().isBlank()
                                ? matchedCust.getBranch()
                                : "Head Office");
                    }
                    if (mapped.getFacilityType() == null || mapped.getFacilityType().isBlank()) {
                        mapped.setFacilityType("Term Loan");
                    }
                    if (mapped.getStatus() == null || mapped.getStatus().isBlank()) {
                        mapped.setStatus("Active");
                    }
                    if (entityManager != null) {
                        if (existing == null) {
                            entityManager.persist(mapped);
                        } else {
                            mapped = entityManager.merge(mapped);
                        }
                    } else {
                        mapped = loanAccountRepository.save(mapped);
                    }
                    if (mapped.getLoanReference() != null) {
                        cimsLoanByRef.put(mapped.getLoanReference().trim().toUpperCase(), mapped);
                    }
                    if (mapped.getId() != null) {
                        cimsLoanByRef.put(mapped.getId().trim().toUpperCase(), mapped);
                    }
                    if (mapped.getLineCode() != null) {
                        cimsLoanByRef.put(mapped.getLineCode().trim().toUpperCase(), mapped);
                    }
                    facilitiesSucceeded++;
                } catch (Exception e) {
                    facilitiesFailed++;
                    errorLog.append("[Facility: ").append(cf.getLoanRefNo()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
                if (facilitiesProcessed % 500 == 0 && entityManager != null) {
                    entityManager.flush();
                    entityManager.clear();
                }
                if (facilitiesProcessed % 10000 == 0) {
                    log.info("Synchronized {}/{} facilities...", facilitiesProcessed, cbsFacilities.size());
                }
            }
            if (entityManager != null) {
                entityManager.flush();
                entityManager.clear();
            }
            log.info("Completed facility synchronization: {}/{} succeeded in {}ms", facilitiesSucceeded, cbsFacilities.size(), (System.currentTimeMillis() - totalStart));

            // 5. Synchronize Collaterals
            for (CbsCollateral ccol : cbsCollaterals) {
                collateralsProcessed++;
                try {
                    if (ccol.getCollateralCode() == null || ccol.getCollateralCode().isBlank()) {
                        throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_VALIDATION_ERROR, "Missing Collateral Code on CBS collateral " + ccol.getId());
                    }
                    Collateral existing = findExistingCollateral(ccol.getCollateralCode(), cimsColByCode);

                    // Safeguard: Never overwrite CBAIMS_REGISTERED records
                    if (existing != null && "CBAIMS_REGISTERED".equalsIgnoreCase(existing.getOriginType())) {
                        log.warn("Safeguard triggered: skipping collateral overwrite for CBAIMS_REGISTERED code: {}", ccol.getCollateralCode());
                        collateralsSucceeded++;
                        continue;
                    }

                    // For CBS_IMPORTED collateral, update CBS financial fields while preserving local enrichment
                    if (existing != null && "CBS_IMPORTED".equalsIgnoreCase(existing.getOriginType())) {
                        log.debug("Preserving local enrichment while updating CBS fields for code: {}", ccol.getCollateralCode());
                    }

                    Customer matchedCust = (ccol.getCustomerCif() != null && !ccol.getCustomerCif().isBlank())
                            ? findExistingCustomer(ccol.getCustomerCif(), cimsCustByCif)
                            : null;

                    LoanAccount linkedLoan = (ccol.getLinkedAccountNo() != null && !ccol.getLinkedAccountNo().isBlank())
                            ? findExistingLoan(ccol.getLinkedAccountNo(), cimsLoanByRef)
                            : null;

                    Collateral mapped = cbsMapper.mapCollateral(ccol, existing, matchedCust, sourceSystem);
                    if (mapped.getOwningSegment() == null || mapped.getOwningSegment().isBlank()) {
                        String fallbackSeg = (matchedCust != null && matchedCust.getSegment() != null && !matchedCust.getSegment().isBlank())
                                ? matchedCust.getSegment()
                                : (linkedLoan != null && linkedLoan.getSegment() != null && !linkedLoan.getSegment().isBlank()
                                        ? linkedLoan.getSegment()
                                        : "Corporate Banking");
                        mapped.setOwningSegment(fallbackSeg);
                    }
                    if (mapped.getBranch() == null || mapped.getBranch().isBlank()) {
                        String fallbackBranch = (linkedLoan != null && linkedLoan.getBranch() != null && !linkedLoan.getBranch().isBlank())
                                ? linkedLoan.getBranch()
                                : (matchedCust != null && matchedCust.getBranch() != null && !matchedCust.getBranch().isBlank()
                                        ? matchedCust.getBranch()
                                        : "Head Office");
                        mapped.setBranch(fallbackBranch);
                    }
                    if (mapped.getStatus() == null || mapped.getStatus().isBlank()) {
                        mapped.setStatus("Active");
                    }
                    if (mapped.getOwnerType() == null || mapped.getOwnerType().isBlank()) {
                        mapped.setOwnerType("Borrower-owned");
                    }
                    if (mapped.getType() == null || mapped.getType().isBlank()) {
                        mapped.setType("Commercial Property");
                    }
                    if (entityManager != null) {
                        if (existing == null) {
                            entityManager.persist(mapped);
                        } else {
                            mapped = entityManager.merge(mapped);
                        }
                    } else {
                        mapped = collateralRepository.save(mapped);
                    }
                    if (mapped.getCode() != null) {
                        cimsColByCode.put(mapped.getCode().trim().toUpperCase(), mapped);
                    }
                    if (mapped.getId() != null) {
                        cimsColByCode.put(mapped.getId().trim().toUpperCase(), mapped);
                    }
                    if (mapped.getId() != null) {
                        affectedCollateralIds.add(mapped.getId());
                    }
                    collateralsSucceeded++;
                } catch (Exception e) {
                    collateralsFailed++;
                    errorLog.append("[Collateral: ").append(ccol.getCollateralCode()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
                if (collateralsProcessed % 500 == 0 && entityManager != null) {
                    entityManager.flush();
                    entityManager.clear();
                }
                if (collateralsProcessed % 10000 == 0) {
                    log.info("Synchronized {}/{} collaterals...", collateralsProcessed, cbsCollaterals.size());
                }
            }
            if (entityManager != null) {
                entityManager.flush();
                entityManager.clear();
            }
            log.info("Completed collateral synchronization: {}/{} succeeded in {}ms", collateralsSucceeded, cbsCollaterals.size(), (System.currentTimeMillis() - totalStart));

            // 6. Synchronize Account-Collateral Linkages
            for (CbsAccCollLinkDtls cl : cbsLinks) {
                linksProcessed++;
                try {
                    LoanAccount matchedLoan = (cl.getAccountNumber() != null && !cl.getAccountNumber().isBlank())
                            ? findExistingLoan(cl.getAccountNumber(), cimsLoanByRef)
                            : null;

                    Collateral matchedCol = (cl.getLinkedReferenceNo() != null && !cl.getLinkedReferenceNo().isBlank())
                            ? findExistingCollateral(cl.getLinkedReferenceNo(), cimsColByCode)
                            : null;

                    // Enforce foreign key validity: skip orphan linkages where loan or collateral does not exist in CIMS
                    if (matchedLoan == null) {
                        log.debug("Skipping linkage {} because loan account '{}' is not present in CIMS facilities", cl.getId(), cl.getAccountNumber());
                        linksFailed++;
                        continue;
                    }
                    if (matchedCol == null) {
                        log.debug("Skipping linkage {} because collateral code '{}' is not present in CIMS collaterals", cl.getId(), cl.getLinkedReferenceNo());
                        linksFailed++;
                        continue;
                    }

                    String pairKey = (matchedCol.getId().trim() + ":" + matchedLoan.getId().trim()).toUpperCase();
                    LoanCollateralLink existing = cimsLinkByPair.get(pairKey);
                    if (existing == null && cl.getId() != null) {
                        LoanCollateralLink byId = findExistingLink(cl.getId(), cimsLinkById);
                        if (byId != null && (byId.getCollateralId() == null || byId.getLoanAccountId() == null
                                || (byId.getCollateralId().trim().equalsIgnoreCase(matchedCol.getId().trim())
                                    && byId.getLoanAccountId().trim().equalsIgnoreCase(matchedLoan.getId().trim())))) {
                            existing = byId;
                        }
                    }

                    LoanCollateralLink mapped = cbsMapper.mapLink(cl, existing, matchedLoan, matchedCol, sourceSystem);
                    if (existing == null && mapped.getId() != null && cimsLinkById.containsKey(mapped.getId().trim().toUpperCase())) {
                        // Guard against any primary key collision across different collateral-loan pairs
                        mapped.setId("link-" + UUID.randomUUID());
                    }
                    if (entityManager != null) {
                        if (existing == null) {
                            entityManager.persist(mapped);
                        } else {
                            mapped = entityManager.merge(mapped);
                        }
                    } else {
                        mapped = loanCollateralLinkRepository.save(mapped);
                    }
                    if (mapped.getId() != null) {
                        cimsLinkById.put(mapped.getId().trim().toUpperCase(), mapped);
                    }
                    cimsLinkByPair.put(pairKey, mapped);

                    affectedCollateralIds.add(matchedCol.getId());
                    linksSucceeded++;
                } catch (Exception e) {
                    linksFailed++;
                    errorLog.append("[Link: ").append(cl.getId()).append(" Error: ").append(e.getMessage()).append("]; ");
                }
                if (linksProcessed % 500 == 0 && entityManager != null) {
                    entityManager.flush();
                    entityManager.clear();
                }
                if (linksProcessed % 10000 == 0) {
                    log.info("Synchronized {}/{} linkages...", linksProcessed, cbsLinks.size());
                }
            }
            if (entityManager != null) {
                entityManager.flush();
                entityManager.clear();
            }
            log.info("Completed linkage synchronization: {}/{} succeeded in {}ms", linksSucceeded, cbsLinks.size(), (System.currentTimeMillis() - totalStart));

            // 7. Trigger downstream exposure & adequacy recalculations
            if (affectedCollateralIds.size() <= 500) {
                for (String colId : affectedCollateralIds) {
                    try {
                        exposureCalculationService.calculateExposureAndAdequacy(colId);
                    } catch (Exception ex) {
                        log.warn("Downstream exposure calculation skipped for collateral {}: {}", colId, ex.getMessage());
                    }
                }
            } else if (entityManager != null) {
                log.info("Batch sync contains {} collaterals; updating current_allocation via bulk SQL aggregation.", affectedCollateralIds.size());
                int updatedAllocations = entityManager.createNativeQuery(
                        "UPDATE cims_collaterals col " +
                        "SET current_allocation = COALESCE(agg.total_alloc, 0.0) " +
                        "FROM (" +
                        "  SELECT collateral_id, SUM(COALESCE(NULLIF(allocated_amount, 0), linked_amount, 0)) AS total_alloc " +
                        "  FROM cims_loan_collateral_links " +
                        "  WHERE status IS NULL OR UPPER(status) <> 'RELEASED' " +
                        "  GROUP BY collateral_id" +
                        ") agg " +
                        "WHERE col.id = agg.collateral_id"
                ).executeUpdate();
                log.info("Bulk updated current_allocation for {} collaterals.", updatedAllocations);
            } else {
                log.info("Batch sync contains {} collaterals; skipping synchronous exposure recalculation to prevent HTTP timeout.", affectedCollateralIds.size());
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

            log.info("CBS batch synchronization completed in {}ms: status={}, customers={}/{}, facilities={}/{}, collaterals={}/{}, links={}/{}",
                    (System.currentTimeMillis() - totalStart), resultStatus,
                    customersSucceeded, customersProcessed,
                    facilitiesSucceeded, facilitiesProcessed,
                    collateralsSucceeded, collateralsProcessed,
                    linksSucceeded, linksProcessed);

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

            String errDetail;
            if (e instanceof CbsSyncException cbsEx && cbsEx.getFailingView() != null) {
                errDetail = "[" + cbsEx.getFailingView() + "] " + cbsEx.getMessage();
            } else {
                errDetail = e.getMessage() != null ? e.getMessage() : "Unknown sync error";
            }
            errLog.setErrorMessage(errDetail);
            errLog.setRecordsProcessed(customersProcessed + facilitiesProcessed + collateralsProcessed + linksProcessed);
            errLog.setRecordsFailed(1);
            cbsSyncLogRepository.save(errLog);

            if (e instanceof CbsSyncException cbsEx) {
                throw cbsEx;
            }
            throw new RuntimeException("CBS Synchronisation batch failed: " + errDetail, e);
        } finally {
            isSyncInProgress.set(false);
            currentRunningSyncId = null;
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
        status.put("isSyncInProgress", isSyncInProgress.get());
        status.put("currentRunningSyncId", currentRunningSyncId);

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

    private Customer findExistingCustomer(String cif, Map<String, Customer> cache) {
        if (cif == null || cif.isBlank()) return null;
        String key = cif.trim().toUpperCase();
        if (cache != null) {
            return cache.get(key);
        }
        return customerRepository.findFirstByCifIgnoreCase(cif).orElse(null);
    }

    private LoanAccount findExistingLoan(String ref, Map<String, LoanAccount> cache) {
        if (ref == null || ref.isBlank()) return null;
        String key = ref.trim().toUpperCase();
        if (cache != null) {
            return cache.get(key);
        }
        return loanAccountRepository.findFirstByLoanReferenceIgnoreCase(ref).orElse(null);
    }

    private Collateral findExistingCollateral(String code, Map<String, Collateral> cache) {
        if (code == null || code.isBlank()) return null;
        String key = code.trim().toUpperCase();
        if (cache != null) {
            return cache.get(key);
        }
        return collateralRepository.findFirstByCodeIgnoreCase(code).orElse(null);
    }

    private LoanCollateralLink findExistingLink(String id, Map<String, LoanCollateralLink> cache) {
        if (id == null || id.isBlank()) return null;
        if (cache != null) {
            return cache.get(id.trim().toUpperCase());
        }
        return loanCollateralLinkRepository.findById(id).orElse(null);
    }
}
