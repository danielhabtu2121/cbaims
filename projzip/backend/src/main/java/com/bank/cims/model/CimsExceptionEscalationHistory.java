package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_exception_escalation_history")
public class CimsExceptionEscalationHistory {
    @Id
    private String id;

    @Column(name = "exception_id", nullable = false)
    private String exceptionId;

    @Column(name = "previous_status")
    private String previousStatus;

    @Column(name = "new_status")
    private String newStatus;

    @Column(name = "previous_role")
    private String previousRole;

    @Column(name = "previous_user_id")
    private String previousUserId;

    @Column(name = "new_role")
    private String newRole;

    @Column(name = "new_user_id")
    private String newUserId;

    @Column(name = "escalation_level")
    private Integer escalationLevel = 1;

    @Column(name = "escalated_by", nullable = false)
    private String escalatedBy;

    @Column(name = "escalated_at", nullable = false)
    private String escalatedAt = LocalDateTime.now().toString();

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "notification_reference")
    private String notificationReference;

    public CimsExceptionEscalationHistory() {}

    public CimsExceptionEscalationHistory(String id, String exceptionId, String previousStatus, String newStatus,
                                          String previousRole, String previousUserId, String newRole, String newUserId,
                                          Integer escalationLevel, String escalatedBy, String reason, String notificationReference) {
        this.id = id;
        this.exceptionId = exceptionId;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.previousRole = previousRole;
        this.previousUserId = previousUserId;
        this.newRole = newRole;
        this.newUserId = newUserId;
        this.escalationLevel = escalationLevel;
        this.escalatedBy = escalatedBy;
        this.escalatedAt = LocalDateTime.now().toString();
        this.reason = reason;
        this.notificationReference = notificationReference;
    }

    public CimsExceptionEscalationHistory(String id, String exceptionId, String previousStatus,
                                          String previousRole, String previousUserId, String newRole, String newUserId,
                                          Integer escalationLevel, String escalatedBy, String reason) {
        this(id, exceptionId, previousStatus, "Escalated", previousRole, previousUserId, newRole, newUserId, escalationLevel, escalatedBy, reason, null);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExceptionId() { return exceptionId; }
    public void setExceptionId(String exceptionId) { this.exceptionId = exceptionId; }
    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }
    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }
    public String getPreviousRole() { return previousRole; }
    public void setPreviousRole(String previousRole) { this.previousRole = previousRole; }
    public String getPreviousUserId() { return previousUserId; }
    public void setPreviousUserId(String previousUserId) { this.previousUserId = previousUserId; }
    public String getNewRole() { return newRole; }
    public void setNewRole(String newRole) { this.newRole = newRole; }
    public String getNewUserId() { return newUserId; }
    public void setNewUserId(String newUserId) { this.newUserId = newUserId; }
    public Integer getEscalationLevel() { return escalationLevel; }
    public void setEscalationLevel(Integer escalationLevel) { this.escalationLevel = escalationLevel; }
    public String getEscalatedBy() { return escalatedBy; }
    public void setEscalatedBy(String escalatedBy) { this.escalatedBy = escalatedBy; }
    public String getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(String escalatedAt) { this.escalatedAt = escalatedAt; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getNotificationReference() { return notificationReference; }
    public void setNotificationReference(String notificationReference) { this.notificationReference = notificationReference; }
}
