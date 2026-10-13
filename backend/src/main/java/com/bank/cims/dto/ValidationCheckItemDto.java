package com.bank.cims.dto;

public class ValidationCheckItemDto {
    private String category;
    private String checkName;
    private boolean passed;
    private String message;
    private boolean overrideable;
    private String exceptionType;
    private String failedRequirement;
    private String ruleKey;
    private String severity = "INFO"; // INFO, WARNING, HARD_STOP

    public ValidationCheckItemDto() {}

    public ValidationCheckItemDto(String category, String checkName, boolean passed, String message,
                                  boolean overrideable, String exceptionType, String failedRequirement, String ruleKey) {
        this.category = category;
        this.checkName = checkName;
        this.passed = passed;
        this.message = message;
        this.overrideable = overrideable;
        this.exceptionType = exceptionType;
        this.failedRequirement = failedRequirement;
        this.ruleKey = ruleKey;
    }

    public ValidationCheckItemDto(String ruleKey, String checkName, String category, boolean passed, boolean overrideable, String message) {
        this.ruleKey = ruleKey;
        this.checkName = checkName;
        this.category = category;
        this.passed = passed;
        this.overrideable = overrideable;
        this.message = message;
    }

    public ValidationCheckItemDto(String ruleKey, String checkName, String category, boolean passed, boolean overrideable, String message, String failedRequirement, String exceptionType) {
        this.ruleKey = ruleKey;
        this.checkName = checkName;
        this.category = category;
        this.passed = passed;
        this.overrideable = overrideable;
        this.message = message;
        this.failedRequirement = failedRequirement;
        this.exceptionType = exceptionType;
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCheckName() { return checkName; }
    public void setCheckName(String checkName) { this.checkName = checkName; }
    public boolean isPassed() { return passed; }
    public void setPassed(boolean passed) { this.passed = passed; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isOverrideable() { return overrideable; }
    public void setOverrideable(boolean overrideable) { this.overrideable = overrideable; }
    public String getExceptionType() { return exceptionType; }
    public void setExceptionType(String exceptionType) { this.exceptionType = exceptionType; }
    public String getFailedRequirement() { return failedRequirement; }
    public void setFailedRequirement(String failedRequirement) { this.failedRequirement = failedRequirement; }
    public String getRuleKey() { return ruleKey; }
    public void setRuleKey(String ruleKey) { this.ruleKey = ruleKey; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
}
