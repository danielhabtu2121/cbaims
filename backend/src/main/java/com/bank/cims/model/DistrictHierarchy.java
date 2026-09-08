package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_district_hierarchies")
public class DistrictHierarchy {
    @Id
    private String id;

    @Column(name = "district_name", nullable = false)
    private String districtName;

    @Column(name = "area_office", nullable = false)
    private String areaOffice;

    @Column(name = "branch_name", nullable = false)
    private String branchName;

    public DistrictHierarchy() {}

    public DistrictHierarchy(String id, String districtName, String areaOffice, String branchName) {
        this.id = id;
        this.districtName = districtName;
        this.areaOffice = areaOffice;
        this.branchName = branchName;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDistrictName() { return districtName; }
    public void setDistrictName(String districtName) { this.districtName = districtName; }
    public String getAreaOffice() { return areaOffice; }
    public void setAreaOffice(String areaOffice) { this.areaOffice = areaOffice; }
    public String getBranchName() { return branchName; }
    public void setBranchName(String branchName) { this.branchName = branchName; }
}
