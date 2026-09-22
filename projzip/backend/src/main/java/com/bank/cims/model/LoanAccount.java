package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_loan_accounts")
public class LoanAccount {
    @Id
    private String id;

    @Column(name = "line_code")
    private String lineCode;

    @Column(name = "loan_reference", nullable = false, unique = true)
    private String loanReference;

    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @Column(name = "facility_type", nullable = false)
    private String facilityType;

    @Column(name = "line_currency")
    private String lineCurrency = "ETB";

    @Column(name = "revolving_line")
    private boolean revolvingLine = false;

    @Column(name = "line_start_date")
    private String lineStartDate;

    @Column(name = "line_expiry_date")
    private String lineExpiryDate;

    @Column(name = "approved_limit", nullable = false)
    private double approvedLimit;

    @Column(name = "outstanding_balance", nullable = false)
    private double outstandingBalance;

    @Column(name = "available_amount")
    private double availableAmount;

    @Column(name = "collateral_contribution")
    private double collateralContribution = 0;

    @Column(name = "collateral_pct")
    private double collateralPct = 0;

    private String segment;
    private String branch;

    @Column(name = "rm_user_id")
    private String rmUserId;

    @Column(nullable = false)
    private String status = "Active";

    @Column(name = "next_review_due_date")
    private String nextReviewDueDate;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "cbs_sync_status")
    private String cbsSyncStatus = "Synced";

    @Column(name = "cbs_synced_at")
    private String cbsSyncedAt;

    private String source = "CBS_SIM";

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

    @Column(name = "once_auth")
    private String onceAuth = "Y";

    public LoanAccount() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getLineCode() { return lineCode; }
    public void setLineCode(String lineCode) { this.lineCode = lineCode; }
    public String getLoanReference() { return loanReference; }
    public void setLoanReference(String loanReference) { this.loanReference = loanReference; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getFacilityType() { return facilityType; }
    public void setFacilityType(String facilityType) { this.facilityType = facilityType; }
    public String getLineCurrency() { return lineCurrency; }
    public void setLineCurrency(String lineCurrency) { this.lineCurrency = lineCurrency; }
    public boolean isRevolvingLine() { return revolvingLine; }
    public void setRevolvingLine(boolean revolvingLine) { this.revolvingLine = revolvingLine; }
    public String getLineStartDate() { return lineStartDate; }
    public void setLineStartDate(String lineStartDate) { this.lineStartDate = lineStartDate; }
    public String getLineExpiryDate() { return lineExpiryDate; }
    public void setLineExpiryDate(String lineExpiryDate) { this.lineExpiryDate = lineExpiryDate; }
    public double getApprovedLimit() { return approvedLimit; }
    public void setApprovedLimit(double approvedLimit) { this.approvedLimit = approvedLimit; }
    public double getOutstandingBalance() { return outstandingBalance; }
    public void setOutstandingBalance(double outstandingBalance) { this.outstandingBalance = outstandingBalance; }
    public double getAvailableAmount() { return availableAmount; }
    public void setAvailableAmount(double availableAmount) { this.availableAmount = availableAmount; }
    public double getCollateralContribution() { return collateralContribution; }
    public void setCollateralContribution(double collateralContribution) { this.collateralContribution = collateralContribution; }
    public double getCollateralPct() { return collateralPct; }
    public void setCollateralPct(double collateralPct) { this.collateralPct = collateralPct; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getRmUserId() { return rmUserId; }
    public void setRmUserId(String rmUserId) { this.rmUserId = rmUserId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAccountNumber() { return accountNumber != null ? accountNumber : loanReference; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getCbsSyncStatus() { return cbsSyncStatus; }
    public void setCbsSyncStatus(String cbsSyncStatus) { this.cbsSyncStatus = cbsSyncStatus; }
    public String getCbsSyncedAt() { return cbsSyncedAt; }
    public void setCbsSyncedAt(String cbsSyncedAt) { this.cbsSyncedAt = cbsSyncedAt; }
    public String getNextReviewDueDate() { return nextReviewDueDate; }
    public void setNextReviewDueDate(String nextReviewDueDate) { this.nextReviewDueDate = nextReviewDueDate; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
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
    public String getOnceAuth() { return onceAuth; }
    public void setOnceAuth(String onceAuth) { this.onceAuth = onceAuth; }
}
