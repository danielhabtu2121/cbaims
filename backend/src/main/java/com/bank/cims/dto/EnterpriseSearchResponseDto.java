package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class EnterpriseSearchResponseDto {
    private List<SearchCustomerItemDto> customers = new ArrayList<>();
    private List<SearchFacilityItemDto> facilities = new ArrayList<>();
    private List<SearchCollateralItemDto> collaterals = new ArrayList<>();
    private int totalMatches;

    public EnterpriseSearchResponseDto() {}

    public static class SearchCustomerItemDto {
        private String id;
        private String cif;
        private String name;
        private String customerType;
        private String segment;
        private String branch;
        private String status;
        private double totalExposure;
        private double totalCollateralValue;

        public SearchCustomerItemDto() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getCif() { return cif; }
        public void setCif(String cif) { this.cif = cif; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getCustomerType() { return customerType; }
        public void setCustomerType(String customerType) { this.customerType = customerType; }
        public String getSegment() { return segment; }
        public void setSegment(String segment) { this.segment = segment; }
        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public double getTotalExposure() { return totalExposure; }
        public void setTotalExposure(double totalExposure) { this.totalExposure = totalExposure; }
        public double getTotalCollateralValue() { return totalCollateralValue; }
        public void setTotalCollateralValue(double totalCollateralValue) { this.totalCollateralValue = totalCollateralValue; }
    }

    public static class SearchFacilityItemDto {
        private String id;
        private String loanReference;
        private String accountNumber;
        private String customerId;
        private String customerName;
        private String facilityType;
        private double approvedAmount;
        private double currentBalance;
        private double outstandingBalance;
        private String segment;
        private String branch;
        private String status;

        public SearchFacilityItemDto() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLoanReference() { return loanReference; }
        public void setLoanReference(String loanReference) { this.loanReference = loanReference; }
        public String getAccountNumber() { return accountNumber; }
        public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
        public String getCustomerId() { return customerId; }
        public void setCustomerId(String customerId) { this.customerId = customerId; }
        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }
        public String getFacilityType() { return facilityType; }
        public void setFacilityType(String facilityType) { this.facilityType = facilityType; }
        public double getApprovedAmount() { return approvedAmount; }
        public void setApprovedAmount(double approvedAmount) { this.approvedAmount = approvedAmount; }
        public double getCurrentBalance() { return currentBalance; }
        public void setCurrentBalance(double currentBalance) { this.currentBalance = currentBalance; }
        public double getOutstandingBalance() { return outstandingBalance; }
        public void setOutstandingBalance(double outstandingBalance) { this.outstandingBalance = outstandingBalance; }
        public String getSegment() { return segment; }
        public void setSegment(String segment) { this.segment = segment; }
        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class SearchCollateralItemDto {
        private String id;
        private String code;
        private String description;
        private String category;
        private String type;
        private String customerId;
        private String customerName;
        private double marketValue;
        private double netValue;
        private String owningSegment;
        private String branch;
        private String status;

        public SearchCollateralItemDto() {}

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
        public double getMarketValue() { return marketValue; }
        public void setMarketValue(double marketValue) { this.marketValue = marketValue; }
        public double getNetValue() { return netValue; }
        public void setNetValue(double netValue) { this.netValue = netValue; }
        public String getOwningSegment() { return owningSegment; }
        public void setOwningSegment(String owningSegment) { this.owningSegment = owningSegment; }
        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public List<SearchCustomerItemDto> getCustomers() { return customers; }
    public void setCustomers(List<SearchCustomerItemDto> customers) { this.customers = customers; }

    public List<SearchFacilityItemDto> getFacilities() { return facilities; }
    public void setFacilities(List<SearchFacilityItemDto> facilities) { this.facilities = facilities; }

    public List<SearchCollateralItemDto> getCollaterals() { return collaterals; }
    public void setCollaterals(List<SearchCollateralItemDto> collaterals) { this.collaterals = collaterals; }

    public int getTotalMatches() { return totalMatches; }
    public void setTotalMatches(int totalMatches) { this.totalMatches = totalMatches; }
}
