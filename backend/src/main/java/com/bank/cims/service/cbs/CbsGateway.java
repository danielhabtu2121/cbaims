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
        return cbsMode != null ? cbsMode.trim().toUpperCase() : "SIMULATOR";
    }

    public synchronized void setMode(String mode) {
        if (mode != null && (mode.equalsIgnoreCase("REAL") || mode.equalsIgnoreCase("SIMULATOR"))) {
            this.cbsMode = mode.toUpperCase();
        }
    }

    public RealCbsAdapter getRealCbsAdapter() {
        if (realAdapter instanceof RealCbsAdapter rca) {
            return rca;
        }
        return null;
    }

    public CbsAdapter getActiveAdapter() {
        if ("REAL".equalsIgnoreCase(getMode())) {
            return realAdapter;
        }
        return simulatorAdapter;
    }

    public List<CbsCustomer> fetchCustomers() {
        return getActiveAdapter().fetchCustomers();
    }

    public List<CbsCustomer> fetchCustomersByCifs(java.util.Collection<String> cifs) {
        return getActiveAdapter().fetchCustomersByCifs(cifs);
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

    public List<com.bank.cims.dto.cbs.CbsCustomerViewRow> fetchCustomerViewRowsByCifs(java.util.Collection<String> cifs) {
        return getActiveAdapter().fetchCustomerViewRowsByCifs(cifs);
    }

    public List<com.bank.cims.dto.cbs.CbsFacilityViewRow> fetchFacilityViewRows() {
        return getActiveAdapter().fetchFacilityViewRows();
    }

    public List<com.bank.cims.dto.cbs.CbsCollateralViewRow> fetchCollateralViewRows() {
        return getActiveAdapter().fetchCollateralViewRows();
    }

    public void streamCustomerViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsCustomerViewRow> consumer, int maxRows) {
        getActiveAdapter().streamCustomerViewRows(consumer, maxRows);
    }

    public void streamFacilityViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsFacilityViewRow> consumer, int maxRows) {
        getActiveAdapter().streamFacilityViewRows(consumer, maxRows);
    }

    public void streamCollateralViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsCollateralViewRow> consumer, int maxRows) {
        getActiveAdapter().streamCollateralViewRows(consumer, maxRows);
    }

    public java.util.Map<String, Object> validateSchema() {
        return getActiveAdapter().validateSchema();
    }
}
