package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_notification_templates")
public class NotificationTemplate {
    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    @Column(name = "trigger_days_before", nullable = false)
    private int triggerDaysBefore;

    private String subject;

    @Column(nullable = false)
    private String body;

    private boolean active = true;

    public NotificationTemplate() {}

    public NotificationTemplate(String id, String name, String type, int triggerDaysBefore, String subject, String body, boolean active) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.triggerDaysBefore = triggerDaysBefore;
        this.subject = subject;
        this.body = body;
        this.active = active;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public int getTriggerDaysBefore() { return triggerDaysBefore; }
    public void setTriggerDaysBefore(int triggerDaysBefore) { this.triggerDaysBefore = triggerDaysBefore; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
