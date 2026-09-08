package com.bank.cims.service;

import com.bank.cims.dto.ExposureAdequacySummaryDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class ExposureCalculationService {

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private CollateralTaxonomyRepository collateralTaxonomyRepository;

    @Autowired
    private ConfigurationService configurationService;

    public ExposureAdequacySummaryDto calculateExposureAndAdequacy(String collateralId) {
        ExposureAdequacySummaryDto summary = new ExposureAdequacySummaryDto();
        summary.setCollateralId(collateralId);

        Collateral collateral = collateralRepository.findById(collateralId).orElse(null);
        if (collateral == null) {
            // Also try by code
            collateral = collateralRepository.findByCode(collateralId).orElse(null);
        }

        if (collateral == null) {
            summary.setAdequacyStatus("NOT FOUND");
            summary.setCalculationExplanation("Collateral record not found.");
            return summary;
        }

        summary.setCollateralCode(collateral.getCode());
        summary.setCustomerId(collateral.getCustomerId());
        summary.setCollateralMarketValue(collateral.getValuationAmount());
        summary.setHaircutPercentage(collateral.getHaircut());

        double netValue = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));
        summary.setNetCollateralValue(netValue);

        // Fetch links
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        if (links.isEmpty() && collateral.getCode() != null) {
            links = loanCollateralLinkRepository.findByCollateralId(collateral.getCode());
        }

        double totalAllocated = 0;
        double totalLimit = 0;
        double totalOutstanding = 0;
        List<Map<String, Object>> breakdowns = new ArrayList<>();

        for (LoanCollateralLink link : links) {
            totalAllocated += link.getAllocatedAmount();

            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            LoanAccount facility = null;
            if (facId != null) {
                facility = loanAccountRepository.findById(facId).orElse(null);
                if (facility == null) {
                    facility = loanAccountRepository.findByLoanReference(facId).orElse(null);
                }
            }

            Map<String, Object> bMap = new HashMap<>();
            bMap.put("linkId", link.getId());
            bMap.put("facilityId", facId);
            bMap.put("allocatedAmount", link.getAllocatedAmount());
            bMap.put("linkageType", link.getLinkageType());

            if (facility != null) {
                totalLimit += facility.getApprovedLimit();
                totalOutstanding += facility.getOutstandingBalance();
                bMap.put("loanReference", facility.getLoanReference());
                bMap.put("facilityType", facility.getFacilityType());
                bMap.put("approvedLimit", facility.getApprovedLimit());
                bMap.put("outstandingBalance", facility.getOutstandingBalance());
            }
            breakdowns.add(bMap);
        }

        summary.setTotalAllocatedSecurity(totalAllocated);
        summary.setUnallocatedSecurity(Math.max(0, netValue - totalAllocated));
        summary.setTotalFacilityLimit(totalLimit);
        summary.setTotalOutstandingExposure(totalOutstanding);
        summary.setFacilityBreakdowns(breakdowns);

        // Required Insurance Rule: Sum Insured >= Max(Outstanding Balance, Collateral Value)
        boolean isMandatory = true;
        if (collateral.getCategory() != null) {
            List<CollateralTaxonomy> taxonomies = collateralTaxonomyRepository.findAll();
            for (CollateralTaxonomy tax : taxonomies) {
                if (collateral.getCategory().equalsIgnoreCase(tax.getCategory())) {
                    isMandatory = tax.isInsuranceMandatory();
                    break;
                }
            }
        }

        double thresholdPct = configurationService.getMinimumCoverageAdequacyPct();
        double baseRequired = Math.max(totalOutstanding, collateral.getValuationAmount());
        double reqAmount = isMandatory ? (baseRequired * (thresholdPct / 100.0)) : 0.0;
        summary.setRequiredInsurancePercentage(isMandatory ? thresholdPct : 0.0);
        summary.setRequiredInsuranceAmount(reqAmount);

        // Fetch Policies
        List<InsurancePolicy> policies = insurancePolicyRepository.findByCollateralId(collateral.getId());
        if (policies.isEmpty() && collateral.getCode() != null) {
            policies = insurancePolicyRepository.findByCollateralId(collateral.getCode());
        }

        double currentInsured = 0;
        boolean hasExpiredPolicy = false;
        String todayStr = LocalDate.now().toString();

        for (InsurancePolicy policy : policies) {
            if ("Active".equalsIgnoreCase(policy.getStatus()) || "Approved".equalsIgnoreCase(policy.getStatus())) {
                if (policy.getExpiryDate() != null && policy.getExpiryDate().compareTo(todayStr) < 0) {
                    hasExpiredPolicy = true;
                } else {
                    currentInsured += policy.getInsuredAmount();
                }
            }
        }

        summary.setCurrentInsuredAmount(currentInsured);
        double gap = Math.max(0, reqAmount - currentInsured);
        summary.setInsuranceGap(gap);

        // Adequacy Status
        String status;
        if (!isMandatory) {
            status = "NOT REQUIRED";
        } else if (hasExpiredPolicy && currentInsured < reqAmount) {
            status = "EXPIRED";
        } else if (currentInsured >= reqAmount && reqAmount > 0) {
            if (currentInsured > reqAmount * 1.10) {
                status = "EXCESS";
            } else {
                status = "ADEQUATE";
            }
        } else if (currentInsured > 0) {
            status = "UNDERINSURED";
        } else {
            status = "UNDERINSURED";
        }
        summary.setAdequacyStatus(status);

        // Update collateral status in DB if active
        if ("Active".equalsIgnoreCase(collateral.getStatus()) || "Approved".equalsIgnoreCase(collateral.getStatus())) {
            String colInsStatus = "ADEQUATE".equalsIgnoreCase(status) || "EXCESS".equalsIgnoreCase(status)
                    ? "Adequately Insured"
                    : "EXPIRED".equalsIgnoreCase(status)
                    ? "Expired"
                    : "NOT REQUIRED".equalsIgnoreCase(status)
                    ? "Not Required"
                    : "Underinsured";
            collateral.setInsuranceStatus(colInsStatus);
            collateral.setCurrentAllocation(totalAllocated);
            collateral.setUtilizationPercentage(netValue > 0 ? (totalAllocated / netValue) * 100.0 : 0);
            collateralRepository.save(collateral);
        }

        // Formulate clear explanation
        StringBuilder explanation = new StringBuilder();
        explanation.append(String.format(Locale.ROOT, "Collateral Value: ETB %,.2f with Haircut of %.1f%% yields Net Security Value of ETB %,.2f. ", 
                collateral.getValuationAmount(), collateral.getHaircut(), netValue));
        explanation.append(String.format(Locale.ROOT, "Allocated to %d facilities: ETB %,.2f (Remaining unallocated: ETB %,.2f). ", 
                breakdowns.size(), totalAllocated, summary.getUnallocatedSecurity()));
        if (isMandatory) {
            explanation.append(String.format(Locale.ROOT, "Mandatory Insurance Requirement: Max(Outstanding Exposure ETB %,.2f, Collateral Value ETB %,.2f) = ETB %,.2f. Current Active Insured Coverage: ETB %,.2f. Gap: ETB %,.2f -> Status: %s.",
                    totalOutstanding, collateral.getValuationAmount(), reqAmount, currentInsured, gap, status));
        } else {
            explanation.append("Insurance is Not Mandatory for this collateral category.");
        }
        summary.setCalculationExplanation(explanation.toString());

        return summary;
    }
}
