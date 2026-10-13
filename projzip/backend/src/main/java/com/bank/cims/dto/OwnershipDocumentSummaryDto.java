package com.bank.cims.dto;

public class OwnershipDocumentSummaryDto {
    private String id;
    private String entityType;
    private String entityId;
    private String collateralId;
    private String name;
    private String type;
    private String verificationStatus;
    private String status;
    private String expiryDate;
    private int version;
    private boolean isLatest;

    public OwnershipDocumentSummaryDto() {}

    public OwnershipDocumentSummaryDto(String id, String entityType, String entityId, String collateralId,
                                      String name, String type, String verificationStatus, String status,
                                      String expiryDate, int version, boolean isLatest) {
        this.id = id;
        this.entityType = entityType;
        this.entityId = entityId;
        this.collateralId = collateralId;
        this.name = name;
        this.type = type;
        this.verificationStatus = verificationStatus;
        this.status = status;
        this.expiryDate = expiryDate;
        this.version = version;
        this.isLatest = isLatest;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public boolean isLatest() { return isLatest; }
    public void setLatest(boolean latest) { isLatest = latest; }
}
