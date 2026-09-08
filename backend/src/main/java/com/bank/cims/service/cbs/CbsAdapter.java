package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import java.util.List;

public interface CbsAdapter {
    List<CbsCustomer> fetchCustomers();
    CbsCustomer fetchCustomerByCif(String cif);
    List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif);
    List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif);
    List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber);
    
    CbsCustomer saveCustomer(CbsCustomer customer);
    CbsFacility saveFacility(CbsFacility facility);
    CbsCollateral saveCollateral(CbsCollateral collateral);
    CbsAccCollLinkDtls saveLink(CbsAccCollLinkDtls link);
    
    boolean syncCustomerToCims(String customerCif, String userId);
    boolean syncFacilityToCims(String lineCodeOrLoanRef, String userId);
    boolean syncCollateralToCims(String collateralCode, String userId);
}
