package com.bank.cims.dto;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

public class NotificationDispatchResult {
    private boolean success;
    private String deliveryReference;
    private String provider;
    private String status;
    private String errorMessage;
    private String timestamp = LocalDateTime.now().toString();
    private long latencyMs = 0;
    private Map<String, Object> metadata = new HashMap<>();

    public NotificationDispatchResult() {}

    public NotificationDispatchResult(boolean success, String deliveryReference, String provider, String status, String errorMessage) {
        this.success = success;
        this.deliveryReference = deliveryReference;
        this.provider = provider;
        this.status = status;
        this.errorMessage = errorMessage;
        this.timestamp = LocalDateTime.now().toString();
    }

    public static NotificationDispatchResult success(String deliveryReference, String provider, String status) {
        return new NotificationDispatchResult(true, deliveryReference, provider, status != null ? status : "Sent", null);
    }

    public static NotificationDispatchResult failure(String provider, String errorMessage) {
        return new NotificationDispatchResult(false, null, provider, "Failed", errorMessage);
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getDeliveryReference() { return deliveryReference; }
    public void setDeliveryReference(String deliveryReference) { this.deliveryReference = deliveryReference; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(long latencyMs) { this.latencyMs = latencyMs; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}
