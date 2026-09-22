package com.bank.cims.dto;

import java.util.List;

public class ScopeBannerDto {
    private String displayScope;
    private String scopeLevel; // BANK_WIDE, SEGMENT, DISTRICT, BRANCH, PORTFOLIO
    private String authorizedRole;
    private String segment;
    private List<String> availableSegments;
    private String district;
    private List<String> availableDistricts;
    private String branch;
    private List<String> availableBranches;
    private String portfolioOwner;
    private boolean lockedSegment;
    private boolean lockedDistrict;
    private boolean lockedBranch;
    private String serverDate;
    private String asOfDate;
    private String lastRefresh;

    // CBS freshness
    private String cbsSyncStatus = "Current";
    private String cbsLastSyncedAt;

    // Scope counts & boundary explanation
    private long authorizedBranchesCount;
    private long scopedBranchesCount;
    private String scopeBoundaryDescription;

    public ScopeBannerDto() {}

    public String getDisplayScope() { return displayScope; }
    public void setDisplayScope(String displayScope) { this.displayScope = displayScope; }
    public String getScopeLevel() { return scopeLevel; }
    public void setScopeLevel(String scopeLevel) { this.scopeLevel = scopeLevel; }
    public String getAuthorizedRole() { return authorizedRole; }
    public void setAuthorizedRole(String authorizedRole) { this.authorizedRole = authorizedRole; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public List<String> getAvailableSegments() { return availableSegments; }
    public void setAvailableSegments(List<String> availableSegments) { this.availableSegments = availableSegments; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public List<String> getAvailableDistricts() { return availableDistricts; }
    public void setAvailableDistricts(List<String> availableDistricts) { this.availableDistricts = availableDistricts; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public List<String> getAvailableBranches() { return availableBranches; }
    public void setAvailableBranches(List<String> availableBranches) { this.availableBranches = availableBranches; }
    public String getPortfolioOwner() { return portfolioOwner; }
    public void setPortfolioOwner(String portfolioOwner) { this.portfolioOwner = portfolioOwner; }
    public boolean isLockedSegment() { return lockedSegment; }
    public void setLockedSegment(boolean lockedSegment) { this.lockedSegment = lockedSegment; }
    public boolean isLockedDistrict() { return lockedDistrict; }
    public void setLockedDistrict(boolean lockedDistrict) { this.lockedDistrict = lockedDistrict; }
    public boolean isLockedBranch() { return lockedBranch; }
    public void setLockedBranch(boolean lockedBranch) { this.lockedBranch = lockedBranch; }
    public String getServerDate() { return serverDate; }
    public void setServerDate(String serverDate) { this.serverDate = serverDate; }
    public String getAsOfDate() { return asOfDate; }
    public void setAsOfDate(String asOfDate) { this.asOfDate = asOfDate; }
    public String getLastRefresh() { return lastRefresh; }
    public void setLastRefresh(String lastRefresh) { this.lastRefresh = lastRefresh; }
    public String getCbsSyncStatus() { return cbsSyncStatus; }
    public void setCbsSyncStatus(String cbsSyncStatus) { this.cbsSyncStatus = cbsSyncStatus; }
    public String getCbsLastSyncedAt() { return cbsLastSyncedAt; }
    public void setCbsLastSyncedAt(String cbsLastSyncedAt) { this.cbsLastSyncedAt = cbsLastSyncedAt; }
    public long getAuthorizedBranchesCount() { return authorizedBranchesCount; }
    public void setAuthorizedBranchesCount(long authorizedBranchesCount) { this.authorizedBranchesCount = authorizedBranchesCount; }
    public long getScopedBranchesCount() { return scopedBranchesCount; }
    public void setScopedBranchesCount(long scopedBranchesCount) { this.scopedBranchesCount = scopedBranchesCount; }
    public String getScopeBoundaryDescription() { return scopeBoundaryDescription; }
    public void setScopeBoundaryDescription(String scopeBoundaryDescription) { this.scopeBoundaryDescription = scopeBoundaryDescription; }
}
