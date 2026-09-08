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
    
    @Column(nullable = false)
    private String result;
    
    @Column(name = "error_message")
    private String errorMessage;
    
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
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
}
