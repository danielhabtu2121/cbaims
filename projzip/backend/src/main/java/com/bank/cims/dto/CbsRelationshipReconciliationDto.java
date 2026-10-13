package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class CbsRelationshipReconciliationDto {
    private int totalCbsRelationships;
    private int totalCimsRelationships;
    private int matchingCount;
    private int cbsOnlyCount;
    private int cimsOnlyCount;
    private int changedCount;
    private int inconsistentCount;
    private String reconciliationTimestamp;
    private List<ReconciliationItem> items = new ArrayList<>();

    public static class ReconciliationItem {
        private String linkId;
        private String loanAccountId;
        private String collateralId;
        private String status; // MATCHING, CBS_ONLY, CIMS_ONLY, CHANGED_IN_CBS, INCONSISTENT
        private double cbsLinkedAmount;
        private double cimsAllocatedAmount;
        private String cbsLinkageType;
        private String cimsLinkageType;
        private String cbsStatus;
        private String cimsStatus;
        private String differenceSummary;

        public ReconciliationItem() {}

        public String getLinkId() { return linkId; }
        public void setLinkId(String linkId) { this.linkId = linkId; }

        public String getLoanAccountId() { return loanAccountId; }
        public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }

        public String getCollateralId() { return collateralId; }
        public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public double getCbsLinkedAmount() { return cbsLinkedAmount; }
        public void setCbsLinkedAmount(double cbsLinkedAmount) { this.cbsLinkedAmount = cbsLinkedAmount; }

        public double getCimsAllocatedAmount() { return cimsAllocatedAmount; }
        public void setCimsAllocatedAmount(double cimsAllocatedAmount) { this.cimsAllocatedAmount = cimsAllocatedAmount; }

        public String getCbsLinkageType() { return cbsLinkageType; }
        public void setCbsLinkageType(String cbsLinkageType) { this.cbsLinkageType = cbsLinkageType; }

        public String getCimsLinkageType() { return cimsLinkageType; }
        public void setCimsLinkageType(String cimsLinkageType) { this.cimsLinkageType = cimsLinkageType; }

        public String getCbsStatus() { return cbsStatus; }
        public void setCbsStatus(String cbsStatus) { this.cbsStatus = cbsStatus; }

        public String getCimsStatus() { return cimsStatus; }
        public void setCimsStatus(String cimsStatus) { this.cimsStatus = cimsStatus; }

        public String getDifferenceSummary() { return differenceSummary; }
        public void setDifferenceSummary(String differenceSummary) { this.differenceSummary = differenceSummary; }
    }

    public CbsRelationshipReconciliationDto() {}

    public int getTotalCbsRelationships() { return totalCbsRelationships; }
    public void setTotalCbsRelationships(int totalCbsRelationships) { this.totalCbsRelationships = totalCbsRelationships; }

    public int getTotalCimsRelationships() { return totalCimsRelationships; }
    public void setTotalCimsRelationships(int totalCimsRelationships) { this.totalCimsRelationships = totalCimsRelationships; }

    public int getMatchingCount() { return matchingCount; }
    public void setMatchingCount(int matchingCount) { this.matchingCount = matchingCount; }

    public int getCbsOnlyCount() { return cbsOnlyCount; }
    public void setCbsOnlyCount(int cbsOnlyCount) { this.cbsOnlyCount = cbsOnlyCount; }

    public int getCimsOnlyCount() { return cimsOnlyCount; }
    public void setCimsOnlyCount(int cimsOnlyCount) { this.cimsOnlyCount = cimsOnlyCount; }

    public int getChangedCount() { return changedCount; }
    public void setChangedCount(int changedCount) { this.changedCount = changedCount; }

    public int getInconsistentCount() { return inconsistentCount; }
    public void setInconsistentCount(int inconsistentCount) { this.inconsistentCount = inconsistentCount; }

    public String getReconciliationTimestamp() { return reconciliationTimestamp; }
    public void setReconciliationTimestamp(String reconciliationTimestamp) { this.reconciliationTimestamp = reconciliationTimestamp; }

    public List<ReconciliationItem> getItems() { return items; }
    public void setItems(List<ReconciliationItem> items) { this.items = items; }
}
