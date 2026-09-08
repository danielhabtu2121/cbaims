package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_approval_history")
public class ApprovalHistory {
    @Id
    private String id;
    
    @Column(name = "workflow_task_id", nullable = false)
    private String workflowTaskId;
    
    @Column(name = "actor_id", nullable = false)
    private String actorId;
    
    @Column(name = "actor_role", nullable = false)
    private String actorRole;
    
    @Column(name = "step_name", nullable = false)
    private String stepName;
    
    @Column(nullable = false)
    private String decision;
    
    @Column(columnDefinition = "TEXT")
    private String comments;
    
    @Column(name = "decided_at")
    private String decidedAt = LocalDateTime.now().toString();

    public ApprovalHistory() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getWorkflowTaskId() { return workflowTaskId; }
    public void setWorkflowTaskId(String workflowTaskId) { this.workflowTaskId = workflowTaskId; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public String getStepName() { return stepName; }
    public void setStepName(String stepName) { this.stepName = stepName; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
    public String getDecidedAt() { return decidedAt; }
    public void setDecidedAt(String decidedAt) { this.decidedAt = decidedAt; }
}
