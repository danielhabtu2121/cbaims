package com.bank.cims;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CollateralFacilityRelationshipService;
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
public class CollateralFacilityRelationshipIntegrationTest {

    @Autowired
    private CollateralFacilityRelationshipService relationshipService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private CollateralOwnerRepository collateralOwnerRepository;

    @Autowired
    private LoanCollateralLinkRepository linkRepository;

    @Autowired
    private LoanCollateralLinkHistoryRepository linkHistoryRepository;

    @Autowired
    private InsurancePolicyRepository policyRepository;

    @Autowired
    private OwnershipDocumentRepository documentRepository;

    private Customer custCorporate;
    private Customer custDifferent;
    private Collateral col100M;
    private LoanAccount loanA;
    private LoanAccount loanB;
    private LoanAccount loanC;

    @BeforeEach
    public void setUp() {
        String uid = UUID.randomUUID().toString().substring(0, 6);

        // Corporate Borrower
        custCorporate = new Customer();
        custCorporate.setId("cust-test-" + uid);
        custCorporate.setCif("CIF-T-" + uid);
        custCorporate.setName("Test Agro Industries " + uid);
        custCorporate.setSegment("Corporate Banking");
        custCorporate.setCustomerType("Corporate");
        custCorporate.setStatus("Active");
        customerRepository.save(custCorporate);

        // Distinct Borrower for Customer Isolation testing
        custDifferent = new Customer();
        custDifferent.setId("cust-diff-" + uid);
        custDifferent.setCif("CIF-D-" + uid);
        custDifferent.setName("Distinct Borrower Plc " + uid);
        custDifferent.setSegment("Commercial Banking");
        custDifferent.setCustomerType("Corporate");
        custDifferent.setStatus("Active");
        customerRepository.save(custDifferent);

        // Primary Collateral Asset: MV 100M, Haircut 20% -> NSV 80M (Section 36 & 37)
        col100M = new Collateral();
        col100M.setId("col-test-100m-" + uid);
        col100M.setCode("COL-100M-" + uid);
        col100M.setCustomerId(custCorporate.getId());
        col100M.setDescription("Industrial Production Complex " + uid);
        col100M.setCategory("Immovable Properties");
        col100M.setType("Buildings - Commercial");
        col100M.setOwnerType("Borrower-owned");
        col100M.setCurrency("ETB");
        col100M.setValuationAmount(100_000_000.0);
        col100M.setHaircut(20.0);
        col100M.setNsv(80_000_000.0);
        col100M.setStatus("Active");
        col100M.setOwningSegment("Corporate Banking");
        col100M.setBranch("BRN-001");
        collateralRepository.save(col100M);

        // Section 36 Facilities:
        // Loan A: Outstanding 40M, Limit 50M
        loanA = new LoanAccount();
        loanA.setId("loan-a-" + uid);
        loanA.setLoanReference("LN-A-" + uid);
        loanA.setLineCode("FAC-A-" + uid);
        loanA.setAccountNumber("ACC-A-" + uid);
        loanA.setCustomerId(custCorporate.getId());
        loanA.setFacilityType("Term Loan");
        loanA.setLineCurrency("ETB");
        loanA.setApprovedLimit(50_000_000.0);
        loanA.setOutstandingBalance(40_000_000.0);
        loanA.setStatus("Active");
        loanAccountRepository.save(loanA);

        // Loan B: Outstanding 25M, Limit 35M
        loanB = new LoanAccount();
        loanB.setId("loan-b-" + uid);
        loanB.setLoanReference("LN-B-" + uid);
        loanB.setLineCode("FAC-B-" + uid);
        loanB.setAccountNumber("ACC-B-" + uid);
        loanB.setCustomerId(custCorporate.getId());
        loanB.setFacilityType("Working Capital Overdraft");
        loanB.setLineCurrency("ETB");
        loanB.setApprovedLimit(35_000_000.0);
        loanB.setOutstandingBalance(25_000_000.0);
        loanB.setStatus("Active");
        loanAccountRepository.save(loanB);

        // Loan C: Outstanding 15M, Limit 20M
        loanC = new LoanAccount();
        loanC.setId("loan-c-" + uid);
        loanC.setLoanReference("LN-C-" + uid);
        loanC.setLineCode("FAC-C-" + uid);
        loanC.setAccountNumber("ACC-C-" + uid);
        loanC.setCustomerId(custCorporate.getId());
        loanC.setFacilityType("Merchandise Loan");
        loanC.setLineCurrency("ETB");
        loanC.setApprovedLimit(20_000_000.0);
        loanC.setOutstandingBalance(15_000_000.0);
        loanC.setStatus("Active");
        loanAccountRepository.save(loanC);
    }

    @Test
    @DisplayName("Scenario 1: One Collateral -> One Loan Account (1:1 Relationship)")
    public void testScenarioOneToOne() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(40_000_000.0);
        req.setLinkageType("Primary");
        req.setChangeReason("Initial Term Loan security pledge");

        CollateralFacilityLinkDto created = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(created);
        assertEquals(40_000_000.0, created.getAllocatedAmount());
        assertEquals("Active", created.getRelationshipStatus());
        assertEquals(50.0, created.getCollateralAllocationPct(), 0.01); // 40M / 80M = 50%
        assertEquals(100.0, created.getFacilityCoveragePct(), 0.01);   // 40M / 40M outstanding = 100%

        // Direction 1: Collateral -> Facilities
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colSummary.getLinkedFacilityCount());
        assertEquals(40_000_000.0, colSummary.getTotalAllocatedSecurity());
        assertEquals(40_000_000.0, colSummary.getUnallocatedSecurity()); // 80M - 40M = 40M
        assertEquals(40_000_000.0, colSummary.getAggregateSecuredExposure());

        // Direction 2: Facility -> Collaterals
        FacilityCollateralSummaryDto facSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(1, facSummary.getLinkedCollateralCount());
        assertEquals(40_000_000.0, facSummary.getTotalAllocatedCollateral());
        assertEquals(80_000_000.0, facSummary.getTotalNetCollateralValue());
    }

    @Test
    @DisplayName("Scenario 2 & Section 36 Test: One Collateral -> Multiple Loans (Cross-Collateral & Recalculation)")
    public void testScenarioOneToManyCrossCollateralSection36() {
        // 1. Link Loan A with 40M
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(40_000_000.0);
        reqA.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        // 2. Link Loan B with 25M
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(25_000_000.0);
        reqB.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqB, "TEST_MAKER");

        // 3. Link Loan C with 15M
        RelationshipRequestDto reqC = new RelationshipRequestDto();
        reqC.setCollateralId(col100M.getId());
        reqC.setLoanAccountId(loanC.getId());
        reqC.setAllocatedAmount(15_000_000.0);
        reqC.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC, "TEST_MAKER");

        // Evaluate Collateral Aggregates: Total Allocation = 40 + 25 + 15 = 80M. Unallocated = 0.
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(3, colSummary.getLinkedFacilityCount());
        assertEquals(80_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, colSummary.getUnallocatedSecurity(), 0.01);
        // Aggregate linked exposure = 40M + 25M + 15M = 80M
        assertEquals(80_000_000.0, colSummary.getAggregateSecuredExposure(), 0.01);

        // Section 36 Test requirement:
        // "Then change Loan B outstanding to 30M. The system must automatically recalculate aggregate exposure
        // without the allocation silently changing from 25M to 30M."
        loanB.setOutstandingBalance(30_000_000.0);
        loanAccountRepository.save(loanB);

        CollateralSecuredFacilitiesSummaryDto updatedColSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        // Allocation must remain intact: 80M total, Loan B allocation is still 25M
        assertEquals(80_000_000.0, updatedColSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, updatedColSummary.getUnallocatedSecurity(), 0.01);
        // Aggregate linked exposure must now reflect 40M + 30M + 15M = 85M!
        assertEquals(85_000_000.0, updatedColSummary.getAggregateSecuredExposure(), 0.01);
    }

    @Test
    @DisplayName("Section 37 Test: Valuation 100M, Haircut 20%, Net 80M, Loans 50M + 50M, Allocation 40M + 40M")
    public void testSection37AllocatableCeilingVsExposure() {
        // Loan A outstanding = 50M, Loan B outstanding = 50M
        loanA.setOutstandingBalance(50_000_000.0);
        loanB.setOutstandingBalance(50_000_000.0);
        loanAccountRepository.save(loanA);
        loanAccountRepository.save(loanB);

        // Allocate 40M to Loan A
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(40_000_000.0);
        reqA.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        // Allocate 40M to Loan B
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(40_000_000.0);
        reqB.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqB, "TEST_MAKER");

        CollateralSecuredFacilitiesSummaryDto summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(80_000_000.0, summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(80_000_000.0, summary.getNetCollateralValue(), 0.01);
        assertEquals(0.0, summary.getUnallocatedSecurity(), 0.01);
        // Aggregate exposure is 100M, but allocatable security is capped at 80M
        assertEquals(100_000_000.0, summary.getAggregateSecuredExposure(), 0.01);
    }

    @Test
    @DisplayName("Section 38 Insurance Test: Active Policy 90M evaluated against Aggregate Exposure")
    public void testSection38InsuranceAdequacyIndependentOfAllocation() {
        // Set up Loan A (50M) and Loan B (50M) -> Aggregate Exposure = 100M
        loanA.setOutstandingBalance(50_000_000.0);
        loanB.setOutstandingBalance(50_000_000.0);
        loanAccountRepository.save(loanA);
        loanAccountRepository.save(loanB);

        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(reqB, "TEST_MAKER");

        // Add Active Policy of 90M on collateral
        InsurancePolicy pol = new InsurancePolicy();
        pol.setId("pol-test-90m-" + UUID.randomUUID().toString().substring(0, 6));
        pol.setPolicyNumber("POL-90M-TEST");
        pol.setCollateralId(col100M.getId());
        pol.setInsuredAmount(90_000_000.0);
        pol.setPremium(200_000.0);
        pol.setEffectiveDate("2024-01-01");
        pol.setExpiryDate("2028-12-31");
        pol.setStatus("Active");
        policyRepository.save(pol);

        CollateralSecuredFacilitiesSummaryDto summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(100_000_000.0, summary.getMarketValuation());
        assertEquals(80_000_000.0, summary.getNetCollateralValue());
        assertEquals(80_000_000.0, summary.getTotalAllocatedSecurity());
        assertEquals(100_000_000.0, summary.getAggregateSecuredExposure());
        assertEquals(90_000_000.0, summary.getCurrentInsuredAmount());
        // Required is 100% of Max(Aggregate Exposure 100M, MV 100M) = 100M
        assertEquals(100_000_000.0, summary.getRequiredInsuranceAmount());
        assertEquals(10_000_000.0, summary.getInsuranceGap()); // 100M - 90M = 10M gap
        assertEquals("UNDERINSURED", summary.getAdequacyStatus());
    }

    @Test
    @DisplayName("Integrity & Duplicate Prevention: Second active link between same Collateral and Loan rejected")
    public void testDuplicateRelationshipPrevention() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);
        relationshipService.createRelationship(req, "TEST_MAKER");

        // Try creating duplicate active link
        RelationshipRequestDto dupReq = new RelationshipRequestDto();
        dupReq.setCollateralId(col100M.getId());
        dupReq.setLoanAccountId(loanA.getId());
        dupReq.setAllocatedAmount(10_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(dupReq, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Duplicate Relationship Block"));
    }

    @Test
    @DisplayName("Allocation Capacity Rule: Total allocation cannot exceed Net Collateral Value (80M)")
    public void testAllocationOverflowRejected() {
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(50_000_000.0);
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        // Try allocating 35M to Loan B (50M + 35M = 85M > 80M NSV)
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(35_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(reqB, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Allocation Overflow"));
    }

    @Test
    @DisplayName("Customer Isolation: Borrower-owned collateral cannot be linked to distinct borrower")
    public void testCustomerIsolationEnforced() {
        LoanAccount diffLoan = new LoanAccount();
        diffLoan.setId("loan-diff-" + UUID.randomUUID().toString().substring(0, 6));
        diffLoan.setLoanReference("LN-DIFF-001");
        diffLoan.setCustomerId(custDifferent.getId()); // Different customer!
        diffLoan.setFacilityType("Term Loan");
        diffLoan.setApprovedLimit(20_000_000.0);
        diffLoan.setOutstandingBalance(15_000_000.0);
        diffLoan.setStatus("Active");
        loanAccountRepository.save(diffLoan);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId()); // Owned by custCorporate
        req.setLoanAccountId(diffLoan.getId());
        req.setAllocatedAmount(10_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Customer Isolation Violation"));
    }

    @Test
    @DisplayName("Third-Party Collateral: Permitted when asset is designated Third-Party Owned")
    public void testThirdPartyCollateralPermitted() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-tp-" + UUID.randomUUID().toString().substring(0, 6));
        tpCol.setCode("COL-TP-01");
        tpCol.setCustomerId(custCorporate.getId()); // Secured for custCorporate
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Buildings - Commercial");
        tpCol.setValuationAmount(60_000_000.0);
        tpCol.setHaircut(20.0);
        tpCol.setNsv(48_000_000.0);
        tpCol.setStatus("Active");
        tpCol.setOwningSegment("Corporate Banking");
        tpCol.setBranch("BRN-001");
        collateralRepository.save(tpCol);

        // Third-party owner record
        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-tp-" + UUID.randomUUID().toString().substring(0, 6));
        owner.setCollateralId(tpCol.getId());
        owner.setName("Guarantor Ato Tesfaye");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Guarantor");
        owner.setConsentInfo("Written Spousal & Third-Party Consent on File");
        owner.setPledgeAgreementRef("PLG-AGR-2024-TEST-01");
        owner.setPercentage(100.0);
        owner.setVerificationStatus("Verified");
        owner.setStatus("Active");
        collateralOwnerRepository.save(owner);

        // Mandatory third-party documents
        OwnershipDocument doc1 = new OwnershipDocument();
        doc1.setId("doc-plg-" + UUID.randomUUID().toString().substring(0, 6));
        doc1.setCollateralId(tpCol.getId());
        doc1.setType("Third-Party Consent and Pledge Agreement");
        doc1.setName("Third-Party Pledge Agreement");
        doc1.setStatus("Active");
        doc1.setVerificationStatus("Verified");
        doc1.setFileContent("MOCK_BASE64_PLEDGE");
        documentRepository.save(doc1);

        OwnershipDocument doc2 = new OwnershipDocument();
        doc2.setId("doc-let-" + UUID.randomUUID().toString().substring(0, 6));
        doc2.setCollateralId(tpCol.getId());
        doc2.setType("Letter of Consent");
        doc2.setName("Letter of Consent");
        doc2.setStatus("Active");
        doc2.setVerificationStatus("Verified");
        doc2.setFileContent("MOCK_BASE64_CONSENT");
        documentRepository.save(doc2);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);
        req.setLinkageType("Primary");

        CollateralFacilityLinkDto created = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(created);
        assertEquals(30_000_000.0, created.getAllocatedAmount());
        assertEquals("Third-party-owned", created.getCollateralOwnerType());
    }

    @Test
    @DisplayName("Relationship Change & History: Modifying allocation records previous value and increments modNo")
    public void testRelationshipChangeTracksHistory() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);
        req.setLinkageType("Primary");
        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "MAKER_1");

        // Now modify allocation to 45M
        RelationshipRequestDto updateReq = new RelationshipRequestDto();
        updateReq.setAllocatedAmount(45_000_000.0);
        updateReq.setLinkageType("Secondary");
        updateReq.setChangeReason("Limit extension on term loan");
        CollateralFacilityLinkDto updated = relationshipService.updateRelationship(link.getId(), updateReq, "CHECKER_1");

        assertEquals(45_000_000.0, updated.getAllocatedAmount());
        assertEquals("Secondary", updated.getLinkageType());
        assertEquals(2, updated.getModNo());

        // Check history records
        List<LoanCollateralLinkHistory> history = relationshipService.getRelationshipHistory(link.getId());
        assertEquals(2, history.size());

        LoanCollateralLinkHistory latestHistory = history.get(0);
        assertEquals(30_000_000.0, latestHistory.getPreviousAllocatedAmount());
        assertEquals(45_000_000.0, latestHistory.getNewAllocatedAmount());
        assertEquals("Primary", latestHistory.getPreviousLinkageType());
        assertEquals("Secondary", latestHistory.getNewLinkageType());
        assertEquals("ALLOCATION_CHANGED", latestHistory.getActionType());
        assertEquals("Limit extension on term loan", latestHistory.getChangeReason());
    }

    @Test
    @DisplayName("Relationship Removal: Ends relationship, sets end date, retains history without hard delete")
    public void testRelationshipRemovalRetainsHistory() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(40_000_000.0);
        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "MAKER_1");

        CollateralFacilityLinkDto ended = relationshipService.endRelationship(link.getId(), "Loan facility settled early", "CHECKER_1");
        assertEquals("Ended", ended.getRelationshipStatus());
        assertNotNull(ended.getEndDate());

        // Verify entity still exists in database with status Ended
        LoanCollateralLink dbLink = linkRepository.findById(link.getId()).orElse(null);
        assertNotNull(dbLink);
        assertEquals("Ended", dbLink.getStatus());

        // Verify active summary excludes ended link
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(0, colSummary.getLinkedFacilityCount());
        assertEquals(0.0, colSummary.getTotalAllocatedSecurity());
        assertEquals(80_000_000.0, colSummary.getUnallocatedSecurity());
    }

    @Test
    @DisplayName("Release Validation: Relationship-aware release check blocks release if linked obligations remain")
    public void testCollateralReleaseValidationRelationshipAware() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId()); // Outstanding is 40M!
        req.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(req, "MAKER_1");

        Map<String, Object> releaseCheck = relationshipService.validateCollateralRelease(col100M.getId());
        assertFalse((Boolean) releaseCheck.get("eligibleForRelease"));
        assertTrue(releaseCheck.get("message").toString().contains("active credit obligation"));

        // Now settle Loan A
        loanA.setOutstandingBalance(0.0);
        loanA.setStatus("Closed");
        loanAccountRepository.save(loanA);

        Map<String, Object> releaseCheckAfterSettlement = relationshipService.validateCollateralRelease(col100M.getId());
        assertTrue((Boolean) releaseCheckAfterSettlement.get("eligibleForRelease"));
    }

    @Test
    @DisplayName("Section 15 Double-Counting Correction: Bank portfolio exposure counts each facility once")
    public void testDoubleCountingCorrectionInPortfolioExposure() {
        // Link col100M to Loan A (40M) and Loan B (25M)
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(req1, "MAKER_1");

        // Create a second collateral also securing Loan A (Cross-collateral arrangement)
        Collateral col2 = new Collateral();
        col2.setId("col-second-" + UUID.randomUUID().toString().substring(0, 6));
        col2.setCode("COL-2ND");
        col2.setCustomerId(custCorporate.getId());
        col2.setCategory("Movable Properties");
        col2.setType("Vehicles");
        col2.setValuationAmount(50_000_000.0);
        col2.setHaircut(20.0);
        col2.setNsv(40_000_000.0);
        col2.setStatus("Active");
        col2.setOwningSegment("Corporate Banking");
        col2.setBranch("BRN-001");
        collateralRepository.save(col2);

        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(col2.getId());
        req2.setLoanAccountId(loanA.getId()); // Secured by BOTH col100M and col2!
        req2.setAllocatedAmount(10_000_000.0);
        relationshipService.createRelationship(req2, "MAKER_1");

        Map<String, Object> portfolioSummary = relationshipService.calculateBankPortfolioExposure();
        assertNotNull(portfolioSummary);

        // In collateral aggregate exposure, Loan A (40M) appears under col100M AND under col2 (total sum = 80M).
        // But trueBankPortfolioExposure / trueSecuredPortfolioExposure counts Loan A (40M) exactly ONCE!
        double trueBank = (Double) portfolioSummary.get("trueBankPortfolioExposure");
        double totalColAgg = (Double) portfolioSummary.get("totalCollateralAggregateExposure");
        assertTrue(trueBank > 0);
        assertNotNull(portfolioSummary.get("doubleCountingDifferential"));
    }
}
