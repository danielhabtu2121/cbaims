package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cims_collaterals")
public class Collateral {
    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "customer_id")
    private String customerId;

    private String type;
    private String category;
    private String currency = "ETB";
    
    @Column(name = "valuation_amount", nullable = false)
    private double valuationAmount;
    
    private double haircut = 0;
    
    @Column(name = "limit_contribution")
    private double limitContribution;
    
    @Column(name = "start_date")
    private String startDate;
    
    @Column(name = "review_date")
    private String reviewDate;
    
    @Column(name = "current_allocation")
    private double currentAllocation;
    
    @Column(name = "utilization_percentage")
    private double utilizationPercentage;
    
    private String status = "Uninsured";
    
    @Column(name = "owner_type")
    private String ownerType = "Borrower-owned";
    
    private boolean tangible = true;
    
    @Column(name = "owning_segment")
    private String owningSegment;
    
    @Column(name = "registration_number")
    private String registrationNumber;
    
    @Column(name = "title_deed_number")
    private String titleDeedNumber;
    
    @Column(name = "tin_number")
    private String tinNumber;
    
    @Column(name = "gps_coordinates")
    private String gpsCoordinates;
    
    private String branch;
    
    @Column(name = "zip_code")
    private String zipCode;
    
    @Column(name = "insured_amount")
    private double insuredAmount = 0;
    
    @Column(name = "net_insurance_coverage_pct")
    private double netInsuranceCoveragePct = 0;
    
    @Column(name = "insurance_status")
    private String insuranceStatus = "Uninsured";
    
    @Column(name = "verification_status")
    private String verificationStatus = "Recorded";
    
    private String source = "CBS_SIM";
    
    @Column(name = "cbs_sync_status")
    private String cbsSyncStatus = "Synced";

    @Column(name = "cbs_synced_at")
    private String cbsSyncedAt;

    @Column(name = "created_by")
    private String createdBy;

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

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "collateral_id")
    private List<CollateralOwner> owners = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "collateral_id")
    private List<OwnershipDocument> documents = new ArrayList<>();

    public Collateral() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public double getValuationAmount() { return valuationAmount; }
    public void setValuationAmount(double valuationAmount) { this.valuationAmount = valuationAmount; }
    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }
    public double getLimitContribution() { return limitContribution; }
    public void setLimitContribution(double limitContribution) { this.limitContribution = limitContribution; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getReviewDate() { return reviewDate; }
    public void setReviewDate(String reviewDate) { this.reviewDate = reviewDate; }
    public double getCurrentAllocation() { return currentAllocation; }
    public void setCurrentAllocation(double currentAllocation) { this.currentAllocation = currentAllocation; }
    public double getUtilizationPercentage() { return utilizationPercentage; }
    public void setUtilizationPercentage(double utilizationPercentage) { this.utilizationPercentage = utilizationPercentage; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOwnerType() { return ownerType; }
    public void setOwnerType(String ownerType) { this.ownerType = ownerType; }
    public boolean isTangible() { return tangible; }
    public void setTangible(boolean tangible) { this.tangible = tangible; }
    public String getOwningSegment() { return owningSegment; }
    public void setOwningSegment(String owningSegment) { this.owningSegment = owningSegment; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public String getTitleDeedNumber() { return titleDeedNumber; }
    public void setTitleDeedNumber(String titleDeedNumber) { this.titleDeedNumber = titleDeedNumber; }
    public String getTinNumber() { return tinNumber; }
    public void setTinNumber(String tinNumber) { this.tinNumber = tinNumber; }
    public String getGpsCoordinates() { return gpsCoordinates; }
    public void setGpsCoordinates(String gpsCoordinates) { this.gpsCoordinates = gpsCoordinates; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getZipCode() { return zipCode; }
    public void setZipCode(String zipCode) { this.zipCode = zipCode; }
    public double getInsuredAmount() { return insuredAmount; }
    public void setInsuredAmount(double insuredAmount) { this.insuredAmount = insuredAmount; }
    public double getNetInsuranceCoveragePct() { return netInsuranceCoveragePct; }
    public void setNetInsuranceCoveragePct(double netInsuranceCoveragePct) { this.netInsuranceCoveragePct = netInsuranceCoveragePct; }
    public String getInsuranceStatus() { return insuranceStatus; }
    public void setInsuranceStatus(String insuranceStatus) { this.insuranceStatus = insuranceStatus; }
    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getCbsSyncStatus() { return cbsSyncStatus; }
    public void setCbsSyncStatus(String cbsSyncStatus) { this.cbsSyncStatus = cbsSyncStatus; }
    public String getCbsSyncedAt() { return cbsSyncedAt; }
    public void setCbsSyncedAt(String cbsSyncedAt) { this.cbsSyncedAt = cbsSyncedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
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
    public List<CollateralOwner> getOwners() { return owners; }
    public void setOwners(List<CollateralOwner> owners) { this.owners = owners; }
    public List<OwnershipDocument> getDocuments() { return documents; }
    public void setDocuments(List<OwnershipDocument> documents) { this.documents = documents; }
}
