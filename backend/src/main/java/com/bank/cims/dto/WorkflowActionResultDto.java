package com.bank.cims.dto;

public class WorkflowActionResultDto {
    private boolean success;
    private String workflowTaskId;
    private String entityType;
    private String entityId;
    private String action;
    private String entityStatus;
    private String workflowStatus;
    private String message;
    private String errorCode;

    public WorkflowActionResultDto() {}

    public WorkflowActionResultDto(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getWorkflowTaskId() { return workflowTaskId; }
    public void setWorkflowTaskId(String workflowTaskId) { this.workflowTaskId = workflowTaskId; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getEntityStatus() { return entityStatus; }
    public void setEntityStatus(String entityStatus) { this.entityStatus = entityStatus; }
    public String getWorkflowStatus() { return workflowStatus; }
    public void setWorkflowStatus(String workflowStatus) { this.workflowStatus = workflowStatus; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
}
