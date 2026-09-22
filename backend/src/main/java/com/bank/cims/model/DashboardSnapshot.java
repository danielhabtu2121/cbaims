package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "cims_dashboard_snapshots",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_snapshot_date_scope", columnNames = {"snapshot_date", "scope_level", "scope_id"})
    }
)
public class DashboardSnapshot {

    @Id
    private String id;

    @Column(name = "snapshot_date", nullable = false)
    private String snapshotDate;

    @Column(name = "as_of_date", nullable = false)
    private String asOfDate;

    @Column(name = "captured_at", nullable = false)
    private String capturedAt = LocalDateTime.now().toString();

    @Column(name = "scope_level", nullable = false)
    private String scopeLevel; // BANK, SEGMENT, DISTRICT, AREA, BRANCH

    @Column(name = "scope_id", nullable = false)
    private String scopeId; // e.g. "ALL", "Corporate Banking", "Addis Ababa East District", "Bole Special Branch"

    @Column(name = "total_exposure")
    private double totalExposure;

    @Column(name = "collateral_value")
    private double collateralValue;

    @Column(name = "net_security_value")
    private double netSecurityValue;

    @Column(name = "required_insurance")
    private double requiredInsurance;

    @Column(name = "active_insurance")
    private double activeInsurance;

    @Column(name = "insurance_gap")
    private double insuranceGap;

    @Column(name = "coverage_percentage")
    private double coveragePercentage;

    @Column(name = "uninsured_collaterals_count")
    private long uninsuredCollateralsCount;

    @Column(name = "underinsured_collaterals_count")
    private long underinsuredCollateralsCount;

    @Column(name = "expired_policies_count")
    private long expiredPoliciesCount;

    @Column(name = "open_exceptions_count")
    private long openExceptionsCount;

    @Column(name = "total_facilities_count")
    private long totalFacilitiesCount;

    @Column(name = "total_customers_count")
    private long totalCustomersCount;

    @Column(name = "total_collaterals_count")
    private long totalCollateralsCount;

    public DashboardSnapshot() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSnapshotDate() { return snapshotDate; }
    public void setSnapshotDate(String snapshotDate) { this.snapshotDate = snapshotDate; }

    public String getAsOfDate() { return asOfDate; }
    public void setAsOfDate(String asOfDate) { this.asOfDate = asOfDate; }

    public String getCapturedAt() { return capturedAt; }
    public void setCapturedAt(String capturedAt) { this.capturedAt = capturedAt; }

    public String getScopeLevel() { return scopeLevel; }
    public void setScopeLevel(String scopeLevel) { this.scopeLevel = scopeLevel; }

    public String getScopeId() { return scopeId; }
    public void setScopeId(String scopeId) { this.scopeId = scopeId; }

    public double getTotalExposure() { return totalExposure; }
    public void setTotalExposure(double totalExposure) { this.totalExposure = totalExposure; }

    public double getCollateralValue() { return collateralValue; }
    public void setCollateralValue(double collateralValue) { this.collateralValue = collateralValue; }

    public double getNetSecurityValue() { return netSecurityValue; }
    public void setNetSecurityValue(double netSecurityValue) { this.netSecurityValue = netSecurityValue; }

    public double getRequiredInsurance() { return requiredInsurance; }
    public void setRequiredInsurance(double requiredInsurance) { this.requiredInsurance = requiredInsurance; }

    public double getActiveInsurance() { return activeInsurance; }
    public void setActiveInsurance(double activeInsurance) { this.activeInsurance = activeInsurance; }

    public double getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(double insuranceGap) { this.insuranceGap = insuranceGap; }

    public double getCoveragePercentage() { return coveragePercentage; }
    public void setCoveragePercentage(double coveragePercentage) { this.coveragePercentage = coveragePercentage; }

    public long getUninsuredCollateralsCount() { return uninsuredCollateralsCount; }
    public void setUninsuredCollateralsCount(long uninsuredCollateralsCount) { this.uninsuredCollateralsCount = uninsuredCollateralsCount; }

    public long getUnderinsuredCollateralsCount() { return underinsuredCollateralsCount; }
    public void setUnderinsuredCollateralsCount(long underinsuredCollateralsCount) { this.underinsuredCollateralsCount = underinsuredCollateralsCount; }

    public long getExpiredPoliciesCount() { return expiredPoliciesCount; }
    public void setExpiredPoliciesCount(long expiredPoliciesCount) { this.expiredPoliciesCount = expiredPoliciesCount; }

    public long getOpenExceptionsCount() { return openExceptionsCount; }
    public void setOpenExceptionsCount(long openExceptionsCount) { this.openExceptionsCount = openExceptionsCount; }

    public long getTotalFacilitiesCount() { return totalFacilitiesCount; }
    public void setTotalFacilitiesCount(long totalFacilitiesCount) { this.totalFacilitiesCount = totalFacilitiesCount; }

    public long getTotalCustomersCount() { return totalCustomersCount; }
    public void setTotalCustomersCount(long totalCustomersCount) { this.totalCustomersCount = totalCustomersCount; }

    public long getTotalCollateralsCount() { return totalCollateralsCount; }
    public void setTotalCollateralsCount(long totalCollateralsCount) { this.totalCollateralsCount = totalCollateralsCount; }
}
