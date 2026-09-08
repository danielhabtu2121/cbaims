package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_insurance_policies")
public class InsurancePolicy {
    @Id
    private String id;

    @Column(name = "policy_number", nullable = false, unique = true)
    private String policyNumber;

    @Column(name = "collateral_id")
    private String collateralId;

    @Column(name = "customer_id")
    private String customerId;

    @Column(name = "insurer_id")
    private String insurerId;

    @Column(name = "insurer_name")
    private String insurerName;

    @Column(name = "coverage_type")
    private String coverageType;

    @Column(name = "insured_amount")
    private double insuredAmount;

    @Column
    private double premium;

    @Column(name = "effective_date")
    private String effectiveDate;

    @Column(name = "expiry_date")
    private String expiryDate;

    @Column
    private String status = "Active";

    @Column(name = "replaces_policy_id")
    private String replacesPolicyId;

    @Column(name = "renewed_from_policy_id")
    private String renewedFromPolicyId;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(name = "closure_reason", columnDefinition = "TEXT")
    private String closureReason;

    @Column(name = "reopening_reason", columnDefinition = "TEXT")
    private String reopeningReason;

    @Column(name = "endorsement_count")
    private int endorsementCount = 0;

    private int version = 1;

    @Column(name = "history_json", columnDefinition = "TEXT")
    private String historyJson;

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

    public InsurancePolicy() {}

    public InsurancePolicy(String id, String policyNumber, String insurerName, String effectiveDate, String expiryDate, double insuredAmount, double premium, String coverageType, String collateralId, String status, int version, String historyJson) {
        this.id = id;
        this.policyNumber = policyNumber;
        this.insurerName = insurerName;
        this.effectiveDate = effectiveDate;
        this.expiryDate = expiryDate;
        this.insuredAmount = insuredAmount;
        this.premium = premium;
        this.coverageType = coverageType;
        this.collateralId = collateralId;
        this.status = status;
        this.version = version;
        this.historyJson = historyJson;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPolicyNumber() { return policyNumber; }
    public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getInsurerId() { return insurerId; }
    public void setInsurerId(String insurerId) { this.insurerId = insurerId; }
    public String getInsurerName() { return insurerName; }
    public void setInsurerName(String insurerName) { this.insurerName = insurerName; }
    public String getCoverageType() { return coverageType; }
    public void setCoverageType(String coverageType) { this.coverageType = coverageType; }
    public double getInsuredAmount() { return insuredAmount; }
    public void setInsuredAmount(double insuredAmount) { this.insuredAmount = insuredAmount; }
    public double getPremium() { return premium; }
    public void setPremium(double premium) { this.premium = premium; }
    public String getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }
    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReplacesPolicyId() { return replacesPolicyId; }
    public void setReplacesPolicyId(String replacesPolicyId) { this.replacesPolicyId = replacesPolicyId; }
    public String getRenewedFromPolicyId() { return renewedFromPolicyId; }
    public void setRenewedFromPolicyId(String renewedFromPolicyId) { this.renewedFromPolicyId = renewedFromPolicyId; }
    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }
    public String getClosureReason() { return closureReason; }
    public void setClosureReason(String closureReason) { this.closureReason = closureReason; }
    public String getReopeningReason() { return reopeningReason; }
    public void setReopeningReason(String reopeningReason) { this.reopeningReason = reopeningReason; }
    public int getEndorsementCount() { return endorsementCount; }
    public void setEndorsementCount(int endorsementCount) { this.endorsementCount = endorsementCount; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getHistoryJson() { return historyJson; }
    public void setHistoryJson(String historyJson) { this.historyJson = historyJson; }
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
