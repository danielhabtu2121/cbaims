package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_policy_history")
public class PolicyHistory {

    @Id
    private String id;

    @Column(name = "policy_id", nullable = false)
    private String policyId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "previous_status")
    private String previousStatus;

    @Column(name = "new_status")
    private String newStatus;

    @Column
    private int version = 1;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "user_role")
    private String userRole;

    @Column(nullable = false)
    private String timestamp;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "workflow_task_id")
    private String workflowTaskId;

    @Column(name = "snapshot_json", columnDefinition = "TEXT")
    private String snapshotJson;

    public PolicyHistory() {}

    public PolicyHistory(String id, String policyId, String eventType, String previousStatus, String newStatus,
                         int version, String userId, String userRole, String timestamp, String reason,
                         String workflowTaskId, String snapshotJson) {
        this.id = id;
        this.policyId = policyId;
        this.eventType = eventType;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.version = version;
        this.userId = userId;
        this.userRole = userRole;
        this.timestamp = timestamp;
        this.reason = reason;
        this.workflowTaskId = workflowTaskId;
        this.snapshotJson = snapshotJson;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getWorkflowTaskId() { return workflowTaskId; }
    public void setWorkflowTaskId(String workflowTaskId) { this.workflowTaskId = workflowTaskId; }

    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String snapshotJson) { this.snapshotJson = snapshotJson; }
}
