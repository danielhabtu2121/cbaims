package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class RelationshipValidationResultDto {
    private boolean valid = true;
    private boolean canProceed = true;
    private String summaryMessage;

    // Financial calculation values calculated during validation
    private double netCollateralValue;
    private double requestedAllocationAmount;
    private double currentActiveAllocations;
    private double projectedTotalAllocation;
    private double remainingUnallocatedSecurity;
    private double excessAllocationAmount;
    private double collateralAllocationPct;
    private double facilityCoveragePct;
    private double facilityOutstandingBalance;
    private double facilityApprovedLimit;

    // Entity Resolution & Identity Diagnostics
    private String collateralId;
    private String collateralCode;
    private String collateralDescription;
    private String collateralStatus;
    private String collateralCurrency = "ETB";

    private String facilityId;
    private String loanReference;
    private String accountNumber;
    private String facilityStatus;
    private String facilityCurrency = "ETB";
    private boolean currencyMatched = true;

    // Legal Owner vs Facility Borrower Diagnostics
    private String legalOwnerName;
    private String legalOwnerCustomerId;
    private String legalOwnerCif;
    private String ownerType;
    private double ownershipPercentage = 100.0;
    private String ownerVerificationStatus;
    private String relationshipToBorrower;

    private String borrowerName;
    private String borrowerCustomerId;
    private String borrowerCif;

    private boolean ownerBorrowerMatch = true;
    private boolean thirdParty = false;
    private String consentStatus;
    private String pledgeAgreementRef;
    private boolean hasRequiredPledgeEvidence = true;

    private String overallDecision = "CAN_PROCEED"; // CAN_PROCEED, REQUIRES_CORRECTION, BLOCKED
    private List<String> warningMessages = new ArrayList<>();
    private List<String> blockingMessages = new ArrayList<>();

    private List<ValidationCheckItemDto> checks = new ArrayList<>();

    public RelationshipValidationResultDto() {}

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }

    public boolean isCanProceed() { return canProceed; }
    public void setCanProceed(boolean canProceed) { this.canProceed = canProceed; }

    public String getSummaryMessage() { return summaryMessage; }
    public void setSummaryMessage(String summaryMessage) { this.summaryMessage = summaryMessage; }

    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }

    public double getRequestedAllocationAmount() { return requestedAllocationAmount; }
    public void setRequestedAllocationAmount(double requestedAllocationAmount) { this.requestedAllocationAmount = requestedAllocationAmount; }

    public double getCurrentActiveAllocations() { return currentActiveAllocations; }
    public void setCurrentActiveAllocations(double currentActiveAllocations) { this.currentActiveAllocations = currentActiveAllocations; }

    public double getProjectedTotalAllocation() { return projectedTotalAllocation; }
    public void setProjectedTotalAllocation(double projectedTotalAllocation) { this.projectedTotalAllocation = projectedTotalAllocation; }

    public double getRemainingUnallocatedSecurity() { return remainingUnallocatedSecurity; }
    public void setRemainingUnallocatedSecurity(double remainingUnallocatedSecurity) { this.remainingUnallocatedSecurity = remainingUnallocatedSecurity; }

    public double getCollateralAllocationPct() { return collateralAllocationPct; }
    public void setCollateralAllocationPct(double collateralAllocationPct) { this.collateralAllocationPct = collateralAllocationPct; }

    public double getFacilityCoveragePct() { return facilityCoveragePct; }
    public void setFacilityCoveragePct(double facilityCoveragePct) { this.facilityCoveragePct = facilityCoveragePct; }

    public double getFacilityOutstandingBalance() { return facilityOutstandingBalance; }
    public void setFacilityOutstandingBalance(double facilityOutstandingBalance) { this.facilityOutstandingBalance = facilityOutstandingBalance; }

    public double getFacilityApprovedLimit() { return facilityApprovedLimit; }
    public void setFacilityApprovedLimit(double facilityApprovedLimit) { this.facilityApprovedLimit = facilityApprovedLimit; }

    public List<ValidationCheckItemDto> getChecks() { return checks; }
    public void setChecks(List<ValidationCheckItemDto> checks) { this.checks = checks; }

    public double getExcessAllocationAmount() { return excessAllocationAmount; }
    public void setExcessAllocationAmount(double excessAllocationAmount) { this.excessAllocationAmount = excessAllocationAmount; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }

    public String getCollateralDescription() { return collateralDescription; }
    public void setCollateralDescription(String collateralDescription) { this.collateralDescription = collateralDescription; }

    public String getCollateralStatus() { return collateralStatus; }
    public void setCollateralStatus(String collateralStatus) { this.collateralStatus = collateralStatus; }

    public String getCollateralCurrency() { return collateralCurrency; }
    public void setCollateralCurrency(String collateralCurrency) { this.collateralCurrency = collateralCurrency; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getLoanReference() { return loanReference; }
    public void setLoanReference(String loanReference) { this.loanReference = loanReference; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getFacilityStatus() { return facilityStatus; }
    public void setFacilityStatus(String facilityStatus) { this.facilityStatus = facilityStatus; }

    public String getFacilityCurrency() { return facilityCurrency; }
    public void setFacilityCurrency(String facilityCurrency) { this.facilityCurrency = facilityCurrency; }

    public boolean isCurrencyMatched() { return currencyMatched; }
    public void setCurrencyMatched(boolean currencyMatched) { this.currencyMatched = currencyMatched; }

    public String getLegalOwnerName() { return legalOwnerName; }
    public void setLegalOwnerName(String legalOwnerName) { this.legalOwnerName = legalOwnerName; }

    public String getLegalOwnerCustomerId() { return legalOwnerCustomerId; }
    public void setLegalOwnerCustomerId(String legalOwnerCustomerId) { this.legalOwnerCustomerId = legalOwnerCustomerId; }

    public String getLegalOwnerCif() { return legalOwnerCif; }
    public void setLegalOwnerCif(String legalOwnerCif) { this.legalOwnerCif = legalOwnerCif; }

    public String getOwnerType() { return ownerType; }
    public void setOwnerType(String ownerType) { this.ownerType = ownerType; }

    public double getOwnershipPercentage() { return ownershipPercentage; }
    public void setOwnershipPercentage(double ownershipPercentage) { this.ownershipPercentage = ownershipPercentage; }

    public String getOwnerVerificationStatus() { return ownerVerificationStatus; }
    public void setOwnerVerificationStatus(String ownerVerificationStatus) { this.ownerVerificationStatus = ownerVerificationStatus; }

    public String getRelationshipToBorrower() { return relationshipToBorrower; }
    public void setRelationshipToBorrower(String relationshipToBorrower) { this.relationshipToBorrower = relationshipToBorrower; }

    public String getBorrowerName() { return borrowerName; }
    public void setBorrowerName(String borrowerName) { this.borrowerName = borrowerName; }

    public String getBorrowerCustomerId() { return borrowerCustomerId; }
    public void setBorrowerCustomerId(String borrowerCustomerId) { this.borrowerCustomerId = borrowerCustomerId; }

    public String getBorrowerCif() { return borrowerCif; }
    public void setBorrowerCif(String borrowerCif) { this.borrowerCif = borrowerCif; }

    public boolean isOwnerBorrowerMatch() { return ownerBorrowerMatch; }
    public void setOwnerBorrowerMatch(boolean ownerBorrowerMatch) { this.ownerBorrowerMatch = ownerBorrowerMatch; }

    public boolean isThirdParty() { return thirdParty; }
    public void setThirdParty(boolean thirdParty) { this.thirdParty = thirdParty; }

    public String getConsentStatus() { return consentStatus; }
    public void setConsentStatus(String consentStatus) { this.consentStatus = consentStatus; }

    public String getPledgeAgreementRef() { return pledgeAgreementRef; }
    public void setPledgeAgreementRef(String pledgeAgreementRef) { this.pledgeAgreementRef = pledgeAgreementRef; }

    public boolean isHasRequiredPledgeEvidence() { return hasRequiredPledgeEvidence; }
    public void setHasRequiredPledgeEvidence(boolean hasRequiredPledgeEvidence) { this.hasRequiredPledgeEvidence = hasRequiredPledgeEvidence; }

    public String getOverallDecision() { return overallDecision; }
    public void setOverallDecision(String overallDecision) { this.overallDecision = overallDecision; }

    public List<String> getWarningMessages() { return warningMessages; }
    public void setWarningMessages(List<String> warningMessages) { this.warningMessages = warningMessages; }

    public List<String> getBlockingMessages() { return blockingMessages; }
    public void setBlockingMessages(List<String> blockingMessages) { this.blockingMessages = blockingMessages; }

    public void addCheck(ValidationCheckItemDto check) {
        if (this.checks == null) this.checks = new ArrayList<>();
        this.checks.add(check);
        if (!check.isPassed()) {
            this.valid = false;
            if (!check.isOverrideable()) {
                this.canProceed = false;
                if (this.blockingMessages == null) this.blockingMessages = new ArrayList<>();
                this.blockingMessages.add(check.getMessage());
                this.overallDecision = "BLOCKED";
            } else {
                if (this.warningMessages == null) this.warningMessages = new ArrayList<>();
                this.warningMessages.add(check.getMessage());
                if (!"BLOCKED".equalsIgnoreCase(this.overallDecision)) {
                    this.overallDecision = "REQUIRES_CORRECTION";
                }
            }
        }
    }
}
