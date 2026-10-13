package com.bank.cims.service.cbs;

import java.time.LocalDateTime;

public class CbsConnectionStatus {
    private String mode; // SIMULATOR or REAL
    private String status; // AVAILABLE, UNAVAILABLE, NOT_CONFIGURED
    private String message;
    private String checkTimestamp;

    public CbsConnectionStatus() {
        this.checkTimestamp = LocalDateTime.now().toString();
    }

    public CbsConnectionStatus(String mode, String status, String message) {
        this.mode = mode;
        this.status = status;
        this.message = message;
        this.checkTimestamp = LocalDateTime.now().toString();
    }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getCheckTimestamp() { return checkTimestamp; }
    public void setCheckTimestamp(String checkTimestamp) { this.checkTimestamp = checkTimestamp; }
}
