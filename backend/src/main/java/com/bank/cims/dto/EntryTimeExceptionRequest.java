package com.bank.cims.dto;

import com.bank.cims.model.Collateral;
import com.bank.cims.model.InsurancePolicy;

import java.util.List;
import java.util.Map;

public class EntryTimeExceptionRequest {
    private InsurancePolicy policy;
    private Collateral collateral;
    private List<Map<String, Object>> allocations;
    private List<Map<String, Object>> documents;
    private String exceptionType;
    private String failedRequirement;
    private String ruleKey;
    private String reason;
    private String comments;
    private String evidenceDocument;

    private String entityType;
    private String entityId;
    private String collateralId;
    private String customerId;
    private String severity;

    public EntryTimeExceptionRequest() {}

    public Collateral getCollateral() { return collateral; }
    public void setCollateral(Collateral collateral) { this.collateral = collateral; }
    public List<Map<String, Object>> getAllocations() { return allocations; }
    public void setAllocations(List<Map<String, Object>> allocations) { this.allocations = allocations; }

    public InsurancePolicy getPolicy() { return policy; }
    public void setPolicy(InsurancePolicy policy) { this.policy = policy; }
    public List<Map<String, Object>> getDocuments() { return documents; }
    public void setDocuments(List<Map<String, Object>> documents) { this.documents = documents; }
    public String getExceptionType() { return exceptionType; }
    public void setExceptionType(String exceptionType) { this.exceptionType = exceptionType; }
    public String getFailedRequirement() { return failedRequirement; }
    public void setFailedRequirement(String failedRequirement) { this.failedRequirement = failedRequirement; }
    public String getRuleKey() { return ruleKey; }
    public void setRuleKey(String ruleKey) { this.ruleKey = ruleKey; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
    public String getEvidenceDocument() { return evidenceDocument; }
    public void setEvidenceDocument(String evidenceDocument) { this.evidenceDocument = evidenceDocument; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
}
