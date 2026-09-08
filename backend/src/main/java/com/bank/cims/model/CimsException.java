package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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

    public CimsException() {}

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
}
