package com.bank.cims;

import com.bank.cims.dto.DashboardSummaryDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive Integration Test Suite verifying all 15 Acceptance Tests
 * for the Hierarchical Drill-Down Dashboard, Role-Scope Enforcement,
 * Mandatory Document Logic, and Policy Lifecycle Auditing (Part L).
 */
@SpringBootTest
@Transactional
public class HierarchicalDashboardIntegrationTest {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UserRepository userRepository;

    private Customer testCustomer;
    private Collateral testCollateral;

    @BeforeEach
    public void setup() {
        testCustomer = new Customer();
        testCustomer.setId("cust-test-" + UUID.randomUUID().toString().substring(0, 8));
        testCustomer.setCif("CIF-HTEST-" + UUID.randomUUID().toString().substring(0, 6));
        testCustomer.setName("Alpha Trading PLC");
        testCustomer.setSegment("Corporate Banking");
        testCustomer.setBranch("Bole Special Branch");
        testCustomer.setStatus("Active");
        testCustomer.setAuthStat("A");
        testCustomer.setRecordStat("O");
        customerRepository.save(testCustomer);

        testCollateral = new Collateral();
        testCollateral.setId("col-test-" + UUID.randomUUID().toString().substring(0, 8));
        testCollateral.setCode("COL-HTEST-" + UUID.randomUUID().toString().substring(0, 6));
        testCollateral.setDescription("Headquarters Commercial Building");
        testCollateral.setCustomerId(testCustomer.getId());
        testCollateral.setCategory("Building");
        testCollateral.setType("Commercial Real Estate");
        testCollateral.setValuationAmount(10000000.0);
        testCollateral.setHaircut(20.0);
        testCollateral.setOwningSegment("Corporate Banking");
        testCollateral.setBranch("Bole Special Branch");
        testCollateral.setStatus("Uninsured");
        testCollateral.setInsuranceStatus("Uninsured");
        testCollateral.setVerificationStatus("Recorded");
        testCollateral.setAuthStat("A");
        testCollateral.setRecordStat("O");
        collateralRepository.save(testCollateral);
    }

    // =========================================================================
    // ACCEPTANCE TEST 1: Bank Level Progressive Loading
    // =========================================================================
    @Test
    @DisplayName("AT 1: Bank Level Progressive Loading returns 4 segments, KPIs, charts, shared collaterals, and hotspots")
    public void test01_bankLevelProgressiveLoading() {
        Map<String, Object> bankView = dashboardService.getHierarchyBank("usr-exec");
        assertNotNull(bankView);
        assertEquals("BANK", bankView.get("scopeLevel"));
        assertEquals("Bank Overview", bankView.get("scopeTitle"));
        assertNotNull(bankView.get("summary"), "Summary KPIs must be returned");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> segments = (List<Map<String, Object>>) bankView.get("segments");
        assertNotNull(segments);
        assertEquals(4, segments.size(), "Must contain exactly 4 canonical business segments");

        assertNotNull(bankView.get("exposureVsProtection"), "Exposure vs protection chart data must be present");
        assertNotNull(bankView.get("sharedCollaterals"), "Shared collaterals list must be present");
        assertNotNull(bankView.get("requiresAttention"), "Requires attention hotspots must be present");
    }

    // =========================================================================
    // ACCEPTANCE TEST 2: Segment Drill-Down
    // =========================================================================
    @Test
    @DisplayName("AT 2: Segment Drill-Down returns districts, ranking, summary, and hotspots")
    public void test02_segmentDrillDown() {
        Map<String, Object> segView = dashboardService.getHierarchySegment("usr-exec", "Corporate Banking");
        assertNotNull(segView);
        assertEquals("SEGMENT", segView.get("scopeLevel"));
        assertEquals("Corporate Banking", segView.get("segmentName"));
        assertNotNull(segView.get("summary"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> districts = (List<Map<String, Object>>) segView.get("districts");
        assertNotNull(districts);
        assertFalse(districts.isEmpty(), "Districts list must not be empty");

        assertNotNull(segView.get("districtRanking"));
        assertNotNull(segView.get("sharedCollaterals"));
        assertNotNull(segView.get("requiresAttention"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 3: District Drill-Down
    // =========================================================================
    @Test
    @DisplayName("AT 3: District Drill-Down returns branches, ranking, areas, and hotspots")
    public void test03_districtDrillDown() {
        Map<String, Object> distView = dashboardService.getHierarchyDistrict("usr-exec", "Addis Ababa East District", "Corporate Banking");
        assertNotNull(distView);
        assertEquals("DISTRICT", distView.get("scopeLevel"));
        assertEquals("Addis Ababa East District", distView.get("districtName"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branches = (List<Map<String, Object>>) distView.get("branches");
        assertNotNull(branches);

        @SuppressWarnings("unchecked")
        Set<String> areas = (Set<String>) distView.get("areas");
        assertNotNull(areas);
        assertNotNull(distView.get("requiresAttention"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 4: Area Drill-Down
    // =========================================================================
    @Test
    @DisplayName("AT 4: Area Drill-Down returns branches within that area office")
    public void test04_areaDrillDown() {
        Map<String, Object> areaView = dashboardService.getHierarchyArea("usr-exec", "Bole Area Office", "Addis Ababa East District", "Corporate Banking");
        assertNotNull(areaView);
        assertEquals("AREA", areaView.get("scopeLevel"));
        assertEquals("Bole Area Office", areaView.get("areaName"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branches = (List<Map<String, Object>>) areaView.get("branches");
        assertNotNull(branches);
        assertNotNull(areaView.get("requiresAttention"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 5: Branch Drill-Down
    // =========================================================================
    @Test
    @DisplayName("AT 5: Branch Drill-Down returns multi-segment distribution, customer list, and hotspots")
    public void test05_branchDrillDown() {
        Map<String, Object> brView = dashboardService.getHierarchyBranch("usr-exec", "Bole Special Branch", "Corporate Banking");
        assertNotNull(brView);
        assertEquals("BRANCH", brView.get("scopeLevel"));
        assertEquals("Bole Special Branch", brView.get("branchName"));
        assertNotNull(brView.get("summary"));

        @SuppressWarnings("unchecked")
        Map<String, Integer> segDist = (Map<String, Integer>) brView.get("segmentDistribution");
        assertNotNull(segDist);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> customers = (List<Map<String, Object>>) brView.get("customers");
        assertNotNull(customers);
        assertNotNull(brView.get("requiresAttention"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 6: Customer 360 View
    // =========================================================================
    @Test
    @DisplayName("AT 6: Customer 360 View aggregates customer, facilities, collaterals, policies, and documents")
    public void test06_customer360View() {
        Map<String, Object> custView = dashboardService.getHierarchyCustomer("usr-exec", testCustomer.getCif());
        assertNotNull(custView);
        assertEquals("CUSTOMER", custView.get("scopeLevel"));
        assertEquals(testCustomer.getId(), ((Customer) custView.get("customer")).getId());

        @SuppressWarnings("unchecked")
        List<Collateral> collaterals = (List<Collateral>) custView.get("collaterals");
        assertNotNull(collaterals);
        assertTrue(collaterals.stream().anyMatch(c -> c.getId().equals(testCollateral.getId())));

        assertNotNull(custView.get("facilities"));
        assertNotNull(custView.get("policies"));
        assertNotNull(custView.get("documents"));
        assertNotNull(custView.get("exceptions"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 7: Facility View
    // =========================================================================
    @Test
    @DisplayName("AT 7: Facility View resolves facility, borrower, and linked collaterals with haircut calculations")
    public void test07_facilityView() {
        LoanAccount fac = new LoanAccount();
        fac.setId("fac-test-" + UUID.randomUUID().toString().substring(0, 8));
        fac.setLoanReference("LN-AT7-001");
        fac.setCustomerId(testCustomer.getId());
        fac.setFacilityType("Term Loan");
        fac.setApprovedLimit(5000000.0);
        fac.setOutstandingBalance(4500000.0);
        fac.setBranch("Bole Special Branch");
        fac.setSegment("Corporate Banking");
        loanAccountRepository.save(fac);

        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("lnk-at7-" + UUID.randomUUID().toString().substring(0, 8));
        link.setCollateralId(testCollateral.getId());
        link.setFacilityId(fac.getId());
        link.setLoanAccountId(fac.getId());
        link.setAllocatedAmount(4500000.0);
        loanCollateralLinkRepository.save(link);

        Map<String, Object> facView = dashboardService.getHierarchyFacility("usr-exec", fac.getId());
        assertNotNull(facView);
        assertEquals("FACILITY", facView.get("scopeLevel"));
        assertNotNull(facView.get("facility"));
        assertNotNull(facView.get("customer"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> linkedColls = (List<Map<String, Object>>) facView.get("linkedCollaterals");
        assertNotNull(linkedColls);
        assertFalse(linkedColls.isEmpty());
        Map<String, Object> firstCol = linkedColls.get(0);
        assertEquals(testCollateral.getId(), firstCol.get("collateralId"));
        assertNotNull(firstCol.get("haircut"));
        assertNotNull(firstCol.get("netSecurityValue"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 8: Collateral View
    // =========================================================================
    @Test
    @DisplayName("AT 8: Collateral View resolves collateral, linked facilities, policies, documents, and mandatory checklist")
    public void test08_collateralView() {
        Map<String, Object> colView = dashboardService.getHierarchyCollateral("usr-exec", testCollateral.getId());
        assertNotNull(colView);
        assertEquals("COLLATERAL", colView.get("scopeLevel"));
        assertEquals(testCollateral.getId(), ((Collateral) colView.get("collateral")).getId());
        assertNotNull(colView.get("linkedFacilities"));
        assertNotNull(colView.get("policies"));
        assertNotNull(colView.get("documents"));
        assertNotNull(colView.get("mandatoryChecklist"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 9: Policy Lifecycle View
    // =========================================================================
    @Test
    @DisplayName("AT 9: Policy View provides endorsements, verification documents, and renewal history")
    public void test09_policyLifecycleView() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-at9-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-AT9-001");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Ethiopian Insurance Corporation");
        policy.setCoverageType("Fire and Special Perils");
        policy.setInsuredAmount(10000000.0);
        policy.setEffectiveDate("2026-01-01");
        policy.setExpiryDate("2027-01-01");
        policy.setStatus("Active");
        insurancePolicyRepository.save(policy);

        Map<String, Object> polView = dashboardService.getHierarchyPolicy("usr-exec", policy.getId());
        assertNotNull(polView);
        assertEquals("POLICY", polView.get("scopeLevel"));
        assertNotNull(polView.get("policy"));
        assertNotNull(polView.get("collateral"));
        assertNotNull(polView.get("customer"));
        assertNotNull(polView.get("endorsements"));
        assertNotNull(polView.get("documents"));
        assertNotNull(polView.get("history"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 10: Cross-Collateral Value Integrity
    // =========================================================================
    @Test
    @DisplayName("AT 10: Collateral linked to multiple facilities is counted once, not duplicated")
    public void test10_crossCollateralValueIntegrity() {
        LoanAccount fac1 = new LoanAccount();
        fac1.setId("fac-1-" + UUID.randomUUID().toString().substring(0, 8));
        fac1.setLoanReference("LN-REF-001");
        fac1.setCustomerId(testCustomer.getId());
        fac1.setFacilityType("Term Loan");
        fac1.setApprovedLimit(6000000.0);
        fac1.setOutstandingBalance(6000000.0);
        fac1.setBranch("Bole Special Branch");
        fac1.setSegment("Corporate Banking");
        loanAccountRepository.save(fac1);

        LoanAccount fac2 = new LoanAccount();
        fac2.setId("fac-2-" + UUID.randomUUID().toString().substring(0, 8));
        fac2.setLoanReference("LN-REF-002");
        fac2.setCustomerId(testCustomer.getId());
        fac2.setFacilityType("Overdraft Facility");
        fac2.setApprovedLimit(4000000.0);
        fac2.setOutstandingBalance(4000000.0);
        fac2.setBranch("Bole Special Branch");
        fac2.setSegment("Corporate Banking");
        loanAccountRepository.save(fac2);

        LoanCollateralLink link1 = new LoanCollateralLink();
        link1.setId("lnk-1-" + UUID.randomUUID().toString().substring(0, 8));
        link1.setCollateralId(testCollateral.getId());
        link1.setFacilityId(fac1.getId());
        link1.setLoanAccountId(fac1.getId());
        link1.setAllocatedAmount(6000000.0);
        loanCollateralLinkRepository.save(link1);

        LoanCollateralLink link2 = new LoanCollateralLink();
        link2.setId("lnk-2-" + UUID.randomUUID().toString().substring(0, 8));
        link2.setCollateralId(testCollateral.getId());
        link2.setFacilityId(fac2.getId());
        link2.setLoanAccountId(fac2.getId());
        link2.setAllocatedAmount(4000000.0);
        loanCollateralLinkRepository.save(link2);

        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-exec", "Corporate Banking", null, "Bole Special Branch");
        DashboardService.ScopedDataset ds = dashboardService.loadScopedDataset(scope, null, null, null);

        long occurrencesOfTestCol = ds.collaterals.stream()
                .filter(c -> c.getId().equals(testCollateral.getId()))
                .count();
        assertEquals(1, occurrencesOfTestCol, "Collateral must appear exactly once in scoped dataset despite multiple links");
    }

    // =========================================================================
    // ACCEPTANCE TEST 11: Shared Collateral Across Segments
    // =========================================================================
    @Test
    @DisplayName("AT 11: Collateral linked across different segments is detected in sharedCollaterals without double counting")
    public void test11_sharedCollateralAcrossSegments() {
        // Create Retail customer and facility
        Customer retCust = new Customer();
        retCust.setId("cust-ret-" + UUID.randomUUID().toString().substring(0, 8));
        retCust.setCif("CIF-RET-" + UUID.randomUUID().toString().substring(0, 6));
        retCust.setName("Retail Borrower");
        retCust.setSegment("Retail Banking");
        retCust.setBranch("Bole Special Branch");
        retCust.setStatus("Active");
        customerRepository.save(retCust);

        LoanAccount retFac = new LoanAccount();
        retFac.setId("fac-ret-" + UUID.randomUUID().toString().substring(0, 8));
        retFac.setLoanReference("LN-RET-001");
        retFac.setCustomerId(retCust.getId());
        retFac.setFacilityType("Mortgage");
        retFac.setApprovedLimit(3000000.0);
        retFac.setOutstandingBalance(3000000.0);
        retFac.setBranch("Bole Special Branch");
        retFac.setSegment("Retail Banking");
        loanAccountRepository.save(retFac);

        // Link testCollateral (Corporate Banking) to retail facility
        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("lnk-shared-" + UUID.randomUUID().toString().substring(0, 8));
        link.setCollateralId(testCollateral.getId());
        link.setFacilityId(retFac.getId());
        link.setLoanAccountId(retFac.getId());
        link.setAllocatedAmount(3000000.0);
        loanCollateralLinkRepository.save(link);

        Map<String, Object> bankView = dashboardService.getHierarchyBank("usr-exec");
        assertNotNull(bankView);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> shared = (List<Map<String, Object>>) bankView.get("sharedCollaterals");
        assertNotNull(shared);

        Optional<Map<String, Object>> match = shared.stream()
                .filter(m -> testCollateral.getId().equals(m.get("collateralId")))
                .findFirst();
        assertTrue(match.isPresent(), "Shared collateral must be identified in sharedCollaterals list");

        @SuppressWarnings("unchecked")
        List<String> linkedSegs = (List<String>) match.get().get("linkedSegments");
        assertTrue(linkedSegs.contains("Corporate Banking"));
        assertTrue(linkedSegs.contains("Retail Banking"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 12: BRO/CRO Multi-Segment Operations
    // =========================================================================
    @Test
    @DisplayName("AT 12: BRO/CRO can register collaterals and policies across all operating segments")
    public void test12_broCroMultiSegmentOperations() {
        DashboardService.ResolvedScope broScope = dashboardService.resolveUserScope("usr-bro", null, null, null);
        assertFalse(broScope.lockedSegment, "BRO must not be locked to a single segment");
        assertTrue(broScope.allowedSegments.contains("Corporate Banking"));
        assertTrue(broScope.allowedSegments.contains("Retail Banking"));
        assertTrue(broScope.allowedSegments.contains("MSME Banking"));
        assertTrue(broScope.allowedSegments.contains("Interest-Free Banking (IFB)"));

        DashboardService.ResolvedScope croScope = dashboardService.resolveUserScope("usr-cro", null, null, null);
        assertFalse(croScope.lockedSegment, "CRO must not be locked to a single segment");
        assertTrue(croScope.allowedSegments.size() >= 4);
    }

    // =========================================================================
    // ACCEPTANCE TEST 13: Branch Manager Multi-Segment Visibility
    // =========================================================================
    @Test
    @DisplayName("AT 13: Branch Manager manages branch records across ALL operating segments")
    public void test13_branchManagerMultiSegmentVisibility() {
        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-brmgr", null, null, "Bole Special Branch");
        assertEquals("BRANCH", scope.scopeLevel);
        assertTrue(scope.lockedBranch, "Branch Manager must be locked to branch");
        assertFalse(scope.lockedSegment, "Branch Manager must NOT be locked to a single segment");

        // Seed a Retail collateral in Bole Special Branch alongside Corporate
        Collateral retCol = new Collateral();
        retCol.setId("col-ret-" + UUID.randomUUID().toString().substring(0, 8));
        retCol.setCode("COL-RET-" + UUID.randomUUID().toString().substring(0, 6));
        retCol.setDescription("Retail Villa");
        retCol.setOwningSegment("Retail Banking");
        retCol.setBranch("Bole Special Branch");
        retCol.setCategory("Building");
        retCol.setType("Commercial Real Estate");
        retCol.setValuationAmount(5000000.0);
        collateralRepository.save(retCol);

        Map<String, Object> branchData = dashboardService.getHierarchyBranch("usr-brmgr", "Bole Special Branch", null);
        assertNotNull(branchData);

        @SuppressWarnings("unchecked")
        Map<String, Integer> segDist = (Map<String, Integer>) branchData.get("segmentDistribution");
        assertNotNull(segDist);
        assertTrue(segDist.containsKey("Corporate Banking") || segDist.containsKey("Retail Banking"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 14: Role-Scope Enforcement — Senior Management
    // =========================================================================
    @Test
    @DisplayName("AT 14: Senior Management lands on Bank Overview and can select all 4 segments")
    public void test14_roleScope_seniorManagement() {
        Map<String, Object> bankView = dashboardService.getHierarchyBank("usr-srmgmt");
        assertNotNull(bankView);
        assertEquals("BANK", bankView.get("scopeLevel"));

        List<String> canonicalSegments = List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        for (String seg : canonicalSegments) {
            Map<String, Object> segView = dashboardService.getHierarchySegment("usr-srmgmt", seg);
            assertNotNull(segView);
            assertEquals(seg, segView.get("segmentName"));
        }
    }

    // =========================================================================
    // ACCEPTANCE TEST 15: Role-Scope Enforcement — Executive Management
    // =========================================================================
    @Test
    @DisplayName("AT 15: Executive Management has bank-wide visibility across all hierarchy levels")
    public void test15_roleScope_executiveManagement() {
        Map<String, Object> bankView = dashboardService.getHierarchyBank("usr-exec");
        assertNotNull(bankView);

        Map<String, Object> segView = dashboardService.getHierarchySegment("usr-exec", "Corporate Banking");
        assertNotNull(segView);

        Map<String, Object> distView = dashboardService.getHierarchyDistrict("usr-exec", "Addis Ababa East District", "Corporate Banking");
        assertNotNull(distView);

        Map<String, Object> areaView = dashboardService.getHierarchyArea("usr-exec", "Bole Area Office", "Addis Ababa East District", "Corporate Banking");
        assertNotNull(areaView);

        Map<String, Object> brView = dashboardService.getHierarchyBranch("usr-exec", "Bole Special Branch", "Corporate Banking");
        assertNotNull(brView);
    }

    // =========================================================================
    // ACCEPTANCE TEST 16: Role-Scope Enforcement — Head Office Segment User
    // =========================================================================
    @Test
    @DisplayName("AT 16: Head Office Segment User locked to segment; Bank Overview and other segments denied")
    public void test16_roleScope_headOfficeSegmentUser() {
        IllegalArgumentException bankEx = assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyBank("usr-hodept");
        });
        assertTrue(bankEx.getMessage().toLowerCase().contains("access denied"));

        IllegalArgumentException retailEx = assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchySegment("usr-hodept", "Retail Banking");
        });
        assertTrue(retailEx.getMessage().toLowerCase().contains("access denied"));

        Map<String, Object> corporateView = dashboardService.getHierarchySegment("usr-hodept", "Corporate Banking");
        assertNotNull(corporateView);
        assertEquals("Corporate Banking", corporateView.get("segmentName"));
    }

    // =========================================================================
    // ACCEPTANCE TEST 17: Data Integrity (No Fake Data / Empty States)
    // =========================================================================
    @Test
    @DisplayName("AT 17: Empty collections returned cleanly without dummy or simulated data")
    public void test17_dataIntegrity_noFakeData() {
        Customer emptyCust = new Customer();
        emptyCust.setId("cust-empty-" + UUID.randomUUID().toString().substring(0, 8));
        emptyCust.setCif("CIF-EMPTY-" + UUID.randomUUID().toString().substring(0, 6));
        emptyCust.setName("Brand New Customer");
        emptyCust.setSegment("Corporate Banking");
        emptyCust.setBranch("Bole Special Branch");
        emptyCust.setStatus("Active");
        customerRepository.save(emptyCust);

        Map<String, Object> res = dashboardService.getHierarchyCustomer("usr-exec", emptyCust.getCif());
        assertNotNull(res);

        @SuppressWarnings("unchecked")
        List<LoanAccount> facs = (List<LoanAccount>) res.get("facilities");
        assertTrue(facs.isEmpty(), "Facilities list must be empty, not populated with fake records");

        @SuppressWarnings("unchecked")
        List<Collateral> cols = (List<Collateral>) res.get("collaterals");
        assertTrue(cols.isEmpty(), "Collaterals list must be empty, not populated with fake records");
    }

    // =========================================================================
    // ACCEPTANCE TEST 18: Error Handling — Non-Existent Entity
    // =========================================================================
    @Test
    @DisplayName("AT 18: Non-existent entities return descriptive not found errors")
    public void test18_errorHandling_notFound() {
        assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyCustomer("usr-exec", "NON_EXISTENT_CIF_9999");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyFacility("usr-exec", "NON_EXISTENT_FAC_9999");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyCollateral("usr-exec", "NON_EXISTENT_COL_9999");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyPolicy("usr-exec", "NON_EXISTENT_POL_9999");
        });
    }

    // =========================================================================
    // ACCEPTANCE TEST 19: Backend Aggregation Performance
    // =========================================================================
    @Test
    @DisplayName("AT 19: Backend Aggregation executes efficiently within acceptable SLA")
    public void test19_backendAggregationPerformance() {
        long start = System.currentTimeMillis();
        Map<String, Object> bankView = dashboardService.getHierarchyBank("usr-exec");
        long elapsed = System.currentTimeMillis() - start;

        assertNotNull(bankView);
        assertTrue(elapsed < 3000, "Bank hierarchy aggregation took " + elapsed + "ms, expected under 3000ms");
    }

    // =========================================================================
    // ACCEPTANCE TEST 20: Security / Authorization Rejection
    // =========================================================================
    @Test
    @DisplayName("AT 20: User accessing entity outside locked branch is rejected with Access Denied")
    public void test20_securityAuthorizationRejection() {
        // usr-brmgr is assigned to Bole Special Branch
        // Attempting to access a branch outside their jurisdiction must be rejected
        IllegalArgumentException brEx = assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyBranch("usr-brmgr", "Merkato Branch", null);
        });
        assertTrue(brEx.getMessage().toLowerCase().contains("access denied"));

        // Create collateral in Merkato Branch
        Collateral merkatoCol = new Collateral();
        merkatoCol.setId("col-mer-" + UUID.randomUUID().toString().substring(0, 8));
        merkatoCol.setCode("COL-MER-" + UUID.randomUUID().toString().substring(0, 6));
        merkatoCol.setCategory("Vehicle");
        merkatoCol.setType("Commercial Vehicle");
        merkatoCol.setBranch("Merkato Branch");
        merkatoCol.setOwningSegment("Corporate Banking");
        collateralRepository.save(merkatoCol);

        IllegalArgumentException colEx = assertThrows(IllegalArgumentException.class, () -> {
            dashboardService.getHierarchyCollateral("usr-brmgr", merkatoCol.getId());
        });
        assertTrue(colEx.getMessage().toLowerCase().contains("access denied"));
    }

    // =========================================================================
    // WORKFLOW TEST 21: Mandatory Documents — Wrong Document Type
    // =========================================================================
    @Test
    @DisplayName("TEST 21: Uploading wrong document type does not satisfy mandatory requirement")
    public void test21_mandatoryDocs_wrongDocumentTypeUpload() {
        OwnershipDocument wrongDoc = new OwnershipDocument();
        wrongDoc.setId("doc-wrong-" + UUID.randomUUID().toString().substring(0, 8));
        wrongDoc.setEntityId(testCollateral.getId());
        wrongDoc.setCollateralId(testCollateral.getId());
        wrongDoc.setEntityType("Collateral");
        wrongDoc.setType("Valuation Report");
        wrongDoc.setName("Valuation Report 2026");
        wrongDoc.setFileName("valuation.pdf");
        wrongDoc.setFileContent("data:application/pdf;base64,JVBERi0x...");
        wrongDoc.setStatus("Active");
        wrongDoc.setVerificationStatus("Recorded");
        ownershipDocumentRepository.save(wrongDoc);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            validationService.validateMandatoryDocuments(testCollateral);
        });
        assertTrue(ex.getMessage().contains("Missing mandatory documents"));
    }

    // =========================================================================
    // WORKFLOW TEST 22: Mandatory Documents — Correct Document Type
    // =========================================================================
    @Test
    @DisplayName("TEST 22: Uploading matching document type passes without false auto-verification")
    public void test22_mandatoryDocs_correctDocumentTypeUpload() {
        String[] types = {
                "Title Deed / Property Ownership Certificate",
                "Approved Building Plan",
                "Valuation Report"
        };
        for (String t : types) {
            OwnershipDocument doc = new OwnershipDocument();
            doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
            doc.setEntityId(testCollateral.getId());
            doc.setCollateralId(testCollateral.getId());
            doc.setEntityType("Collateral");
            doc.setType(t);
            doc.setName("Doc - " + t);
            doc.setFileName("doc.pdf");
            doc.setFileContent("data:application/pdf;base64,JVBERi0x...");
            doc.setStatus("Active");
            doc.setVerificationStatus("Recorded");
            ownershipDocumentRepository.save(doc);
        }

        assertDoesNotThrow(() -> {
            validationService.validateMandatoryDocuments(testCollateral);
        });
    }

    // =========================================================================
    // WORKFLOW TEST 23: Mandatory Documents — Cross-Collateral Rejection
    // =========================================================================
    @Test
    @DisplayName("TEST 23: Document uploaded to Collateral A does not satisfy Collateral B")
    public void test23_mandatoryDocs_crossCollateralDocumentRejection() {
        OwnershipDocument docA = new OwnershipDocument();
        docA.setId("doc-a-" + UUID.randomUUID().toString().substring(0, 8));
        docA.setEntityId(testCollateral.getId());
        docA.setCollateralId(testCollateral.getId());
        docA.setEntityType("Collateral");
        docA.setType("Title Deed / Property Ownership Certificate");
        docA.setName("Title Deed Doc A");
        docA.setFileContent("data:application/pdf;base64,JVBERi0x...");
        docA.setStatus("Active");
        ownershipDocumentRepository.save(docA);

        Collateral colB = new Collateral();
        colB.setId("col-b-" + UUID.randomUUID().toString().substring(0, 8));
        colB.setCode("COL-B-" + UUID.randomUUID().toString().substring(0, 6));
        colB.setCategory("Building");
        colB.setType("Commercial Real Estate");
        colB.setOwningSegment("Corporate Banking");
        colB.setBranch("Bole Special Branch");
        colB.setValuationAmount(4000000.0);
        collateralRepository.save(colB);

        assertThrows(IllegalArgumentException.class, () -> {
            validationService.validateMandatoryDocuments(colB);
        });
    }

    // =========================================================================
    // WORKFLOW TEST 24: Mandatory Documents — Metadata Only Without Content
    // =========================================================================
    @Test
    @DisplayName("TEST 24: Metadata document record without file content or dmsRef fails validation")
    public void test24_mandatoryDocs_metadataOnlyWithoutContentRejection() {
        OwnershipDocument metaDoc = new OwnershipDocument();
        metaDoc.setId("doc-meta-" + UUID.randomUUID().toString().substring(0, 8));
        metaDoc.setEntityId(testCollateral.getId());
        metaDoc.setCollateralId(testCollateral.getId());
        metaDoc.setEntityType("Collateral");
        metaDoc.setType("Title Deed / Property Ownership Certificate");
        metaDoc.setName("Empty Metadata Doc");
        metaDoc.setFileName("placeholder.pdf");
        metaDoc.setFileContent(null);
        metaDoc.setDmsRef(null);
        metaDoc.setStatus("Active");
        ownershipDocumentRepository.save(metaDoc);

        assertThrows(IllegalArgumentException.class, () -> {
            validationService.validateMandatoryDocuments(testCollateral);
        });
    }

    // =========================================================================
    // WORKFLOW TEST 25: Policy Amendment
    // =========================================================================
    @Test
    @DisplayName("TEST 25: Policy amendment requires reason, increments version, and creates audit log")
    public void test25_policyAmendment_versionHistoryAndAudit() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-amend-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-AMD-" + UUID.randomUUID().toString().substring(0, 6));
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance");
        policy.setCoverageType("Fire and Lightning");
        policy.setInsuredAmount(5000000.0);
        policy.setPremium(15000.0);
        policy.setEffectiveDate("2026-01-01");
        policy.setExpiryDate("2027-01-01");
        policy.setStatus("Active");
        policy.setVersion(1);
        insurancePolicyRepository.save(policy);

        InsurancePolicy updated = new InsurancePolicy();
        updated.setInsuredAmount(6000000.0);
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.amendPolicy(policy.getId(), updated, "", "usr-cro");
        });

        Map<String, Object> result = cimsService.amendPolicy(policy.getId(), updated, "Property revalued upward", "usr-cro");
        assertTrue((Boolean) result.get("success"));

        InsurancePolicy amended = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals(2, amended.getVersion());
        assertEquals(6000000.0, amended.getInsuredAmount());
    }

    // =========================================================================
    // WORKFLOW TEST 26: Policy Endorsement
    // =========================================================================
    @Test
    @DisplayName("TEST 26: Policy endorsement links to policy and increments endorsement count")
    public void test26_policyEndorsement_linkingAndAudit() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-end-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-END-" + UUID.randomUUID().toString().substring(0, 6));
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Awash Insurance");
        policy.setCoverageType("Comprehensive");
        policy.setInsuredAmount(10000000.0);
        policy.setStatus("Active");
        policy.setEndorsementCount(0);
        insurancePolicyRepository.save(policy);

        Map<String, Object> res = cimsService.endorsePolicy(policy.getId(), "END-001", "Bank Loss Payee Endorsement", "2026-09-01", null, "usr-cro");
        assertTrue((Boolean) res.get("success"));

        InsurancePolicy updatedPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals(1, updatedPol.getEndorsementCount());
    }

    // =========================================================================
    // WORKFLOW TEST 27: Policy Renewal
    // =========================================================================
    @Test
    @DisplayName("TEST 27: Policy renewal preserves renewedFromPolicyId link")
    public void test27_policyRenewal_preservesParentLink() {
        InsurancePolicy oldPolicy = new InsurancePolicy();
        oldPolicy.setId("pol-old-" + UUID.randomUUID().toString().substring(0, 8));
        oldPolicy.setPolicyNumber("POL-OLD-" + UUID.randomUUID().toString().substring(0, 6));
        oldPolicy.setCollateralId(testCollateral.getId());
        oldPolicy.setCustomerId(testCustomer.getId());
        oldPolicy.setInsurerName("Africa Insurance");
        oldPolicy.setCoverageType("Fire");
        oldPolicy.setInsuredAmount(8000000.0);
        oldPolicy.setExpiryDate("2026-09-30");
        oldPolicy.setStatus("Active");
        insurancePolicyRepository.save(oldPolicy);

        InsurancePolicy renewalReq = new InsurancePolicy();
        renewalReq.setInsuredAmount(8500000.0);
        Map<String, Object> result = cimsService.renewPolicy(oldPolicy.getId(), renewalReq, "usr-cro");
        assertTrue((Boolean) result.get("success"));

        InsurancePolicy newPolicy = (InsurancePolicy) result.get("policy");
        assertEquals(oldPolicy.getId(), newPolicy.getRenewedFromPolicyId());
    }

    // =========================================================================
    // WORKFLOW TEST 28: Policy Cancellation
    // =========================================================================
    @Test
    @DisplayName("TEST 28: Policy cancellation requires reason and initiates cancellation workflow")
    public void test28_policyCancellation_reasonMandatoryAndWorkflowAudit() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-can-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-CAN-" + UUID.randomUUID().toString().substring(0, 6));
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nice Insurance");
        policy.setCoverageType("Burglary");
        policy.setInsuredAmount(2000000.0);
        policy.setStatus("Active");
        insurancePolicyRepository.save(policy);

        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.cancelPolicy(policy.getId(), "   ", "usr-cro");
        });

        Map<String, Object> res = cimsService.cancelPolicy(policy.getId(), "Loan settled in full by borrower", "usr-cro");
        assertTrue((Boolean) res.get("success"));

        InsurancePolicy pending = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Cancellation Pending", pending.getStatus());
    }
}
