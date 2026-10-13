package com.bank.cims.dto;

public class ExceptionAssignmentRequest {
    private String assignedToRole;
    private String assignedToUserId;
    private String remarks;
    private String reason;
    private String userId; // optional client-supplied user for backward compatibility

    public ExceptionAssignmentRequest() {}

    public String getAssignedToRole() {
        return assignedToRole != null ? assignedToRole : null;
    }
    public void setAssignedToRole(String assignedToRole) { this.assignedToRole = assignedToRole; }

    public String getAssignedRole() {
        return assignedToRole;
    }
    public void setAssignedRole(String assignedRole) {
        this.assignedToRole = assignedRole;
    }

    public String getAssignedToUserId() { return assignedToUserId; }
    public void setAssignedToUserId(String assignedToUserId) { this.assignedToUserId = assignedToUserId; }

    public String getAssignedUserId() { return assignedToUserId; }
    public void setAssignedUserId(String assignedUserId) { this.assignedToUserId = assignedUserId; }

    public String getRemarks() { return remarks != null ? remarks : reason; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getReason() { return reason != null ? reason : remarks; }
    public void setReason(String reason) { this.reason = reason; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
