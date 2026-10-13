package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_exception_investigation_notes")
public class CimsExceptionInvestigationNote {
    @Id
    private String id;

    @Column(name = "exception_id", nullable = false)
    private String exceptionId;

    @Column(name = "author_id", nullable = false)
    private String authorId;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "note_text", columnDefinition = "TEXT", nullable = false)
    private String noteText;

    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public CimsExceptionInvestigationNote() {}

    public CimsExceptionInvestigationNote(String id, String exceptionId, String authorId, String authorName, String noteText) {
        this.id = id;
        this.exceptionId = exceptionId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.noteText = noteText;
        this.createdAt = LocalDateTime.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExceptionId() { return exceptionId; }
    public void setExceptionId(String exceptionId) { this.exceptionId = exceptionId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getNoteText() { return noteText; }
    public void setNoteText(String noteText) { this.noteText = noteText; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
