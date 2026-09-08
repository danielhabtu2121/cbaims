package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_ownership_documents")
public class OwnershipDocument {
    @Id
    private String id;

    @Column(name = "entity_type")
    private String entityType = "Collateral";

    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "collateral_id")
    private String collateralId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "verification_status")
    private String verificationStatus = "Pending Verification";

    @Column(name = "upload_date")
    private String uploadDate = LocalDateTime.now().toString();

    @Column(name = "uploaded_by")
    private String uploadedBy;

    @Column(name = "uploaded_at")
    private String uploadedAt = LocalDateTime.now().toString();

    @Column(name = "expiry_date")
    private String expiryDate;

    @Column(name = "dms_ref")
    private String dmsRef;

    private String status = "Active";

    private int version = 1;

    @Column(name = "parent_document_id")
    private String parentDocumentId;

    @Column(name = "version_notes")
    private String versionNotes;

    @Column(name = "is_latest")
    private boolean isLatest = true;

    @Column(name = "file_size")
    private long fileSize = 102400;

    @Column(name = "content_type")
    private String contentType = "application/pdf";

    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "file_content", columnDefinition = "TEXT")
    private String fileContent;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "retention_policy")
    private String retentionPolicy = "10 Years Post-Settlement";

    public OwnershipDocument() {}

    public OwnershipDocument(String id, String name, String type, String verificationStatus, String collateralId, String uploadDate, int version, String fileUrl) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.verificationStatus = verificationStatus;
        this.collateralId = collateralId;
        this.entityId = collateralId;
        this.uploadDate = uploadDate;
        this.version = version;
        this.fileUrl = fileUrl;
        this.isLatest = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; this.entityId = collateralId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getUploadDate() { return uploadDate; }
    public void setUploadDate(String uploadDate) { this.uploadDate = uploadDate; }
    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }
    public String getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(String uploadedAt) { this.uploadedAt = uploadedAt; }
    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }
    public String getDmsRef() { return dmsRef; }
    public void setDmsRef(String dmsRef) { this.dmsRef = dmsRef; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getParentDocumentId() { return parentDocumentId; }
    public void setParentDocumentId(String parentDocumentId) { this.parentDocumentId = parentDocumentId; }
    public String getVersionNotes() { return versionNotes; }
    public void setVersionNotes(String versionNotes) { this.versionNotes = versionNotes; }
    public boolean isLatest() { return isLatest; }
    public void setLatest(boolean latest) { isLatest = latest; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getFileContent() { return fileContent; }
    public void setFileContent(String fileContent) { this.fileContent = fileContent; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getRetentionPolicy() { return retentionPolicy; }
    public void setRetentionPolicy(String retentionPolicy) { this.retentionPolicy = retentionPolicy; }
}
