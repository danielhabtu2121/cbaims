package com.bank.cims;

import com.bank.cims.dto.Collateral360Dto;
import com.bank.cims.dto.WorkflowActionResultDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.ValidationService;
import com.bank.cims.service.WorkflowExecutionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class CollateralModule2IntegrationTest {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private Customer testCustomerA;
    private Customer testCustomerB;
    private LoanAccount testLoanA1;
    private LoanAccount testLoanA2;
    private LoanAccount testLoanB1;

    @BeforeEach
    public void setup() {
        String uid = UUID.randomUUID().toString().substring(0, 6);

        testCustomerA = new Customer();
        testCustomerA.setId("cust-a-" + uid);
        testCustomerA.setCif("CUST-A-" + uid);
        testCustomerA.setName("Abyssinia Trading Enterprise PLC");
        testCustomerA.setCustomerType("Corporate");
        testCustomerA.setSegment("Corporate Banking");
        testCustomerA.setBranch("Addis Ababa Main Branch");
        testCustomerA.setStatus("Active");
        testCustomerA.setRecordStat("O");
        testCustomerA.setAuthStat("A");
        customerRepository.save(testCustomerA);

        testCustomerB = new Customer();
        testCustomerB.setId("cust-b-" + uid);
        testCustomerB.setCif("CUST-B-" + uid);
        testCustomerB.setName("Blue Nile Logistics Ltd");
        testCustomerB.setCustomerType("Corporate");
        testCustomerB.setSegment("Commercial Banking");
        testCustomerB.setBranch("Bole Branch");
        testCustomerB.setStatus("Active");
        testCustomerB.setRecordStat("O");
        testCustomerB.setAuthStat("A");
        customerRepository.save(testCustomerB);

        testLoanA1 = new LoanAccount();
        testLoanA1.setId("loan-a1-" + uid);
        testLoanA1.setLoanReference("LN-EXP-A1-" + uid);
        testLoanA1.setCustomerId(testCustomerA.getId());
        testLoanA1.setFacilityType("Term Loan");
        testLoanA1.setApprovedLimit(50_000_000.0);
        testLoanA1.setOutstandingBalance(35_000_000.0);
        testLoanA1.setAvailableAmount(15_000_000.0);
        testLoanA1.setLineCurrency("ETB");
        testLoanA1.setSegment("Corporate Banking");
        testLoanA1.setBranch("Addis Ababa Main Branch");
        testLoanA1.setStatus("Active");
        loanAccountRepository.save(testLoanA1);

        testLoanA2 = new LoanAccount();
        testLoanA2.setId("loan-a2-" + uid);
        testLoanA2.setLoanReference("LN-REV-A2-" + uid);
        testLoanA2.setCustomerId(testCustomerA.getId());
        testLoanA2.setFacilityType("Revolving Overdraft");
        testLoanA2.setApprovedLimit(30_000_000.0);
        testLoanA2.setOutstandingBalance(20_000_000.0);
        testLoanA2.setAvailableAmount(10_000_000.0);
        testLoanA2.setLineCurrency("ETB");
        testLoanA2.setSegment("Corporate Banking");
        testLoanA2.setBranch("Addis Ababa Main Branch");
        testLoanA2.setStatus("Active");
        loanAccountRepository.save(testLoanA2);

        testLoanB1 = new LoanAccount();
        testLoanB1.setId("loan-b1-" + uid);
        testLoanB1.setLoanReference("LN-LOG-B1-" + uid);
        testLoanB1.setCustomerId(testCustomerB.getId());
        testLoanB1.setFacilityType("Letter of Credit");
        testLoanB1.setApprovedLimit(25_000_000.0);
        testLoanB1.setOutstandingBalance(10_000_000.0);
        testLoanB1.setAvailableAmount(15_000_000.0);
        testLoanB1.setLineCurrency("ETB");
        testLoanB1.setSegment("Commercial Banking");
        testLoanB1.setBranch("Bole Branch");
        testLoanB1.setStatus("Active");
        loanAccountRepository.save(testLoanB1);
    }

    private Collateral createTestCollateral(String code, double value, double haircut, String ownerName, String ownershipType) {
        String id = "col-" + UUID.randomUUID().toString().substring(0, 8);
        Collateral col = new Collateral();
        col.setId(id);
        col.setCode(code);
        col.setCustomerId(testCustomerA.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setDescription("Commercial Office Complex - 8 Storey Building");
        col.setValuationAmount(value);
        col.setHaircut(haircut);
        double nsv = value * (1.0 - (haircut / 100.0));
        col.setNsv(nsv);
        col.setLimitContribution(nsv);
        col.setCurrency("ETB");
        col.setOwnerType(ownershipType != null ? ownershipType : "Borrower-owned");
        col.setOwningSegment("Corporate Banking");
        col.setBranch("Addis Ababa Main Branch");
        col.setStatus("Active");
        col.setAuthStat("A");
        col.setRecordStat("O");

        CollateralOwner owner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 6),
                ownerName != null ? ownerName : testCustomerA.getName(), "+251911223344", id, "Borrower", 100.0);
        owner.setOwnershipType(col.getOwnerType());
        owner.setOwnerType("Corporate");
        owner.setTin("0012345678");
        owner.setStatus("Active");
        owner.setEffectiveFrom("2026-01-01");
        owner.setVerificationStatus("Verified");

        List<CollateralOwner> owners = new ArrayList<>();
        owners.add(owner);
        col.setOwners(owners);

        return collateralRepository.save(col);
    }

    @Test
    @DisplayName("Test 1: Single Facility Link & Allocation (1 Collateral -> 1 Loan)")
    public void test1_singleFacilityLinkAndAllocation() {
        Collateral col = createTestCollateral("COL-MOD2-T1", 80_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");
        // NSV = 80M * 0.8 = 64M

        cimsService.addLink(testLoanA1.getId(), col.getId(), 35_000_000.0, "RO_MAKER");

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        assertEquals(1, links.size());
        LoanCollateralLink link = links.get(0);

        assertEquals("Active", link.getStatus());
        assertEquals(35_000_000.0, link.getAllocatedAmount(), 0.01);
        assertEquals(testLoanA1.getId(), link.getLoanAccountId());
        assertEquals(testCustomerA.getId(), link.getCustomerId());

        Collateral updatedCol = collateralRepository.findById(col.getId()).orElseThrow();
        assertEquals(35_000_000.0, updatedCol.getCurrentAllocation(), 0.01);
        assertEquals((35_000_000.0 / 64_000_000.0) * 100.0, updatedCol.getUtilizationPercentage(), 0.01);
    }

    @Test
    @DisplayName("Test 2: Multi-Collateral to Single Facility (Many Collaterals -> 1 Loan)")
    public void test2_multiCollateralToSingleFacility() {
        Collateral col1 = createTestCollateral("COL-MOD2-T2-A", 40_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");
        Collateral col2 = createTestCollateral("COL-MOD2-T2-B", 30_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");

        cimsService.addLink(testLoanA1.getId(), col1.getId(), 20_000_000.0, "RO_MAKER");
        cimsService.addLink(testLoanA1.getId(), col2.getId(), 15_000_000.0, "RO_MAKER");

        List<LoanCollateralLink> linksForLoan = loanCollateralLinkRepository.findByLoanAccountId(testLoanA1.getId());
        assertEquals(2, linksForLoan.size());

        double totalAllocated = linksForLoan.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(35_000_000.0, totalAllocated, 0.01);
    }

    @Test
    @DisplayName("Test 3: Cross-Collateralization (1 Collateral -> Multiple Facilities)")
    public void test3_crossCollateralization() {
        Collateral col = createTestCollateral("COL-MOD2-T3-CROSS", 100_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");
        // NSV = 80M. Facility A1 takes 30M, Facility A2 takes 20M -> Total 50M <= 80M

        cimsService.addLink(testLoanA1.getId(), col.getId(), 30_000_000.0, "RO_MAKER");
        cimsService.addLink(testLoanA2.getId(), col.getId(), 20_000_000.0, "RO_MAKER");

        Collateral360Dto dto360 = cimsService.getCollateral360(col.getId());
        assertTrue(dto360.isCrossCollateralized(), "Collateral securing multiple facilities must be flagged as cross-collateralized");
        assertEquals(2, dto360.getLinkedFacilities().size());
        assertEquals(50_000_000.0, dto360.getTotalAllocatedAmount(), 0.01);
        assertEquals(30_000_000.0, dto360.getUnallocatedAmount(), 0.01); // 80M - 50M = 30M
    }

    @Test
    @DisplayName("Test 4: Third-Party Owned Collateral Supporting Borrower Facilities")
    public void test4_thirdPartyOwnerCollateral() {
        Collateral col = createTestCollateral("COL-MOD2-T4-TP", 90_000_000.0, 20.0, "Parent Holding Group S.C.", "Third Party");
        // Update owner details with third party metadata
        CollateralOwner tpOwner = col.getOwners().get(0);
        tpOwner.setOwnershipType("Third Party");
        tpOwner.setRelationshipToBorrower("Parent Company");
        tpOwner.setConsentInfo("Board Resolution BR-2026-088 dated 2026-01-15");
        tpOwner.setPledgeAgreementRef("PLG-AGR-2026-992");
        collateralRepository.save(col);

        // Third party collateral can secure testLoanA1
        cimsService.addLink(testLoanA1.getId(), col.getId(), 35_000_000.0, "RO_MAKER");

        Collateral360Dto dto360 = cimsService.getCollateral360(col.getId());
        assertEquals("Third Party", dto360.getCollateral().getOwnerType());
        assertEquals(1, dto360.getActiveOwners().size());
        assertEquals("Parent Holding Group S.C.", dto360.getActiveOwners().get(0).getName());
        assertEquals("Parent Company", dto360.getActiveOwners().get(0).getRelationshipToBorrower());
    }

    @Test
    @DisplayName("Test 5: Ownership Transfer Retaining Historical Owner and Audit Trail")
    public void test5_ownershipTransferWithHistoricalRetention() {
        Collateral col = createTestCollateral("COL-MOD2-T5-TRF", 50_000_000.0, 10.0, "Original Owner Ato Bekele", "Individual");
        String originalOwnerId = col.getOwners().get(0).getId();

        Map<String, Object> transferPayload = new HashMap<>();
        transferPayload.put("currentOwnerId", originalOwnerId);
        transferPayload.put("newOwnerName", "Transferee W/ro Chaltu");
        transferPayload.put("newOwnershipType", "Third Party");
        transferPayload.put("newOwnerType", "Individual");
        transferPayload.put("ownershipPercentage", 100.0);
        transferPayload.put("relationshipToBorrower", "Business Partner");
        transferPayload.put("reason", "Property deed transferred by court decree 4492");
        transferPayload.put("supportingDocRef", "DOC-TRANSFER-4492");

        Map<String, Object> resp = cimsService.changeCollateralOwnership(col.getId(), transferPayload, "CRO_OFFICER");
        assertTrue((Boolean) resp.get("success"));

        Collateral360Dto dto360 = cimsService.getCollateral360(col.getId());

        // 1. Active owner is now W/ro Chaltu
        assertEquals(1, dto360.getActiveOwners().size());
        assertEquals("Transferee W/ro Chaltu", dto360.getActiveOwners().get(0).getName());
        assertEquals("Active", dto360.getActiveOwners().get(0).getStatus());

        // 2. Original owner Ato Bekele is retained in Historical list
        assertEquals(1, dto360.getHistoricalOwners().size());
        assertEquals("Original Owner Ato Bekele", dto360.getHistoricalOwners().get(0).getName());
        assertEquals("Historical", dto360.getHistoricalOwners().get(0).getStatus());
        assertNotNull(dto360.getHistoricalOwners().get(0).getEffectiveTo());

        // 3. Audit trail exists
        boolean auditFound = dto360.getAuditHistory().stream()
                .anyMatch(a -> "CHANGE_COLLATERAL_OWNERSHIP".equalsIgnoreCase(a.getActionType()));
        assertTrue(auditFound, "Ownership transfer must generate an audit record");
    }

    @Test
    @DisplayName("Test 6: Duplicate Active Link Rejection")
    public void test6_duplicateActiveLinkRejected() {
        Collateral col = createTestCollateral("COL-MOD2-T6-DUP", 50_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");

        // First link succeeds
        cimsService.addLink(testLoanA1.getId(), col.getId(), 20_000_000.0, "RO_MAKER");

        // Second identical active link must be rejected
        Exception ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.addLink(testLoanA1.getId(), col.getId(), 10_000_000.0, "RO_MAKER");
        });
        assertTrue(ex.getMessage().contains("already actively linked") || ex.getMessage().contains("Duplicate"),
                "Expected rejection of duplicate active link, got: " + ex.getMessage());
    }

    @Test
    @DisplayName("Test 7: Collateral Release Blocked When Active Exposure Remains, Allowed Once Settled")
    public void test7_collateralReleaseBlockedWhenActiveExposureRemains() {
        Collateral col = createTestCollateral("COL-MOD2-T7-REL", 60_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");
        cimsService.addLink(testLoanA1.getId(), col.getId(), 25_000_000.0, "RO_MAKER");

        // loanA1 has outstandingBalance = 35_000_000.0 > 0 -> Release must be blocked
        Map<String, Object> validationRes = cimsService.validateCollateralRelease(col.getId());
        assertFalse((Boolean) validationRes.get("eligible"), "Release must not be eligible when loan has outstanding balance");
        assertNotNull(validationRes.get("reasons"));

        // Attempting to request release directly must throw
        Exception ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.requestCollateralRelease(col.getId(), "Borrower requested early release", "RO_MAKER");
        });
        assertTrue(ex.getMessage().contains("remains linked to Loan") || ex.getMessage().contains("outstanding secured exposure"),
                "Expected release block message with outstanding balance details, got: " + ex.getMessage());

        // Now settle the loan
        testLoanA1.setOutstandingBalance(0.0);
        loanAccountRepository.save(testLoanA1);

        // Validation now succeeds
        Map<String, Object> clearedRes = cimsService.validateCollateralRelease(col.getId());
        assertTrue((Boolean) clearedRes.get("eligible"), "Release should be eligible after facility is settled");

        // Request release now succeeds and submits to workflow
        Map<String, Object> releaseResp = cimsService.requestCollateralRelease(col.getId(), "Facility fully settled", "RO_MAKER");
        assertTrue((Boolean) releaseResp.get("success"));
        assertNotNull(releaseResp.get("workflowTaskId"));
    }

    @Test
    @DisplayName("Test 8: Joint Ownership Percentage Validation")
    public void test8_jointOwnershipPercentageValidation() {
        Collateral col = createTestCollateral("COL-MOD2-T8-JOINT", 40_000_000.0, 10.0, "Partner 1", "Joint");
        col.setOwnerType("Joint");

        CollateralOwner o1 = new CollateralOwner("own-j1", "Partner 1", "+251911111111", col.getId(), "Joint Owner", 60.0);
        o1.setStatus("Active");
        CollateralOwner o2 = new CollateralOwner("own-j2", "Partner 2", "+251922222222", col.getId(), "Joint Owner", 50.0);
        o2.setStatus("Active");

        col.setOwners(new ArrayList<>(List.of(o1, o2)));

        // 60% + 50% = 110% != 100% -> must be rejected
        Exception ex = assertThrows(IllegalArgumentException.class, () -> {
            validationService.validateJointOwnership(col.getOwners());
        });
        assertTrue(ex.getMessage().contains("100.00%"),
                "Expected joint percentage validation error, got: " + ex.getMessage());

        // Correct to 60% + 40% = 100% -> passes
        o2.setPercentage(40.0);
        assertDoesNotThrow(() -> validationService.validateJointOwnership(col.getOwners()));
    }

    @Test
    @DisplayName("Test 9: Allocation Capacity Overflow Rejection")
    public void test9_allocationCapacityOverflowRejected() {
        Collateral col = createTestCollateral("COL-MOD2-T9-OVERFLOW", 100_000_000.0, 20.0, "Abyssinia Trading", "Borrower-owned");
        // NSV = 80,000,000.0

        // Allocate 50M -> Success
        cimsService.addLink(testLoanA1.getId(), col.getId(), 50_000_000.0, "RO_MAKER");

        // Attempt to allocate another 40M (Total 90M > 80M NSV) -> Rejected
        Exception ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.addLink(testLoanA2.getId(), col.getId(), 40_000_000.0, "RO_MAKER");
        });
        assertTrue(ex.getMessage().contains("exceeds net collateral value"),
                "Expected allocation overflow rejection, got: " + ex.getMessage());
    }

    @Test
    @DisplayName("Test 10: Non-Destructive Link Reallocation & Full Maker-Checker Workflow Agreement")
    public void test10_approvalWorkflowDeterministicTransitions() {
        String uid = UUID.randomUUID().toString().substring(0, 6);
        Collateral newCol = new Collateral();
        newCol.setId("col-wf-" + uid);
        newCol.setCode("COL-WF-" + uid);
        newCol.setCustomerId(testCustomerA.getId());
        newCol.setCategory("Immovable Properties");
        newCol.setType("Buildings - Commercial");
        newCol.setDescription("Maker Checker Test Collateral");
        newCol.setValuationAmount(70_000_000.0);
        newCol.setHaircut(20.0);
        newCol.setCurrency("ETB");
        newCol.setOwnerType("Borrower-owned");
        newCol.setOwningSegment("Corporate Banking");
        newCol.setBranch("Addis Ababa Main Branch");

        CollateralOwner owner = new CollateralOwner("own-wf-" + uid, testCustomerA.getName(), "+251911000000", newCol.getId(), "Borrower", 100.0);
        owner.setStatus("Active");
        newCol.setOwners(List.of(owner));

        List<Map<String, Object>> allocations = List.of(
                Map.of("facilityId", testLoanA1.getId(), "allocatedAmount", 30_000_000.0, "linkageType", "Primary")
        );

        List<Map<String, Object>> documents = List.of(
                Map.of("name", "Commercial Building Plan", "type", "Approved Building Plan", "fileContent", "JVBERi0xLjQK..."),
                Map.of("name", "Title Deed Certificate", "type", "Title Deed / Ownership Certificate", "fileContent", "JVBERi0xLjQK...")
        );

        // 1. Submit Collateral with allocations and mandatory documents
        Map<String, Object> regResp = cimsService.registerCollateralWithAllocations(newCol, allocations, documents, "RO_MAKER");
        assertTrue((Boolean) regResp.get("success"));
        String taskId = (String) regResp.get("workflowTaskId");
        assertNotNull(taskId);

        // Verify Pending Approval state in DB
        Collateral savedCol = collateralRepository.findById(newCol.getId()).orElseThrow();
        assertEquals("Pending Approval", savedCol.getStatus());
        List<LoanCollateralLink> pendingLinks = loanCollateralLinkRepository.findByCollateralId(newCol.getId());
        assertEquals(1, pendingLinks.size());
        assertEquals("Pending Approval", pendingLinks.get(0).getStatus());

        // 2. Checker approves
        WorkflowActionResultDto approveRes = workflowExecutionService.approveWorkflowTask(taskId, "BRMGR_USER", "BRMGR", "Collateral valuation verified");
        assertTrue(approveRes.isSuccess());

        // Verify Active state in DB
        Collateral approvedCol = collateralRepository.findById(newCol.getId()).orElseThrow();
        assertEquals("Active", approvedCol.getStatus());
        assertEquals("A", approvedCol.getAuthStat());
        List<LoanCollateralLink> activeLinks = loanCollateralLinkRepository.findByCollateralId(newCol.getId());
        assertEquals("Active", activeLinks.get(0).getStatus());

        // 3. Non-destructive reallocation: change allocation to Loan A2
        List<Map<String, Object>> reallocations = List.of(
                Map.of("facilityId", testLoanA2.getId(), "allocatedAmount", 25_000_000.0, "linkageType", "Primary")
        );
        cimsService.allocateCollateralFacilities(approvedCol.getId(), reallocations, "RO_MAKER");

        List<LoanCollateralLink> allLinks = loanCollateralLinkRepository.findByCollateralId(approvedCol.getId());
        assertEquals(2, allLinks.size(), "Both the historical and active links must exist");

        LoanCollateralLink historicalLink = allLinks.stream().filter(l -> l.getLoanAccountId().equals(testLoanA1.getId())).findFirst().orElseThrow();
        assertEquals("Historical", historicalLink.getStatus());
        assertNotNull(historicalLink.getEndDate());

        LoanCollateralLink currentLink = allLinks.stream().filter(l -> l.getLoanAccountId().equals(testLoanA2.getId())).findFirst().orElseThrow();
        assertEquals("Active", currentLink.getStatus());
        assertEquals(25_000_000.0, currentLink.getAllocatedAmount(), 0.01);
    }
}
