package com.bank.cims.service.cbs;

import com.bank.cims.model.CbsAccCollLinkDtls;
import com.bank.cims.model.CbsCollateral;
import com.bank.cims.model.CbsCustomer;
import com.bank.cims.model.CbsFacility;

import java.util.List;
import java.util.Optional;

/**
 * Standard CBS Source Adapter Contract.
 * Provides read and inspection operations for CBS master domains:
 * Customer, Facility, Collateral, and Account-Collateral Relationships.
 */
public interface CbsAdapter {

    List<CbsCustomer> fetchCustomers();

    Optional<CbsCustomer> fetchCustomerByCif(String cif);

    List<CbsFacility> fetchFacilities();

    List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif);

    Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference);

    Optional<CbsFacility> fetchFacilityByLineCode(String lineCode);

    List<CbsCollateral> fetchCollaterals();

    List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif);

    Optional<CbsCollateral> fetchCollateralByCode(String collateralCode);

    List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber);

    List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks();

    CbsConnectionStatus checkConnectionStatus();
}
