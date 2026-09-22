package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_loan_collateral_links")
public class LoanCollateralLink {
    @Id
    private String id;

    @Column(name = "loan_account_id", nullable = false)
    private String loanAccountId;

    @Column(name = "facility_id")
    private String facilityId;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "branch_code")
    private String branchCode;

    @Column(name = "linked_reference_no")
    private String linkedReferenceNo;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "linkage_currency")
    private String linkageCurrency = "ETB";

    @Column(name = "overall_amount")
    private double overallAmount;

    @Column(name = "collateral_category")
    private String collateralCategory;

    private double haircut = 0;

    @Column(name = "limit_amount")
    private double limitAmount;

    @Column(name = "linked_amount")
    private double linkedAmount;

    @Column(name = "linked_percent")
    private double linkedPercent;

    @Column(name = "util_order")
    private int utilOrder = 1;

    @Column(name = "reinstate_order")
    private int reinstateOrder = 1;

    @Column(name = "util_amount")
    private double utilAmount;

    private String status = "Active";

    @Column(name = "taken_over")
    private String takenOver = "N";

    @Column(name = "effective_date")
    private String effectiveDate;

    @Column(name = "end_date")
    private String endDate;

    @Column(name = "change_reason", columnDefinition = "TEXT")
    private String changeReason;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(name = "allocated_amount", nullable = false)
    private double allocatedAmount;

    @Column(name = "linkage_type")
    private String linkageType = "Primary";

    @Column(name = "utilization_pct")
    private double utilizationPct = 0;

    @Column(name = "maker_id")
    private String makerId;

    @Column(name = "maker_dt_stamp")
    private String makerDtStamp = LocalDateTime.now().toString();

    @Column(name = "checker_id")
    private String checkerId;

    @Column(name = "checker_dt_stamp")
    private String checkerDtStamp;

    @Column(name = "record_stat")
    private String recordStat = "O";

    @Column(name = "auth_stat")
    private String authStat = "A";

    @Column(name = "mod_no")
    private int modNo = 1;

    public LoanCollateralLink() {}

    public LoanCollateralLink(String id, String loanAccountId, String collateralId, double allocatedAmount) {
        this.id = id;
        this.loanAccountId = loanAccountId;
        this.facilityId = loanAccountId;
        this.collateralId = collateralId;
        this.allocatedAmount = allocatedAmount;
        this.linkedAmount = allocatedAmount;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getLoanAccountId() { return loanAccountId; }
    public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }
    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getBranchCode() { return branchCode; }
    public void setBranchCode(String branchCode) { this.branchCode = branchCode; }
    public String getLinkedReferenceNo() { return linkedReferenceNo; }
    public void setLinkedReferenceNo(String linkedReferenceNo) { this.linkedReferenceNo = linkedReferenceNo; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getLinkageCurrency() { return linkageCurrency; }
    public void setLinkageCurrency(String linkageCurrency) { this.linkageCurrency = linkageCurrency; }
    public double getOverallAmount() { return overallAmount; }
    public void setOverallAmount(double overallAmount) { this.overallAmount = overallAmount; }
    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }
    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }
    public double getLimitAmount() { return limitAmount; }
    public void setLimitAmount(double limitAmount) { this.limitAmount = limitAmount; }
    public double getLinkedAmount() { return linkedAmount; }
    public void setLinkedAmount(double linkedAmount) { this.linkedAmount = linkedAmount; }
    public double getLinkedPercent() { return linkedPercent; }
    public void setLinkedPercent(double linkedPercent) { this.linkedPercent = linkedPercent; }
    public int getUtilOrder() { return utilOrder; }
    public void setUtilOrder(int utilOrder) { this.utilOrder = utilOrder; }
    public int getReinstateOrder() { return reinstateOrder; }
    public void setReinstateOrder(int reinstateOrder) { this.reinstateOrder = reinstateOrder; }
    public double getUtilAmount() { return utilAmount; }
    public void setUtilAmount(double utilAmount) { this.utilAmount = utilAmount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTakenOver() { return takenOver; }
    public void setTakenOver(String takenOver) { this.takenOver = takenOver; }
    public String getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public double getAllocatedAmount() { return allocatedAmount; }
    public void setAllocatedAmount(double allocatedAmount) { 
        this.allocatedAmount = allocatedAmount; 
        this.linkedAmount = allocatedAmount;
    }
    public String getLinkageType() { return linkageType; }
    public void setLinkageType(String linkageType) { this.linkageType = linkageType; }
    public double getUtilizationPct() { return utilizationPct; }
    public void setUtilizationPct(double utilizationPct) { this.utilizationPct = utilizationPct; }
    public String getMakerId() { return makerId; }
    public void setMakerId(String makerId) { this.makerId = makerId; }
    public String getMakerDtStamp() { return makerDtStamp; }
    public void setMakerDtStamp(String makerDtStamp) { this.makerDtStamp = makerDtStamp; }
    public String getCheckerId() { return checkerId; }
    public void setCheckerId(String checkerId) { this.checkerId = checkerId; }
    public String getCheckerDtStamp() { return checkerDtStamp; }
    public void setCheckerDtStamp(String checkerDtStamp) { this.checkerDtStamp = checkerDtStamp; }
    public String getRecordStat() { return recordStat; }
    public void setRecordStat(String recordStat) { this.recordStat = recordStat; }
    public String getAuthStat() { return authStat; }
    public void setAuthStat(String authStat) { this.authStat = authStat; }
    public int getModNo() { return modNo; }
    public void setModNo(int modNo) { this.modNo = modNo; }
}
