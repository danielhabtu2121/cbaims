package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Dedicated Mapping Layer for CBS-to-CIMS canonical domain entities.
 * Handles deterministic field conversions, status mappings, and source metadata attribution.
 */
@Component
public class CbsMapper {

    /**
     * Maps incoming CBS Customer onto CIMS Customer master entity.
     * Updates source-owned fields while preserving CIMS identity.
     */
    public Customer mapCustomer(CbsCustomer cc, Customer existing, String sourceSystem) {
        Customer cust = existing != null ? existing : new Customer();
        if (cust.getId() == null || cust.getId().isBlank()) {
            cust.setId(cc.getId() != null ? cc.getId() : "cst-" + UUID.randomUUID().toString().substring(0, 8));
        }

        cust.setCif(cc.getCif() != null ? cc.getCif().trim() : null);
        cust.setName(cc.getFullName());
        cust.setCustomerType(cc.getCustomerType() != null ? cc.getCustomerType() : "Individual");
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
        cust.setRiskRating(cc.getRiskRating() != null ? cc.getRiskRating() : "Medium");
        cust.setStatus(cc.getCustomerStatus() != null ? cc.getCustomerStatus() : "Active");

        // Source metadata
        cust.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        cust.setCbsSyncStatus("Synced");
        cust.setCbsSyncedAt(LocalDateTime.now().toString());

        return cust;
    }

    /**
     * Maps incoming CBS Facility onto CIMS LoanAccount master entity.
     * Accurately synchronizes limits, balances, and source statuses (including closures).
     */
    public LoanAccount mapFacility(CbsFacility cf, LoanAccount existing, Customer matchedCustomer, String sourceSystem) {
        LoanAccount la = existing != null ? existing : new LoanAccount();
        if (la.getId() == null || la.getId().isBlank()) {
            la.setId(cf.getId() != null ? cf.getId() : "fac-" + UUID.randomUUID().toString().substring(0, 8));
        }

        la.setLoanReference(cf.getLoanRefNo() != null ? cf.getLoanRefNo().trim() : null);
        la.setLineCode(cf.getLineCode());
        la.setAccountNumber(cf.getLoanRefNo());

        if (matchedCustomer != null) {
            la.setCustomerId(matchedCustomer.getId());
        } else if (cf.getCustomerCif() != null) {
            la.setCustomerId(cf.getCustomerCif().trim());
        }

        la.setFacilityType(cf.getFacilityType());
        la.setLineCurrency(cf.getLineCurrency() != null ? cf.getLineCurrency() : "ETB");
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
        la.setNextReviewDueDate(cf.getNextReviewDate());

        // Status & Loan Closure synchronization
        String limitStatus = cf.getLimitStatus() != null ? cf.getLimitStatus() : "Active";
        if ("Closed".equalsIgnoreCase(limitStatus) || "Matured".equalsIgnoreCase(limitStatus) || "Liquidated".equalsIgnoreCase(limitStatus)) {
            la.setStatus("Closed");
        } else {
            la.setStatus(limitStatus);
        }

        // Source metadata
        la.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        la.setCbsSyncStatus("Synced");
        la.setCbsSyncedAt(LocalDateTime.now().toString());

        return la;
    }

    /**
     * Maps incoming CBS Collateral onto CIMS Collateral canonical entity.
     * Enforces strict distinction between Collateral Type (Asset Class) and Ownership Type.
     * Fully preserves Haircut and Limit Contribution.
     */
    public Collateral mapCollateral(CbsCollateral ccol, Collateral existing, Customer matchedCustomer, String sourceSystem) {
        Collateral col = existing != null ? existing : new Collateral();
        if (col.getId() == null || col.getId().isBlank()) {
            col.setId(ccol.getId() != null ? ccol.getId() : "col-" + UUID.randomUUID().toString().substring(0, 8));
        }

        col.setCode(ccol.getCollateralCode() != null ? ccol.getCollateralCode().trim() : null);

        if (matchedCustomer != null) {
            col.setCustomerId(matchedCustomer.getId());
        } else if (ccol.getCustomerCif() != null) {
            col.setCustomerId(ccol.getCustomerCif().trim());
        }

        col.setDescription(ccol.getDescription());
        col.setCategory(ccol.getCategory());

        // CRITICAL: Distinct mapping for Type vs Ownership Type
        col.setType(ccol.getCollateralType() != null ? ccol.getCollateralType() : "Building");
        col.setOwnerType(ccol.getOwnershipType() != null ? ccol.getOwnershipType() : "Borrower-owned");

        col.setCurrency(ccol.getCurrency() != null ? ccol.getCurrency() : "ETB");
        col.setValuationAmount(ccol.getCollateralValue());

        // Haircut preservation
        col.setHaircut(ccol.getHaircut());

        // Limit contribution calculation / preservation
        if (ccol.getLimitContribution() > 0) {
            col.setLimitContribution(ccol.getLimitContribution());
        } else {
            double effectiveHaircut = ccol.getHaircut();
            col.setLimitContribution(ccol.getCollateralValue() * (1.0 - (effectiveHaircut / 100.0)));
        }

        col.setStartDate(ccol.getStartDate());
        col.setReviewDate(ccol.getReviewDate());
        col.setTangible(ccol.isTangible());
        col.setOwningSegment(ccol.getBusinessSegment());
        col.setBranch(ccol.getBranch());
        col.setZipCode(ccol.getZipCode());

        // Source metadata
        col.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        col.setCbsSyncStatus("Synced");
        col.setCbsSyncedAt(LocalDateTime.now().toString());

        return col;
    }

    /**
     * Maps incoming CBS Linkage details onto CIMS LoanCollateralLink entity.
     * Ensures distinct facility identity vs loan account identity and cross-collateral support.
     */
    public LoanCollateralLink mapLink(
            CbsAccCollLinkDtls cl,
            LoanCollateralLink existing,
            LoanAccount matchedLoan,
            Collateral matchedCollateral,
            String sourceSystem) {

        LoanCollateralLink link = existing != null ? existing : new LoanCollateralLink();
        if (link.getId() == null || link.getId().isBlank()) {
            link.setId(cl.getId() != null ? cl.getId() : "link-" + UUID.randomUUID().toString().substring(0, 8));
        }

        // Account & Facility Identity mapping
        link.setAccountNumber(cl.getAccountNumber());
        if (matchedLoan != null) {
            link.setLoanAccountId(matchedLoan.getId());
            // Facility identity distinction
            link.setFacilityId(matchedLoan.getLineCode() != null && !matchedLoan.getLineCode().isBlank()
                    ? matchedLoan.getLineCode()
                    : matchedLoan.getId());
        } else {
            link.setLoanAccountId(cl.getAccountNumber());
            link.setFacilityId(cl.getAccountNumber());
        }

        // Collateral Identity mapping
        if (matchedCollateral != null) {
            link.setCollateralId(matchedCollateral.getId());
        } else {
            link.setCollateralId(cl.getLinkedReferenceNo());
        }

        link.setBranchCode(cl.getBranchCode());
        link.setLinkageType(cl.getLinkageType() != null ? cl.getLinkageType() : "Primary");
        link.setLinkedReferenceNo(cl.getLinkedReferenceNo());
        link.setDescription(cl.getDescription());
        link.setLinkageCurrency(cl.getLinkageCurrency() != null ? cl.getLinkageCurrency() : "ETB");
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
        link.setStatus(cl.getStatus() != null ? cl.getStatus() : "Active");
        link.setTakenOver(cl.getTakenOver() != null ? cl.getTakenOver() : "N");

        // Source metadata
        link.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        link.setSourceRecordId(cl.getId());
        link.setCbsSyncStatus("Synced");
        link.setCbsSyncedAt(LocalDateTime.now().toString());

        return link;
    }
}
