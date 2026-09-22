package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_workflow_tasks")
public class WorkflowTask {
    @Id
    private String id;
    
    @Column(name = "process_instance_id")
    private String processInstanceId;
    
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    
    @Column(name = "entity_id", nullable = false)
    private String entityId;
    
    @Column(name = "action_type", nullable = false)
    private String actionType;
    
    @Column(name = "payload_diff_json", columnDefinition = "TEXT")
    private String payloadDiffJson;
    
    @Column(columnDefinition = "TEXT")
    private String remarks;
    
    @Column(name = "maker_id", nullable = false)
    private String makerId;
    
    @Column(name = "current_step", nullable = false)
    private String currentStep = "Checker Review";
    
    @Column(name = "candidate_role", nullable = false)
    private String candidateRole;
    
    @Column(name = "candidate_user_id")
    private String candidateUserId;
    
    @Column(nullable = false)
    private String status = "Pending";
    
    private String priority = "Medium";
    
    @Column(name = "submitted_at")
    private String submittedAt = LocalDateTime.now().toString();
    
    @Column(name = "completed_at")
    private String completedAt;
    
    @Column(name = "sla_due_at")
    private String slaDueAt;
    
    @Column(name = "is_escalated")
    private boolean isEscalated = false;

    public WorkflowTask() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProcessInstanceId() { return processInstanceId; }
    public void setProcessInstanceId(String processInstanceId) { this.processInstanceId = processInstanceId; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public String getPayloadDiffJson() { return payloadDiffJson; }
    public void setPayloadDiffJson(String payloadDiffJson) { this.payloadDiffJson = payloadDiffJson; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getMakerId() { return makerId; }
    public void setMakerId(String makerId) { this.makerId = makerId; }
    public String getCurrentStep() { return currentStep; }
    public void setCurrentStep(String currentStep) { this.currentStep = currentStep; }
    public String getCandidateRole() { return candidateRole; }
    public void setCandidateRole(String candidateRole) { this.candidateRole = candidateRole; }
    public String getCandidateUserId() { return candidateUserId; }
    public void setCandidateUserId(String candidateUserId) { this.candidateUserId = candidateUserId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(String submittedAt) { this.submittedAt = submittedAt; }
    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }
    public String getSlaDueAt() { return slaDueAt; }
    public void setSlaDueAt(String slaDueAt) { this.slaDueAt = slaDueAt; }
    public boolean isEscalated() { return isEscalated; }
    public void setEscalated(boolean isEscalated) { this.isEscalated = isEscalated; }
}
