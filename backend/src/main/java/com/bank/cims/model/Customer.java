package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_customers")
public class Customer {
    @Id
    private String id;

    private String cif;

    @Column(name = "customer_type")
    private String customerType = "Individual";

    @Column(nullable = false)
    private String name;

    @Column(name = "national_id")
    private String nationalId;

    @Column(name = "business_reg_no")
    private String businessRegNo;

    @Column(name = "tax_id_no")
    private String taxIdNo;

    @Column(name = "dob_or_incorp")
    private String dobOrIncorp;

    private String gender;
    private String phone;
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(nullable = false)
    private String segment;

    private String branch;
    private String status = "Active";

    @Column(name = "risk_rating")
    private String riskRating = "Medium";

    private String source = "CBS_SIM";

    @Column(name = "cbs_sync_status")
    private String cbsSyncStatus = "Synced";

    @Column(name = "cbs_synced_at")
    private String cbsSyncedAt;

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

    public Customer() {}

    public Customer(String id, String name, String segment, String email, String phone) {
        this.id = id;
        this.name = name;
        this.segment = segment;
        this.email = email;
        this.phone = phone;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCif() { return cif; }
    public void setCif(String cif) { this.cif = cif; }
    public String getCustomerType() { return customerType; }
    public void setCustomerType(String customerType) { this.customerType = customerType; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNationalId() { return nationalId; }
    public void setNationalId(String nationalId) { this.nationalId = nationalId; }
    public String getBusinessRegNo() { return businessRegNo; }
    public void setBusinessRegNo(String businessRegNo) { this.businessRegNo = businessRegNo; }
    public String getTaxIdNo() { return taxIdNo; }
    public void setTaxIdNo(String taxIdNo) { this.taxIdNo = taxIdNo; }
    public String getDobOrIncorp() { return dobOrIncorp; }
    public void setDobOrIncorp(String dobOrIncorp) { this.dobOrIncorp = dobOrIncorp; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRiskRating() { return riskRating; }
    public void setRiskRating(String riskRating) { this.riskRating = riskRating; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getCbsSyncStatus() { return cbsSyncStatus; }
    public void setCbsSyncStatus(String cbsSyncStatus) { this.cbsSyncStatus = cbsSyncStatus; }
    public String getCbsSyncedAt() { return cbsSyncedAt; }
    public void setCbsSyncedAt(String cbsSyncedAt) { this.cbsSyncedAt = cbsSyncedAt; }
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
