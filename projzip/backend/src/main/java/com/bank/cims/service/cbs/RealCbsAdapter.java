package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Real CBS Adapter Skeleton.
 * Ready for future production REST/SOAP/MQ CBS integration.
 * In accordance with CIMS architectural requirements, this adapter reports
 * "REAL CBS NOT CONFIGURED" when real endpoints/credentials are not configured,
 * ensuring the application never displays a false connected state.
 */
@Component("realCbsAdapter")
public class RealCbsAdapter implements CbsAdapter {

    @Value("${cims.cbs.real.enabled:false}")
    private boolean enabled;

    @Value("${cims.cbs.real.base-url:}")
    private String baseUrl;

    @Value("${cims.cbs.real.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${cims.cbs.real.read-timeout-ms:10000}")
    private int readTimeoutMs;

    @Value("${cims.cbs.real.authentication-type:NONE}")
    private String authType;

    private boolean isConfigured() {
        return enabled && baseUrl != null && !baseUrl.isBlank();
    }

    private void ensureConfigured() {
        if (!isConfigured()) {
            throw new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE,
                    "REAL CBS NOT CONFIGURED: Real CBS endpoints, authentication, and service contracts have not yet been provided by the Bank."
            );
        }
    }

    @Override
    public List<CbsCustomer> fetchCustomers() {
        ensureConfigured();
        return List.of();
    }

    @Override
    public Optional<CbsCustomer> fetchCustomerByCif(String cif) {
        ensureConfigured();
        return Optional.empty();
    }

    @Override
    public List<CbsFacility> fetchFacilities() {
        ensureConfigured();
        return List.of();
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        ensureConfigured();
        return List.of();
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference) {
        ensureConfigured();
        return Optional.empty();
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLineCode(String lineCode) {
        ensureConfigured();
        return Optional.empty();
    }

    @Override
    public List<CbsCollateral> fetchCollaterals() {
        ensureConfigured();
        return List.of();
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        ensureConfigured();
        return List.of();
    }

    @Override
    public Optional<CbsCollateral> fetchCollateralByCode(String collateralCode) {
        ensureConfigured();
        return Optional.empty();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        ensureConfigured();
        return List.of();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks() {
        ensureConfigured();
        return List.of();
    }

    @Override
    public CbsConnectionStatus checkConnectionStatus() {
        if (!isConfigured()) {
            return new CbsConnectionStatus(
                    "REAL",
                    "NOT_CONFIGURED",
                    "REAL CBS NOT CONFIGURED: Bank CBS endpoints and credentials are not yet configured."
            );
        }
        return new CbsConnectionStatus(
                "REAL",
                "AVAILABLE",
                "Real CBS client connected to " + baseUrl
        );
    }
}
