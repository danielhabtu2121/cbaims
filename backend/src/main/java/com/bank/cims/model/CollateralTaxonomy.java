package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_collateral_taxonomies")
public class CollateralTaxonomy {
    @Id
    private String id;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String subCategory;

    private boolean insuranceMandatory;

    private String mandatoryCoverageType;

    public CollateralTaxonomy() {}

    public CollateralTaxonomy(String id, String category, String subCategory, boolean insuranceMandatory, String mandatoryCoverageType) {
        this.id = id;
        this.category = category;
        this.subCategory = subCategory;
        this.insuranceMandatory = insuranceMandatory;
        this.mandatoryCoverageType = mandatoryCoverageType;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getSubCategory() { return subCategory; }
    public void setSubCategory(String subCategory) { this.subCategory = subCategory; }
    public boolean isInsuranceMandatory() { return insuranceMandatory; }
    public void setInsuranceMandatory(boolean insuranceMandatory) { this.insuranceMandatory = insuranceMandatory; }
    public String getMandatoryCoverageType() { return mandatoryCoverageType; }
    public void setMandatoryCoverageType(String mandatoryCoverageType) { this.mandatoryCoverageType = mandatoryCoverageType; }
}
