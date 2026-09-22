package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_reminder_schedules")
public class ReminderSchedule {
    @Id
    private String id;
    
    @Column(name = "days_before_expiry", nullable = false, unique = true)
    private int daysBeforeExpiry;
    
    @Column(name = "channels_json")
    private String channelsJson = "[\"SMS\",\"Email\"]";
    
    @Column(name = "recipient_roles_json")
    private String recipientRolesJson = "[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]";
    
    private boolean active = true;

    public ReminderSchedule() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public int getDaysBeforeExpiry() { return daysBeforeExpiry; }
    public void setDaysBeforeExpiry(int daysBeforeExpiry) { this.daysBeforeExpiry = daysBeforeExpiry; }
    public String getChannelsJson() { return channelsJson; }
    public void setChannelsJson(String channelsJson) { this.channelsJson = channelsJson; }
    public String getRecipientRolesJson() { return recipientRolesJson; }
    public void setRecipientRolesJson(String recipientRolesJson) { this.recipientRolesJson = recipientRolesJson; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
