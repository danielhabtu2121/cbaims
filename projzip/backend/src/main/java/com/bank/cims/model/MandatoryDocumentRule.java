package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_mandatory_document_rules")
public class MandatoryDocumentRule {
    @Id
    private String id;

    @Column(name = "collateral_category", nullable = false)
    private String collateralCategory;

    @Column(name = "collateral_type")
    private String collateralType;

    @Column(name = "document_type", nullable = false)
    private String documentType;

    @Column(name = "ownership_condition")
    private String ownershipCondition;

    @Column(name = "applicability_condition")
    private String applicabilityCondition;

    private boolean mandatory = true;

    private boolean active = true;

    public MandatoryDocumentRule() {}

    public MandatoryDocumentRule(String id, String collateralCategory, String documentType, boolean mandatory) {
        this.id = id;
        this.collateralCategory = collateralCategory;
        this.documentType = documentType;
        this.mandatory = mandatory;
        this.active = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }
    public String getCollateralType() { return collateralType; }
    public void setCollateralType(String collateralType) { this.collateralType = collateralType; }
    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }
    public String getOwnershipCondition() { return ownershipCondition; }
    public void setOwnershipCondition(String ownershipCondition) { this.ownershipCondition = ownershipCondition; }
    public String getApplicabilityCondition() { return applicabilityCondition; }
    public void setApplicabilityCondition(String applicabilityCondition) { this.applicabilityCondition = applicabilityCondition; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
