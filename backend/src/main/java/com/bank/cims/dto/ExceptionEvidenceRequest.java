package com.bank.cims.dto;

public class ExceptionEvidenceRequest {
    private String documentId;
    private String documentName;
    private String dmsRef;
    private String notes;
    private String userId;

    public ExceptionEvidenceRequest() {}

    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getDocumentName() { return documentName; }
    public void setDocumentName(String documentName) { this.documentName = documentName; }
    public String getDmsRef() { return dmsRef; }
    public void setDmsRef(String dmsRef) { this.dmsRef = dmsRef; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
