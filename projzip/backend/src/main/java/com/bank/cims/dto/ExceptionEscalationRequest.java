package com.bank.cims.dto;

public class ExceptionEscalationRequest {
    private String escalationRole;
    private String targetUserId;
    private String reason;
    private String userId; // optional client-supplied user for backward compatibility

    public ExceptionEscalationRequest() {}

    public String getEscalationRole() { return escalationRole; }
    public void setEscalationRole(String escalationRole) { this.escalationRole = escalationRole; }

    public String getTargetUserId() { return targetUserId; }
    public void setTargetUserId(String targetUserId) { this.targetUserId = targetUserId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
