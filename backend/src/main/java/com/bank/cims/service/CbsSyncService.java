package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.CbsGateway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class CbsSyncService {

    @Autowired
    private CbsGateway cbsGateway;

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

    @Transactional
    public Map<String, Object> syncAllFromCbs(String userId) {
        String syncId = "sync-" + UUID.randomUUID().toString().substring(0, 8);
        String now = LocalDateTime.now().toString();
        int customersProcessed = 0;
        int facilitiesProcessed = 0;
        int collateralsProcessed = 0;
        int linksProcessed = 0;
        int failedCount = 0;
        StringBuilder errorLog = new StringBuilder();

        try {
            // 1. Sync Customers
            List<CbsCustomer> cbsCustomers = cbsGateway.fetchCustomers();
            for (CbsCustomer cc : cbsCustomers) {
                try {
                    syncSingleCustomerEntity(cc);
                    customersProcessed++;
                } catch (Exception e) {
                    failedCount++;
                    errorLog.append("Customer CIF ").append(cc.getCif()).append(" sync error: ").append(e.getMessage()).append("; ");
                }
            }

            // 2. Sync Facilities (GETM_FACILITY)
            for (CbsCustomer cc : cbsCustomers) {
                List<CbsFacility> cbsFacs = cbsGateway.fetchFacilitiesByCustomerCif(cc.getCif());
                for (CbsFacility cf : cbsFacs) {
                    try {
                        syncSingleFacilityEntity(cf);
                        facilitiesProcessed++;
                    } catch (Exception e) {
                        failedCount++;
                        errorLog.append("Facility ").append(cf.getLoanRefNo()).append(" sync error: ").append(e.getMessage()).append("; ");
                    }
                }
            }

            // 3. Sync Collaterals (GETM_COLLAT)
            for (CbsCustomer cc : cbsCustomers) {
                List<CbsCollateral> cbsCols = cbsGateway.fetchCollateralsByCustomerCif(cc.getCif());
                for (CbsCollateral ccol : cbsCols) {
                    try {
                        syncSingleCollateralEntity(ccol);
                        collateralsProcessed++;
                    } catch (Exception e) {
                        failedCount++;
                        errorLog.append("Collateral ").append(ccol.getCollateralCode()).append(" sync error: ").append(e.getMessage()).append("; ");
                    }
                }
            }

            // 4. Sync Account-Collateral Linkages (CLTB_ACC_COLL_LINK_DTLS)
            List<LoanAccount> allLoans = loanAccountRepository.findAll();
            for (LoanAccount la : allLoans) {
                String accNo = la.getAccountNumber() != null ? la.getAccountNumber() : la.getLoanReference();
                List<CbsAccCollLinkDtls> cbsLinks = cbsGateway.fetchAccountCollateralLinks(accNo);
                for (CbsAccCollLinkDtls cl : cbsLinks) {
                    try {
                        syncSingleLinkEntity(cl);
                        linksProcessed++;
                    } catch (Exception e) {
                        failedCount++;
                        errorLog.append("Link ").append(cl.getId()).append(" sync error: ").append(e.getMessage()).append("; ");
                    }
                }
            }

            // 5. Trigger Exposure & Adequacy Recalculation across all collaterals
            List<Collateral> allCollaterals = collateralRepository.findAll();
            for (Collateral col : allCollaterals) {
                try {
                    exposureCalculationService.calculateExposureAndAdequacy(col.getId());
                } catch (Exception ignored) {}
            }

            // 6. Log Sync Result
            CbsSyncLog log = new CbsSyncLog();
            log.setId(syncId);
            log.setEntityType("ALL");
            log.setEntityId("BATCH_SYNC");
            log.setDirection("CBS->CIMS");
            log.setResult(failedCount == 0 ? "SUCCESS" : "PARTIAL_SUCCESS");
            log.setErrorMessage(errorLog.length() > 0 ? errorLog.toString() : null);
            log.setPayloadJson(String.format("Customers: %d, Facilities: %d, Collaterals: %d, Links: %d, Failed: %d",
                    customersProcessed, facilitiesProcessed, collateralsProcessed, linksProcessed, failedCount));
            log.setTimestamp(now);
            cbsSyncLogRepository.save(log);

        } catch (Exception e) {
            CbsSyncLog log = new CbsSyncLog();
            log.setId(syncId);
            log.setEntityType("ALL");
            log.setEntityId("BATCH_SYNC");
            log.setDirection("CBS->CIMS");
            log.setResult("FAILED");
            log.setErrorMessage(e.getMessage());
            log.setTimestamp(now);
            cbsSyncLogRepository.save(log);
            throw new RuntimeException("CBS Synchronisation batch failed: " + e.getMessage(), e);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("syncId", syncId);
        result.put("status", failedCount == 0 ? "SUCCESS" : "PARTIAL_SUCCESS");
        result.put("timestamp", now);
        result.put("customersSynced", customersProcessed);
        result.put("facilitiesSynced", facilitiesProcessed);
        result.put("collateralsSynced", collateralsProcessed);
        result.put("linksSynced", linksProcessed);
        result.put("errorsCount", failedCount);
        return result;
    }

    @Transactional
    public Map<String, Object> syncCustomerFromCbs(String customerCif, String userId) {
        CbsCustomer cc = cbsGateway.fetchCustomerByCif(customerCif);
        if (cc == null) {
            throw new IllegalArgumentException("Customer CIF not found in CBS: " + customerCif);
        }

        Customer cust = syncSingleCustomerEntity(cc);

        // Sync facilities
        List<CbsFacility> facs = cbsGateway.fetchFacilitiesByCustomerCif(customerCif);
        for (CbsFacility f : facs) {
            syncSingleFacilityEntity(f);
        }

        // Sync collaterals
        List<CbsCollateral> cols = cbsGateway.fetchCollateralsByCustomerCif(customerCif);
        for (CbsCollateral c : cols) {
            syncSingleCollateralEntity(c);
            exposureCalculationService.calculateExposureAndAdequacy(c.getCollateralCode());
        }

        CbsSyncLog log = new CbsSyncLog(
                "sync-cst-" + UUID.randomUUID().toString().substring(0, 8),
                "Customer",
                customerCif,
                "CBS->CIMS",
                "SUCCESS",
                null
        );
        cbsSyncLogRepository.save(log);

        Map<String, Object> res = new HashMap<>();
        res.put("customerCif", customerCif);
        res.put("customerName", cust.getName());
        res.put("facilitiesCount", facs.size());
        res.put("collateralsCount", cols.size());
        res.put("status", "SUCCESS");
        return res;
    }

    @Transactional
    public Map<String, Object> syncFacilityFromCbs(String loanRefNo, String userId) {
        List<CbsCustomer> customers = cbsGateway.fetchCustomers();
        CbsFacility target = null;
        for (CbsCustomer c : customers) {
            for (CbsFacility f : cbsGateway.fetchFacilitiesByCustomerCif(c.getCif())) {
                if (f.getLoanRefNo().equalsIgnoreCase(loanRefNo) || f.getLineCode().equalsIgnoreCase(loanRefNo)) {
                    target = f;
                    break;
                }
            }
            if (target != null) break;
        }

        if (target == null) {
            throw new IllegalArgumentException("Facility line code or reference not found in CBS: " + loanRefNo);
        }

        LoanAccount la = syncSingleFacilityEntity(target);

        // Recalculate exposures for any linked collaterals
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByLoanAccountId(la.getId());
        for (LoanCollateralLink link : links) {
            if (link.getCollateralId() != null) {
                exposureCalculationService.calculateExposureAndAdequacy(link.getCollateralId());
            }
        }

        CbsSyncLog log = new CbsSyncLog(
                "sync-fac-" + UUID.randomUUID().toString().substring(0, 8),
                "Facility",
                loanRefNo,
                "CBS->CIMS",
                "SUCCESS",
                null
        );
        cbsSyncLogRepository.save(log);

        Map<String, Object> res = new HashMap<>();
        res.put("loanReference", la.getLoanReference());
        res.put("facilityType", la.getFacilityType());
        res.put("approvedLimit", la.getApprovedLimit());
        res.put("outstandingBalance", la.getOutstandingBalance());
        res.put("status", "SUCCESS");
        return res;
    }

    private Customer syncSingleCustomerEntity(CbsCustomer cc) {
        Customer cust = customerRepository.findFirstByCifIgnoreCase(cc.getCif()).orElse(null);
        if (cust == null) {
            cust = customerRepository.findById(cc.getId()).orElse(null);
        }
        if (cust == null) {
            cust = new Customer();
            cust.setId(cc.getId() != null ? cc.getId() : "cst-" + UUID.randomUUID().toString().substring(0, 8));
            cust.setCif(cc.getCif());
        }

        cust.setName(cc.getFullName());
        cust.setCustomerType(cc.getCustomerType());
        cust.setNationalId(cc.getNationalId());
        cust.setBusinessRegNo(cc.getBusinessRegNo());
        cust.setTaxIdNo(cc.getTaxIdNo());
        cust.setDobOrIncorp(cc.getDobOrIncorp());
        cust.setGender(cc.getGender());
        cust.setPhone(cc.getPhone());
        cust.setEmail(cc.getEmail());
        cust.setAddress(cc.getAddress());
        cust.setSegment(cc.getBusinessSegment());
        cust.setBranch(cc.getBranch());
        cust.setRiskRating(cc.getRiskRating());
        cust.setStatus(cc.getCustomerStatus());
        cust.setSource("CBS_SIM");
        cust.setCbsSyncStatus("Synced");
        cust.setCbsSyncedAt(LocalDateTime.now().toString());

        return customerRepository.save(cust);
    }

    private LoanAccount syncSingleFacilityEntity(CbsFacility cf) {
        LoanAccount la = loanAccountRepository.findByLoanReference(cf.getLoanRefNo()).orElse(null);
        if (la == null) {
            la = loanAccountRepository.findById(cf.getId()).orElse(null);
        }
        if (la == null) {
            la = new LoanAccount();
            la.setId(cf.getId() != null ? cf.getId() : "fac-" + UUID.randomUUID().toString().substring(0, 8));
            la.setLoanReference(cf.getLoanRefNo());
        }

        // Link to customer
        Customer cust = customerRepository.findFirstByCifIgnoreCase(cf.getCustomerCif()).orElse(null);
        if (cust != null) {
            la.setCustomerId(cust.getId());
        } else {
            la.setCustomerId(cf.getCustomerCif());
        }

        la.setLineCode(cf.getLineCode());
        la.setFacilityType(cf.getFacilityType());
        la.setLineCurrency(cf.getLineCurrency());
        la.setRevolvingLine(cf.isRevolvingLine());
        la.setLineStartDate(cf.getLineStartDate());
        la.setLineExpiryDate(cf.getLineExpiryDate());
        la.setApprovedLimit(cf.getApprovedLimit());
        la.setOutstandingBalance(cf.getOutstandingAmount());
        la.setAvailableAmount(cf.getAvailableAmount());
        la.setCollateralContribution(cf.getCollateralContribution());
        la.setCollateralPct(cf.getCollateralPct());
        la.setSegment(cf.getBusinessSegment());
        la.setBranch(cf.getBranch());
        la.setRmUserId(cf.getRelationshipManager());
        la.setStatus(cf.getLimitStatus() != null ? cf.getLimitStatus() : "Active");
        la.setCbsSyncStatus("Synced");
        la.setCbsSyncedAt(LocalDateTime.now().toString());

        return loanAccountRepository.save(la);
    }

    private Collateral syncSingleCollateralEntity(CbsCollateral ccol) {
        Collateral col = collateralRepository.findByCode(ccol.getCollateralCode()).orElse(null);
        if (col == null) {
            col = collateralRepository.findById(ccol.getId()).orElse(null);
        }
        if (col == null) {
            col = new Collateral();
            col.setId(ccol.getId() != null ? ccol.getId() : "col-" + UUID.randomUUID().toString().substring(0, 8));
            col.setCode(ccol.getCollateralCode());
        }

        Customer cust = customerRepository.findFirstByCifIgnoreCase(ccol.getCustomerCif()).orElse(null);
        if (cust != null) {
            col.setCustomerId(cust.getId());
        } else {
            col.setCustomerId(ccol.getCustomerCif());
        }

        col.setDescription(ccol.getDescription());
        col.setCategory(ccol.getCategory());
        col.setType(ccol.getCollateralType());
        col.setCurrency(ccol.getCurrency());
        col.setValuationAmount(ccol.getCollateralValue());
        col.setHaircut(ccol.getHaircut());
        col.setLimitContribution(ccol.getLimitContribution());
        col.setStartDate(ccol.getStartDate());
        col.setReviewDate(ccol.getReviewDate());
        col.setOwnerType(ccol.getCollateralType());
        col.setTangible(ccol.isTangible());
        col.setOwningSegment(ccol.getBusinessSegment());
        col.setBranch(ccol.getBranch());
        col.setCbsSyncStatus("Synced");
        col.setCbsSyncedAt(LocalDateTime.now().toString());

        return collateralRepository.save(col);
    }

    private LoanCollateralLink syncSingleLinkEntity(CbsAccCollLinkDtls cl) {
        LoanCollateralLink link = loanCollateralLinkRepository.findById(cl.getId()).orElse(null);
        if (link == null) {
            link = new LoanCollateralLink();
            link.setId(cl.getId());
        }

        // Map Account & Facility
        link.setAccountNumber(cl.getAccountNumber());
        LoanAccount la = loanAccountRepository.findByLoanReference(cl.getAccountNumber())
                .or(() -> loanAccountRepository.findByLoanReference(cl.getLinkedReferenceNo()))
                .orElse(null);
        if (la != null) {
            link.setLoanAccountId(la.getId());
            link.setFacilityId(la.getId());
        } else {
            link.setLoanAccountId(cl.getAccountNumber());
            link.setFacilityId(cl.getAccountNumber());
        }

        // Map Collateral
        Collateral col = collateralRepository.findByCode(cl.getLinkedReferenceNo())
                .or(() -> collateralRepository.findById(cl.getLinkedReferenceNo()))
                .orElse(null);
        if (col != null) {
            link.setCollateralId(col.getId());
        } else {
            link.setCollateralId(cl.getLinkedReferenceNo());
        }

        link.setBranchCode(cl.getBranchCode());
        link.setLinkageType(cl.getLinkageType());
        link.setLinkedReferenceNo(cl.getLinkedReferenceNo());
        link.setDescription(cl.getDescription());
        link.setLinkageCurrency(cl.getLinkageCurrency());
        link.setOverallAmount(cl.getOverallAmount());
        link.setCollateralCategory(cl.getCollateralCategory());
        link.setHaircut(cl.getHaircut());
        link.setLimitAmount(cl.getLimitAmount());
        link.setAllocatedAmount(cl.getLinkedAmount());
        link.setLinkedAmount(cl.getLinkedAmount());
        link.setLinkedPercent(cl.getLinkedPercentNumber());
        link.setUtilOrder(cl.getUtilOrder());
        link.setReinstateOrder(cl.getReinstateOrder());
        link.setUtilAmount(cl.getUtilAmount());
        link.setStatus(cl.getStatus());
        link.setTakenOver(cl.getTakenOver());

        return loanCollateralLinkRepository.save(link);
    }

    public List<CbsSyncLog> getCbsSyncLogs() {
        return cbsSyncLogRepository.findAll();
    }

    public Map<String, Object> getCbsSyncStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("cbsConnected", true);
        status.put("syncMode", configurationService.getCbsSyncMode());
        status.put("syncIntervalMinutes", configurationService.getCbsSyncIntervalMinutes());
        status.put("lastSyncTimestamp", LocalDateTime.now().toString());
        status.put("syncedCustomersCount", customerRepository.count());
        status.put("syncedLoansCount", loanAccountRepository.count());
        status.put("syncedCollateralsCount", collateralRepository.count());
        status.put("syncedLinksCount", loanCollateralLinkRepository.count());
        return status;
    }
}
