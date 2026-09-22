package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_exception_requests")
public class ExceptionRequest {
    @Id
    private String id;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(name = "policy_id")
    private String policyId;

    @Column(name = "requested_by", nullable = false)
    private String requestedBy;

    @Column(nullable = false)
    private String reason;

    @Column(name = "evidence_document")
    private String evidenceDocument;

    @Column(nullable = false)
    private String status;

    @Column(name = "resolved_by")
    private String resolvedBy;

    @Column(name = "resolved_at")
    private String resolvedAt;

    private String comments;

    public ExceptionRequest() {}

    public ExceptionRequest(String id, String collateralId, String policyId, String requestedBy, String reason, String evidenceDocument, String status, String resolvedBy, String resolvedAt, String comments) {
        this.id = id;
        this.collateralId = collateralId;
        this.policyId = policyId;
        this.requestedBy = requestedBy;
        this.reason = reason;
        this.evidenceDocument = evidenceDocument;
        this.status = status;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = resolvedAt;
        this.comments = comments;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getEvidenceDocument() { return evidenceDocument; }
    public void setEvidenceDocument(String evidenceDocument) { this.evidenceDocument = evidenceDocument; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
    public String getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(String resolvedAt) { this.resolvedAt = resolvedAt; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
}
