package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_mandatory_document_rules")
public class MandatoryDocumentRule {
    @Id
    private String id;

    @Column(name = "collateral_category", nullable = false)
    private String collateralCategory;

    @Column(name = "document_type", nullable = false)
    private String documentType;

    private boolean mandatory = true;

    public MandatoryDocumentRule() {}

    public MandatoryDocumentRule(String id, String collateralCategory, String documentType, boolean mandatory) {
        this.id = id;
        this.collateralCategory = collateralCategory;
        this.documentType = documentType;
        this.mandatory = mandatory;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }
    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
}
