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

    default List<CbsCustomer> fetchCustomersByCifs(java.util.Collection<String> cifs) {
        if (cifs == null || cifs.isEmpty()) return java.util.Collections.emptyList();
        java.util.Set<String> set = new java.util.HashSet<>(cifs);
        return fetchCustomers().stream()
                .filter(c -> c.getCif() != null && set.contains(c.getCif().trim().toUpperCase()))
                .toList();
    }

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

    // Production Oracle 3-View operations
    List<com.bank.cims.dto.cbs.CbsCustomerViewRow> fetchCustomerViewRows();

    default List<com.bank.cims.dto.cbs.CbsCustomerViewRow> fetchCustomerViewRowsByCifs(java.util.Collection<String> cifs) {
        if (cifs == null || cifs.isEmpty()) return java.util.Collections.emptyList();
        java.util.Set<String> set = new java.util.HashSet<>(cifs);
        return fetchCustomerViewRows().stream()
                .filter(r -> r.getCustomerNo() != null && set.contains(r.getCustomerNo().trim().toUpperCase()))
                .toList();
    }

    List<com.bank.cims.dto.cbs.CbsFacilityViewRow> fetchFacilityViewRows();

    List<com.bank.cims.dto.cbs.CbsCollateralViewRow> fetchCollateralViewRows();

    default void streamCustomerViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsCustomerViewRow> consumer, int maxRows) {
        List<com.bank.cims.dto.cbs.CbsCustomerViewRow> rows = fetchCustomerViewRows();
        if (maxRows > 0 && rows.size() > maxRows) {
            rows = rows.subList(0, maxRows);
        }
        rows.forEach(consumer);
    }

    default void streamFacilityViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsFacilityViewRow> consumer, int maxRows) {
        List<com.bank.cims.dto.cbs.CbsFacilityViewRow> rows = fetchFacilityViewRows();
        if (maxRows > 0 && rows.size() > maxRows) {
            rows = rows.subList(0, maxRows);
        }
        rows.forEach(consumer);
    }

    default void streamCollateralViewRows(java.util.function.Consumer<com.bank.cims.dto.cbs.CbsCollateralViewRow> consumer, int maxRows) {
        List<com.bank.cims.dto.cbs.CbsCollateralViewRow> rows = fetchCollateralViewRows();
        if (maxRows > 0 && rows.size() > maxRows) {
            rows = rows.subList(0, maxRows);
        }
        rows.forEach(consumer);
    }

    java.util.Map<String, Object> validateSchema();

    CbsConnectionStatus checkConnectionStatus();
}
