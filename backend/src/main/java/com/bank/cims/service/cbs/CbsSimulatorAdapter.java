package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("cbsSimulatorAdapter")
public class CbsSimulatorAdapter implements CbsAdapter {

    @Autowired
    private CbsCustomerRepository cbsCustomerRepository;

    @Autowired
    private CbsFacilityRepository cbsFacilityRepository;

    @Autowired
    private CbsCollateralRepository cbsCollateralRepository;

    @Autowired
    private CbsAccCollLinkDtlsRepository cbsAccCollLinkDtlsRepository;

    @Override
    public List<CbsCustomer> fetchCustomers() {
        return cbsCustomerRepository.findAll();
    }

    @Override
    public CbsCustomer fetchCustomerByCif(String cif) {
        return cbsCustomerRepository.findByCif(cif).orElse(null);
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        return cbsFacilityRepository.findByCustomerCif(customerCif);
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        return cbsCollateralRepository.findByCustomerCif(customerCif);
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        return cbsAccCollLinkDtlsRepository.findByAccountNumber(accountNumber);
    }

    @Override
    public CbsCustomer saveCustomer(CbsCustomer customer) {
        return cbsCustomerRepository.save(customer);
    }

    @Override
    public CbsFacility saveFacility(CbsFacility facility) {
        return cbsFacilityRepository.save(facility);
    }

    @Override
    public CbsCollateral saveCollateral(CbsCollateral collateral) {
        return cbsCollateralRepository.save(collateral);
    }

    @Override
    public CbsAccCollLinkDtls saveLink(CbsAccCollLinkDtls link) {
        return cbsAccCollLinkDtlsRepository.save(link);
    }

    @Override
    public boolean syncCustomerToCims(String customerCif, String userId) {
        return true;
    }

    @Override
    public boolean syncFacilityToCims(String lineCodeOrLoanRef, String userId) {
        return true;
    }

    @Override
    public boolean syncCollateralToCims(String collateralCode, String userId) {
        return true;
    }
}
