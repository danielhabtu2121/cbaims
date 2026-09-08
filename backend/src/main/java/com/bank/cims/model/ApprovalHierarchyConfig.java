package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_approval_hierarchy_configs")
public class ApprovalHierarchyConfig {
    @Id
    private String id;
    
    @Column(name = "transaction_type", nullable = false, unique = true)
    private String transactionType;
    
    @Column(name = "approval_levels")
    private int approvalLevels = 1;
    
    @Column(name = "level1_role", nullable = false)
    private String level1Role;
    
    @Column(name = "level2_role")
    private String level2Role;
    
    @Column(name = "bulk_approve_allowed")
    private boolean bulkApproveAllowed = false;
    
    @Column(name = "sla_hours")
    private int slaHours = 24;
    
    private boolean active = true;

    public ApprovalHierarchyConfig() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }
    public int getApprovalLevels() { return approvalLevels; }
    public void setApprovalLevels(int approvalLevels) { this.approvalLevels = approvalLevels; }
    public String getLevel1Role() { return level1Role; }
    public void setLevel1Role(String level1Role) { this.level1Role = level1Role; }
    public String getLevel2Role() { return level2Role; }
    public void setLevel2Role(String level2Role) { this.level2Role = level2Role; }
    public boolean isBulkApproveAllowed() { return bulkApproveAllowed; }
    public void setBulkApproveAllowed(boolean bulkApproveAllowed) { this.bulkApproveAllowed = bulkApproveAllowed; }
    public int getSlaHours() { return slaHours; }
    public void setSlaHours(int slaHours) { this.slaHours = slaHours; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
