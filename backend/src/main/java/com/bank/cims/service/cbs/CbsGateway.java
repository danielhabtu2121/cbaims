package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CbsGateway {

    @Autowired
    @Qualifier("cbsSimulatorAdapter")
    private CbsAdapter simulatorAdapter;

    @Autowired
    @Qualifier("realCbsAdapter")
    private CbsAdapter realAdapter;

    @Value("${cims.cbs.mode:SIMULATOR}")
    private String cbsMode;

    private CbsAdapter getActiveAdapter() {
        if ("REAL".equalsIgnoreCase(cbsMode)) {
            return realAdapter;
        }
        return simulatorAdapter;
    }

    public List<CbsCustomer> fetchCustomers() {
        return getActiveAdapter().fetchCustomers();
    }

    public CbsCustomer fetchCustomerByCif(String cif) {
        return getActiveAdapter().fetchCustomerByCif(cif);
    }

    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        return getActiveAdapter().fetchFacilitiesByCustomerCif(customerCif);
    }

    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        return getActiveAdapter().fetchCollateralsByCustomerCif(customerCif);
    }

    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        return getActiveAdapter().fetchAccountCollateralLinks(accountNumber);
    }

    public CbsCustomer saveCustomer(CbsCustomer customer) {
        return getActiveAdapter().saveCustomer(customer);
    }

    public CbsFacility saveFacility(CbsFacility facility) {
        return getActiveAdapter().saveFacility(facility);
    }

    public CbsCollateral saveCollateral(CbsCollateral collateral) {
        return getActiveAdapter().saveCollateral(collateral);
    }

    public CbsAccCollLinkDtls saveLink(CbsAccCollLinkDtls link) {
        return getActiveAdapter().saveLink(link);
    }
}
