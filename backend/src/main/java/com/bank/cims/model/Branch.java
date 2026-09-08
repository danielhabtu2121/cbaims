package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_branches")
public class Branch {
    @Id
    private String id;
    
    @Column(nullable = false, unique = true)
    private String code;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String type = "Branch";
    
    @Column(name = "parent_district_id")
    private String parentDistrictId;
    
    @Column(name = "segment_ids", columnDefinition = "TEXT")
    private String segmentIds;
    
    @Column(name = "is_active")
    private boolean active = true;

    public Branch() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getParentDistrictId() { return parentDistrictId; }
    public void setParentDistrictId(String parentDistrictId) { this.parentDistrictId = parentDistrictId; }
    public String getSegmentIds() { return segmentIds; }
    public void setSegmentIds(String segmentIds) { this.segmentIds = segmentIds; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
