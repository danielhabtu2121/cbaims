package com.bank.cims.dto;

import java.util.*;

/**
 * First-class authorization scope governing dashboard visibility, permitted drill-down levels,
 * and operational boundaries derived strictly from authenticated user credentials and RBAC.
 */
public class DashboardAuthorizationScope {

    private String userId;
    private String role;
    private String rootLevel; // BANK, SEGMENT, DISTRICT, AREA, BRANCH, PORTFOLIO
    private String rootEntity;

    private List<String> allowedSegments = new ArrayList<>();
    private List<String> allowedDistricts = new ArrayList<>();
    private List<String> allowedAreas = new ArrayList<>();
    private List<String> allowedBranches = new ArrayList<>();
    private List<String> allowedPortfolioOwners = new ArrayList<>();
    private List<String> allowedCustomerIds = new ArrayList<>();

    private Set<String> permittedDrillLevels = new HashSet<>();
    private Set<String> permittedActions = new HashSet<>();

    private boolean isBankWide = false;
    private boolean lockedSegment = false;
    private boolean lockedDistrict = false;
    private boolean lockedBranch = false;

    // Active selection filters for the current request
    private String requestedSegment;
    private String requestedDistrict;
    private String requestedArea;
    private String requestedBranch;

    public DashboardAuthorizationScope() {}

    public boolean isSegmentPermitted(String segment) {
        if (segment == null || segment.isBlank() || segment.equalsIgnoreCase("ALL")) {
            return isBankWide || allowedSegments.size() > 1;
        }
        return allowedSegments.stream().anyMatch(s -> s.equalsIgnoreCase(segment));
    }

    public boolean isDistrictPermitted(String district) {
        if (district == null || district.isBlank() || district.equalsIgnoreCase("ALL")) {
            return !lockedDistrict;
        }
        return allowedDistricts.stream().anyMatch(d -> d.equalsIgnoreCase(district));
    }

    public boolean isBranchPermitted(String branch) {
        if (branch == null || branch.isBlank() || branch.equalsIgnoreCase("ALL")) {
            return !lockedBranch;
        }
        return allowedBranches.stream().anyMatch(b -> b.equalsIgnoreCase(branch));
    }

    public boolean isDrillLevelPermitted(String level) {
        if (level == null) return false;
        return permittedDrillLevels.contains(level.toUpperCase());
    }

    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getRootLevel() { return rootLevel; }
    public void setRootLevel(String rootLevel) { this.rootLevel = rootLevel; }

    public String getRootEntity() { return rootEntity; }
    public void setRootEntity(String rootEntity) { this.rootEntity = rootEntity; }

    public List<String> getAllowedSegments() { return allowedSegments; }
    public void setAllowedSegments(List<String> allowedSegments) { this.allowedSegments = allowedSegments; }

    public List<String> getAllowedDistricts() { return allowedDistricts; }
    public void setAllowedDistricts(List<String> allowedDistricts) { this.allowedDistricts = allowedDistricts; }

    public List<String> getAllowedAreas() { return allowedAreas; }
    public void setAllowedAreas(List<String> allowedAreas) { this.allowedAreas = allowedAreas; }

    public List<String> getAllowedBranches() { return allowedBranches; }
    public void setAllowedBranches(List<String> allowedBranches) { this.allowedBranches = allowedBranches; }

    public List<String> getAllowedPortfolioOwners() { return allowedPortfolioOwners; }
    public void setAllowedPortfolioOwners(List<String> allowedPortfolioOwners) { this.allowedPortfolioOwners = allowedPortfolioOwners; }

    public List<String> getAllowedCustomerIds() { return allowedCustomerIds; }
    public void setAllowedCustomerIds(List<String> allowedCustomerIds) { this.allowedCustomerIds = allowedCustomerIds; }

    public Set<String> getPermittedDrillLevels() { return permittedDrillLevels; }
    public void setPermittedDrillLevels(Set<String> permittedDrillLevels) { this.permittedDrillLevels = permittedDrillLevels; }

    public Set<String> getPermittedActions() { return permittedActions; }
    public void setPermittedActions(Set<String> permittedActions) { this.permittedActions = permittedActions; }

    public boolean isBankWide() { return isBankWide; }
    public void setBankWide(boolean bankWide) { isBankWide = bankWide; }

    public boolean isLockedSegment() { return lockedSegment; }
    public void setLockedSegment(boolean lockedSegment) { this.lockedSegment = lockedSegment; }

    public boolean isLockedDistrict() { return lockedDistrict; }
    public void setLockedDistrict(boolean lockedDistrict) { this.lockedDistrict = lockedDistrict; }

    public boolean isLockedBranch() { return lockedBranch; }
    public void setLockedBranch(boolean lockedBranch) { this.lockedBranch = lockedBranch; }

    public String getRequestedSegment() { return requestedSegment; }
    public void setRequestedSegment(String requestedSegment) { this.requestedSegment = requestedSegment; }

    public String getRequestedDistrict() { return requestedDistrict; }
    public void setRequestedDistrict(String requestedDistrict) { this.requestedDistrict = requestedDistrict; }

    public String getRequestedArea() { return requestedArea; }
    public void setRequestedArea(String requestedArea) { this.requestedArea = requestedArea; }

    public String getRequestedBranch() { return requestedBranch; }
    public void setRequestedBranch(String requestedBranch) { this.requestedBranch = requestedBranch; }
}
