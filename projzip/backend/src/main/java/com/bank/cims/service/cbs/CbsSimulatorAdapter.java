package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

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
    public Optional<CbsCustomer> fetchCustomerByCif(String cif) {
        if (cif == null || cif.isBlank()) return Optional.empty();
        return cbsCustomerRepository.findByCifIgnoreCase(cif.trim())
                .or(() -> cbsCustomerRepository.findByCif(cif.trim()))
                .or(() -> cbsCustomerRepository.findById(cif.trim()));
    }

    @Override
    public List<CbsFacility> fetchFacilities() {
        return cbsFacilityRepository.findAll();
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        if (customerCif == null || customerCif.isBlank()) return List.of();
        return cbsFacilityRepository.findByCustomerCif(customerCif.trim());
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference) {
        if (loanReference == null || loanReference.isBlank()) return Optional.empty();
        return cbsFacilityRepository.findByLoanRefNo(loanReference.trim())
                .or(() -> cbsFacilityRepository.findByLineCode(loanReference.trim()))
                .or(() -> cbsFacilityRepository.findById(loanReference.trim()));
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLineCode(String lineCode) {
        if (lineCode == null || lineCode.isBlank()) return Optional.empty();
        return cbsFacilityRepository.findByLineCode(lineCode.trim())
                .or(() -> cbsFacilityRepository.findByLoanRefNo(lineCode.trim()))
                .or(() -> cbsFacilityRepository.findById(lineCode.trim()));
    }

    @Override
    public List<CbsCollateral> fetchCollaterals() {
        return cbsCollateralRepository.findAll();
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        if (customerCif == null || customerCif.isBlank()) return List.of();
        return cbsCollateralRepository.findByCustomerCif(customerCif.trim());
    }

    @Override
    public Optional<CbsCollateral> fetchCollateralByCode(String collateralCode) {
        if (collateralCode == null || collateralCode.isBlank()) return Optional.empty();
        return cbsCollateralRepository.findByCollateralCode(collateralCode.trim())
                .or(() -> cbsCollateralRepository.findById(collateralCode.trim()));
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) return List.of();
        return cbsAccCollLinkDtlsRepository.findByAccountNumber(accountNumber.trim());
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks() {
        return cbsAccCollLinkDtlsRepository.findAll();
    }

    @Override
    public CbsConnectionStatus checkConnectionStatus() {
        return new CbsConnectionStatus("SIMULATOR", "AVAILABLE", "CBS Simulator is active and connected to cbs_sim schema.");
    }
}
