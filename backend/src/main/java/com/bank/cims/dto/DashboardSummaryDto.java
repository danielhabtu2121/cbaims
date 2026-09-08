package com.bank.cims.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class DashboardSummaryDto {
    private ScopeBannerDto scopeBanner;
    
    // 12 Primary KPI Cards (§5)
    private BigDecimal totalOutstandingExposure;
    private BigDecimal totalCollateralMarketValue;
    private BigDecimal totalNetSecurityValue;
    private BigDecimal totalInsuranceRequired;
    private BigDecimal totalValidActiveInsurance;
    private BigDecimal totalInsuranceGap;
    private double insuranceCoveragePct;
    private long expiredPoliciesCount;
    private long policiesExpiringWithin30Days;
    private long openExceptionsCount;
    private long pendingApprovalsCount;
    private long activeCollateralsCount;

    // Role-specific KPI supplements
    private long totalCustomersCount;
    private long totalFacilitiesCount;
    private long totalBranchesCount;
    private long missingDocumentsCount;
    private long pendingDocumentVerificationsCount;
    private long returnedTasksCount;
    private long overrideCount;
    private double insurerConcentrationMaxPct;
    private String systemDate;
    private String lastRefreshTimestamp;

    public DashboardSummaryDto() {}

    public ScopeBannerDto getScopeBanner() { return scopeBanner; }
    public void setScopeBanner(ScopeBannerDto scopeBanner) { this.scopeBanner = scopeBanner; }
    public BigDecimal getTotalOutstandingExposure() { return totalOutstandingExposure; }
    public void setTotalOutstandingExposure(BigDecimal totalOutstandingExposure) { this.totalOutstandingExposure = totalOutstandingExposure; }
    public BigDecimal getTotalCollateralMarketValue() { return totalCollateralMarketValue; }
    public void setTotalCollateralMarketValue(BigDecimal totalCollateralMarketValue) { this.totalCollateralMarketValue = totalCollateralMarketValue; }
    public BigDecimal getTotalNetSecurityValue() { return totalNetSecurityValue; }
    public void setTotalNetSecurityValue(BigDecimal totalNetSecurityValue) { this.totalNetSecurityValue = totalNetSecurityValue; }
    public BigDecimal getTotalInsuranceRequired() { return totalInsuranceRequired; }
    public void setTotalInsuranceRequired(BigDecimal totalInsuranceRequired) { this.totalInsuranceRequired = totalInsuranceRequired; }
    public BigDecimal getTotalValidActiveInsurance() { return totalValidActiveInsurance; }
    public void setTotalValidActiveInsurance(BigDecimal totalValidActiveInsurance) { this.totalValidActiveInsurance = totalValidActiveInsurance; }
    public BigDecimal getTotalInsuranceGap() { return totalInsuranceGap; }
    public void setTotalInsuranceGap(BigDecimal totalInsuranceGap) { this.totalInsuranceGap = totalInsuranceGap; }
    public double getInsuranceCoveragePct() { return insuranceCoveragePct; }
    public void setInsuranceCoveragePct(double insuranceCoveragePct) { this.insuranceCoveragePct = insuranceCoveragePct; }
    public long getExpiredPoliciesCount() { return expiredPoliciesCount; }
    public void setExpiredPoliciesCount(long expiredPoliciesCount) { this.expiredPoliciesCount = expiredPoliciesCount; }
    public long getPoliciesExpiringWithin30Days() { return policiesExpiringWithin30Days; }
    public void setPoliciesExpiringWithin30Days(long policiesExpiringWithin30Days) { this.policiesExpiringWithin30Days = policiesExpiringWithin30Days; }
    public long getOpenExceptionsCount() { return openExceptionsCount; }
    public void setOpenExceptionsCount(long openExceptionsCount) { this.openExceptionsCount = openExceptionsCount; }
    public long getPendingApprovalsCount() { return pendingApprovalsCount; }
    public void setPendingApprovalsCount(long pendingApprovalsCount) { this.pendingApprovalsCount = pendingApprovalsCount; }
    public long getActiveCollateralsCount() { return activeCollateralsCount; }
    public void setActiveCollateralsCount(long activeCollateralsCount) { this.activeCollateralsCount = activeCollateralsCount; }
    public long getTotalCustomersCount() { return totalCustomersCount; }
    public void setTotalCustomersCount(long totalCustomersCount) { this.totalCustomersCount = totalCustomersCount; }
    public long getTotalFacilitiesCount() { return totalFacilitiesCount; }
    public void setTotalFacilitiesCount(long totalFacilitiesCount) { this.totalFacilitiesCount = totalFacilitiesCount; }
    public long getTotalBranchesCount() { return totalBranchesCount; }
    public void setTotalBranchesCount(long totalBranchesCount) { this.totalBranchesCount = totalBranchesCount; }
    public long getMissingDocumentsCount() { return missingDocumentsCount; }
    public void setMissingDocumentsCount(long missingDocumentsCount) { this.missingDocumentsCount = missingDocumentsCount; }
    public long getPendingDocumentVerificationsCount() { return pendingDocumentVerificationsCount; }
    public void setPendingDocumentVerificationsCount(long pendingDocumentVerificationsCount) { this.pendingDocumentVerificationsCount = pendingDocumentVerificationsCount; }
    public long getReturnedTasksCount() { return returnedTasksCount; }
    public void setReturnedTasksCount(long returnedTasksCount) { this.returnedTasksCount = returnedTasksCount; }
    public long getOverrideCount() { return overrideCount; }
    public void setOverrideCount(long overrideCount) { this.overrideCount = overrideCount; }
    public double getInsurerConcentrationMaxPct() { return insurerConcentrationMaxPct; }
    public void setInsurerConcentrationMaxPct(double insurerConcentrationMaxPct) { this.insurerConcentrationMaxPct = insurerConcentrationMaxPct; }
    public String getSystemDate() { return systemDate; }
    public void setSystemDate(String systemDate) { this.systemDate = systemDate; }
    public String getLastRefreshTimestamp() { return lastRefreshTimestamp; }
    public void setLastRefreshTimestamp(String lastRefreshTimestamp) { this.lastRefreshTimestamp = lastRefreshTimestamp; }
}
