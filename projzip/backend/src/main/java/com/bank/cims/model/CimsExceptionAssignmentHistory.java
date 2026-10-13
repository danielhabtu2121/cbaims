package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_exception_assignment_history")
public class CimsExceptionAssignmentHistory {
    @Id
    private String id;

    @Column(name = "exception_id", nullable = false)
    private String exceptionId;

    @Column(name = "previous_role")
    private String previousRole;

    @Column(name = "previous_user_id")
    private String previousUserId;

    @Column(name = "new_role")
    private String newRole;

    @Column(name = "new_user_id")
    private String newUserId;

    @Column(name = "assigned_by", nullable = false)
    private String assignedBy;

    @Column(name = "assigned_at", nullable = false)
    private String assignedAt = LocalDateTime.now().toString();

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    public CimsExceptionAssignmentHistory() {}

    public CimsExceptionAssignmentHistory(String id, String exceptionId, String previousRole, String previousUserId,
                                          String newRole, String newUserId, String assignedBy, String remarks) {
        this.id = id;
        this.exceptionId = exceptionId;
        this.previousRole = previousRole;
        this.previousUserId = previousUserId;
        this.newRole = newRole;
        this.newUserId = newUserId;
        this.assignedBy = assignedBy;
        this.assignedAt = LocalDateTime.now().toString();
        this.remarks = remarks;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExceptionId() { return exceptionId; }
    public void setExceptionId(String exceptionId) { this.exceptionId = exceptionId; }
    public String getPreviousRole() { return previousRole; }
    public void setPreviousRole(String previousRole) { this.previousRole = previousRole; }
    public String getPreviousUserId() { return previousUserId; }
    public void setPreviousUserId(String previousUserId) { this.previousUserId = previousUserId; }
    public String getNewRole() { return newRole; }
    public void setNewRole(String newRole) { this.newRole = newRole; }
    public String getNewUserId() { return newUserId; }
    public void setNewUserId(String newUserId) { this.newUserId = newUserId; }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }
    public String getAssignedAt() { return assignedAt; }
    public void setAssignedAt(String assignedAt) { this.assignedAt = assignedAt; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
