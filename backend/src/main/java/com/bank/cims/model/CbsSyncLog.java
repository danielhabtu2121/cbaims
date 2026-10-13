package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sync_logs", schema = "cbs_sim")
public class CbsSyncLog {
    @Id
    private String id;
    
    private String timestamp = LocalDateTime.now().toString();
    
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    
    @Column(name = "entity_id", nullable = false)
    private String entityId;
    
    @Column(nullable = false)
    private String direction = "CBS->CIMS";

    @Column(name = "source_system")
    private String sourceSystem = "CBS_SIM";
    
    @Column(nullable = false)
    private String result;
    
    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "start_time")
    private String startTime;

    @Column(name = "completion_time")
    private String completionTime;

    @Column(name = "records_processed")
    private int recordsProcessed = 0;

    @Column(name = "records_succeeded")
    private int recordsSucceeded = 0;

    @Column(name = "records_failed")
    private int recordsFailed = 0;

    @Column(name = "customer_count")
    private int customerCount = 0;

    @Column(name = "facility_count")
    private int facilityCount = 0;

    @Column(name = "collateral_count")
    private int collateralCount = 0;

    @Column(name = "relationship_count")
    private int relationshipCount = 0;

    @Column(name = "sync_batch_id")
    private String syncBatchId;
    
    @Column(name = "payload_json", columnDefinition = "TEXT")
    private String payloadJson;

    public CbsSyncLog() {}

    public CbsSyncLog(String id, String entityType, String entityId, String direction, String result, String errorMessage) {
        this.id = id;
        this.entityType = entityType;
        this.entityId = entityId;
        this.direction = direction;
        this.result = result;
        this.errorMessage = errorMessage;
        this.timestamp = LocalDateTime.now().toString();
        this.startTime = this.timestamp;
        this.completionTime = this.timestamp;
        this.sourceSystem = "CBS_SIM";
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public String getSourceSystem() { return sourceSystem; }
    public void setSourceSystem(String sourceSystem) { this.sourceSystem = sourceSystem; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getCompletionTime() { return completionTime; }
    public void setCompletionTime(String completionTime) { this.completionTime = completionTime; }
    public int getRecordsProcessed() { return recordsProcessed; }
    public void setRecordsProcessed(int recordsProcessed) { this.recordsProcessed = recordsProcessed; }
    public int getRecordsSucceeded() { return recordsSucceeded; }
    public void setRecordsSucceeded(int recordsSucceeded) { this.recordsSucceeded = recordsSucceeded; }
    public int getRecordsFailed() { return recordsFailed; }
    public void setRecordsFailed(int recordsFailed) { this.recordsFailed = recordsFailed; }
    public int getCustomerCount() { return customerCount; }
    public void setCustomerCount(int customerCount) { this.customerCount = customerCount; }
    public int getFacilityCount() { return facilityCount; }
    public void setFacilityCount(int facilityCount) { this.facilityCount = facilityCount; }
    public int getCollateralCount() { return collateralCount; }
    public void setCollateralCount(int collateralCount) { this.collateralCount = collateralCount; }
    public int getRelationshipCount() { return relationshipCount; }
    public void setRelationshipCount(int relationshipCount) { this.relationshipCount = relationshipCount; }
    public String getSyncBatchId() { return syncBatchId; }
    public void setSyncBatchId(String syncBatchId) { this.syncBatchId = syncBatchId; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
}
