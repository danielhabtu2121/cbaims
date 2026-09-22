package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_delegations")
public class Delegation {
    @Id
    private String id;
    
    @Column(name = "delegator_id", nullable = false)
    private String delegatorId;
    
    @Column(name = "delegate_id", nullable = false)
    private String delegateId;
    
    @Column(name = "start_date", nullable = false)
    private String startDate;
    
    @Column(name = "end_date", nullable = false)
    private String endDate;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String reason;
    
    @Column(nullable = false)
    private String status = "Active";
    
    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public Delegation() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDelegatorId() { return delegatorId; }
    public void setDelegatorId(String delegatorId) { this.delegatorId = delegatorId; }
    public String getDelegateId() { return delegateId; }
    public void setDelegateId(String delegateId) { this.delegateId = delegateId; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
