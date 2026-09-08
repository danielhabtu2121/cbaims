package com.bank.cims.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class DashboardChartDataDto {
    // Chart 1: Compliance Donut
    private List<Map<String, Object>> complianceDonut;

    // Chart 2: Exposure vs Protection grouped bars (by Segment or District)
    private List<Map<String, Object>> exposureVsProtection;

    // Chart 3: District Risk Ranking
    private List<Map<String, Object>> districtRanking;

    // Chart 4: Branch Compliance Ranking
    private List<Map<String, Object>> branchRanking;

    // Chart 5: Expiry Pipeline Buckets
    private List<Map<String, Object>> expiryPipeline;

    // Chart 6: Collateral Category Distribution
    private List<Map<String, Object>> collateralCategoryDistribution;

    // Chart 7: Top Insurance Gaps
    private List<Map<String, Object>> topInsuranceGaps;

    // Chart 8: Workflow Funnel
    private List<Map<String, Object>> workflowFunnel;

    // Chart 9: Documentation Health
    private List<Map<String, Object>> documentationHealth;

    // Chart 10: Ownership Distribution
    private List<Map<String, Object>> ownershipDistribution;

    // Chart 11: Genuine Historical Performance (or null/empty)
    private List<Map<String, Object>> historicalSnapshots;
    private String historicalDataMessage;

    public DashboardChartDataDto() {}

    public List<Map<String, Object>> getComplianceDonut() { return complianceDonut; }
    public void setComplianceDonut(List<Map<String, Object>> complianceDonut) { this.complianceDonut = complianceDonut; }
    public List<Map<String, Object>> getExposureVsProtection() { return exposureVsProtection; }
    public void setExposureVsProtection(List<Map<String, Object>> exposureVsProtection) { this.exposureVsProtection = exposureVsProtection; }
    public List<Map<String, Object>> getDistrictRanking() { return districtRanking; }
    public void setDistrictRanking(List<Map<String, Object>> districtRanking) { this.districtRanking = districtRanking; }
    public List<Map<String, Object>> getBranchRanking() { return branchRanking; }
    public void setBranchRanking(List<Map<String, Object>> branchRanking) { this.branchRanking = branchRanking; }
    public List<Map<String, Object>> getExpiryPipeline() { return expiryPipeline; }
    public void setExpiryPipeline(List<Map<String, Object>> expiryPipeline) { this.expiryPipeline = expiryPipeline; }
    public List<Map<String, Object>> getCollateralCategoryDistribution() { return collateralCategoryDistribution; }
    public void setCollateralCategoryDistribution(List<Map<String, Object>> collateralCategoryDistribution) { this.collateralCategoryDistribution = collateralCategoryDistribution; }
    public List<Map<String, Object>> getTopInsuranceGaps() { return topInsuranceGaps; }
    public void setTopInsuranceGaps(List<Map<String, Object>> topInsuranceGaps) { this.topInsuranceGaps = topInsuranceGaps; }
    public List<Map<String, Object>> getWorkflowFunnel() { return workflowFunnel; }
    public void setWorkflowFunnel(List<Map<String, Object>> workflowFunnel) { this.workflowFunnel = workflowFunnel; }
    public List<Map<String, Object>> getDocumentationHealth() { return documentationHealth; }
    public void setDocumentationHealth(List<Map<String, Object>> documentationHealth) { this.documentationHealth = documentationHealth; }
    public List<Map<String, Object>> getOwnershipDistribution() { return ownershipDistribution; }
    public void setOwnershipDistribution(List<Map<String, Object>> ownershipDistribution) { this.ownershipDistribution = ownershipDistribution; }
    public List<Map<String, Object>> getHistoricalSnapshots() { return historicalSnapshots; }
    public void setHistoricalSnapshots(List<Map<String, Object>> historicalSnapshots) { this.historicalSnapshots = historicalSnapshots; }
    public String getHistoricalDataMessage() { return historicalDataMessage; }
    public void setHistoricalDataMessage(String historicalDataMessage) { this.historicalDataMessage = historicalDataMessage; }
}
