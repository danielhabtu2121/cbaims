package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_reminder_schedules")
public class ReminderSchedule {
    @Id
    private String id;

    @Column(name = "name")
    private String name;

    @Column(name = "days_before_expiry", nullable = false)
    private int daysBeforeExpiry;

    @Column(name = "audience")
    private String audience = "Staff";

    @Column(name = "trigger_basis")
    private String triggerBasis = "Before Expiry";

    @Column(name = "offset_days")
    private int offsetDays = 30;

    @Column(name = "day_type")
    private String dayType = "Working Day";

    @Column(name = "recurrence")
    private String recurrence = "One-time";

    @Column(name = "recurrence_interval")
    private int recurrenceInterval = 1;

    @Column(name = "recurrence_unit")
    private String recurrenceUnit = "DAYS";

    @Column(name = "continue_until")
    private String continueUntil = "Renewed";

    @Column(name = "channels_json")
    private String channelsJson = "[\"SMS\",\"Email\"]";

    @Column(name = "recipient_roles_json")
    private String recipientRolesJson = "[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]";

    private boolean active = true;

    public ReminderSchedule() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() {
        if (name != null && !name.isBlank()) return name;
        return (triggerBasis != null ? triggerBasis : "Expiry") + " " + offsetDays + " " + (dayType != null ? dayType : "Day(s)");
    }
    public void setName(String name) { this.name = name; }
    public int getDaysBeforeExpiry() { return daysBeforeExpiry; }
    public void setDaysBeforeExpiry(int daysBeforeExpiry) { 
        this.daysBeforeExpiry = daysBeforeExpiry; 
        this.offsetDays = daysBeforeExpiry;
    }
    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }
    public String getTriggerBasis() { return triggerBasis; }
    public void setTriggerBasis(String triggerBasis) { this.triggerBasis = triggerBasis; }
    public int getOffsetDays() { return offsetDays; }
    public void setOffsetDays(int offsetDays) { 
        this.offsetDays = offsetDays; 
        this.daysBeforeExpiry = offsetDays;
    }
    public String getDayType() { return dayType; }
    public void setDayType(String dayType) { this.dayType = dayType; }
    public String getRecurrence() { return recurrence; }
    public void setRecurrence(String recurrence) { this.recurrence = recurrence; }
    public int getRecurrenceInterval() { return recurrenceInterval > 0 ? recurrenceInterval : 1; }
    public void setRecurrenceInterval(int recurrenceInterval) { this.recurrenceInterval = Math.max(1, recurrenceInterval); }
    public String getRecurrenceUnit() { return recurrenceUnit != null ? recurrenceUnit : "DAYS"; }
    public void setRecurrenceUnit(String recurrenceUnit) { this.recurrenceUnit = recurrenceUnit; }
    public String getContinueUntil() { return continueUntil; }
    public void setContinueUntil(String continueUntil) { this.continueUntil = continueUntil; }
    public String getChannelsJson() { return channelsJson; }
    public void setChannelsJson(String channelsJson) { this.channelsJson = channelsJson; }
    public String getRecipientRolesJson() { return recipientRolesJson; }
    public void setRecipientRolesJson(String recipientRolesJson) { this.recipientRolesJson = recipientRolesJson; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
