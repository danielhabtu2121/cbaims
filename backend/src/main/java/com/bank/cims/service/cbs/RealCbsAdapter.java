package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component("realCbsAdapter")
public class RealCbsAdapter implements CbsAdapter {

    @Override
    public List<CbsCustomer> fetchCustomers() {
        // Plug in production REST/SOAP CBS client here
        return Collections.emptyList();
    }

    @Override
    public CbsCustomer fetchCustomerByCif(String cif) {
        return null;
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        return Collections.emptyList();
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        return Collections.emptyList();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        return Collections.emptyList();
    }

    @Override
    public CbsCustomer saveCustomer(CbsCustomer customer) {
        return customer;
    }

    @Override
    public CbsFacility saveFacility(CbsFacility facility) {
        return facility;
    }

    @Override
    public CbsCollateral saveCollateral(CbsCollateral collateral) {
        return collateral;
    }

    @Override
    public CbsAccCollLinkDtls saveLink(CbsAccCollLinkDtls link) {
        return link;
    }

    @Override
    public boolean syncCustomerToCims(String customerCif, String userId) {
        return false;
    }

    @Override
    public boolean syncFacilityToCims(String lineCodeOrLoanRef, String userId) {
        return false;
    }

    @Override
    public boolean syncCollateralToCims(String collateralCode, String userId) {
        return false;
    }
}
