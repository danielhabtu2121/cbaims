package com.bank.cims.dto;

public class RelationshipRequestDto {
    private String id; // Optional, generated if null
    private String collateralId;
    private String loanAccountId; // CIMS Loan Account ID
    private String facilityId;    // CIMS Facility ID
    private double allocatedAmount;
    private String linkageType = "Primary"; // Primary, Secondary, Cross-Collateral
    private int utilOrder = 1;
    private int reinstateOrder = 1;
    private String effectiveDate;
    private String endDate;
    private String changeReason;
    private String source = "CIMS";
    private String sourceRecordId;
    private String borrowerCustomerId;
    private String relationshipToBorrower;
    private String pledgeAgreementRef;
    private String consentInfo;
    private boolean thirdPartyPledge;

    public RelationshipRequestDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCollateralId() { return collateralId; }
    public void setCollateralId(String collateralId) { this.collateralId = collateralId; }

    public String getLoanAccountId() { return loanAccountId; }
    public void setLoanAccountId(String loanAccountId) { this.loanAccountId = loanAccountId; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public double getAllocatedAmount() { return allocatedAmount; }
    public void setAllocatedAmount(double allocatedAmount) { this.allocatedAmount = allocatedAmount; }

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

    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getSourceRecordId() { return sourceRecordId; }
    public void setSourceRecordId(String sourceRecordId) { this.sourceRecordId = sourceRecordId; }

    public String getBorrowerCustomerId() { return borrowerCustomerId; }
    public void setBorrowerCustomerId(String borrowerCustomerId) { this.borrowerCustomerId = borrowerCustomerId; }

    public String getRelationshipToBorrower() { return relationshipToBorrower; }
    public void setRelationshipToBorrower(String relationshipToBorrower) { this.relationshipToBorrower = relationshipToBorrower; }

    public String getPledgeAgreementRef() { return pledgeAgreementRef; }
    public void setPledgeAgreementRef(String pledgeAgreementRef) { this.pledgeAgreementRef = pledgeAgreementRef; }

    public String getConsentInfo() { return consentInfo; }
    public void setConsentInfo(String consentInfo) { this.consentInfo = consentInfo; }

    public boolean isThirdPartyPledge() { return thirdPartyPledge; }
    public void setThirdPartyPledge(boolean thirdPartyPledge) { this.thirdPartyPledge = thirdPartyPledge; }
}
