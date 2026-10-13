package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_loan_collateral_link_history")
public class LoanCollateralLinkHistory {

    @Id
    private String id;

    @Column(name = "link_id", nullable = false)
    private String linkId;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(name = "loan_account_id", nullable = false)
    private String loanAccountId;

    @Column(name = "facility_id")
    private String facilityId;

    @Column(name = "customer_id")
    private String customerId;

    @Column(name = "previous_allocated_amount")
    private double previousAllocatedAmount;

    @Column(name = "new_allocated_amount")
    private double newAllocatedAmount;

    @Column(name = "previous_linkage_type")
    private String previousLinkageType;

    @Column(name = "new_linkage_type")
    private String newLinkageType;

    @Column(name = "previous_effective_date")
    private String previousEffectiveDate;

    @Column(name = "new_effective_date")
    private String newEffectiveDate;

    @Column(name = "previous_end_date")
    private String previousEndDate;

    @Column(name = "new_end_date")
    private String newEndDate;

    @Column(name = "previous_status")
    private String previousStatus;

    @Column(name = "new_status")
    private String newStatus;

    @Column(name = "action_type", nullable = false)
    private String actionType; // CREATED, UPDATED, ALLOCATION_CHANGED, ENDED, REINSTATED, CBS_SYNC

    @Column(name = "change_reason", columnDefinition = "TEXT")
    private String changeReason;

    @Column(name = "maker_id")
    private String makerId;

    @Column(name = "maker_dt_stamp")
    private String makerDtStamp = LocalDateTime.now().toString();

    @Column(name = "checker_id")
    private String checkerId;

    @Column(name = "checker_dt_stamp")
    private String checkerDtStamp;

    @Column(name = "auth_stat")
    private String authStat = "A";

    public LoanCollateralLinkHistory() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLinkId() { return linkId; }
    public void setLinkId(String linkId) { this.linkId = linkId; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getLoanAccountId() { return loanAccountId; }
    public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public double getPreviousAllocatedAmount() { return previousAllocatedAmount; }
    public void setPreviousAllocatedAmount(double previousAllocatedAmount) { this.previousAllocatedAmount = previousAllocatedAmount; }

    public double getNewAllocatedAmount() { return newAllocatedAmount; }
    public void setNewAllocatedAmount(double newAllocatedAmount) { this.newAllocatedAmount = newAllocatedAmount; }

    public String getPreviousLinkageType() { return previousLinkageType; }
    public void setPreviousLinkageType(String previousLinkageType) { this.previousLinkageType = previousLinkageType; }

    public String getNewLinkageType() { return newLinkageType; }
    public void setNewLinkageType(String newLinkageType) { this.newLinkageType = newLinkageType; }

    public String getPreviousEffectiveDate() { return previousEffectiveDate; }
    public void setPreviousEffectiveDate(String previousEffectiveDate) { this.previousEffectiveDate = previousEffectiveDate; }

    public String getNewEffectiveDate() { return newEffectiveDate; }
    public void setNewEffectiveDate(String newEffectiveDate) { this.newEffectiveDate = newEffectiveDate; }

    public String getPreviousEndDate() { return previousEndDate; }
    public void setPreviousEndDate(String previousEndDate) { this.previousEndDate = previousEndDate; }

    public String getNewEndDate() { return newEndDate; }
    public void setNewEndDate(String newEndDate) { this.newEndDate = newEndDate; }

    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }

    public String getMakerId() { return makerId; }
    public void setMakerId(String makerId) { this.makerId = makerId; }

    public String getMakerDtStamp() { return makerDtStamp; }
    public void setMakerDtStamp(String makerDtStamp) { this.makerDtStamp = makerDtStamp; }

    public String getCheckerId() { return checkerId; }
    public void setCheckerId(String checkerId) { this.checkerId = checkerId; }

    public String getCheckerDtStamp() { return checkerDtStamp; }
    public void setCheckerDtStamp(String checkerDtStamp) { this.checkerDtStamp = checkerDtStamp; }

    public String getAuthStat() { return authStat; }
    public void setAuthStat(String authStat) { this.authStat = authStat; }
}
