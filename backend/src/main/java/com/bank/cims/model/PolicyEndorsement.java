package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_policy_endorsements")
public class PolicyEndorsement {
    @Id
    private String id;
    
    @Column(name = "policy_id", nullable = false)
    private String policyId;
    
    @Column(name = "endorsement_no", nullable = false)
    private String endorsementNo;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;
    
    @Column(name = "effective_date", nullable = false)
    private String effectiveDate;
    
    @Column(name = "document_id")
    private String documentId;
    
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

    public PolicyEndorsement() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }
    public String getEndorsementNo() { return endorsementNo; }
    public void setEndorsementNo(String endorsementNo) { this.endorsementNo = endorsementNo; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
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
