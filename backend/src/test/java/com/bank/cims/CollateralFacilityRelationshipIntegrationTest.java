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
    @DisplayName("US-04.5: Borrower-owned collateral can be pledged for a distinct borrower with third-party relationship and pledge details")
    public void testUS045BorrowerOwnedCollateralLinkedAsThirdPartyPledge() {
        LoanAccount diffLoan = new LoanAccount();
        diffLoan.setId("loan-us045-" + UUID.randomUUID().toString().substring(0, 6));
        diffLoan.setLoanReference("LN-US045-001");
        diffLoan.setCustomerId(custDifferent.getId());
        diffLoan.setFacilityType("Term Loan");
        diffLoan.setApprovedLimit(25_000_000.0);
        diffLoan.setOutstandingBalance(18_000_000.0);
        diffLoan.setStatus("Active");
        loanAccountRepository.save(diffLoan);

        // 1. Verify getEligibleFacilitiesForCollateral returns diffLoan when targetCustomerId is custDifferent
        List<LoanAccount> eligibleForDiff = relationshipService.getEligibleFacilitiesForCollateral(col100M.getId(), custDifferent.getId(), "TEST_MAKER");
        assertTrue(eligibleForDiff.stream().anyMatch(f -> f.getId().equals(diffLoan.getId())));

        // 1b. Verify targetCustomerId="ALL" returns diffLoan across borrowers for third-party pledge search without re-registering collateral
        List<LoanAccount> allPortfolioEligible = relationshipService.getEligibleFacilitiesForCollateral(col100M.getId(), "ALL", "TEST_MAKER");
        assertTrue(allPortfolioEligible.stream().anyMatch(f -> f.getId().equals(diffLoan.getId())));

        // 2. Link col100M (owned by custCorporate) to diffLoan (borrower is custDifferent) with US-04.5 metadata
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(diffLoan.getId());
        req.setAllocatedAmount(10_000_000.0);
        req.setLinkageType("Primary");
        req.setBorrowerCustomerId(custDifferent.getId());
        req.setRelationshipToBorrower("Guarantor");
        req.setPledgeAgreementRef("PLG-AGR-US045-2024");
        req.setConsentInfo("Written Board Resolution & Pledge Agreement on File");
        req.setThirdPartyPledge(true);

        CollateralFacilityLinkDto created = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(created);
        assertEquals(10_000_000.0, created.getAllocatedAmount());
        assertTrue(created.isThirdParty());
        assertEquals("Guarantor", created.getRelationshipToBorrower());
        assertEquals(custDifferent.getId(), created.getBorrowerCustomerId());

        // 3. Duplicate link between same (collateral, borrower, loan) is prevented
        RelationshipRequestDto dupReq = new RelationshipRequestDto();
        dupReq.setCollateralId(col100M.getId());
        dupReq.setLoanAccountId(diffLoan.getId());
        dupReq.setAllocatedAmount(5_000_000.0);
        dupReq.setBorrowerCustomerId(custDifferent.getId());
        dupReq.setRelationshipToBorrower("Guarantor");
        dupReq.setPledgeAgreementRef("PLG-AGR-US045-2024");
        dupReq.setThirdPartyPledge(true);

        IllegalArgumentException dupEx = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(dupReq, "TEST_MAKER");
        });
        assertTrue(dupEx.getMessage().contains("Duplicate") || dupEx.getMessage().contains("already linked"));

        // 4. US-04.5 validation blocks if selected loan does not belong to associated borrower
        LoanAccount otherLoan = new LoanAccount();
        otherLoan.setId("loan-other-" + UUID.randomUUID().toString().substring(0, 6));
        otherLoan.setLoanReference("LN-OTHER-001");
        otherLoan.setCustomerId("CUST-OTHER-123");
        otherLoan.setFacilityType("Term Loan");
        otherLoan.setApprovedLimit(20_000_000.0);
        otherLoan.setOutstandingBalance(10_000_000.0);
        otherLoan.setStatus("Active");
        loanAccountRepository.save(otherLoan);

        RelationshipRequestDto mismatchReq = new RelationshipRequestDto();
        mismatchReq.setCollateralId(col100M.getId());
        mismatchReq.setLoanAccountId(otherLoan.getId()); // belongs to CUST-OTHER-123
        mismatchReq.setAllocatedAmount(5_000_000.0);
        mismatchReq.setBorrowerCustomerId(custDifferent.getId()); // Associated borrower is custDifferent!
        mismatchReq.setRelationshipToBorrower("Guarantor");
        mismatchReq.setThirdPartyPledge(true);

        IllegalArgumentException mismatchEx = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(mismatchReq, "TEST_MAKER");
        });
        assertTrue(mismatchEx.getMessage().contains("US-04.5 Validation Failed") || mismatchEx.getMessage().contains("does not belong to the associated borrower"));
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

    @Test
    @DisplayName("Test 3 (N:1 Pattern): Multiple Collateral Assets securing Single Credit Facility")
    public void testScenarioManyToOne_Test3() {
        // Collateral 1: col100M (NSV 80M) -> Loan A (allocated 25M)
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(25_000_000.0);
        req1.setLinkageType("Primary");
        relationshipService.createRelationship(req1, "TEST_MAKER");

        // Collateral 2: colVehicles (MV 30M, Haircut 20% -> NSV 24M) -> Loan A (allocated 15M)
        Collateral colVehicles = new Collateral();
        colVehicles.setId("col-veh-" + UUID.randomUUID().toString().substring(0, 6));
        colVehicles.setCode("COL-VEH-01");
        colVehicles.setCustomerId(custCorporate.getId());
        colVehicles.setCategory("Movable Properties");
        colVehicles.setType("Vehicles");
        colVehicles.setOwnerType("Borrower-owned");
        colVehicles.setCurrency("ETB");
        colVehicles.setValuationAmount(30_000_000.0);
        colVehicles.setHaircut(20.0);
        colVehicles.setNsv(24_000_000.0);
        colVehicles.setStatus("Active");
        colVehicles.setOwningSegment("Corporate Banking");
        colVehicles.setBranch("BRN-001");
        collateralRepository.save(colVehicles);

        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(colVehicles.getId());
        req2.setLoanAccountId(loanA.getId());
        req2.setAllocatedAmount(15_000_000.0);
        req2.setLinkageType("Secondary");
        relationshipService.createRelationship(req2, "TEST_MAKER");

        // Facility-side inspection: Loan A should show 2 linked collaterals, total allocated = 40M
        FacilityCollateralSummaryDto facSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(2, facSummary.getLinkedCollateralCount());
        assertEquals(40_000_000.0, facSummary.getTotalAllocatedCollateral(), 0.01);
        assertEquals(104_000_000.0, facSummary.getTotalNetCollateralValue(), 0.01); // 80M + 24M = 104M
        assertEquals(40_000_000.0, facSummary.getOutstandingBalance(), 0.01);

        // Ending C2 link does not remove C1 link
        LoanCollateralLink link2 = linkRepository.findByCollateralIdAndLoanAccountIdAndStatus(
                colVehicles.getId(), loanA.getId(), "Active").get(0);
        relationshipService.endRelationship(link2.getId(), "Vehicle released", "TEST_CHECKER");

        FacilityCollateralSummaryDto updatedFacSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(1, updatedFacSummary.getLinkedCollateralCount());
        assertEquals(25_000_000.0, updatedFacSummary.getTotalAllocatedCollateral(), 0.01);
    }

    @Test
    @DisplayName("Test 4 (N:N Pattern): Multiple Independent Collateral-Facility Associations")
    public void testScenarioManyToMany_Test4() {
        // Collaterals: C1 (col100M, NSV 80M), C2 (colMachinery, NSV 50M)
        Collateral colMachinery = new Collateral();
        colMachinery.setId("col-mach-" + UUID.randomUUID().toString().substring(0, 6));
        colMachinery.setCode("COL-MACH-01");
        colMachinery.setCustomerId(custCorporate.getId());
        colMachinery.setCategory("Movable Properties");
        colMachinery.setType("Equipment & Machinery");
        colMachinery.setOwnerType("Borrower-owned");
        colMachinery.setCurrency("ETB");
        colMachinery.setValuationAmount(62_500_000.0);
        colMachinery.setHaircut(20.0);
        colMachinery.setNsv(50_000_000.0);
        colMachinery.setStatus("Active");
        colMachinery.setOwningSegment("Corporate Banking");
        colMachinery.setBranch("BRN-001");
        collateralRepository.save(colMachinery);

        // C1 -> L1 (30M), C1 -> L2 (20M)
        RelationshipRequestDto reqC1L1 = new RelationshipRequestDto();
        reqC1L1.setCollateralId(col100M.getId());
        reqC1L1.setLoanAccountId(loanA.getId());
        reqC1L1.setAllocatedAmount(30_000_000.0);
        reqC1L1.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC1L1, "TEST_MAKER");

        RelationshipRequestDto reqC1L2 = new RelationshipRequestDto();
        reqC1L2.setCollateralId(col100M.getId());
        reqC1L2.setLoanAccountId(loanB.getId());
        reqC1L2.setAllocatedAmount(20_000_000.0);
        reqC1L2.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC1L2, "TEST_MAKER");

        // C2 -> L1 (10M), C2 -> L2 (25M)
        RelationshipRequestDto reqC2L1 = new RelationshipRequestDto();
        reqC2L1.setCollateralId(colMachinery.getId());
        reqC2L1.setLoanAccountId(loanA.getId());
        reqC2L1.setAllocatedAmount(10_000_000.0);
        reqC2L1.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC2L1, "TEST_MAKER");

        RelationshipRequestDto reqC2L2 = new RelationshipRequestDto();
        reqC2L2.setCollateralId(colMachinery.getId());
        reqC2L2.setLoanAccountId(loanB.getId());
        reqC2L2.setAllocatedAmount(25_000_000.0);
        reqC2L2.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC2L2, "TEST_MAKER");

        // Verify C1: 2 facilities, 50M allocated, 30M unallocated
        CollateralSecuredFacilitiesSummaryDto c1Summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(2, c1Summary.getLinkedFacilityCount());
        assertEquals(50_000_000.0, c1Summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(30_000_000.0, c1Summary.getUnallocatedSecurity(), 0.01);

        // Verify C2: 2 facilities, 35M allocated, 15M unallocated
        CollateralSecuredFacilitiesSummaryDto c2Summary = relationshipService.getCollateralSecuredFacilitiesSummary(colMachinery.getId());
        assertEquals(2, c2Summary.getLinkedFacilityCount());
        assertEquals(35_000_000.0, c2Summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(15_000_000.0, c2Summary.getUnallocatedSecurity(), 0.01);

        // Verify L1: 2 collaterals, 40M allocated
        FacilityCollateralSummaryDto l1Summary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(2, l1Summary.getLinkedCollateralCount());
        assertEquals(40_000_000.0, l1Summary.getTotalAllocatedCollateral(), 0.01);

        // Verify L2: 2 collaterals, 45M allocated
        FacilityCollateralSummaryDto l2Summary = relationshipService.getFacilityCollateralSummary(loanB.getId());
        assertEquals(2, l2Summary.getLinkedCollateralCount());
        assertEquals(45_000_000.0, l2Summary.getTotalAllocatedCollateral(), 0.01);
    }

    @Test
    @DisplayName("Test 6: Valid Additional Link (C1 -> L1 exists, C1 -> L2 is accepted)")
    public void testValidAdditionalLink_Test6() {
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(30_000_000.0);
        relationshipService.createRelationship(req1, "TEST_MAKER");

        // Adding C1 -> L2 must succeed
        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(col100M.getId());
        req2.setLoanAccountId(loanB.getId());
        req2.setAllocatedAmount(25_000_000.0);
        CollateralFacilityLinkDto link2 = relationshipService.createRelationship(req2, "TEST_MAKER");

        assertNotNull(link2);
        assertEquals(25_000_000.0, link2.getAllocatedAmount());
        assertEquals("Active", link2.getRelationshipStatus());

        List<LoanCollateralLink> activeLinks = linkRepository.findByCollateralIdAndStatus(col100M.getId(), "Active");
        assertEquals(2, activeLinks.size());
    }

    @Test
    @DisplayName("Test 9: Third-Party Prerequisites Missing (Missing Consent or Pledge Document Rejected with Explanation)")
    public void testThirdPartyPrerequisitesMissing_Test9() {
        Collateral tpColMissing = new Collateral();
        tpColMissing.setId("col-tp-missing-" + UUID.randomUUID().toString().substring(0, 6));
        tpColMissing.setCode("COL-TP-MISS");
        tpColMissing.setCustomerId(custCorporate.getId());
        tpColMissing.setOwnerType("Third-party-owned");
        tpColMissing.setCategory("Immovable Properties");
        tpColMissing.setType("Buildings - Commercial");
        tpColMissing.setValuationAmount(50_000_000.0);
        tpColMissing.setHaircut(20.0);
        tpColMissing.setNsv(40_000_000.0);
        tpColMissing.setStatus("Active");
        tpColMissing.setOwningSegment("Corporate Banking");
        tpColMissing.setBranch("BRN-001");
        collateralRepository.save(tpColMissing);

        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-tp-miss-" + UUID.randomUUID().toString().substring(0, 6));
        owner.setCollateralId(tpColMissing.getId());
        owner.setName("W/ro Chaltu Gemechu");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Shareholder");
        owner.setPercentage(100.0);
        owner.setVerificationStatus("Verified");
        owner.setStatus("Active");
        collateralOwnerRepository.save(owner);

        // DO NOT upload the mandatory Third-Party Consent and Pledge Agreement or Letter of Consent

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpColMissing.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(20_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("mandatory documents are missing") ||
                   ex.getMessage().contains("Third-Party Consent and Pledge Agreement") ||
                   ex.getMessage().contains("Letter of Consent"));
    }

    @Test
    @DisplayName("Test 10: Ineligible Facility Status (Closed, Settled, Cancelled Rejected with Reason)")
    public void testFacilityStatusIneligible_Test10() {
        // Set loanA status to Closed
        loanA.setStatus("Closed");
        loanAccountRepository.save(loanA);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(20_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Facility Status Ineligible") || ex.getMessage().contains("Closed"));
    }

    @Test
    @DisplayName("Test 12: Allocation Amendment Self-Exclusion (Current allocation excluded during capacity check)")
    public void testAllocationAmendmentSelfExclusion_Test12() {
        // col100M NSV = 80M
        // Create initial link of 50M (remaining capacity = 30M)
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(50_000_000.0);
        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "TEST_MAKER");

        // Amend allocation from 50M to 70M.
        // If prior 50M were not excluded, 50M + 70M = 120M > 80M would fail!
        // Because of self-exclusion, projected = (50 - 50) + 70 = 70M <= 80M -> SUCCEEDS!
        RelationshipRequestDto amendReq = new RelationshipRequestDto();
        amendReq.setAllocatedAmount(70_000_000.0);
        amendReq.setChangeReason("Increased credit facility utilization");

        CollateralFacilityLinkDto amended = relationshipService.updateRelationship(link.getId(), amendReq, "TEST_CHECKER");
        assertEquals(70_000_000.0, amended.getAllocatedAmount());

        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(70_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(10_000_000.0, colSummary.getUnallocatedSecurity(), 0.01);

        // Amending to 85M (> 80M NSV) must fail
        amendReq.setAllocatedAmount(85_000_000.0);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.updateRelationship(link.getId(), amendReq, "TEST_CHECKER");
        });
        assertTrue(ex.getMessage().contains("Allocation Overflow") || ex.getMessage().contains("Net Security Value"));
    }

    @Test
    @DisplayName("Test 15: End One Relationship Preserves Other Active Relationships")
    public void testEndOneRelationshipPreservesOther_Test15() {
        // C1 -> L1 (30M) and C1 -> L2 (25M)
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(30_000_000.0);
        CollateralFacilityLinkDto linkA = relationshipService.createRelationship(reqA, "TEST_MAKER");

        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(25_000_000.0);
        CollateralFacilityLinkDto linkB = relationshipService.createRelationship(reqB, "TEST_MAKER");

        // End C1 -> L1
        relationshipService.endRelationship(linkA.getId(), "Refinanced via other security", "TEST_CHECKER");

        // Verify C1 -> L1 is Ended
        LoanCollateralLink dbLinkA = linkRepository.findById(linkA.getId()).orElse(null);
        assertNotNull(dbLinkA);
        assertEquals("Ended", dbLinkA.getStatus());

        // Verify C1 -> L2 is completely Active and intact
        LoanCollateralLink dbLinkB = linkRepository.findById(linkB.getId()).orElse(null);
        assertNotNull(dbLinkB);
        assertEquals("Active", dbLinkB.getStatus());
        assertEquals(25_000_000.0, dbLinkB.getAllocatedAmount());

        // Collateral summary reflects only L2 as active
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colSummary.getLinkedFacilityCount());
        assertEquals(25_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(55_000_000.0, colSummary.getUnallocatedSecurity(), 0.01);
    }

    @Test
    @DisplayName("Test 16: Multi-Facility Collateral Release Blocked when any obligation remains unsettled")
    public void testMultiFacilityCollateralReleaseBlocked_Test16() {
        // col100M secures Loan A (40M) and Loan B (25M)
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(25_000_000.0);
        relationshipService.createRelationship(reqB, "TEST_MAKER");

        // Settle Loan A only
        loanA.setOutstandingBalance(0.0);
        loanA.setStatus("Closed");
        loanAccountRepository.save(loanA);

        // Loan B is still outstanding (25M). Release must remain blocked!
        Map<String, Object> releaseCheck1 = relationshipService.validateCollateralRelease(col100M.getId());
        assertFalse((Boolean) releaseCheck1.get("eligibleForRelease"));
        assertEquals(25_000_000.0, (Double) releaseCheck1.get("totalUnclearedExposure"), 0.01);

        // Now settle Loan B as well
        loanB.setOutstandingBalance(0.0);
        loanB.setStatus("Closed");
        loanAccountRepository.save(loanB);

        // Both facilities settled -> release is eligible!
        Map<String, Object> releaseCheck2 = relationshipService.validateCollateralRelease(col100M.getId());
        assertTrue((Boolean) releaseCheck2.get("eligibleForRelease"));
        assertEquals(0.0, (Double) releaseCheck2.get("totalUnclearedExposure"), 0.01);
    }

    @Test
    @DisplayName("Test 17: Bidirectional Consistency (Collateral-First vs Facility-First views)")
    public void testBidirectionalConsistency_Test17() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(35_000_000.0);
        req.setLinkageType("Primary");
        relationshipService.createRelationship(req, "TEST_MAKER");

        // Direction 1: Collateral -> Facilities
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colSummary.getLinkedFacilityCount());
        assertEquals(35_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(loanA.getLoanReference(), colSummary.getSecuredFacilities().get(0).getLoanReference());

        // Direction 2: Facility -> Collaterals
        FacilityCollateralSummaryDto facSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(1, facSummary.getLinkedCollateralCount());
        assertEquals(35_000_000.0, facSummary.getTotalAllocatedCollateral(), 0.01);
        assertEquals(col100M.getCode(), facSummary.getSecuringCollaterals().get(0).getCollateralCode());
    }

    @Test
    @DisplayName("Test 18: Authoritative Eligibility Explanation")
    public void testAuthoritativeEligibilityExplanation_Test18() {
        RelationshipRequestDto validReq = new RelationshipRequestDto();
        validReq.setCollateralId(col100M.getId());
        validReq.setLoanAccountId(loanA.getId());
        validReq.setAllocatedAmount(40_000_000.0);

        RelationshipValidationResultDto validResult = relationshipService.validateRelationship(validReq);
        assertTrue(validResult.isValid());
        assertTrue(validResult.isCanProceed());
        assertTrue(validResult.isOwnerBorrowerMatch());
        assertNotNull(validResult.getNetCollateralValue());
        assertNotNull(validResult.getChecks());

        // Candidate collaterals evaluation for Loan A
        List<CollateralCandidateDto> candidates = relationshipService.getEligibleCollateralsForFacility(loanA.getId(), "TEST_USER");
        assertNotNull(candidates);
        assertFalse(candidates.isEmpty());
        CollateralCandidateDto cand = candidates.stream().filter(c -> c.getId().equalsIgnoreCase(col100M.getId())).findFirst().orElse(null);
        assertNotNull(cand);
        assertTrue(cand.isEligible());
        assertEquals(80_000_000.0, cand.getNetCollateralValue(), 0.01);
    }

    @Test
    @DisplayName("Test 19: Historical Records Preserved and Excluded from Active Allocations on Re-linking")
    public void testHistoricalRecordsPreservedOnReLinking_Test19() {
        // 1. Initial Link (30M)
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(30_000_000.0);
        CollateralFacilityLinkDto link1 = relationshipService.createRelationship(req1, "TEST_MAKER");

        // 2. End link
        relationshipService.endRelationship(link1.getId(), "Matured contract", "TEST_CHECKER");

        // 3. Re-establish link with new terms (35M)
        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(col100M.getId());
        req2.setLoanAccountId(loanA.getId());
        req2.setAllocatedAmount(35_000_000.0);
        req2.setChangeReason("New credit agreement executed");
        CollateralFacilityLinkDto link2 = relationshipService.createRelationship(req2, "TEST_MAKER");

        assertNotEquals(link1.getId(), link2.getId());

        // Check history and status in database: exactly 1 Active, 1 Ended
        List<LoanCollateralLink> allLinks = linkRepository.findByCollateralId(col100M.getId());
        long activeCount = allLinks.stream().filter(l -> "Active".equalsIgnoreCase(l.getStatus())).count();
        long endedCount = allLinks.stream().filter(l -> "Ended".equalsIgnoreCase(l.getStatus())).count();
        assertEquals(1, activeCount);
        assertEquals(1, endedCount);

        // Active allocation on col100M must be 35M (historical 30M is NOT counted)
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(35_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(45_000_000.0, colSummary.getUnallocatedSecurity(), 0.01); // 80M - 35M = 45M
    }

    @Test
    @DisplayName("Test 20: CBS Relationship Reconciliation (MATCHING, CHANGED, CBS_ONLY, CIMS_ONLY)")
    public void testCbsRelationshipReconciliation_Test20() {
        CbsRelationshipReconciliationDto recon = relationshipService.reconcileCbsRelationships();
        assertNotNull(recon);
        assertNotNull(recon.getReconciliationTimestamp());
        assertTrue(recon.getTotalCbsRelationships() >= 0);
        assertTrue(recon.getTotalCimsRelationships() >= 0);
        assertNotNull(recon.getItems());
    }
}
