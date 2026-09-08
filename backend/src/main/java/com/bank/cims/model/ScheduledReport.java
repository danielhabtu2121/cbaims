package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cims_scheduled_reports")
public class ScheduledReport {
    @Id
    private String id;
    
    @Column(name = "report_type", nullable = false)
    private String reportType;
    
    @Column(nullable = false)
    private String frequency = "Weekly";
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String recipients;
    
    @Column(nullable = false)
    private String format = "PDF";
    
    @Column(name = "parameters_json", columnDefinition = "TEXT")
    private String parametersJson;
    
    @Column(name = "last_run_at")
    private String lastRunAt;
    
    @Column(name = "next_run_at")
    private String nextRunAt;
    
    @Column(nullable = false)
    private String status = "Active";
    
    @Column(name = "created_by")
    private String createdBy;
    
    @Column(name = "created_at")
    private String createdAt = LocalDateTime.now().toString();

    public ScheduledReport() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getRecipients() { return recipients; }
    public void setRecipients(String recipients) { this.recipients = recipients; }
    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }
    public String getParametersJson() { return parametersJson; }
    public void setParametersJson(String parametersJson) { this.parametersJson = parametersJson; }
    public String getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(String lastRunAt) { this.lastRunAt = lastRunAt; }
    public String getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(String nextRunAt) { this.nextRunAt = nextRunAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
