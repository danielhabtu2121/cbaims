package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class CollateralSecuredFacilitiesSummaryDto {
    private String collateralId;
    private String collateralCode;
    private String description;
    private String category;
    private String type;
    private String ownerType;
    private String currency;
    private double marketValuation;
    private double haircut;
    private double netCollateralValue;
    private double totalAllocatedSecurity;
    private double unallocatedSecurity;
    private double utilizationPct;

    // Aggregate Exposure across all active linked facilities (Section 14 & 18)
    private int linkedFacilityCount;
    private double aggregateSecuredExposure; // Sum of outstanding balances of all active linked facilities
    private double totalFacilityApprovedLimit;

    // Collateral Insurance Adequacy relative to aggregate secured exposure (Section 14, 18, 38)
    private double currentInsuredAmount;
    private double requiredInsuranceAmount;
    private double insuranceGap;
    private String adequacyStatus; // ADEQUATE, UNDERINSURED, EXPIRED, NOT REQUIRED
    private double coveragePercentage;
    private String calculationExplanation;

    // Detailed Secured Facilities table
    private List<CollateralFacilityLinkDto> securedFacilities = new ArrayList<>();

    public CollateralSecuredFacilitiesSummaryDto() {}

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getOwnerType() { return ownerType; }
    public void setOwnerType(String ownerType) { this.ownerType = ownerType; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public double getMarketValuation() { return marketValuation; }
    public void setMarketValuation(double marketValuation) { this.marketValuation = marketValuation; }

    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }

    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }

    public double getTotalAllocatedSecurity() { return totalAllocatedSecurity; }
    public void setTotalAllocatedSecurity(double totalAllocatedSecurity) { this.totalAllocatedSecurity = totalAllocatedSecurity; }

    public double getUnallocatedSecurity() { return unallocatedSecurity; }
    public void setUnallocatedSecurity(double unallocatedSecurity) { this.unallocatedSecurity = unallocatedSecurity; }

    public double getUtilizationPct() { return utilizationPct; }
    public void setUtilizationPct(double utilizationPct) { this.utilizationPct = utilizationPct; }

    public int getLinkedFacilityCount() { return linkedFacilityCount; }
    public void setLinkedFacilityCount(int linkedFacilityCount) { this.linkedFacilityCount = linkedFacilityCount; }

    public double getAggregateSecuredExposure() { return aggregateSecuredExposure; }
    public void setAggregateSecuredExposure(double aggregateSecuredExposure) { this.aggregateSecuredExposure = aggregateSecuredExposure; }

    public double getTotalFacilityApprovedLimit() { return totalFacilityApprovedLimit; }
    public void setTotalFacilityApprovedLimit(double totalFacilityApprovedLimit) { this.totalFacilityApprovedLimit = totalFacilityApprovedLimit; }

    public double getCurrentInsuredAmount() { return currentInsuredAmount; }
    public void setCurrentInsuredAmount(double currentInsuredAmount) { this.currentInsuredAmount = currentInsuredAmount; }

    public double getRequiredInsuranceAmount() { return requiredInsuranceAmount; }
    public void setRequiredInsuranceAmount(double requiredInsuranceAmount) { this.requiredInsuranceAmount = requiredInsuranceAmount; }

    public double getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(double insuranceGap) { this.insuranceGap = insuranceGap; }

    public String getAdequacyStatus() { return adequacyStatus; }
    public void setAdequacyStatus(String adequacyStatus) { this.adequacyStatus = adequacyStatus; }

    public double getCoveragePercentage() { return coveragePercentage; }
    public void setCoveragePercentage(double coveragePercentage) { this.coveragePercentage = coveragePercentage; }

    public String getCalculationExplanation() { return calculationExplanation; }
    public void setCalculationExplanation(String calculationExplanation) { this.calculationExplanation = calculationExplanation; }

    public List<CollateralFacilityLinkDto> getSecuredFacilities() { return securedFacilities; }
    public void setSecuredFacilities(List<CollateralFacilityLinkDto> securedFacilities) { this.securedFacilities = securedFacilities; }
}
