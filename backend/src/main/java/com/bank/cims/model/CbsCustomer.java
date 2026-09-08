package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "customers", schema = "cbs_sim")
public class CbsCustomer {
    @Id
    private String id;
    
    @Column(nullable = false, unique = true)
    private String cif;
    
    @Column(name = "customer_type", nullable = false)
    private String customerType = "Individual";
    
    @Column(name = "full_name", nullable = false)
    private String fullName;
    
    @Column(name = "national_id")
    private String nationalId;
    
    @Column(name = "business_reg_no")
    private String businessRegNo;
    
    @Column(name = "tax_id_no")
    private String taxIdNo;
    
    @Column(name = "dob_or_incorp")
    private String dobOrIncorp;
    
    private String gender;
    
    @Column(nullable = false)
    private String phone;
    
    private String email;
    
    @Column(columnDefinition = "TEXT")
    private String address;
    
    @Column(name = "business_segment", nullable = false)
    private String businessSegment;
    
    @Column(nullable = false)
    private String branch;
    
    @Column(name = "customer_status", nullable = false)
    private String customerStatus = "Active";
    
    @Column(name = "risk_rating")
    private String riskRating = "Medium";
    
    @Column(name = "synced_at")
    private String syncedAt;
    
    @Column(name = "sync_status")
    private String syncStatus = "Not Synced";
    
    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public CbsCustomer() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCif() { return cif; }
    public void setCif(String cif) { this.cif = cif; }
    public String getCustomerType() { return customerType; }
    public void setCustomerType(String customerType) { this.customerType = customerType; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
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
    public String getBusinessSegment() { return businessSegment; }
    public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getCustomerStatus() { return customerStatus; }
    public void setCustomerStatus(String customerStatus) { this.customerStatus = customerStatus; }
    public String getRiskRating() { return riskRating; }
    public void setRiskRating(String riskRating) { this.riskRating = riskRating; }
    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }
    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
