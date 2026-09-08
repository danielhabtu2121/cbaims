package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_audit_logs")
public class AuditLog {
    @Id
    private String id;

    @Column(nullable = false)
    private String timestamp = LocalDateTime.now().toString();

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "role_code")
    private String roleCode;

    @Column(name = "ip_address", nullable = false)
    private String ipAddress;

    @Column(name = "action_type", nullable = false)
    private String actionType;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private String entityId;

    @Column(name = "field_name")
    private String fieldName;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "old_value_state", columnDefinition = "TEXT")
    private String oldValueState;

    @Column(name = "new_value_state", columnDefinition = "TEXT")
    private String newValueState;

    @Column(columnDefinition = "TEXT")
    private String comments;

    public AuditLog() {}

    public AuditLog(String id, String timestamp, String userId, String ipAddress, String actionType, String entityId, String oldValueState, String newValueState) {
        this.id = id;
        this.timestamp = timestamp;
        this.userId = userId;
        this.ipAddress = ipAddress;
        this.actionType = actionType;
        this.entityId = entityId;
        this.oldValueState = oldValueState;
        this.newValueState = newValueState;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getRoleCode() { return roleCode; }
    public void setRoleCode(String roleCode) { this.roleCode = roleCode; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public String getOldValueState() { return oldValueState; }
    public void setOldValueState(String oldValueState) { this.oldValueState = oldValueState; }
    public String getNewValueState() { return newValueState; }
    public void setNewValueState(String newValueState) { this.newValueState = newValueState; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
}
