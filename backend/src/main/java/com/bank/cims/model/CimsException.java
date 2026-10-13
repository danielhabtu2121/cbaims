package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "cims_exceptions")
public class CimsException {
    @Id
    private String id;
    
    @Column(name = "exception_type", nullable = false)
    private String exceptionType;
    
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    
    @Column(name = "entity_id", nullable = false)
    private String entityId;
    
    @Column(nullable = false)
    private String severity = "Medium";
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;
    
    @Column(name = "assigned_to_role")
    private String assignedToRole;
    
    @Column(name = "assigned_to_user_id")
    private String assignedToUserId;
    
    @Column(nullable = false)
    private String status = "Open";
    
    @Column(name = "sla_due_date")
    private String slaDueDate;
    
    @Column(name = "detected_at")
    private String detectedAt = LocalDateTime.now().toString();
    
    @Column(name = "resolved_at")
    private String resolvedAt;
    
    @Column(name = "resolved_by")
    private String resolvedBy;
    
    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;
    
    @Column(name = "corrective_action")
    private String correctiveAction;

    @Column(name = "evidence_document")
    private String evidenceDocument;

    // Contextual business linkages (BRD & US-12)
    @Column(name = "customer_id")
    private String customerId;

    @Column(name = "customer_cif")
    private String customerCif;

    @Column(name = "facility_id")
    private String facilityId;

    @Column(name = "loan_reference")
    private String loanReference;

    @Column(name = "collateral_id")
    private String collateralId;

    @Column(name = "policy_id")
    private String policyId;

    @Column(name = "branch")
    private String branch;

    @Column(name = "district")
    private String district;

    @Column(name = "business_segment")
    private String businessSegment;

    @Column(name = "relationship_manager_id")
    private String relationshipManagerId;

    @Column(name = "relationship_officer_id")
    private String relationshipOfficerId;

    @Column(name = "detection_source")
    private String detectionSource = "AUTOMATED_SCAN";

    @Column(name = "assigned_at")
    private String assignedAt;

    @Column(name = "assigned_by")
    private String assignedBy;

    @Column(name = "escalation_level")
    private Integer escalationLevel = 0;

    @Column(name = "last_escalation_date")
    private String lastEscalationDate;

    @Column(name = "next_escalation_due")
    private String nextEscalationDue;

    // Transient fields computed dynamically for work queue & UI
    @Transient
    private String slaStatus;

    @Transient
    private Long daysOpen;

    @Transient
    private Long daysOverdue;

    @Transient
    private String customerName;

    @Transient
    private String collateralCode;

    @Transient
    private String policyNumber;

    @Transient
    private String assignedToUser;

    public CimsException() {}

    /**
     * Calculates and enriches dynamic SLA status, days open, and days overdue.
     */
    public void computeSlaAndOperationalMetrics(LocalDate referenceDate) {
        LocalDate today = referenceDate != null ? referenceDate : LocalDate.now();

        // 1. Days Open calculation
        if (detectedAt != null && !detectedAt.isBlank()) {
            try {
                LocalDate dt = LocalDate.parse(detectedAt.substring(0, 10));
                LocalDate end = (resolvedAt != null && !resolvedAt.isBlank())
                        ? LocalDate.parse(resolvedAt.substring(0, 10))
                        : today;
                this.daysOpen = Math.max(0, ChronoUnit.DAYS.between(dt, end));
            } catch (Exception e) {
                this.daysOpen = 0L;
            }
        } else {
            this.daysOpen = 0L;
        }

        // 2. SLA Status & Days Overdue calculation
        if ("Resolved".equalsIgnoreCase(this.status)) {
            this.slaStatus = "Resolved";
            this.daysOverdue = 0L;
            return;
        }

        if (slaDueDate == null || slaDueDate.isBlank()) {
            this.slaStatus = "Unconfigured";
            this.daysOverdue = 0L;
            return;
        }

        try {
            LocalDate due = LocalDate.parse(slaDueDate.substring(0, 10));
            long diff = ChronoUnit.DAYS.between(today, due);
            if (diff < 0) {
                this.slaStatus = "Overdue";
                this.daysOverdue = Math.abs(diff);
            } else if (diff <= 2) {
                this.slaStatus = "Due Soon";
                this.daysOverdue = 0L;
            } else {
                this.slaStatus = "Within SLA";
                this.daysOverdue = 0L;
            }
        } catch (Exception e) {
            this.slaStatus = "Unconfigured";
            this.daysOverdue = 0L;
        }
    }

    public boolean isOverdue() {
        return "Overdue".equalsIgnoreCase(slaStatus) || (daysOverdue != null && daysOverdue > 0);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExceptionType() { return exceptionType; }
    public void setExceptionType(String exceptionType) { this.exceptionType = exceptionType; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAssignedToRole() { return assignedToRole; }
    public void setAssignedToRole(String assignedToRole) { this.assignedToRole = assignedToRole; }
    public String getAssignedToUserId() { return assignedToUserId; }
    public void setAssignedToUserId(String assignedToUserId) { this.assignedToUserId = assignedToUserId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSlaDueDate() { return slaDueDate; }
    public void setSlaDueDate(String slaDueDate) { this.slaDueDate = slaDueDate; }
    public String getDetectedAt() { return detectedAt; }
    public void setDetectedAt(String detectedAt) { this.detectedAt = detectedAt; }
    public String getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(String resolvedAt) { this.resolvedAt = resolvedAt; }
    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public String getCorrectiveAction() { return correctiveAction; }
    public void setCorrectiveAction(String correctiveAction) { this.correctiveAction = correctiveAction; }
    public String getEvidenceDocument() { return evidenceDocument; }
    public void setEvidenceDocument(String evidenceDocument) { this.evidenceDocument = evidenceDocument; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }
    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }
    public String getLoanReference() { return loanReference; }
    public void setLoanReference(String loanReference) { this.loanReference = loanReference; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getBusinessSegment() { return businessSegment; }
    public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }
    public String getRelationshipManagerId() { return relationshipManagerId; }
    public void setRelationshipManagerId(String relationshipManagerId) { this.relationshipManagerId = relationshipManagerId; }
    public String getRelationshipOfficerId() { return relationshipOfficerId; }
    public void setRelationshipOfficerId(String relationshipOfficerId) { this.relationshipOfficerId = relationshipOfficerId; }
    public String getDetectionSource() { return detectionSource; }
    public void setDetectionSource(String detectionSource) { this.detectionSource = detectionSource; }
    public String getAssignedAt() { return assignedAt; }
    public void setAssignedAt(String assignedAt) { this.assignedAt = assignedAt; }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }
    public Integer getEscalationLevel() { return escalationLevel != null ? escalationLevel : 0; }
    public void setEscalationLevel(Integer escalationLevel) { this.escalationLevel = escalationLevel; }
    public String getLastEscalationDate() { return lastEscalationDate; }
    public void setLastEscalationDate(String lastEscalationDate) { this.lastEscalationDate = lastEscalationDate; }
    public String getNextEscalationDue() { return nextEscalationDue; }
    public void setNextEscalationDue(String nextEscalationDue) { this.nextEscalationDue = nextEscalationDue; }

    public String getSlaStatus() { return slaStatus; }
    public void setSlaStatus(String slaStatus) { this.slaStatus = slaStatus; }
    public Long getDaysOpen() { return daysOpen; }
    public void setDaysOpen(Long daysOpen) { this.daysOpen = daysOpen; }
    public Long getDaysOverdue() { return daysOverdue; }
    public void setDaysOverdue(Long daysOverdue) { this.daysOverdue = daysOverdue; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }
    public String getPolicyNumber() { return policyNumber; }
    public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }
    public String getAssignedToUser() { return assignedToUser != null ? assignedToUser : assignedToUserId; }
    public void setAssignedToUser(String assignedToUser) { this.assignedToUser = assignedToUser; }
}
