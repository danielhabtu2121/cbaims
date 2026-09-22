package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_business_segments")
public class BusinessSegment {
    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;

    @Column(name = "risk_profile")
    private String riskProfile;

    private boolean active = true;

    public BusinessSegment() {}

    public BusinessSegment(String id, String name, String description, String riskProfile, boolean active) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.riskProfile = riskProfile;
        this.active = active;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRiskProfile() { return riskProfile; }
    public void setRiskProfile(String riskProfile) { this.riskProfile = riskProfile; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
