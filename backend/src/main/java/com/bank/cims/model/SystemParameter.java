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

    @Column(name = "param_type")
    private String paramType = "string";

    public SystemParameter() {}

    public SystemParameter(String paramKey, String paramValue, String description) {
        this.paramKey = paramKey;
        this.paramValue = paramValue;
        this.description = description;
        this.paramType = "string";
    }

    public SystemParameter(String paramKey, String paramValue, String description, String paramType) {
        this.paramKey = paramKey;
        this.paramValue = paramValue;
        this.description = description;
        this.paramType = paramType != null ? paramType : "string";
    }

    public String getParamKey() { return paramKey; }
    public void setParamKey(String paramKey) { this.paramKey = paramKey; }
    public String getParamValue() { return paramValue; }
    public void setParamValue(String paramValue) { this.paramValue = paramValue; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getParamType() { return paramType; }
    public void setParamType(String paramType) { this.paramType = paramType; }
}
