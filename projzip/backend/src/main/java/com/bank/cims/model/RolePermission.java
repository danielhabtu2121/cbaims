package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_role_permissions")
public class RolePermission {
    @Id
    private String id;
    
    @Column(name = "role_code", nullable = false)
    private String roleCode;
    
    @Column(name = "screen_name", nullable = false)
    private String screenName;
    
    @Column(name = "can_view")
    private boolean canView = true;
    
    @Column(name = "can_create")
    private boolean canCreate = false;
    
    @Column(name = "can_edit")
    private boolean canEdit = false;
    
    @Column(name = "can_approve")
    private boolean canApprove = false;
    
    @Column(name = "can_delete")
    private boolean canDelete = false;

    public RolePermission() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRoleCode() { return roleCode; }
    public void setRoleCode(String roleCode) { this.roleCode = roleCode; }
    public String getScreenName() { return screenName; }
    public void setScreenName(String screenName) { this.screenName = screenName; }
    public boolean isCanView() { return canView; }
    public void setCanView(boolean canView) { this.canView = canView; }
    public boolean isCanCreate() { return canCreate; }
    public void setCanCreate(boolean canCreate) { this.canCreate = canCreate; }
    public boolean isCanEdit() { return canEdit; }
    public void setCanEdit(boolean canEdit) { this.canEdit = canEdit; }
    public boolean isCanApprove() { return canApprove; }
    public void setCanApprove(boolean canApprove) { this.canApprove = canApprove; }
    public boolean isCanDelete() { return canDelete; }
    public void setCanDelete(boolean canDelete) { this.canDelete = canDelete; }
}
