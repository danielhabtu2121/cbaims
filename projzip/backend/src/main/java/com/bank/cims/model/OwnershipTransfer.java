package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_ownership_transfers")
public class OwnershipTransfer {
    @Id
    private String id;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(name = "source_segment", nullable = false)
    private String sourceSegment;

    @Column(name = "destination_segment", nullable = false)
    private String destinationSegment;

    @Column(nullable = false)
    private String reason;

    @Column(name = "initiated_by", nullable = false)
    private String initiatedBy;

    @Column(name = "initiated_at", nullable = false)
    private String initiatedAt;

    @Column(nullable = false)
    private String status;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private String approvedAt;

    private String remarks;

    public OwnershipTransfer() {}

    public OwnershipTransfer(String id, String collateralId, String sourceSegment, String destinationSegment, String reason, String initiatedBy, String initiatedAt, String status, String remarks) {
        this.id = id;
        this.collateralId = collateralId;
        this.sourceSegment = sourceSegment;
        this.destinationSegment = destinationSegment;
        this.reason = reason;
        this.initiatedBy = initiatedBy;
        this.initiatedAt = initiatedAt;
        this.status = status;
        this.remarks = remarks;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getSourceSegment() { return sourceSegment; }
    public void setSourceSegment(String sourceSegment) { this.sourceSegment = sourceSegment; }
    public String getDestinationSegment() { return destinationSegment; }
    public void setDestinationSegment(String destinationSegment) { this.destinationSegment = destinationSegment; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getInitiatedBy() { return initiatedBy; }
    public void setInitiatedBy(String initiatedBy) { this.initiatedBy = initiatedBy; }
    public String getInitiatedAt() { return initiatedAt; }
    public void setInitiatedAt(String initiatedAt) { this.initiatedAt = initiatedAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public String getApprovedAt() { return approvedAt; }
    public void setApprovedAt(String approvedAt) { this.approvedAt = approvedAt; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
