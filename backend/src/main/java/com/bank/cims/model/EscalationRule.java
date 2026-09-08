package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_escalation_rules")
public class EscalationRule {
    @Id
    private String id;

    @Column(name = "days_before_expiry", nullable = false)
    private int daysBeforeExpiry;

    @Column(name = "escalation_role", nullable = false)
    private String escalationRole;

    @Column(name = "recipient_type", nullable = false)
    private String recipientType;

    public EscalationRule() {}

    public EscalationRule(String id, int daysBeforeExpiry, String escalationRole, String recipientType) {
        this.id = id;
        this.daysBeforeExpiry = daysBeforeExpiry;
        this.escalationRole = escalationRole;
        this.recipientType = recipientType;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public int getDaysBeforeExpiry() { return daysBeforeExpiry; }
    public void setDaysBeforeExpiry(int daysBeforeExpiry) { this.daysBeforeExpiry = daysBeforeExpiry; }
    public String getEscalationRole() { return escalationRole; }
    public void setEscalationRole(String escalationRole) { this.escalationRole = escalationRole; }
    public String getRecipientType() { return recipientType; }
    public void setRecipientType(String recipientType) { this.recipientType = recipientType; }
}
