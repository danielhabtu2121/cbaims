package com.bank.cims.dto;

import java.util.List;
import java.util.Map;

public class ExposureAdequacySummaryDto {
    private String collateralId;
    private String collateralCode;
    private String customerId;
    private double totalFacilityLimit;
    private double totalOutstandingExposure;
    private double collateralMarketValue;
    private double haircutPercentage;
    private double netCollateralValue;
    private double totalAllocatedSecurity;
    private double unallocatedSecurity;
    private double requiredInsurancePercentage;
    private double requiredInsuranceAmount;
    private double currentInsuredAmount;
    private double insuranceGap;
    private String adequacyStatus; // ADEQUATE, UNDERINSURED, EXCESS, NOT REQUIRED, EXPIRED, NON_COMPLIANT
    private String calculationExplanation;
    private List<Map<String, Object>> facilityBreakdowns;

    public ExposureAdequacySummaryDto() {}

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public double getTotalFacilityLimit() { return totalFacilityLimit; }
    public void setTotalFacilityLimit(double totalFacilityLimit) { this.totalFacilityLimit = totalFacilityLimit; }
    public double getTotalOutstandingExposure() { return totalOutstandingExposure; }
    public void setTotalOutstandingExposure(double totalOutstandingExposure) { this.totalOutstandingExposure = totalOutstandingExposure; }
    public double getCollateralMarketValue() { return collateralMarketValue; }
    public void setCollateralMarketValue(double collateralMarketValue) { this.collateralMarketValue = collateralMarketValue; }
    public double getHaircutPercentage() { return haircutPercentage; }
    public void setHaircutPercentage(double haircutPercentage) { this.haircutPercentage = haircutPercentage; }
    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }
    public double getTotalAllocatedSecurity() { return totalAllocatedSecurity; }
    public void setTotalAllocatedSecurity(double totalAllocatedSecurity) { this.totalAllocatedSecurity = totalAllocatedSecurity; }
    public double getUnallocatedSecurity() { return unallocatedSecurity; }
    public void setUnallocatedSecurity(double unallocatedSecurity) { this.unallocatedSecurity = unallocatedSecurity; }
    public double getRequiredInsurancePercentage() { return requiredInsurancePercentage; }
    public void setRequiredInsurancePercentage(double requiredInsurancePercentage) { this.requiredInsurancePercentage = requiredInsurancePercentage; }
    public double getRequiredInsuranceAmount() { return requiredInsuranceAmount; }
    public void setRequiredInsuranceAmount(double requiredInsuranceAmount) { this.requiredInsuranceAmount = requiredInsuranceAmount; }
    public double getCurrentInsuredAmount() { return currentInsuredAmount; }
    public void setCurrentInsuredAmount(double currentInsuredAmount) { this.currentInsuredAmount = currentInsuredAmount; }
    public double getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(double insuranceGap) { this.insuranceGap = insuranceGap; }
    public String getAdequacyStatus() { return adequacyStatus; }
    public void setAdequacyStatus(String adequacyStatus) { this.adequacyStatus = adequacyStatus; }
    public String getCalculationExplanation() { return calculationExplanation; }
    public void setCalculationExplanation(String calculationExplanation) { this.calculationExplanation = calculationExplanation; }
    public List<Map<String, Object>> getFacilityBreakdowns() { return facilityBreakdowns; }
    public void setFacilityBreakdowns(List<Map<String, Object>> facilityBreakdowns) { this.facilityBreakdowns = facilityBreakdowns; }
}
