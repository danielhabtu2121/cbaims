package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_collateral_owners")
public class CollateralOwner {
    @Id
    private String id;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(nullable = false)
    private String name;

    @Column(name = "ownership_type")
    private String ownershipType = "Borrower-owned";

    @Column(name = "owner_type")
    private String ownerType = "Individual";

    @Column(name = "id_number")
    private String idNumber;

    private String tin;
    private String phone;

    @Column(name = "contact_info")
    private String contactInfo;

    @Column(nullable = false)
    private double percentage = 100.0;

    private String relationship = "Borrower";

    @Column(name = "relationship_to_borrower")
    private String relationshipToBorrower;

    @Column(name = "verification_status")
    private String verificationStatus = "Recorded";

    @Column(name = "consent_info")
    private String consentInfo;

    @Column(name = "pledge_agreement_ref")
    private String pledgeAgreementRef;

    @Column(name = "verification_date")
    private String verificationDate;

    @Column(name = "verifying_officer")
    private String verifyingOfficer;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "gps_x")
    private Double gpsX;

    @Column(name = "gps_y")
    private Double gpsY;

    @Column(name = "superseded_date")
    private String supersededDate;

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

    public CollateralOwner() {}

    public CollateralOwner(String id, String name, String phone, String collateralId, String relationship, double percentage) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.collateralId = collateralId;
        this.relationship = relationship;
        this.percentage = percentage;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getOwnershipType() { return ownershipType; }
    public void setOwnershipType(String ownershipType) { this.ownershipType = ownershipType; }
    public String getOwnerType() { return ownerType; }
    public void setOwnerType(String ownerType) { this.ownerType = ownerType; }
    public String getIdNumber() { return idNumber; }
    public void setIdNumber(String idNumber) { this.idNumber = idNumber; }
    public String getTin() { return tin; }
    public void setTin(String tin) { this.tin = tin; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }
    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }
    public String getRelationship() { return relationship; }
    public void setRelationship(String relationship) { this.relationship = relationship; }
    public String getRelationshipToBorrower() { return relationshipToBorrower; }
    public void setRelationshipToBorrower(String relationshipToBorrower) { this.relationshipToBorrower = relationshipToBorrower; }
    public String getConsentInfo() { return consentInfo; }
    public void setConsentInfo(String consentInfo) { this.consentInfo = consentInfo; }
    public String getPledgeAgreementRef() { return pledgeAgreementRef; }
    public void setPledgeAgreementRef(String pledgeAgreementRef) { this.pledgeAgreementRef = pledgeAgreementRef; }
    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getVerificationDate() { return verificationDate; }
    public void setVerificationDate(String verificationDate) { this.verificationDate = verificationDate; }
    public String getVerifyingOfficer() { return verifyingOfficer; }
    public void setVerifyingOfficer(String verifyingOfficer) { this.verifyingOfficer = verifyingOfficer; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public Double getGpsX() { return gpsX; }
    public void setGpsX(Double gpsX) { this.gpsX = gpsX; }
    public Double getGpsY() { return gpsY; }
    public void setGpsY(Double gpsY) { this.gpsY = gpsY; }
    public String getSupersededDate() { return supersededDate; }
    public void setSupersededDate(String supersededDate) { this.supersededDate = supersededDate; }
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
