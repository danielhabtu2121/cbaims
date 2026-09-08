package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_approved_insurers")
public class ApprovedInsurer {
    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String name;

    private boolean active = true;

    public ApprovedInsurer() {}

    public ApprovedInsurer(String id, String name, boolean active) {
        this.id = id;
        this.name = name;
        this.active = active;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
