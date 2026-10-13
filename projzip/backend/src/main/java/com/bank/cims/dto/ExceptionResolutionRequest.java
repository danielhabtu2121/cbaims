package com.bank.cims.dto;

public class ExceptionResolutionRequest {
    private String correctiveAction;
    private String resolutionNotes;
    private String evidenceDocument;
    private String userId; // optional client-supplied user for backward compatibility

    private boolean isOverride;
    private String overrideReason;

    public ExceptionResolutionRequest() {}

    public String getCorrectiveAction() { return correctiveAction; }
    public void setCorrectiveAction(String correctiveAction) { this.correctiveAction = correctiveAction; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public String getEvidenceDocument() { return evidenceDocument; }
    public void setEvidenceDocument(String evidenceDocument) { this.evidenceDocument = evidenceDocument; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public boolean isOverride() { return isOverride; }
    public void setOverride(boolean override) { isOverride = override; }
    public void setIsOverride(boolean override) { isOverride = override; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
}
