package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_system_parameters")
public class SystemParameter {
    @Id
    @Column(name = "param_key")
    private String paramKey;

    @Column(name = "param_value", nullable = false)
    private String paramValue;

    private String description;

    public SystemParameter() {}

    public SystemParameter(String paramKey, String paramValue, String description) {
        this.paramKey = paramKey;
        this.paramValue = paramValue;
        this.description = description;
    }

    public String getParamKey() { return paramKey; }
    public void setParamKey(String paramKey) { this.paramKey = paramKey; }
    public String getParamValue() { return paramValue; }
    public void setParamValue(String paramValue) { this.paramValue = paramValue; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
