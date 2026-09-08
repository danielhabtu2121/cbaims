package com.bank.cims.dto;

import com.bank.cims.model.*;
import java.util.List;

public class Customer360Dto {
    private Customer customer;
    private List<LoanAccount> facilities;
    private List<Collateral> collaterals;
    private List<LoanCollateralLink> collateralFacilityLinks;
    private List<InsurancePolicy> insurancePolicies;
    private List<OwnershipDocument> documents;
    private List<WorkflowTask> pendingApprovals;
    private List<CimsException> exceptions;
    private List<AuditLog> auditHistory;
    private ExposureAdequacySummaryDto exposureSummary;

    public Customer360Dto() {}

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }
    public List<LoanAccount> getFacilities() { return facilities; }
    public void setFacilities(List<LoanAccount> facilities) { this.facilities = facilities; }
    public List<Collateral> getCollaterals() { return collaterals; }
    public void setCollaterals(List<Collateral> collaterals) { this.collaterals = collaterals; }
    public List<LoanCollateralLink> getCollateralFacilityLinks() { return collateralFacilityLinks; }
    public void setCollateralFacilityLinks(List<LoanCollateralLink> collateralFacilityLinks) { this.collateralFacilityLinks = collateralFacilityLinks; }
    public List<InsurancePolicy> getInsurancePolicies() { return insurancePolicies; }
    public void setInsurancePolicies(List<InsurancePolicy> insurancePolicies) { this.insurancePolicies = insurancePolicies; }
    public List<OwnershipDocument> getDocuments() { return documents; }
    public void setDocuments(List<OwnershipDocument> documents) { this.documents = documents; }
    public List<WorkflowTask> getPendingApprovals() { return pendingApprovals; }
    public void setPendingApprovals(List<WorkflowTask> pendingApprovals) { this.pendingApprovals = pendingApprovals; }
    public List<CimsException> getExceptions() { return exceptions; }
    public void setExceptions(List<CimsException> exceptions) { this.exceptions = exceptions; }
    public List<AuditLog> getAuditHistory() { return auditHistory; }
    public void setAuditHistory(List<AuditLog> auditHistory) { this.auditHistory = auditHistory; }
    public ExposureAdequacySummaryDto getExposureSummary() { return exposureSummary; }
    public void setExposureSummary(ExposureAdequacySummaryDto exposureSummary) { this.exposureSummary = exposureSummary; }
}
