package com.bank.cims.dto;

public class CollateralFacilityLinkDto {
    // Relationship Identity
    private String id;
    private String collateralId;
    private String collateralCode;
    private String collateralDescription;
    private String collateralCategory;
    private String collateralType;
    private String collateralOwnerType;
    private double collateralValuation;
    private double collateralHaircut;
    private double netCollateralValue;
    private double collateralUnallocatedSecurity;

    // Facility & Loan Identity (Strictly Distinguished)
    private String facilityId;
    private String loanAccountId;
    private String loanReference;
    private String accountNumber;
    private String cbsFacilityRef;
    private String cbsLoanAccount;
    private String cbsCollateralRef;
    private String source;
    private String sourceRecordId;

    // Customer Identity & Isolation (Borrower)
    private String customerId;
    private String customerCif;
    private String customerName;
    private String borrowerCustomerId;
    private String borrowerCif;
    private String borrowerName;

    // Legal Ownership Context (Collateral Owner)
    private String collateralOwnerCustomerId;
    private String collateralOwnerCif;
    private String legalOwnerNames;
    private boolean thirdParty;
    private String relationshipToBorrower;
    private double ownershipPercentage = 100.0;
    private String ownershipVerificationStatus;
    private String pledgeAgreementRef;
    private String consentInfo;

    // Facility Master Snapshot Details
    private String facilityType;
    private String facilityCurrency;
    private double approvedLimit;
    private double outstandingBalance;
    private double availableAmount;
    private String businessSegment;
    private String branch;
    private String relationshipManager;
    private String facilityStatus;

    // Collateral Allocation & Relationship Values
    private double allocatedAmount;
    private double linkedAmount;
    private double collateralAllocationPct; // % of Collateral Allocated
    private double facilityCoveragePct;    // % of Facility Covered by Allocation
    private double utilAmount;
    private double utilizationPct;
    private String linkageType; // Primary, Secondary, Cross-Collateral
    private int utilOrder = 1;
    private int reinstateOrder = 1;
    private String effectiveDate;
    private String endDate;
    private String relationshipStatus; // Active, Inactive, Ended, Historical
    private String releaseStatus;      // Eligible, Blocked, Released

    // Insurance Context for Linked Collateral
    private double activeInsuranceAmount;
    private double requiredInsuranceAmount;
    private double insuranceGap;
    private String insuranceStatus; // ADEQUATE, UNDERINSURED, EXPIRED, NOT REQUIRED
    private int linkedPolicyCount;

    // Governance & Audit
    private String makerId;
    private String makerDtStamp;
    private String checkerId;
    private String checkerDtStamp;
    private String recordStat;
    private String authStat;
    private int modNo = 1;
    private String changeReason;

    public CollateralFacilityLinkDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getCollateralCode() { return collateralCode; }
    public void setCollateralCode(String collateralCode) { this.collateralCode = collateralCode; }

    public String getCollateralDescription() { return collateralDescription; }
    public void setCollateralDescription(String collateralDescription) { this.collateralDescription = collateralDescription; }

    public String getCollateralCategory() { return collateralCategory; }
    public void setCollateralCategory(String collateralCategory) { this.collateralCategory = collateralCategory; }

    public String getCollateralType() { return collateralType; }
    public void setCollateralType(String collateralType) { this.collateralType = collateralType; }

    public String getCollateralOwnerType() { return collateralOwnerType; }
    public void setCollateralOwnerType(String collateralOwnerType) { this.collateralOwnerType = collateralOwnerType; }

    public double getCollateralValuation() { return collateralValuation; }
    public void setCollateralValuation(double collateralValuation) { this.collateralValuation = collateralValuation; }

    public double getCollateralHaircut() { return collateralHaircut; }
    public void setCollateralHaircut(double collateralHaircut) { this.collateralHaircut = collateralHaircut; }

    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }

    public double getCollateralUnallocatedSecurity() { return collateralUnallocatedSecurity; }
    public void setCollateralUnallocatedSecurity(double collateralUnallocatedSecurity) { this.collateralUnallocatedSecurity = collateralUnallocatedSecurity; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getLoanAccountId() { return loanAccountId; }
    public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }

    public String getLoanReference() { return loanReference; }
    public void setLoanReference(String loanReference) { this.loanReference = loanReference; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getCbsFacilityRef() { return cbsFacilityRef; }
    public void setCbsFacilityRef(String cbsFacilityRef) { this.cbsFacilityRef = cbsFacilityRef; }

    public String getCbsLoanAccount() { return cbsLoanAccount; }
    public void setCbsLoanAccount(String cbsLoanAccount) { this.cbsLoanAccount = cbsLoanAccount; }

    public String getCbsCollateralRef() { return cbsCollateralRef; }
    public void setCbsCollateralRef(String cbsCollateralRef) { this.cbsCollateralRef = cbsCollateralRef; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getSourceRecordId() { return sourceRecordId; }
    public void setSourceRecordId(String sourceRecordId) { this.sourceRecordId = sourceRecordId; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getFacilityType() { return facilityType; }
    public void setFacilityType(String facilityType) { this.facilityType = facilityType; }

    public String getFacilityCurrency() { return facilityCurrency; }
    public void setFacilityCurrency(String facilityCurrency) { this.facilityCurrency = facilityCurrency; }

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

    public String getRelationshipManager() { return relationshipManager; }
    public void setRelationshipManager(String relationshipManager) { this.relationshipManager = relationshipManager; }

    public String getFacilityStatus() { return facilityStatus; }
    public void setFacilityStatus(String facilityStatus) { this.facilityStatus = facilityStatus; }

    public double getAllocatedAmount() { return allocatedAmount; }
    public void setAllocatedAmount(double allocatedAmount) { this.allocatedAmount = allocatedAmount; }

    public double getLinkedAmount() { return linkedAmount; }
    public void setLinkedAmount(double linkedAmount) { this.linkedAmount = linkedAmount; }

    public double getCollateralAllocationPct() { return collateralAllocationPct; }
    public void setCollateralAllocationPct(double collateralAllocationPct) { this.collateralAllocationPct = collateralAllocationPct; }

    public double getFacilityCoveragePct() { return facilityCoveragePct; }
    public void setFacilityCoveragePct(double facilityCoveragePct) { this.facilityCoveragePct = facilityCoveragePct; }

    public double getUtilAmount() { return utilAmount; }
    public void setUtilAmount(double utilAmount) { this.utilAmount = utilAmount; }

    public double getUtilizationPct() { return utilizationPct; }
    public void setUtilizationPct(double utilizationPct) { this.utilizationPct = utilizationPct; }

    public String getLinkageType() { return linkageType; }
    public void setLinkageType(String linkageType) { this.linkageType = linkageType; }

    public int getUtilOrder() { return utilOrder; }
    public void setUtilOrder(int utilOrder) { this.utilOrder = utilOrder; }

    public int getReinstateOrder() { return reinstateOrder; }
    public void setReinstateOrder(int reinstateOrder) { this.reinstateOrder = reinstateOrder; }

    public String getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }

    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }

    public String getRelationshipStatus() { return relationshipStatus; }
    public void setRelationshipStatus(String relationshipStatus) { this.relationshipStatus = relationshipStatus; }

    public String getReleaseStatus() { return releaseStatus; }
    public void setReleaseStatus(String releaseStatus) { this.releaseStatus = releaseStatus; }

    public double getActiveInsuranceAmount() { return activeInsuranceAmount; }
    public void setActiveInsuranceAmount(double activeInsuranceAmount) { this.activeInsuranceAmount = activeInsuranceAmount; }

    public double getRequiredInsuranceAmount() { return requiredInsuranceAmount; }
    public void setRequiredInsuranceAmount(double requiredInsuranceAmount) { this.requiredInsuranceAmount = requiredInsuranceAmount; }

    public double getInsuranceGap() { return insuranceGap; }
    public void setInsuranceGap(double insuranceGap) { this.insuranceGap = insuranceGap; }

    public String getInsuranceStatus() { return insuranceStatus; }
    public void setInsuranceStatus(String insuranceStatus) { this.insuranceStatus = insuranceStatus; }

    public int getLinkedPolicyCount() { return linkedPolicyCount; }
    public void setLinkedPolicyCount(int linkedPolicyCount) { this.linkedPolicyCount = linkedPolicyCount; }

    public String getMakerId() { return makerId; }
    public void setMakerId(String makerId) { this.makerId = makerId; }

    public String getMakerDtStamp() { return makerDtStamp; }
    public void setMakerDtStamp(String makerDtStamp) { this.makerDtStamp = makerDtStamp; }

    public String getCheckerId() { return checkerId; }
    public void setCheckerId(String checkerId) { this.checkerId = checkerId; }

    public String getCheckerDtStamp() { return checkerDtStamp; }
    public void setCheckerDtStamp(String checkerDtStamp) { this.checkerDtStamp = checkerDtStamp; }

    public String getRecordStat() { return recordStat; }
    public void setRecordStat(String recordStat) { this.recordStat = recordStat; }

    public String getAuthStat() { return authStat; }
    public void setAuthStat(String authStat) { this.authStat = authStat; }

    public int getModNo() { return modNo; }
    public void setModNo(int modNo) { this.modNo = modNo; }

    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }

    public String getBorrowerCustomerId() { return borrowerCustomerId != null ? borrowerCustomerId : customerId; }
    public void setBorrowerCustomerId(String borrowerCustomerId) { this.borrowerCustomerId = borrowerCustomerId; }

    public String getBorrowerCif() { return borrowerCif != null ? borrowerCif : customerCif; }
    public void setBorrowerCif(String borrowerCif) { this.borrowerCif = borrowerCif; }

    public String getBorrowerName() { return borrowerName != null ? borrowerName : customerName; }
    public void setBorrowerName(String borrowerName) { this.borrowerName = borrowerName; }

    public String getCollateralOwnerCustomerId() { return collateralOwnerCustomerId; }
    public void setCollateralOwnerCustomerId(String collateralOwnerCustomerId) { this.collateralOwnerCustomerId = collateralOwnerCustomerId; }

    public String getCollateralOwnerCif() { return collateralOwnerCif; }
    public void setCollateralOwnerCif(String collateralOwnerCif) { this.collateralOwnerCif = collateralOwnerCif; }

    public String getLegalOwnerNames() { return legalOwnerNames; }
    public void setLegalOwnerNames(String legalOwnerNames) { this.legalOwnerNames = legalOwnerNames; }

    public boolean isThirdParty() { return thirdParty; }
    public void setThirdParty(boolean thirdParty) { this.thirdParty = thirdParty; }

    public String getRelationshipToBorrower() { return relationshipToBorrower; }
    public void setRelationshipToBorrower(String relationshipToBorrower) { this.relationshipToBorrower = relationshipToBorrower; }

    public double getOwnershipPercentage() { return ownershipPercentage; }
    public void setOwnershipPercentage(double ownershipPercentage) { this.ownershipPercentage = ownershipPercentage; }

    public String getOwnershipVerificationStatus() { return ownershipVerificationStatus; }
    public void setOwnershipVerificationStatus(String ownershipVerificationStatus) { this.ownershipVerificationStatus = ownershipVerificationStatus; }

    public String getPledgeAgreementRef() { return pledgeAgreementRef; }
    public void setPledgeAgreementRef(String pledgeAgreementRef) { this.pledgeAgreementRef = pledgeAgreementRef; }

    public String getConsentInfo() { return consentInfo; }
    public void setConsentInfo(String consentInfo) { this.consentInfo = consentInfo; }
}
