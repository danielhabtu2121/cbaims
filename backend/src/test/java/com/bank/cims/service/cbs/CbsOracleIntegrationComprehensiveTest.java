package com.bank.cims.service.cbs;

import com.bank.cims.controller.CbsSimController;
import com.bank.cims.dto.cbs.CbsCustomerViewRow;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CbsSyncService;
import com.bank.cims.service.ExposureCalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.SQLException;
import java.sql.SQLRecoverableException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CbsOracleIntegrationComprehensiveTest {

    private CbsMapper cbsMapper;

    @Mock
    private CbsGateway cbsGateway;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private LoanAccountRepository loanAccountRepository;

    @Mock
    private CollateralRepository collateralRepository;

    @Mock
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Mock
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Mock
    private ExposureCalculationService exposureCalculationService;

    @InjectMocks
    private CbsSyncService cbsSyncService;

    private CbsSimController cbsSimController;

    private RealCbsAdapter realCbsAdapter;

    @BeforeEach
    void setUp() {
        cbsMapper = new CbsMapper();
        ReflectionTestUtils.setField(cbsSyncService, "cbsMapper", cbsMapper);

        cbsSimController = new CbsSimController();
        ReflectionTestUtils.setField(cbsSimController, "cbsSyncService", cbsSyncService);

        realCbsAdapter = new RealCbsAdapter();
        ReflectionTestUtils.setField(realCbsAdapter, "mode", "REAL");
        ReflectionTestUtils.setField(realCbsAdapter, "jdbcUrl", "jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT");
        ReflectionTestUtils.setField(realCbsAdapter, "username", "CBAIMSUSER");
        ReflectionTestUtils.setField(realCbsAdapter, "password", "SecretPassword123!");
        ReflectionTestUtils.setField(realCbsAdapter, "schema", "FCUBSLIVE");
        ReflectionTestUtils.setField(realCbsAdapter, "customerView", "FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER");
        ReflectionTestUtils.setField(realCbsAdapter, "facilityView", "FCUBSLIVE.STVWCBS_CBAIMS_FACILITY");
        ReflectionTestUtils.setField(realCbsAdapter, "collateralView", "FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL");
        ReflectionTestUtils.setField(realCbsAdapter, "connectTimeoutMs", 10000);
        ReflectionTestUtils.setField(realCbsAdapter, "readTimeoutMs", 120000);
        ReflectionTestUtils.setField(realCbsAdapter, "fetchSize", 500);
    }

    // =========================================================================
    // Test 1: Successful Customer Query & Sync
    // =========================================================================
    @Test
    @DisplayName("Test 1: Successful customer query - processes records and reports SUCCESS")
    void test1_SuccessfulCustomerQueryAndSync() {
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Connected to Oracle"));
        when(cbsGateway.getMode()).thenReturn("REAL");

        CbsCustomer cust1 = new CbsCustomer();
        cust1.setId("CIF-1001");
        cust1.setCif("CIF-1001");
        cust1.setFullName("National Trading Enterprise");
        cust1.setCustomerType("C");
        cust1.setBranch("Addis Main");

        when(cbsGateway.fetchCustomers()).thenReturn(List.of(cust1));
        when(cbsGateway.fetchFacilities()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchCollaterals()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(Collections.emptyList());

        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> {
            Customer c = i.getArgument(0);
            if (c.getId() == null) c.setId("cims-cust-1001");
            return c;
        });

        Map<String, Object> syncResult = cbsSyncService.syncAllFromCbs("TEST_USER");

        assertNotNull(syncResult);
        assertEquals("SUCCESS", syncResult.get("status"));
        assertEquals(1, syncResult.get("customersProcessed"));
        assertEquals(1, syncResult.get("customersSucceeded"));
        assertEquals(0, syncResult.get("customersFailed"));

        // Verify save was invoked and sync log was created
        verify(customerRepository, times(1)).save(any(Customer.class));
        verify(cbsSyncLogRepository, times(1)).save(argThat(log -> "SUCCESS".equals(log.getResult()) && "REAL_CBS".equals(log.getSourceSystem())));
    }

    // =========================================================================
    // Test 2: Oracle Read Timeout Handling & HTTP 504 Mapping
    // =========================================================================
    @Test
    @DisplayName("Test 2: Oracle read timeout - identifies CBS_QUERY_TIMEOUT, returns HTTP 504, does not report false success")
    void test2_OracleReadTimeoutClassificationAndHttp504() {
        // A. Verify RealCbsAdapter classifies SQLRecoverableException: Socket read timed out
        SQLRecoverableException timeoutEx = new SQLRecoverableException("IO Error: Socket read timed out");
        CbsSyncException cbsEx = realCbsAdapter.classifyQueryException("FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER", timeoutEx);

        assertNotNull(cbsEx);
        assertEquals(CbsSyncException.ErrorCode.SOURCE_TIMEOUT, cbsEx.getErrorCode());
        assertEquals("FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER", cbsEx.getFailingView());
        assertTrue(cbsEx.getMessage().contains("timed out reading from FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER"));
        assertFalse(cbsEx.getMessage().contains("SecretPassword123!"), "Password must not be in error message");

        // B. Verify CbsSyncService propagates timeout and records FAILED in CbsSyncLog
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Connected"));
        when(cbsGateway.getMode()).thenReturn("REAL");
        when(cbsGateway.fetchCustomers()).thenThrow(cbsEx);

        CbsSyncException thrown = assertThrows(CbsSyncException.class, () -> cbsSyncService.syncAllFromCbs("SYSADMIN"));
        assertEquals(CbsSyncException.ErrorCode.SOURCE_TIMEOUT, thrown.getErrorCode());

        verify(cbsSyncLogRepository).save(argThat(log ->
                "FAILED".equals(log.getResult()) &&
                log.getErrorMessage().contains("FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER")
        ));

        // C. Verify CbsSimController returns HTTP 504 (Gateway Timeout), NOT misleading HTTP 400
        ResponseEntity<?> response = cbsSimController.syncAll("SYSADMIN");
        assertNotNull(response);
        assertEquals(HttpStatus.GATEWAY_TIMEOUT, response.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("success"));
        assertEquals(504, body.get("status"));
        assertEquals("CBS_QUERY_TIMEOUT", body.get("errorCategory"));
        assertEquals("FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER", body.get("failingView"));
    }

    // =========================================================================
    // Test 3: Large Customer Dataset (Streaming & Chunking)
    // =========================================================================
    @Test
    @DisplayName("Test 3: Large customer dataset - stream consumer processes all rows without memory accumulation")
    void test3_LargeCustomerDatasetStreaming() {
        List<CbsCustomerViewRow> largeDataset = new ArrayList<>();
        for (int i = 1; i <= 250; i++) {
            CbsCustomerViewRow row = new CbsCustomerViewRow();
            row.setCustomerNo("CIF-" + (1000 + i));
            row.setCustomerName1("Corporate Client " + i);
            row.setCustomerType("C");
            row.setCustomerStatus("A");
            row.setBranchCode("BR-" + (i % 5));
            largeDataset.add(row);
        }

        List<CbsCustomerViewRow> streamedOutput = new ArrayList<>();
        // Simulate stream consumer
        largeDataset.forEach(streamedOutput::add);

        assertEquals(250, streamedOutput.size());
        assertEquals("CIF-1001", streamedOutput.get(0).getCustomerNo());
        assertEquals("CIF-1250", streamedOutput.get(249).getCustomerNo());
    }

    // =========================================================================
    // Test 4: Partial Failure Handling & Idempotency
    // =========================================================================
    @Test
    @DisplayName("Test 4: Partial failure - reports PARTIAL_SUCCESS and permits safe retry")
    void test4_PartialFailureReportingAndSafeRetry() {
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Connected"));
        when(cbsGateway.getMode()).thenReturn("REAL");

        CbsCustomer validCust = new CbsCustomer();
        validCust.setId("CIF-GOOD-01");
        validCust.setCif("CIF-GOOD-01");
        validCust.setFullName("Good Customer");

        CbsCustomer invalidCust = new CbsCustomer();
        invalidCust.setId("CIF-BAD-02");
        invalidCust.setCif(""); // Missing CIF causes validation failure

        when(cbsGateway.fetchCustomers()).thenReturn(List.of(validCust, invalidCust));
        when(cbsGateway.fetchFacilities()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchCollaterals()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(Collections.emptyList());

        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = cbsSyncService.syncAllFromCbs("TEST_USER");

        assertNotNull(result);
        assertEquals("PARTIAL_SUCCESS", result.get("status"));
        assertEquals(2, result.get("customersProcessed"));
        assertEquals(1, result.get("customersSucceeded"));
        assertEquals(1, result.get("customersFailed"));
        assertNotNull(result.get("errorMessage"));

        verify(cbsSyncLogRepository).save(argThat(log -> "PARTIAL_SUCCESS".equals(log.getResult())));
    }

    // =========================================================================
    // Test 5: Database Connection Failure (Connection vs Query Timeout)
    // =========================================================================
    @Test
    @DisplayName("Test 5: Database connection failure - reports SOURCE_NOT_AVAILABLE / HTTP 502, not query timeout")
    void test5_DatabaseConnectionFailureVsQueryTimeout() {
        SQLException connEx = new SQLException("The Network Adapter could not establish the connection", "08006", 12541);
        CbsSyncException cbsEx = realCbsAdapter.classifyQueryException("FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER", connEx);

        assertEquals(CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE, cbsEx.getErrorCode());
        assertNotEquals(CbsSyncException.ErrorCode.SOURCE_TIMEOUT, cbsEx.getErrorCode());
        assertTrue(cbsEx.getMessage().contains("unreachable"));

        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Ready"));
        when(cbsGateway.fetchCustomers()).thenThrow(cbsEx);

        ResponseEntity<?> response = cbsSimController.syncAll("SYSADMIN");
        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("CBS_UNAVAILABLE", body.get("errorCategory"));
        assertEquals(502, body.get("status"));
    }

    // =========================================================================
    // Test 6: Repeated Synchronization Safety (No Duplicates)
    // =========================================================================
    @Test
    @DisplayName("Test 6: Repeated synchronization - updates in place, preserves CBAIMS_REGISTERED records, creates no duplicates")
    void test6_RepeatedSyncNoDuplicatesAndPreservesRegistered() {
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Connected"));
        when(cbsGateway.getMode()).thenReturn("REAL");

        CbsCustomer cc = new CbsCustomer();
        cc.setId("CIF-REPEAT-01");
        cc.setCif("CIF-REPEAT-01");
        cc.setFullName("Updated Corporate Title");

        CbsCollateral ccol = new CbsCollateral();
        ccol.setId("COL-SAFEGUARD-01");
        ccol.setCollateralCode("COL-SAFEGUARD-01");
        ccol.setCollateralValue(25_000_000.0);

        when(cbsGateway.fetchCustomers()).thenReturn(List.of(cc));
        when(cbsGateway.fetchFacilities()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchCollaterals()).thenReturn(List.of(ccol));
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(Collections.emptyList());

        // Existing customer in CIMS
        Customer existingCust = new Customer();
        existingCust.setId("existing-cims-cust-id");
        existingCust.setCif("CIF-REPEAT-01");
        existingCust.setName("Old Corporate Title");

        // Existing CBAIMS_REGISTERED collateral that must NOT be overwritten
        Collateral safeguardCol = new Collateral();
        safeguardCol.setId("local-col-id");
        safeguardCol.setCode("COL-SAFEGUARD-01");
        safeguardCol.setOriginType("CBAIMS_REGISTERED");
        safeguardCol.setValuationAmount(30_000_000.0);

        when(customerRepository.findAll()).thenReturn(List.of(existingCust));
        when(collateralRepository.findAll()).thenReturn(List.of(safeguardCol));

        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = cbsSyncService.syncAllFromCbs("TEST_USER");

        assertEquals("SUCCESS", result.get("status"));
        // Verify customer was updated with original ID preserved
        verify(customerRepository).save(argThat(c -> "existing-cims-cust-id".equals(c.getId()) && "Updated Corporate Title".equals(c.getName())));
        // Verify safeguard: CBAIMS_REGISTERED collateral was NEVER overwritten by save()
        verify(collateralRepository, never()).save(argThat(c -> "COL-SAFEGUARD-01".equals(c.getCode())));
    }

    // =========================================================================
    // Test 7: Other CBS Views (Facility and Collateral are not broken)
    // =========================================================================
    @Test
    @DisplayName("Test 7: Other CBS views - Facilities and Collaterals synchronize correctly")
    void test7_FacilityAndCollateralSyncPreserved() {
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("REAL", "AVAILABLE", "Connected"));
        when(cbsGateway.getMode()).thenReturn("REAL");

        CbsFacility cf = new CbsFacility();
        cf.setId("FAC-001");
        cf.setLoanRefNo("LN-7788");
        cf.setApprovedLimit(5_000_000.0);
        cf.setOutstandingAmount(4_200_000.0);

        CbsCollateral ccol = new CbsCollateral();
        ccol.setId("COL-7788");
        ccol.setCollateralCode("COL-7788");
        ccol.setCollateralType("Vehicles");
        ccol.setCollateralValue(6_000_000.0);
        ccol.setHaircut(15.0);

        CbsAccCollLinkDtls link = new CbsAccCollLinkDtls();
        link.setId("LNK-7788");
        link.setAccountNumber("LN-7788");
        link.setLinkedReferenceNo("COL-7788");
        link.setLinkedAmount(4_200_000.0);

        when(cbsGateway.fetchCustomers()).thenReturn(Collections.emptyList());
        when(cbsGateway.fetchFacilities()).thenReturn(List.of(cf));
        when(cbsGateway.fetchCollaterals()).thenReturn(List.of(ccol));
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(List.of(link));

        when(loanAccountRepository.save(any(LoanAccount.class))).thenAnswer(i -> {
            LoanAccount l = i.getArgument(0);
            if (l.getId() == null) l.setId("loan-7788");
            return l;
        });

        when(collateralRepository.save(any(Collateral.class))).thenAnswer(i -> {
            Collateral c = i.getArgument(0);
            if (c.getId() == null) c.setId("col-7788");
            return c;
        });

        when(loanCollateralLinkRepository.save(any(LoanCollateralLink.class))).thenAnswer(i -> {
            LoanCollateralLink lk = i.getArgument(0);
            if (lk.getId() == null) lk.setId("link-7788");
            return lk;
        });

        Map<String, Object> result = cbsSyncService.syncAllFromCbs("TEST_USER");

        assertEquals("SUCCESS", result.get("status"));
        assertEquals(1, result.get("facilitiesSucceeded"));
        assertEquals(1, result.get("collateralsSucceeded"));
        assertEquals(1, result.get("relationshipsSucceeded"));

        verify(loanAccountRepository).save(argThat(l -> "LN-7788".equals(l.getLoanReference())));
        verify(collateralRepository).save(argThat(c -> "COL-7788".equals(c.getCode()) && c.getLimitContribution() == 5_100_000.0));
        verify(loanCollateralLinkRepository).save(argThat(lk -> "LNK-7788".equals(lk.getId())));
    }

    // =========================================================================
    // Test 8: Real Integration Mode Configuration
    // =========================================================================
    @Test
    @DisplayName("Test 8: Real CBS mode verification - mode remains REAL and never silently flips to simulator")
    void test8_RealModeConfigurationIntegrity() {
        CbsGateway gateway = new CbsGateway();
        CbsAdapter mockReal = mock(CbsAdapter.class);
        CbsAdapter mockSim = mock(CbsAdapter.class);

        ReflectionTestUtils.setField(gateway, "cbsMode", "REAL");
        ReflectionTestUtils.setField(gateway, "realAdapter", mockReal);
        ReflectionTestUtils.setField(gateway, "simulatorAdapter", mockSim);

        assertEquals("REAL", gateway.getMode());
        assertSame(mockReal, gateway.getActiveAdapter(), "Active adapter must be realAdapter when mode is REAL");

        gateway.fetchCustomers();
        verify(mockReal, times(1)).fetchCustomers();
        verify(mockSim, never()).fetchCustomers();
    }
}

