package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class PolicyPreValidationResultDto {
    private boolean valid = true;
    private String summaryMessage = "Validation Passed: All mandatory requirements satisfied.";
    private List<ValidationCheckItemDto> checks = new ArrayList<>();
    private boolean canSubmitAsException = false;
    private boolean hasHardBlock = false;
    private List<ValidationCheckItemDto> overrideableOptions = new ArrayList<>();

    public PolicyPreValidationResultDto() {}

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    public String getSummaryMessage() { return summaryMessage; }
    public void setSummaryMessage(String summaryMessage) { this.summaryMessage = summaryMessage; }
    public List<ValidationCheckItemDto> getChecks() { return checks; }
    public void setChecks(List<ValidationCheckItemDto> checks) { this.checks = checks; }
    public boolean isCanSubmitAsException() { return canSubmitAsException; }
    public void setCanSubmitAsException(boolean canSubmitAsException) { this.canSubmitAsException = canSubmitAsException; }
    public boolean isHasHardBlock() { return hasHardBlock; }
    public void setHasHardBlock(boolean hasHardBlock) { this.hasHardBlock = hasHardBlock; }
    public List<ValidationCheckItemDto> getOverrideableOptions() { return overrideableOptions; }
    public void setOverrideableOptions(List<ValidationCheckItemDto> overrideableOptions) { this.overrideableOptions = overrideableOptions; }

    public void addCheck(ValidationCheckItemDto check) {
        if (this.checks == null) this.checks = new ArrayList<>();
        this.checks.add(check);
        if (!check.isPassed()) {
            this.valid = false;
            if (!check.isOverrideable()) {
                this.hasHardBlock = true;
            } else {
                if (this.overrideableOptions == null) this.overrideableOptions = new ArrayList<>();
                this.overrideableOptions.add(check);
            }
        }
    }
}
