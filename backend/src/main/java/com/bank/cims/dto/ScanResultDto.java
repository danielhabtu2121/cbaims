package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class ScanResultDto {
    private String scanStartedAt;
    private String scanCompletedAt;
    private int policiesEvaluated;
    private int collateralsEvaluated;
    private int documentsEvaluated;
    private int exceptionsCreated;
    private int exceptionsUpdated;
    private int exceptionsAutoResolved;
    private List<String> errorsEncountered = new ArrayList<>();

    public ScanResultDto() {}

    public String getScanStartedAt() { return scanStartedAt; }
    public void setScanStartedAt(String scanStartedAt) { this.scanStartedAt = scanStartedAt; }
    public String getScanCompletedAt() { return scanCompletedAt; }
    public void setScanCompletedAt(String scanCompletedAt) { this.scanCompletedAt = scanCompletedAt; }
    public int getPoliciesEvaluated() { return policiesEvaluated; }
    public void setPoliciesEvaluated(int policiesEvaluated) { this.policiesEvaluated = policiesEvaluated; }
    public int getCollateralsEvaluated() { return collateralsEvaluated; }
    public void setCollateralsEvaluated(int collateralsEvaluated) { this.collateralsEvaluated = collateralsEvaluated; }
    public int getDocumentsEvaluated() { return documentsEvaluated; }
    public void setDocumentsEvaluated(int documentsEvaluated) { this.documentsEvaluated = documentsEvaluated; }
    public int getExceptionsCreated() { return exceptionsCreated; }
    public void setExceptionsCreated(int exceptionsCreated) { this.exceptionsCreated = exceptionsCreated; }
    public int getExceptionsUpdated() { return exceptionsUpdated; }
    public void setExceptionsUpdated(int exceptionsUpdated) { this.exceptionsUpdated = exceptionsUpdated; }
    public int getExceptionsAutoResolved() { return exceptionsAutoResolved; }
    public void setExceptionsAutoResolved(int exceptionsAutoResolved) { this.exceptionsAutoResolved = exceptionsAutoResolved; }
    public List<String> getErrorsEncountered() { return errorsEncountered; }
    public void setErrorsEncountered(List<String> errorsEncountered) { this.errorsEncountered = errorsEncountered; }
}
