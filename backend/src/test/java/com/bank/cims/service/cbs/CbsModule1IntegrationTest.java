package com.bank.cims.service.cbs;

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
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CbsModule1IntegrationTest {

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

    @BeforeEach
    void setUp() {
        cbsMapper = new CbsMapper();
        ReflectionTestUtils.setField(cbsSyncService, "cbsMapper", cbsMapper);
    }

    @Test
    @DisplayName("CbsMapper: Collateral Type vs Ownership Type semantic bug fix & Haircut preservation")
    void testCollateralMappingBugFixAndHaircutPreservation() {
        CbsCollateral cbsCol = new CbsCollateral();
        cbsCol.setId("cbs-col-001");
        cbsCol.setCollateralCode("COL-TEST-001");
        cbsCol.setCustomerCif("CIF-1001");
        cbsCol.setDescription("Commercial Office Building");
        cbsCol.setCategory("Immovable Properties");
        cbsCol.setCollateralType("Building");
        cbsCol.setOwnershipType("Borrower-owned");
        cbsCol.setCollateralValue(15_000_000.0);
        cbsCol.setHaircut(25.0);
        cbsCol.setCurrency("ETB");

        Customer cust = new Customer();
        cust.setId("cst-1001");
        cust.setCif("CIF-1001");

        Collateral mapped = cbsMapper.mapCollateral(cbsCol, null, cust, "CBS_SIM");

        assertNotNull(mapped);
        assertEquals("COL-TEST-001", mapped.getCode());
        assertEquals("cst-1001", mapped.getCustomerId());
        // Bug fix verification: type is Collateral Type, NOT ownerType
        assertEquals("Building", mapped.getType(), "Collateral type must map to type");
        assertEquals("Borrower-owned", mapped.getOwnerType(), "Ownership type must map to ownerType");
        assertNotEquals(mapped.getType(), mapped.getOwnerType());

        // Haircut preservation verification
        assertEquals(25.0, mapped.getHaircut(), "Haircut must be preserved exactly from source");
        assertEquals(11_250_000.0, mapped.getLimitContribution(), "Limit contribution must reflect haircut calculation");
        assertEquals("CBS_SIM", mapped.getSource());
        assertEquals("Synced", mapped.getCbsSyncStatus());
    }

    @Test
    @DisplayName("CbsMapper: Facility Status and Loan Closure handling")
    void testFacilityStatusAndLoanClosureMapping() {
        CbsFacility cbsFac = new CbsFacility();
        cbsFac.setId("cbs-fac-001");
        cbsFac.setLoanRefNo("LN-CLOSED-001");
        cbsFac.setLineCode("FAC-001");
        cbsFac.setCustomerCif("CIF-1001");
        cbsFac.setFacilityType("Term Loan");
        cbsFac.setApprovedLimit(5_000_000.0);
        cbsFac.setOutstandingAmount(0.0);
        cbsFac.setAvailableAmount(0.0);
        cbsFac.setLimitStatus("Closed");

        LoanAccount mapped = cbsMapper.mapFacility(cbsFac, null, null, "CBS_SIM");

        assertNotNull(mapped);
        assertEquals("LN-CLOSED-001", mapped.getLoanReference());
        assertEquals("FAC-001", mapped.getLineCode());
        assertEquals("Closed", mapped.getStatus(), "When CBS reports Closed, CIMS loan status must be Closed");
        assertEquals(0.0, mapped.getOutstandingBalance());
        assertEquals("CBS_SIM", mapped.getSource());
    }

    @Test
    @DisplayName("CbsMapper: Relationship logical identity separation (facilityId vs loanAccountId)")
    void testRelationshipMappingIdentitySeparation() {
        CbsAccCollLinkDtls linkDtls = new CbsAccCollLinkDtls();
        linkDtls.setId("link-cbs-001");
        linkDtls.setAccountNumber("LN-REF-001");
        linkDtls.setLinkedReferenceNo("COL-CODE-001");
        linkDtls.setLinkedAmount(2_000_000.0);
        linkDtls.setHaircut(15.0);
        linkDtls.setLinkageType("Primary");
        linkDtls.setStatus("Active");

        LoanAccount loan = new LoanAccount();
        loan.setId("loan-uuid-001");
        loan.setLoanReference("LN-REF-001");
        loan.setLineCode("FAC-LINE-001");

        Collateral col = new Collateral();
        col.setId("col-uuid-001");
        col.setCode("COL-CODE-001");

        LoanCollateralLink link = cbsMapper.mapLink(linkDtls, null, loan, col, "CBS_SIM");

        assertNotNull(link);
        assertEquals("loan-uuid-001", link.getLoanAccountId(), "LoanAccountId must point to CIMS loan UUID");
        assertEquals("FAC-LINE-001", link.getFacilityId(), "FacilityId must logically hold lineCode when available");
        assertEquals("col-uuid-001", link.getCollateralId(), "CollateralId must point to CIMS collateral UUID");
        assertEquals("link-cbs-001", link.getSourceRecordId(), "SourceRecordId must track source link ID");
        assertEquals(2_000_000.0, link.getAllocatedAmount());
        assertEquals(15.0, link.getHaircut());
    }

    @Test
    @DisplayName("RealCbsAdapter: Reports Truthful NOT_CONFIGURED Status without fake connections")
    void testRealCbsAdapterTruthfulNotConfiguredStatus() {
        RealCbsAdapter realAdapter = new RealCbsAdapter();
        // Mode REAL with empty jdbcUrl and password by default
        ReflectionTestUtils.setField(realAdapter, "mode", "REAL");
        ReflectionTestUtils.setField(realAdapter, "jdbcUrl", "");
        ReflectionTestUtils.setField(realAdapter, "username", "CBAIMSUSER");
        ReflectionTestUtils.setField(realAdapter, "password", "");

        CbsConnectionStatus status = realAdapter.checkConnectionStatus();
        assertNotNull(status);
        assertEquals("REAL", status.getMode());
        assertEquals("NOT_CONFIGURED", status.getStatus());
        assertTrue(status.getMessage().contains("REAL CBS NOT CONFIGURED"));

        // Fetching without configuration must fail with clear CbsSyncException
        CbsSyncException ex = assertThrows(CbsSyncException.class, realAdapter::fetchCustomers);
        assertEquals(CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE, ex.getErrorCode());
        assertTrue(ex.getMessage().contains("REAL CBS NOT CONFIGURED"));
    }

    @Test
    @DisplayName("CbsSimulatorAdapter: Reports AVAILABLE connection status")
    void testCbsSimulatorAdapterStatus() {
        CbsSimulatorAdapter simAdapter = new CbsSimulatorAdapter();
        CbsConnectionStatus status = simAdapter.checkConnectionStatus();
        assertNotNull(status);
        assertEquals("SIMULATOR", status.getMode());
        assertEquals("AVAILABLE", status.getStatus());
        assertTrue(status.getMessage().contains("active"));
    }

    @Test
    @DisplayName("CbsSyncService: Individual Facility Direct Lookup (O(1) instead of scanning all customers)")
    void testFacilityDirectLookupSync() {
        when(cbsGateway.getMode()).thenReturn("SIMULATOR");

        CbsFacility cf = new CbsFacility();
        cf.setId("cbs-fac-101");
        cf.setLoanRefNo("LN-DIRECT-001");
        cf.setLineCode("FAC-DIRECT-001");
        cf.setCustomerCif("CIF-9999");
        cf.setApprovedLimit(4_000_000.0);
        cf.setOutstandingAmount(3_200_000.0);

        when(cbsGateway.fetchFacilityByLoanReference("LN-DIRECT-001")).thenReturn(Optional.of(cf));
        when(customerRepository.findFirstByCifIgnoreCase("CIF-9999")).thenReturn(Optional.empty());
        when(loanAccountRepository.findByLoanReference("LN-DIRECT-001")).thenReturn(Optional.empty());
        when(loanAccountRepository.save(any(LoanAccount.class))).thenAnswer(i -> i.getArgument(0));

        var result = cbsSyncService.syncFacilityFromCbs("LN-DIRECT-001", "USER1");

        assertNotNull(result);
        assertEquals("SUCCESS", result.get("status"));
        assertEquals("LN-DIRECT-001", result.get("loanReference"));
        assertEquals(3_200_000.0, result.get("outstandingBalance"));

        // Verify direct call was made and NO fetchCustomers was called
        verify(cbsGateway, times(1)).fetchFacilityByLoanReference("LN-DIRECT-001");
        verify(cbsGateway, never()).fetchCustomers();
        verify(cbsSyncLogRepository, times(1)).save(any(CbsSyncLog.class));
    }

    @Test
    @DisplayName("CbsSyncService: Idempotent Batch Sync Updates existing records without creating duplicates")
    void testIdempotentBatchSync() {
        when(cbsGateway.getMode()).thenReturn("SIMULATOR");
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("SIMULATOR", "AVAILABLE", "Ready"));

        // Source data
        CbsCustomer cc = new CbsCustomer();
        cc.setId("cbs-cst-1");
        cc.setCif("CIF-IDEM-01");
        cc.setFullName("Alpha Trading PLC");

        CbsFacility cf = new CbsFacility();
        cf.setId("cbs-fac-1");
        cf.setLoanRefNo("LN-IDEM-01");
        cf.setCustomerCif("CIF-IDEM-01");
        cf.setApprovedLimit(10_000_000.0);
        cf.setOutstandingAmount(8_000_000.0);

        CbsCollateral ccol = new CbsCollateral();
        ccol.setId("cbs-col-1");
        ccol.setCollateralCode("COL-IDEM-01");
        ccol.setCustomerCif("CIF-IDEM-01");
        ccol.setCollateralType("Warehouse");
        ccol.setOwnershipType("Borrower-owned");
        ccol.setCollateralValue(12_000_000.0);
        ccol.setHaircut(20.0);

        CbsAccCollLinkDtls link = new CbsAccCollLinkDtls();
        link.setId("link-1");
        link.setAccountNumber("LN-IDEM-01");
        link.setLinkedReferenceNo("COL-IDEM-01");
        link.setLinkedAmount(8_000_000.0);

        when(cbsGateway.fetchCustomers()).thenReturn(List.of(cc));
        when(cbsGateway.fetchFacilities()).thenReturn(List.of(cf));
        when(cbsGateway.fetchCollaterals()).thenReturn(List.of(ccol));
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(List.of(link));

        // Existing records in CIMS
        Customer existingCust = new Customer();
        existingCust.setId("cims-cst-1");
        existingCust.setCif("CIF-IDEM-01");
        existingCust.setName("Old Alpha Name");

        LoanAccount existingLoan = new LoanAccount();
        existingLoan.setId("cims-loan-1");
        existingLoan.setLoanReference("LN-IDEM-01");
        existingLoan.setApprovedLimit(10_000_000.0);
        existingLoan.setOutstandingBalance(9_000_000.0);

        Collateral existingCol = new Collateral();
        existingCol.setId("cims-col-1");
        existingCol.setCode("COL-IDEM-01");
        existingCol.setValuationAmount(10_000_000.0);
        existingCol.setOriginType("CBS_IMPORTED");

        LoanCollateralLink existingLink = new LoanCollateralLink();
        existingLink.setId("link-1");

        when(customerRepository.findAll()).thenReturn(List.of(existingCust));
        when(loanAccountRepository.findAll()).thenReturn(List.of(existingLoan));
        when(collateralRepository.findAll()).thenReturn(List.of(existingCol));
        when(loanCollateralLinkRepository.findAll()).thenReturn(List.of(existingLink));

        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> i.getArgument(0));
        when(loanAccountRepository.save(any(LoanAccount.class))).thenAnswer(i -> i.getArgument(0));
        when(collateralRepository.save(any(Collateral.class))).thenAnswer(i -> i.getArgument(0));
        when(loanCollateralLinkRepository.save(any(LoanCollateralLink.class))).thenAnswer(i -> i.getArgument(0));

        var batchResult = cbsSyncService.syncAllFromCbs("SYSTEM");

        assertNotNull(batchResult);
        assertEquals("SUCCESS", batchResult.get("status"));
        assertEquals(1, batchResult.get("customersSucceeded"));
        assertEquals(1, batchResult.get("facilitiesSucceeded"));
        assertEquals(1, batchResult.get("collateralsSucceeded"));
        assertEquals(1, batchResult.get("relationshipsSucceeded"));

        // Verify that existing records were preserved and updated in-place (no new duplicate IDs)
        verify(customerRepository).save(argThat(c -> "cims-cst-1".equals(c.getId()) && "Alpha Trading PLC".equals(c.getName())));
        verify(loanAccountRepository).save(argThat(l -> "cims-loan-1".equals(l.getId()) && l.getOutstandingBalance() == 8_000_000.0));
        verify(collateralRepository).save(argThat(c -> "cims-col-1".equals(c.getId()) && c.getValuationAmount() == 12_000_000.0 && c.getHaircut() == 20.0));
        verify(loanCollateralLinkRepository).save(argThat(l -> "link-1".equals(l.getId())));
        verify(exposureCalculationService, times(1)).calculateExposureAndAdequacy("cims-col-1");
    }

    @Test
    @DisplayName("CbsSyncService: Deduplicates identical collateral-loan linkage pairs across batch and updates existing link")
    void testDuplicateLinkageDeduplicationAndPairMatching() {
        CbsCustomer cc = new CbsCustomer();
        cc.setId("cbs-cst-dup");
        cc.setCif("CIF-DUP-01");
        cc.setFullName("Dup Test Customer");

        CbsFacility cf = new CbsFacility();
        cf.setId("cbs-fac-dup");
        cf.setLoanRefNo("LN-DUP-01");
        cf.setCustomerCif("CIF-DUP-01");

        CbsCollateral ccol = new CbsCollateral();
        ccol.setId("cbs-col-dup");
        ccol.setCollateralCode("COL-DUP-01");
        ccol.setCustomerCif("CIF-DUP-01");
        ccol.setCollateralValue(5_000_000.0);

        // Two linkage rows with different source IDs but identical (accountNumber, linkedReferenceNo)
        CbsAccCollLinkDtls link1 = new CbsAccCollLinkDtls();
        link1.setId("link-src-001");
        link1.setAccountNumber("LN-DUP-01");
        link1.setLinkedReferenceNo("COL-DUP-01");
        link1.setLinkedAmount(1_000_000.0);

        CbsAccCollLinkDtls link2 = new CbsAccCollLinkDtls();
        link2.setId("link-src-002");
        link2.setAccountNumber("LN-DUP-01");
        link2.setLinkedReferenceNo("COL-DUP-01");
        link2.setLinkedAmount(2_500_000.0);

        when(cbsGateway.getMode()).thenReturn("SIMULATOR");
        when(cbsGateway.checkConnectionStatus()).thenReturn(new CbsConnectionStatus("SIMULATOR", "AVAILABLE", "Ready"));
        when(cbsGateway.fetchFacilities()).thenReturn(List.of(cf));
        when(cbsGateway.fetchCollaterals()).thenReturn(List.of(ccol));
        when(cbsGateway.fetchCustomersByCifs(any())).thenReturn(List.of(cc));
        when(cbsGateway.fetchAllAccountCollateralLinks()).thenReturn(List.of(link1, link2));

        LoanAccount existingLoan = new LoanAccount();
        existingLoan.setId("cims-loan-dup");
        existingLoan.setLoanReference("LN-DUP-01");

        Collateral existingCol = new Collateral();
        existingCol.setId("cims-col-dup");
        existingCol.setCode("COL-DUP-01");
        existingCol.setOriginType("CBS_IMPORTED");

        LoanCollateralLink existingLink = new LoanCollateralLink();
        existingLink.setId("cims-active-link-001");
        existingLink.setCollateralId("cims-col-dup");
        existingLink.setLoanAccountId("cims-loan-dup");
        existingLink.setStatus("Active");
        existingLink.setLinkedAmount(500_000.0);

        when(customerRepository.findAll()).thenReturn(List.of());
        when(loanAccountRepository.findAll()).thenReturn(List.of(existingLoan));
        when(collateralRepository.findAll()).thenReturn(List.of(existingCol));
        when(loanCollateralLinkRepository.findAll()).thenReturn(List.of(existingLink));

        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> i.getArgument(0));
        when(loanAccountRepository.save(any(LoanAccount.class))).thenAnswer(i -> i.getArgument(0));
        when(collateralRepository.save(any(Collateral.class))).thenAnswer(i -> i.getArgument(0));
        when(loanCollateralLinkRepository.save(any(LoanCollateralLink.class))).thenAnswer(i -> i.getArgument(0));

        var batchResult = cbsSyncService.syncAllFromCbs("SYSTEM");

        assertNotNull(batchResult);
        assertEquals("SUCCESS", batchResult.get("status"));
        assertEquals(2, batchResult.get("relationshipsSucceeded"));

        // Both linkage rows should update the same existing link (cims-active-link-001) rather than creating duplicates
        verify(loanCollateralLinkRepository, times(2)).save(argThat(l -> "cims-active-link-001".equals(l.getId())));
    }

    @Test
    @DisplayName("CbsMapper: Resolves numeric facility types, segments, branch codes, and marks CBS collaterals for enrichment")
    void testCbsCodeResolutionAndCollateralEnrichmentReadiness() {
        Branch branch10 = new Branch();
        branch10.setId("brn-cbs-010");
        branch10.setCode("CBS-010");
        branch10.setCbsBranchCode("010");
        branch10.setName("Bole Branch");

        cbsMapper.refreshBranchCache(List.of(branch10));

        CbsCustomer cc = new CbsCustomer();
        cc.setCif("CIF-MAP-01");
        cc.setFullName("Mapper Test Customer");
        cc.setBranch("10");
        cc.setBusinessSegment("0");

        Customer mappedCust = cbsMapper.mapCustomer(cc, null, "REAL_CBS");
        assertEquals("CBS_IMPORTED", mappedCust.getOriginType());
        assertEquals("Bole Branch", mappedCust.getBranch());
        assertEquals("Corporate Banking", mappedCust.getSegment());

        assertEquals("Short Term Loan", CbsMapper.resolveFacilityType("0"));
        assertEquals("Medium-term Loan", CbsMapper.resolveFacilityType("1"));
        assertEquals("Long-term Loan", CbsMapper.resolveFacilityType("2"));
        assertEquals("Pre-shipment loans", CbsMapper.resolveFacilityType("3"));
        assertEquals("Post shipment loans", CbsMapper.resolveFacilityType("4"));
        assertEquals("Merchandise loans", CbsMapper.resolveFacilityType("5"));
        assertEquals("Advance on LC", CbsMapper.resolveFacilityType("6"));
        assertEquals("ECG loans", CbsMapper.resolveFacilityType("7"));
        assertEquals("Others (USAID and others)", CbsMapper.resolveFacilityType("8"));
        assertEquals("Diminishing Musharaka Agriculture", CbsMapper.resolveFacilityType("DMAG"));
        assertEquals("Ijara Realestate", CbsMapper.resolveFacilityType("ijrs"));
        assertEquals("Mining TermLoan", CbsMapper.resolveFacilityType("MNGL"));
        assertEquals("Student Loan", CbsMapper.resolveFacilityType("EDFI"));
        assertEquals("DBE SME- ADELE", CbsMapper.resolveFacilityType("SMAD"));

        assertEquals("Corporate Banking", CbsMapper.resolveBusinessSegment("0"));
        assertEquals("MSME Banking", CbsMapper.resolveBusinessSegment("1"));
        assertEquals("Retail Banking", CbsMapper.resolveBusinessSegment("2"));
        assertEquals("Retail Banking", CbsMapper.resolveBusinessSegment("MRETAIL"));
        assertEquals("Retail Banking", CbsMapper.resolveBusinessSegment("2Retail Banking Customers"));
        assertEquals("MSME Banking", CbsMapper.resolveBusinessSegment("MSME"));
        assertEquals("MSME Banking", CbsMapper.resolveBusinessSegment("MSME Banking Customers"));
        assertEquals("Corporate Banking", CbsMapper.resolveBusinessSegment("CORPORATE"));
        assertEquals("Interest-Free Banking (IFB)", CbsMapper.resolveBusinessSegment("IFB"));
        assertTrue(CbsMapper.isPlaceholderSegment("General"));
        assertTrue(CbsMapper.isPlaceholderSegment("UNSEGMENTED"));
        assertTrue(CbsMapper.isPlaceholderSegment("MEDIUM"));
        assertFalse(CbsMapper.isPlaceholderSegment("Retail Banking"));

        CbsFacility cf = new CbsFacility();
        cf.setId("LN-MAP-01");
        cf.setLoanRefNo("LN-MAP-01");
        cf.setFacilityType("5");
        cf.setBusinessSegment("1");
        cf.setBranch("010");
        LoanAccount mappedLoan = cbsMapper.mapFacility(cf, null, mappedCust, "REAL_CBS");
        assertEquals("CBS_IMPORTED", mappedLoan.getOriginType());
        assertEquals("Merchandise loans", mappedLoan.getFacilityType());
        assertEquals("MSME Banking", mappedLoan.getSegment());
        assertEquals("Bole Branch", mappedLoan.getBranch());

        CbsCollateral ccol = new CbsCollateral();
        ccol.setCollateralCode("COL-MAP-01");
        ccol.setBranch("CBS-010");
        ccol.setBusinessSegment("2");
        ccol.setCollateralValue(1_000_000.0);
        Collateral mappedCol = cbsMapper.mapCollateral(ccol, null, mappedCust, "REAL_CBS");
        assertEquals("CBS_IMPORTED", mappedCol.getOriginType());
        assertEquals("PENDING_ENRICHMENT", mappedCol.getEnrichmentStatus());
        assertEquals("INCOMPLETE", mappedCol.getDataQualityStatus());
        assertEquals("Retail Banking", mappedCol.getOwningSegment());
        assertEquals("Bole Branch", mappedCol.getBranch());
    }
}
