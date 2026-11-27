package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_policy_collateral_links")
public class PolicyCollateralLink {

    @Id
    private String id;

    @Column(name = "policy_id", nullable = false)
    private String policyId;

    @Column(name = "collateral_id", nullable = false)
    private String collateralId;

    @Column(name = "allocated_insured_amount", nullable = false)
    private double allocatedInsuredAmount = 0.0;

    @Column(name = "allocation_pct", nullable = false)
    private double allocationPct = 100.0;

    private String branch;

    @Column(nullable = false)
    private String status = "Active";

    @Column(name = "created_at")
    private String createdAt;

    @Column(name = "updated_at")
    private String updatedAt;

    public PolicyCollateralLink() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPolicyId() { return policyId; }
    public void setPolicyId(String policyId) { this.policyId = policyId; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public double getAllocatedInsuredAmount() { return allocatedInsuredAmount; }
    public void setAllocatedInsuredAmount(double allocatedInsuredAmount) { this.allocatedInsuredAmount = allocatedInsuredAmount; }

    public double getAllocationPct() { return allocationPct; }
    public void setAllocationPct(double allocationPct) { this.allocationPct = allocationPct; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
