package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class CollateralCandidateDto {
    private String id;
    private String code;
    private String description;
    private String category;
    private String type;
    private String customerId;
    private String customerName;
    private String customerCif;
    private String ownershipType; // Borrower-owned, Third-party-owned, Jointly-owned
    private String legalOwnerNames;
    private String ownerRelationship; // Shareholder, Parent Company, Director, Guarantor, Spouse, Family Member, Business Partner, Other, Borrower
    private double valuationAmount;
    private double haircut;
    private double netCollateralValue;
    private double currentAllocation;
    private double availableCapacity;
    private double utilizationPct;

    private boolean alreadyLinked;
    private double existingAllocationToThisFacility;
    private boolean satisfiesNormalOwnership;
    private boolean thirdParty;
    private boolean thirdPartyValid;
    private boolean eligible;
    private String ineligibilityReason;

    private List<String> legalOwners = new ArrayList<>();

    public CollateralCandidateDto() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerCif() { return customerCif; }
    public void setCustomerCif(String customerCif) { this.customerCif = customerCif; }

    public String getOwnershipType() { return ownershipType; }
    public void setOwnershipType(String ownershipType) { this.ownershipType = ownershipType; }

    public String getLegalOwnerNames() { return legalOwnerNames; }
    public void setLegalOwnerNames(String legalOwnerNames) { this.legalOwnerNames = legalOwnerNames; }

    public String getOwnerRelationship() { return ownerRelationship; }
    public void setOwnerRelationship(String ownerRelationship) { this.ownerRelationship = ownerRelationship; }

    public double getValuationAmount() { return valuationAmount; }
    public void setValuationAmount(double valuationAmount) { this.valuationAmount = valuationAmount; }

    public double getHaircut() { return haircut; }
    public void setHaircut(double haircut) { this.haircut = haircut; }

    public double getNetCollateralValue() { return netCollateralValue; }
    public void setNetCollateralValue(double netCollateralValue) { this.netCollateralValue = netCollateralValue; }

    public double getCurrentAllocation() { return currentAllocation; }
    public void setCurrentAllocation(double currentAllocation) { this.currentAllocation = currentAllocation; }

    public double getAvailableCapacity() { return availableCapacity; }
    public void setAvailableCapacity(double availableCapacity) { this.availableCapacity = availableCapacity; }

    public double getUtilizationPct() { return utilizationPct; }
    public void setUtilizationPct(double utilizationPct) { this.utilizationPct = utilizationPct; }

    public boolean isAlreadyLinked() { return alreadyLinked; }
    public void setAlreadyLinked(boolean alreadyLinked) { this.alreadyLinked = alreadyLinked; }

    public double getExistingAllocationToThisFacility() { return existingAllocationToThisFacility; }
    public void setExistingAllocationToThisFacility(double existingAllocationToThisFacility) { this.existingAllocationToThisFacility = existingAllocationToThisFacility; }

    public boolean isSatisfiesNormalOwnership() { return satisfiesNormalOwnership; }
    public void setSatisfiesNormalOwnership(boolean satisfiesNormalOwnership) { this.satisfiesNormalOwnership = satisfiesNormalOwnership; }

    public boolean isThirdParty() { return thirdParty; }
    public void setThirdParty(boolean thirdParty) { this.thirdParty = thirdParty; }

    public boolean isThirdPartyValid() { return thirdPartyValid; }
    public void setThirdPartyValid(boolean thirdPartyValid) { this.thirdPartyValid = thirdPartyValid; }

    public boolean isEligible() { return eligible; }
    public void setEligible(boolean eligible) { this.eligible = eligible; }

    public String getIneligibilityReason() { return ineligibilityReason; }
    public void setIneligibilityReason(String ineligibilityReason) { this.ineligibilityReason = ineligibilityReason; }

    public List<String> getLegalOwners() { return legalOwners; }
    public void setLegalOwners(List<String> legalOwners) { this.legalOwners = legalOwners; }
}
