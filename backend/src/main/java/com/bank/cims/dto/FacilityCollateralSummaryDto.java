package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class FacilityCollateralSummaryDto {
    private String facilityId;
    private String loanAccountId;
    private String loanReference;
    private String lineCode;
    private String accountNumber;
    private String customerId;
    private String customerName;
    private String customerCif;
    private String facilityType;
    private String currency;
    private double approvedLimit;
    private double outstandingBalance;
    private double availableAmount;
    private String businessSegment;
    private String branch;
    private String status;

    // Aggregate Collateral Metrics for Facility
    private int linkedCollateralCount;
    private double totalAllocatedCollateral;
    private double totalNetCollateralValue;
    private double totalMarketValuation;
    private double collateralCoveragePct; // totalAllocatedCollateral / outstandingBalance * 100

    // Insurance Adequacy for Facility
    private double totalRecognizedInsurance;
    private double insuranceRequirement;
    private double insuranceGap;
    private String adequacyStatus; // ADEQUATE, UNDERINSURED, EXPIRED, NOT REQUIRED
    private double insuranceCoveragePct;

    // Detailed linked collaterals
    private List<CollateralFacilityLinkDto> securingCollaterals = new ArrayList<>();

    public FacilityCollateralSummaryDto() {}

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getLoanAccountId() { return loanAccountId; }
    public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }

    public String getLoanReference() { return loanReference; }
    public void setLoanReference(String loanReference) { this.loanReference = loanReference; }

    public String getLineCode() { return lineCode; }
    public void setLineCode(String lineCode) { this.lineCode = lineCode; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }

    public String getFacilityType() { return facilityType; }
    public void setFacilityType(String facilityType) { this.facilityType = facilityType; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public double getApprovedLimit() { return approvedLimit; }
    public void setApprovedLimit(double approvedLimit) { this.approvedLimit = approvedLimit; }

    public double getOutstandingBalance() { return outstandingBalance; }
    public void setOutstandingBalance(double outstandingBalance) { this.outstandingBalance = outstandingBalance; }

    public double getAvailableAmount() { return availableAmount; }
    public void setAvailableAmount(double availableAmount) { this.availableAmount = availableAmount; }

    public String getBusinessSegment() { return businessSegment; }
    public void setBusinessSegment(String businessSegment) { this.businessSegment = businessSegment; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getLinkedCollateralCount() { return linkedCollateralCount; }
    public void setLinkedCollateralCount(int linkedCollateralCount) { this.linkedCollateralCount = linkedCollateralCount; }

    public double getTotalAllocatedCollateral() { return totalAllocatedCollateral; }
    public void setTotalAllocatedCollateral(double totalAllocatedCollateral) { this.totalAllocatedCollateral = totalAllocatedCollateral; }

    public double getTotalNetCollateralValue() { return totalNetCollateralValue; }
    public void setTotalNetCollateralValue(double totalNetCollateralValue) { this.totalNetCollateralValue = totalNetCollateralValue; }

    public double getTotalMarketValuation() { return totalMarketValuation; }
    public void setTotalMarketValuation(double totalMarketValuation) { this.totalMarketValuation = totalMarketValuation; }

    public double getCollateralCoveragePct() { return collateralCoveragePct; }
    public void setCollateralCoveragePct(double collateralCoveragePct) { this.collateralCoveragePct = collateralCoveragePct; }

    public double getTotalRecognizedInsurance() { return totalRecognizedInsurance; }
    public void setTotalRecognizedInsurance(double totalRecognizedInsurance) { this.totalRecognizedInsurance = totalRecognizedInsurance; }

    public double getInsuranceRequirement() { return insuranceRequirement; }
    public void setInsuranceRequirement(double insuranceRequirement) { this.insuranceRequirement = insuranceRequirement; }

    public double getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(double insuranceGap) { this.insuranceGap = insuranceGap; }

    public String getAdequacyStatus() { return adequacyStatus; }
    public void setAdequacyStatus(String adequacyStatus) { this.adequacyStatus = adequacyStatus; }

    public double getInsuranceCoveragePct() { return insuranceCoveragePct; }
    public void setInsuranceCoveragePct(double insuranceCoveragePct) { this.insuranceCoveragePct = insuranceCoveragePct; }

    public List<CollateralFacilityLinkDto> getSecuringCollaterals() { return securingCollaterals; }
    public void setSecuringCollaterals(List<CollateralFacilityLinkDto> securingCollaterals) { this.securingCollaterals = securingCollaterals; }
}
