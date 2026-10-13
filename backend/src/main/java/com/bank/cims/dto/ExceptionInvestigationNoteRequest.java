package com.bank.cims.dto;

public class ExceptionInvestigationNoteRequest {
    private String noteText;
    private String userId; // optional client-supplied user for backward compatibility

    public ExceptionInvestigationNoteRequest() {}

    public String getNoteText() { return noteText; }
    public void setNoteText(String noteText) { this.noteText = noteText; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
