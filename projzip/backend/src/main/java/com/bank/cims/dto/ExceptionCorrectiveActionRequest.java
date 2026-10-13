package com.bank.cims.dto;

public class ExceptionCorrectiveActionRequest {
    private String correctiveAction;
    private String actionNotes;
    private String targetCompletionDate;
    private String userId;

    public ExceptionCorrectiveActionRequest() {}

    public String getCorrectiveAction() { return correctiveAction; }
    public void setCorrectiveAction(String correctiveAction) { this.correctiveAction = correctiveAction; }
    public String getActionNotes() { return actionNotes; }
    public void setActionNotes(String actionNotes) { this.actionNotes = actionNotes; }
    public String getTargetCompletionDate() { return targetCompletionDate; }
    public void setTargetCompletionDate(String targetCompletionDate) { this.targetCompletionDate = targetCompletionDate; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
