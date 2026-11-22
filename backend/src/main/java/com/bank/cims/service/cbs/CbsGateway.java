package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CbsGateway {

    @Autowired
    @Qualifier("cbsSimulatorAdapter")
    private CbsAdapter simulatorAdapter;

    @Autowired
    @Qualifier("realCbsAdapter")
    private CbsAdapter realAdapter;

    @Value("${cims.cbs.mode:REAL}")
    private String cbsMode;

    public String getMode() {
        return (cbsMode != null && !cbsMode.isBlank()) ? cbsMode.trim().toUpperCase() : "REAL";
    }

    public CbsAdapter getActiveAdapter() {
        if ("SIMULATOR".equalsIgnoreCase(cbsMode)) {
            return simulatorAdapter;
        }
        return realAdapter;
    }

    public List<CbsCustomer> fetchCustomers() {
        return getActiveAdapter().fetchCustomers();
    }

    public Optional<CbsCustomer> fetchCustomerByCif(String cif) {
        return getActiveAdapter().fetchCustomerByCif(cif);
    }

    public List<CbsFacility> fetchFacilities() {
        return getActiveAdapter().fetchFacilities();
    }

    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        return getActiveAdapter().fetchFacilitiesByCustomerCif(customerCif);
    }

    public Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference) {
        return getActiveAdapter().fetchFacilityByLoanReference(loanReference);
    }

    public Optional<CbsFacility> fetchFacilityByLineCode(String lineCode) {
        return getActiveAdapter().fetchFacilityByLineCode(lineCode);
    }

    public List<CbsCollateral> fetchCollaterals() {
        return getActiveAdapter().fetchCollaterals();
    }

    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        return getActiveAdapter().fetchCollateralsByCustomerCif(customerCif);
    }

    public Optional<CbsCollateral> fetchCollateralByCode(String collateralCode) {
        return getActiveAdapter().fetchCollateralByCode(collateralCode);
    }

    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        return getActiveAdapter().fetchAccountCollateralLinks(accountNumber);
    }

    public List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks() {
        return getActiveAdapter().fetchAllAccountCollateralLinks();
    }

    public CbsConnectionStatus checkConnectionStatus() {
        return getActiveAdapter().checkConnectionStatus();
    }

    public List<com.bank.cims.dto.cbs.CbsCustomerViewRow> fetchCustomerViewRows() {
        return getActiveAdapter().fetchCustomerViewRows();
    }

    public List<com.bank.cims.dto.cbs.CbsFacilityViewRow> fetchFacilityViewRows() {
        return getActiveAdapter().fetchFacilityViewRows();
    }

    public List<com.bank.cims.dto.cbs.CbsCollateralViewRow> fetchCollateralViewRows() {
        return getActiveAdapter().fetchCollateralViewRows();
    }

    public java.util.Map<String, Object> validateSchema() {
        return getActiveAdapter().validateSchema();
    }
}
