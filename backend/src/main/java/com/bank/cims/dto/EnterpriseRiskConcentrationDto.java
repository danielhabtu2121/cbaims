package com.bank.cims.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class EnterpriseRiskConcentrationDto {
    private BigDecimal totalCreditExposure = BigDecimal.ZERO;
    private BigDecimal grossCollateralMarketValue = BigDecimal.ZERO;
    private BigDecimal singleCountedPledgedValue = BigDecimal.ZERO;
    private BigDecimal netRealizableSecurityValue = BigDecimal.ZERO;
    private double portfolioWeightedLtvPct = 0.0;
    private double portfolioCoveragePct = 0.0;
    private BigDecimal netUncoveredDeficit = BigDecimal.ZERO;
    private int multiPledgedCollateralCount = 0;

    private List<TopDebtorDto> topDebtors = new ArrayList<>();
    private List<TopDeficitFacilityDto> topDeficitFacilities = new ArrayList<>();
    private List<SharedCollateralPoolDto> sharedCollaterals = new ArrayList<>();
    private List<CriticalExpiringCollateralDto> criticalExpiringCollaterals = new ArrayList<>();

    public EnterpriseRiskConcentrationDto() {}

    public static class TopDebtorDto {
        private String cif;
        private String customerName;
        private String customerType;
        private String segment;
        private String branch;
        private int facilityCount;
        private int collateralCount;
        private BigDecimal totalExposure = BigDecimal.ZERO;
        private BigDecimal collateralMarketValue = BigDecimal.ZERO;
        private BigDecimal netSecurityValue = BigDecimal.ZERO;
        private double effectiveLtvPct = 0.0;
        private double coveragePct = 0.0;
        private String insuranceStatus;
        private String riskRating;

        public TopDebtorDto() {}

        public String getCif() { return cif; }
        public void setCif(String cif) { this.cif = cif; }

        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }

        public String getCustomerType() { return customerType; }
        public void setCustomerType(String customerType) { this.customerType = customerType; }

        public String getSegment() { return segment; }
        public void setSegment(String segment) { this.segment = segment; }

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }

        public int getFacilityCount() { return facilityCount; }
        public void setFacilityCount(int facilityCount) { this.facilityCount = facilityCount; }

        public int getCollateralCount() { return collateralCount; }
        public void setCollateralCount(int collateralCount) { this.collateralCount = collateralCount; }

        public BigDecimal getTotalExposure() { return totalExposure; }
        public void setTotalExposure(BigDecimal totalExposure) { this.totalExposure = totalExposure; }

        public BigDecimal getCollateralMarketValue() { return collateralMarketValue; }
        public void setCollateralMarketValue(BigDecimal collateralMarketValue) { this.collateralMarketValue = collateralMarketValue; }

        public BigDecimal getNetSecurityValue() { return netSecurityValue; }
        public void setNetSecurityValue(BigDecimal netSecurityValue) { this.netSecurityValue = netSecurityValue; }

        public double getEffectiveLtvPct() { return effectiveLtvPct; }
        public void setEffectiveLtvPct(double effectiveLtvPct) { this.effectiveLtvPct = effectiveLtvPct; }

        public double getCoveragePct() { return coveragePct; }
        public void setCoveragePct(double coveragePct) { this.coveragePct = coveragePct; }

        public String getInsuranceStatus() { return insuranceStatus; }
        public void setInsuranceStatus(String insuranceStatus) { this.insuranceStatus = insuranceStatus; }

        public String getRiskRating() { return riskRating; }
        public void setRiskRating(String riskRating) { this.riskRating = riskRating; }
    }

    public static class TopDeficitFacilityDto {
        private String facilityId;
        private String loanReference;
        private String accountNumber;
        private String cif;
        private String customerName;
        private String facilityType;
        private BigDecimal approvedLimit = BigDecimal.ZERO;
        private BigDecimal outstandingBalance = BigDecimal.ZERO;
        private BigDecimal pledgedCollateralValue = BigDecimal.ZERO;
        private BigDecimal shortfallAmount = BigDecimal.ZERO;
        private double ltvRatio = 0.0;
        private String branch;
        private String segment;
        private String actionRequired;

        public TopDeficitFacilityDto() {}

        public String getFacilityId() { return facilityId; }
        public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

        public String getLoanReference() { return loanReference; }
        public void setLoanReference(String loanReference) { this.loanReference = loanReference; }

        public String getAccountNumber() { return accountNumber; }
        public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

        public String getCif() { return cif; }
        public void setCif(String cif) { this.cif = cif; }

        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }

        public String getFacilityType() { return facilityType; }
        public void setFacilityType(String facilityType) { this.facilityType = facilityType; }

        public BigDecimal getApprovedLimit() { return approvedLimit; }
        public void setApprovedLimit(BigDecimal approvedLimit) { this.approvedLimit = approvedLimit; }

        public BigDecimal getOutstandingBalance() { return outstandingBalance; }
        public void setOutstandingBalance(BigDecimal outstandingBalance) { this.outstandingBalance = outstandingBalance; }

        public BigDecimal getPledgedCollateralValue() { return pledgedCollateralValue; }
        public void setPledgedCollateralValue(BigDecimal pledgedCollateralValue) { this.pledgedCollateralValue = pledgedCollateralValue; }

        public BigDecimal getShortfallAmount() { return shortfallAmount; }
        public void setShortfallAmount(BigDecimal shortfallAmount) { this.shortfallAmount = shortfallAmount; }

        public double getLtvRatio() { return ltvRatio; }
        public void setLtvRatio(double ltvRatio) { this.ltvRatio = ltvRatio; }

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }

        public String getSegment() { return segment; }
        public void setSegment(String segment) { this.segment = segment; }

        public String getActionRequired() { return actionRequired; }
        public void setActionRequired(String actionRequired) { this.actionRequired = actionRequired; }
    }

    public static class SharedCollateralPoolDto {
        private String collateralId;
        private String collateralCode;
        private String description;
        private String category;
        private BigDecimal marketValue = BigDecimal.ZERO;
        private BigDecimal netSecurityValue = BigDecimal.ZERO;
        private int linkedFacilitiesCount = 0;
        private BigDecimal totalLinkedExposure = BigDecimal.ZERO;
        private double totalAllocationPct = 0.0;
        private boolean overCommitted = false;
        private String ownerName;
        private String branch;
        private List<String> linkedFacilityRefs = new ArrayList<>();

        public SharedCollateralPoolDto() {}

        public String getCollateralId() { return collateralId; }
        public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

        public String getCollateralCode() { return collateralCode; }
        public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public BigDecimal getMarketValue() { return marketValue; }
        public void setMarketValue(BigDecimal marketValue) { this.marketValue = marketValue; }

        public BigDecimal getNetSecurityValue() { return netSecurityValue; }
        public void setNetSecurityValue(BigDecimal netSecurityValue) { this.netSecurityValue = netSecurityValue; }

        public int getLinkedFacilitiesCount() { return linkedFacilitiesCount; }
        public void setLinkedFacilitiesCount(int linkedFacilitiesCount) { this.linkedFacilitiesCount = linkedFacilitiesCount; }

        public BigDecimal getTotalLinkedExposure() { return totalLinkedExposure; }
        public void setTotalLinkedExposure(BigDecimal totalLinkedExposure) { this.totalLinkedExposure = totalLinkedExposure; }

        public double getTotalAllocationPct() { return totalAllocationPct; }
        public void setTotalAllocationPct(double totalAllocationPct) { this.totalAllocationPct = totalAllocationPct; }

        public boolean isOverCommitted() { return overCommitted; }
        public void setOverCommitted(boolean overCommitted) { this.overCommitted = overCommitted; }

        public String getOwnerName() { return ownerName; }
        public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }

        public List<String> getLinkedFacilityRefs() { return linkedFacilityRefs; }
        public void setLinkedFacilityRefs(List<String> linkedFacilityRefs) { this.linkedFacilityRefs = linkedFacilityRefs; }
    }

    public static class CriticalExpiringCollateralDto {
        private String collateralId;
        private String collateralCode;
        private String description;
        private String category;
        private String customerName;
        private String cif;
        private BigDecimal marketValue = BigDecimal.ZERO;
        private BigDecimal exposedLoanAmount = BigDecimal.ZERO;
        private String issueType; // Missing Policy, Expired Policy, Expired Valuation
        private String policyNumber;
        private String expiryDate;
        private int daysPastOrToExpiry;
        private String branch;

        public CriticalExpiringCollateralDto() {}

        public String getCollateralId() { return collateralId; }
        public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

        public String getCollateralCode() { return collateralCode; }
        public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }

        public String getCif() { return cif; }
        public void setCif(String cif) { this.cif = cif; }

        public BigDecimal getMarketValue() { return marketValue; }
        public void setMarketValue(BigDecimal marketValue) { this.marketValue = marketValue; }

        public BigDecimal getExposedLoanAmount() { return exposedLoanAmount; }
        public void setExposedLoanAmount(BigDecimal exposedLoanAmount) { this.exposedLoanAmount = exposedLoanAmount; }

        public String getIssueType() { return issueType; }
        public void setIssueType(String issueType) { this.issueType = issueType; }

        public String getPolicyNumber() { return policyNumber; }
        public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }

        public String getExpiryDate() { return expiryDate; }
        public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

        public int getDaysPastOrToExpiry() { return daysPastOrToExpiry; }
        public void setDaysPastOrToExpiry(int daysPastOrToExpiry) { this.daysPastOrToExpiry = daysPastOrToExpiry; }

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
    }

    public BigDecimal getTotalCreditExposure() { return totalCreditExposure; }
    public void setTotalCreditExposure(BigDecimal totalCreditExposure) { this.totalCreditExposure = totalCreditExposure; }

    public BigDecimal getGrossCollateralMarketValue() { return grossCollateralMarketValue; }
    public void setGrossCollateralMarketValue(BigDecimal grossCollateralMarketValue) { this.grossCollateralMarketValue = grossCollateralMarketValue; }

    public BigDecimal getSingleCountedPledgedValue() { return singleCountedPledgedValue; }
    public void setSingleCountedPledgedValue(BigDecimal singleCountedPledgedValue) { this.singleCountedPledgedValue = singleCountedPledgedValue; }

    public BigDecimal getNetRealizableSecurityValue() { return netRealizableSecurityValue; }
    public void setNetRealizableSecurityValue(BigDecimal netRealizableSecurityValue) { this.netRealizableSecurityValue = netRealizableSecurityValue; }

    public double getPortfolioWeightedLtvPct() { return portfolioWeightedLtvPct; }
    public void setPortfolioWeightedLtvPct(double portfolioWeightedLtvPct) { this.portfolioWeightedLtvPct = portfolioWeightedLtvPct; }

    public double getPortfolioCoveragePct() { return portfolioCoveragePct; }
    public void setPortfolioCoveragePct(double portfolioCoveragePct) { this.portfolioCoveragePct = portfolioCoveragePct; }

    public BigDecimal getNetUncoveredDeficit() { return netUncoveredDeficit; }
    public void setNetUncoveredDeficit(BigDecimal netUncoveredDeficit) { this.netUncoveredDeficit = netUncoveredDeficit; }

    public int getMultiPledgedCollateralCount() { return multiPledgedCollateralCount; }
    public void setMultiPledgedCollateralCount(int multiPledgedCollateralCount) { this.multiPledgedCollateralCount = multiPledgedCollateralCount; }

    public List<TopDebtorDto> getTopDebtors() { return topDebtors; }
    public void setTopDebtors(List<TopDebtorDto> topDebtors) { this.topDebtors = topDebtors; }

    public List<TopDeficitFacilityDto> getTopDeficitFacilities() { return topDeficitFacilities; }
    public void setTopDeficitFacilities(List<TopDeficitFacilityDto> topDeficitFacilities) { this.topDeficitFacilities = topDeficitFacilities; }

    public List<SharedCollateralPoolDto> getSharedCollaterals() { return sharedCollaterals; }
    public void setSharedCollaterals(List<SharedCollateralPoolDto> sharedCollaterals) { this.sharedCollaterals = sharedCollaterals; }

    public List<CriticalExpiringCollateralDto> getCriticalExpiringCollaterals() { return criticalExpiringCollaterals; }
    public void setCriticalExpiringCollaterals(List<CriticalExpiringCollateralDto> criticalExpiringCollaterals) { this.criticalExpiringCollaterals = criticalExpiringCollaterals; }
}
