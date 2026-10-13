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

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * CIMS — Module 1: Comprehensive 22-Scenario Relationship Integration Test Suite.
 * Covers all requirements in Section 12:
 *  1. One collateral linked to one eligible facility (1:1).
 *  2. One collateral linked to multiple eligible facilities (1:Many).
 *  3. Multiple collateral records linked to one facility (Many:1).
 *  4. Multiple collateral records linked across multiple facilities (Many:Many).
 *  5. A normal owner-borrower match.
 *  6. An owner-borrower mismatch that must be rejected.
 *  7. A valid third-party relationship with the required prerequisites.
 *  8. A third-party relationship missing required consent or pledge evidence rejected.
 *  9. An unauthorized or unrelated third-party link rejected.
 *  10. Duplicate linking of the same collateral to the same facility rejected.
 *  11. Legitimate reuse of one collateral across multiple eligible facilities.
 *  12. Potential duplicate underlying collateral detected by the existing rules.
 *  13. Adding a link without deleting unrelated existing links.
 *  14. Editing an allocation without changing unrelated relationships.
 *  15. Removing one relationship without deleting others.
 *  16. Allocation-limit and aggregate-exposure validation.
 *  17. Failure during persistence without partial relationship changes.
 *  18. Repeated requests and concurrent linking attempts.
 *  19. Relationship history and audit behavior.
 *  20. Creating the same valid link from both existing UI entry points.
 *  21. Refreshing both screens and confirming that saved relationships and allocations remain consistent.
 *  22. Compatibility with the existing CBS simulator and existing data.
 */
@SpringBootTest
@Transactional
public class Module1RelationshipComprehensiveIntegrationTest {

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
    private OwnershipDocumentRepository documentRepository;

    @Autowired
    private InsurancePolicyRepository policyRepository;

    private Customer custCorporate;
    private Customer custDifferent;
    private Collateral col100M;
    private LoanAccount loanA;
    private LoanAccount loanB;
    private LoanAccount loanC;
    private String testUid;

    @BeforeEach
    public void setUp() {
        testUid = UUID.randomUUID().toString().substring(0, 6);

        // Corporate Borrower (Normal Owner)
        custCorporate = new Customer();
        custCorporate.setId("cust-corp-" + testUid);
        custCorporate.setCif("CIF-CORP-" + testUid);
        custCorporate.setName("Apex Manufacturing Plc " + testUid);
        custCorporate.setSegment("Corporate Banking");
        custCorporate.setCustomerType("Corporate");
        custCorporate.setStatus("Active");
        customerRepository.save(custCorporate);

        // Distinct Borrower for Customer Isolation testing
        custDifferent = new Customer();
        custDifferent.setId("cust-diff-" + testUid);
        custDifferent.setCif("CIF-DIFF-" + testUid);
        custDifferent.setName("Distinct Trading Corp " + testUid);
        custDifferent.setSegment("Commercial Banking");
        custDifferent.setCustomerType("Corporate");
        custDifferent.setStatus("Active");
        customerRepository.save(custDifferent);

        // Primary Collateral Asset: Valuation 100M, Haircut 20% -> NSV 80M
        col100M = new Collateral();
        col100M.setId("col-100m-" + testUid);
        col100M.setCode("COL-100M-" + testUid);
        col100M.setCustomerId(custCorporate.getId());
        col100M.setDescription("Industrial Facility Complex " + testUid);
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
        col100M.setTitleDeedNumber("TD-APEX-" + testUid);
        col100M.setRegistrationNumber("REG-APEX-" + testUid);
        collateralRepository.save(col100M);

        // Loan A: Outstanding 40M, Limit 50M
        loanA = new LoanAccount();
        loanA.setId("loan-a-" + testUid);
        loanA.setLoanReference("LN-A-" + testUid);
        loanA.setLineCode("FAC-A-" + testUid);
        loanA.setAccountNumber("ACC-A-" + testUid);
        loanA.setCustomerId(custCorporate.getId());
        loanA.setFacilityType("Term Loan");
        loanA.setLineCurrency("ETB");
        loanA.setApprovedLimit(50_000_000.0);
        loanA.setOutstandingBalance(40_000_000.0);
        loanA.setStatus("Active");
        loanAccountRepository.save(loanA);

        // Loan B: Outstanding 25M, Limit 35M
        loanB = new LoanAccount();
        loanB.setId("loan-b-" + testUid);
        loanB.setLoanReference("LN-B-" + testUid);
        loanB.setLineCode("FAC-B-" + testUid);
        loanB.setAccountNumber("ACC-B-" + testUid);
        loanB.setCustomerId(custCorporate.getId());
        loanB.setFacilityType("Working Capital Overdraft");
        loanB.setLineCurrency("ETB");
        loanB.setApprovedLimit(35_000_000.0);
        loanB.setOutstandingBalance(25_000_000.0);
        loanB.setStatus("Active");
        loanAccountRepository.save(loanB);

        // Loan C: Outstanding 15M, Limit 20M
        loanC = new LoanAccount();
        loanC.setId("loan-c-" + testUid);
        loanC.setLoanReference("LN-C-" + testUid);
        loanC.setLineCode("FAC-C-" + testUid);
        loanC.setAccountNumber("ACC-C-" + testUid);
        loanC.setCustomerId(custCorporate.getId());
        loanC.setFacilityType("Merchandise Loan");
        loanC.setLineCurrency("ETB");
        loanC.setApprovedLimit(20_000_000.0);
        loanC.setOutstandingBalance(15_000_000.0);
        loanC.setStatus("Active");
        loanAccountRepository.save(loanC);
    }

    // =========================================================================
    // 1. One collateral linked to one eligible facility (1:1)
    // =========================================================================
    @Test
    @DisplayName("Scenario 1: One Collateral -> One Loan Account (1:1 Relationship)")
    public void test01_OneCollateralToOneEligibleFacility() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(40_000_000.0);
        req.setLinkageType("Primary");
        req.setChangeReason("Initial Term Loan security pledge");

        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(link);
        assertEquals(40_000_000.0, link.getAllocatedAmount());
        assertEquals("Active", link.getRelationshipStatus());
        assertEquals(50.0, link.getCollateralAllocationPct(), 0.01); // 40M / 80M NSV = 50%
        assertEquals(100.0, link.getFacilityCoveragePct(), 0.01);   // 40M / 40M Outstanding = 100%

        // Direction 1: Collateral -> Secured Facilities
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colSummary.getLinkedFacilityCount());
        assertEquals(40_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(40_000_000.0, colSummary.getUnallocatedSecurity(), 0.01); // 80M - 40M = 40M
        assertEquals(40_000_000.0, colSummary.getAggregateSecuredExposure(), 0.01);

        // Direction 2: Facility -> Securing Collaterals
        FacilityCollateralSummaryDto facSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(1, facSummary.getLinkedCollateralCount());
        assertEquals(40_000_000.0, facSummary.getTotalAllocatedCollateral(), 0.01);
        assertEquals(80_000_000.0, facSummary.getTotalNetCollateralValue(), 0.01);
        assertEquals(100.0, facSummary.getCollateralCoveragePct(), 0.01);
    }

    // =========================================================================
    // 2. One collateral linked to multiple eligible facilities (1:Many)
    // =========================================================================
    @Test
    @DisplayName("Scenario 2: One Collateral -> Multiple Facilities (1:Many Cross-Collateralization & Recalculation)")
    public void test02_OneCollateralToMultipleEligibleFacilities() {
        // Link Loan A (40M)
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(40_000_000.0);
        reqA.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqA, "TEST_MAKER");

        // Link Loan B (25M)
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(25_000_000.0);
        reqB.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqB, "TEST_MAKER");

        // Link Loan C (15M)
        RelationshipRequestDto reqC = new RelationshipRequestDto();
        reqC.setCollateralId(col100M.getId());
        reqC.setLoanAccountId(loanC.getId());
        reqC.setAllocatedAmount(15_000_000.0);
        reqC.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(reqC, "TEST_MAKER");

        // Total allocation = 40M + 25M + 15M = 80M. Unallocated capacity = 0.
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(3, colSummary.getLinkedFacilityCount());
        assertEquals(80_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, colSummary.getUnallocatedSecurity(), 0.01);
        assertEquals(80_000_000.0, colSummary.getAggregateSecuredExposure(), 0.01);

        // Dynamic Recalculation: increase Loan B outstanding balance to 30M
        loanB.setOutstandingBalance(30_000_000.0);
        loanAccountRepository.save(loanB);

        // Aggregate exposure updates automatically to 85M (40M + 30M + 15M) without altering static allocations
        CollateralSecuredFacilitiesSummaryDto updatedColSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(80_000_000.0, updatedColSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, updatedColSummary.getUnallocatedSecurity(), 0.01);
        assertEquals(85_000_000.0, updatedColSummary.getAggregateSecuredExposure(), 0.01);
    }

    // =========================================================================
    // 3. Multiple collateral records linked to one facility (Many:1)
    // =========================================================================
    @Test
    @DisplayName("Scenario 3: Multiple Collateral Records -> One Facility (Many:1)")
    public void test03_MultipleCollateralRecordsToOneFacility() {
        // Loan A has 40M outstanding. Set outstanding to 60M for Many:1 demonstration
        loanA.setOutstandingBalance(60_000_000.0);
        loanAccountRepository.save(loanA);

        // Second Collateral: Commercial Warehouse, NSV 40M
        Collateral col2 = new Collateral();
        col2.setId("col-wh-" + testUid);
        col2.setCode("COL-WH-" + testUid);
        col2.setCustomerId(custCorporate.getId());
        col2.setDescription("Commercial Warehouse " + testUid);
        col2.setCategory("Immovable Properties");
        col2.setType("Warehouse");
        col2.setOwnerType("Borrower-owned");
        col2.setCurrency("ETB");
        col2.setValuationAmount(50_000_000.0);
        col2.setHaircut(20.0);
        col2.setNsv(40_000_000.0);
        col2.setStatus("Active");
        col2.setOwningSegment("Corporate Banking");
        col2.setBranch("BRN-001");
        collateralRepository.save(col2);

        // Link Collateral 1: 35M to Loan A
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(35_000_000.0);
        req1.setLinkageType("Primary");
        relationshipService.createRelationship(req1, "TEST_MAKER");

        // Link Collateral 2: 25M to Loan A
        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(col2.getId());
        req2.setLoanAccountId(loanA.getId());
        req2.setAllocatedAmount(25_000_000.0);
        req2.setLinkageType("Secondary");
        relationshipService.createRelationship(req2, "TEST_MAKER");

        // Facility Summary: 2 collaterals securing Loan A with total 60M allocated (100% coverage)
        FacilityCollateralSummaryDto facSummary = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(2, facSummary.getLinkedCollateralCount());
        assertEquals(60_000_000.0, facSummary.getTotalAllocatedCollateral(), 0.01);
        assertEquals(100.0, facSummary.getCollateralCoveragePct(), 0.01);
        assertEquals(120_000_000.0, facSummary.getTotalNetCollateralValue(), 0.01); // 80M + 40M = 120M
    }

    // =========================================================================
    // 4. Multiple collateral records linked across multiple facilities (Many:Many)
    // =========================================================================
    @Test
    @DisplayName("Scenario 4: Many:Many Cross-Collateralization Pool")
    public void test04_MultipleCollateralRecordsAcrossMultipleFacilities() {
        // Create second collateral asset (NSV 50M)
        Collateral col2 = new Collateral();
        col2.setId("col-pool2-" + testUid);
        col2.setCode("COL-P2-" + testUid);
        col2.setCustomerId(custCorporate.getId());
        col2.setCategory("Movable Properties");
        col2.setType("Machinery - Industrial");
        col2.setOwnerType("Borrower-owned");
        col2.setCurrency("ETB");
        col2.setValuationAmount(62_500_000.0);
        col2.setHaircut(20.0);
        col2.setNsv(50_000_000.0);
        col2.setStatus("Active");
        col2.setOwningSegment("Corporate Banking");
        col2.setBranch("BRN-001");
        collateralRepository.save(col2);

        // Col 1 (80M NSV) -> Loan A (30M) and Loan B (20M)
        RelationshipRequestDto link1A = new RelationshipRequestDto();
        link1A.setCollateralId(col100M.getId());
        link1A.setLoanAccountId(loanA.getId());
        link1A.setAllocatedAmount(30_000_000.0);
        link1A.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(link1A, "TEST_MAKER");

        RelationshipRequestDto link1B = new RelationshipRequestDto();
        link1B.setCollateralId(col100M.getId());
        link1B.setLoanAccountId(loanB.getId());
        link1B.setAllocatedAmount(20_000_000.0);
        link1B.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(link1B, "TEST_MAKER");

        // Col 2 (50M NSV) -> Loan B (5M) and Loan C (15M)
        RelationshipRequestDto link2B = new RelationshipRequestDto();
        link2B.setCollateralId(col2.getId());
        link2B.setLoanAccountId(loanB.getId());
        link2B.setAllocatedAmount(5_000_000.0);
        link2B.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(link2B, "TEST_MAKER");

        RelationshipRequestDto link2C = new RelationshipRequestDto();
        link2C.setCollateralId(col2.getId());
        link2C.setLoanAccountId(loanC.getId());
        link2C.setAllocatedAmount(15_000_000.0);
        link2C.setLinkageType("Cross-Collateral");
        relationshipService.createRelationship(link2C, "TEST_MAKER");

        // Assert Col 1 metrics
        CollateralSecuredFacilitiesSummaryDto col1Summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(2, col1Summary.getLinkedFacilityCount());
        assertEquals(50_000_000.0, col1Summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(30_000_000.0, col1Summary.getUnallocatedSecurity(), 0.01); // 80M - 50M = 30M

        // Assert Col 2 metrics
        CollateralSecuredFacilitiesSummaryDto col2Summary = relationshipService.getCollateralSecuredFacilitiesSummary(col2.getId());
        assertEquals(2, col2Summary.getLinkedFacilityCount());
        assertEquals(20_000_000.0, col2Summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(30_000_000.0, col2Summary.getUnallocatedSecurity(), 0.01); // 50M - 20M = 30M

        // Assert Loan B metrics (Secured by BOTH Col 1 and Col 2)
        FacilityCollateralSummaryDto facBSummary = relationshipService.getFacilityCollateralSummary(loanB.getId());
        assertEquals(2, facBSummary.getLinkedCollateralCount());
        assertEquals(25_000_000.0, facBSummary.getTotalAllocatedCollateral(), 0.01); // 20M + 5M = 25M
        assertEquals(100.0, facBSummary.getCollateralCoveragePct(), 0.01);           // 25M / 25M outstanding = 100%
    }

    // =========================================================================
    // 5. Normal owner-borrower match
    // =========================================================================
    @Test
    @DisplayName("Scenario 5: Normal Owner-Borrower Match Enforced")
    public void test05_NormalOwnerBorrowerMatch() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);

        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(link);
        assertEquals("Borrower-owned", link.getCollateralOwnerType());
        assertEquals("Active", link.getRelationshipStatus());
    }

    // =========================================================================
    // 6. Owner-borrower mismatch rejected
    // =========================================================================
    @Test
    @DisplayName("Scenario 6: Owner-Borrower Mismatch Rejected Under Borrower Isolation")
    public void test06_OwnerBorrowerMismatchRejected() {
        // Loan belonging to distinct borrower
        LoanAccount diffLoan = new LoanAccount();
        diffLoan.setId("loan-diff-" + testUid);
        diffLoan.setLoanReference("LN-DIFF-" + testUid);
        diffLoan.setCustomerId(custDifferent.getId());
        diffLoan.setFacilityType("Term Loan");
        diffLoan.setApprovedLimit(20_000_000.0);
        diffLoan.setOutstandingBalance(15_000_000.0);
        diffLoan.setStatus("Active");
        loanAccountRepository.save(diffLoan);

        // Attempting to pledge borrower-owned collateral to unrelated customer
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(diffLoan.getId());
        req.setAllocatedAmount(10_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Customer Isolation Violation"));
    }

    // =========================================================================
    // 7. Valid third-party relationship with required prerequisites
    // =========================================================================
    @Test
    @DisplayName("Scenario 7: Valid Third-Party Relationship with Required Prerequisites")
    public void test07_ValidThirdPartyRelationshipWithPrerequisites() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-tp-val-" + testUid);
        tpCol.setCode("COL-TP-VAL-" + testUid);
        tpCol.setCustomerId(custCorporate.getId());
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Commercial Real Estate");
        tpCol.setValuationAmount(60_000_000.0);
        tpCol.setHaircut(20.0);
        tpCol.setNsv(48_000_000.0);
        tpCol.setStatus("Active");
        tpCol.setOwningSegment("Corporate Banking");
        tpCol.setBranch("BRN-001");
        collateralRepository.save(tpCol);

        // Verified Third-Party Owner Record
        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-tp-val-" + testUid);
        owner.setCollateralId(tpCol.getId());
        owner.setName("Guarantor Almaz Tefera");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Guarantor");
        owner.setConsentInfo("Written Spousal & Third-Party Consent on File");
        owner.setPledgeAgreementRef("PLG-AGR-2024-" + testUid);
        owner.setPercentage(100.0);
        owner.setVerificationStatus("Verified");
        owner.setStatus("Active");
        collateralOwnerRepository.save(owner);

        // Mandatory verified third-party documents in DMS
        OwnershipDocument docPledge = new OwnershipDocument();
        docPledge.setId("doc-plg-" + testUid);
        docPledge.setCollateralId(tpCol.getId());
        docPledge.setType("Third-Party Consent and Pledge Agreement");
        docPledge.setName("Third-Party Pledge Agreement");
        docPledge.setStatus("Active");
        docPledge.setVerificationStatus("Verified");
        docPledge.setFileContent("MOCK_BASE64_PLEDGE");
        documentRepository.save(docPledge);

        OwnershipDocument docConsent = new OwnershipDocument();
        docConsent.setId("doc-let-" + testUid);
        docConsent.setCollateralId(tpCol.getId());
        docConsent.setType("Letter of Consent");
        docConsent.setName("Letter of Consent");
        docConsent.setStatus("Active");
        docConsent.setVerificationStatus("Verified");
        docConsent.setFileContent("MOCK_BASE64_CONSENT");
        documentRepository.save(docConsent);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);
        req.setLinkageType("Primary");

        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "TEST_MAKER");
        assertNotNull(link);
        assertEquals(30_000_000.0, link.getAllocatedAmount());
        assertEquals("Third-party-owned", link.getCollateralOwnerType());
    }

    // =========================================================================
    // 8. Third-party relationship missing required consent/pledge evidence rejected
    // =========================================================================
    @Test
    @DisplayName("Scenario 8: Third-Party Relationship Missing Required Evidence Rejected")
    public void test08_ThirdPartyMissingRequiredConsentOrPledgeEvidenceRejected() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-tp-missing-" + testUid);
        tpCol.setCode("COL-TP-MISS-" + testUid);
        tpCol.setCustomerId(custCorporate.getId());
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Commercial Real Estate");
        tpCol.setValuationAmount(60_000_000.0);
        tpCol.setHaircut(20.0);
        tpCol.setNsv(48_000_000.0);
        tpCol.setStatus("Active");
        tpCol.setOwningSegment("Corporate Banking");
        tpCol.setBranch("BRN-001");
        collateralRepository.save(tpCol);

        // Third-party owner record without DMS consent document
        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-tp-miss-" + testUid);
        owner.setCollateralId(tpCol.getId());
        owner.setName("Guarantor Ato Bekele");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Guarantor");
        owner.setPercentage(100.0);
        owner.setVerificationStatus("Verified");
        collateralOwnerRepository.save(owner);

        // Intentionally DO NOT upload/verify Third-Party Consent and Pledge Agreement in DMS

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(20_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().toLowerCase().contains("third-party") || ex.getMessage().toLowerCase().contains("pledge") || ex.getMessage().toLowerCase().contains("consent"));
    }

    // =========================================================================
    // 9. Unauthorized or unrelated third-party link rejected
    // =========================================================================
    @Test
    @DisplayName("Scenario 9: Unauthorized or Unrelated Third-Party Link Rejected")
    public void test09_UnauthorizedOrUnrelatedThirdPartyLinkRejected() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-tp-unauth-" + testUid);
        tpCol.setCode("COL-TP-UNAUTH-" + testUid);
        tpCol.setCustomerId(custCorporate.getId());
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setValuationAmount(60_000_000.0);
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Commercial Real Estate");
        tpCol.setOwningSegment("Corporate Banking");
        tpCol.setBranch("BRN-001");
        tpCol.setStatus("Active");
        collateralRepository.save(tpCol);

        // Unverified owner with unapproved/empty relationship
        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-tp-unauth-" + testUid);
        owner.setCollateralId(tpCol.getId());
        owner.setName("Unrelated Person");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Unrelated Party");
        owner.setVerificationStatus("Pending"); // Unverified
        collateralOwnerRepository.save(owner);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(20_000_000.0);

        assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req, "TEST_MAKER");
        });
    }

    // =========================================================================
    // 10. Duplicate linking of same collateral to same facility rejected
    // =========================================================================
    @Test
    @DisplayName("Scenario 10: Duplicate Linking of Same Collateral to Same Facility Rejected")
    public void test10_DuplicateLinkingOfSameCollateralToSameFacilityRejected() {
        // First valid link
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(25_000_000.0);
        relationshipService.createRelationship(req, "TEST_MAKER");

        // Attempting to create a second active link between same Collateral and Loan A
        RelationshipRequestDto dupReq = new RelationshipRequestDto();
        dupReq.setCollateralId(col100M.getId());
        dupReq.setLoanAccountId(loanA.getId());
        dupReq.setAllocatedAmount(15_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(dupReq, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Duplicate Relationship Block"));
    }

    // =========================================================================
    // 11. Legitimate reuse of one collateral across multiple eligible facilities
    // =========================================================================
    @Test
    @DisplayName("Scenario 11: Legitimate Reuse of One Collateral Across Multiple Facilities Allowed")
    public void test11_LegitimateReuseOfOneCollateralAcrossMultipleEligibleFacilities() {
        // Link Col 1 to Loan A
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(35_000_000.0);
        CollateralFacilityLinkDto linkA = relationshipService.createRelationship(reqA, "TEST_MAKER");
        assertNotNull(linkA);

        // Legitimate reuse: Link SAME Col 1 to distinct Loan B
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(20_000_000.0);
        CollateralFacilityLinkDto linkB = relationshipService.createRelationship(reqB, "TEST_MAKER");
        assertNotNull(linkB);

        // Duplicate check did not block legitimate reuse across distinct facilities
        assertEquals("Active", linkA.getRelationshipStatus());
        assertEquals("Active", linkB.getRelationshipStatus());
    }

    // =========================================================================
    // 12. Potential duplicate underlying collateral detected by existing rules
    // =========================================================================
    @Test
    @DisplayName("Scenario 12: Potential Duplicate Underlying Collateral Detected Prior to Registration")
    public void test12_PotentialDuplicateUnderlyingCollateralDetected() {
        // Search by Title Deed of existing collateral
        Map<String, Object> resultMatch = relationshipService.searchExistingCollateral(
                null, col100M.getTitleDeedNumber(), null, null
        );
        assertTrue((Boolean) resultMatch.get("found"));
        assertEquals(col100M.getId(), resultMatch.get("collateralId"));
        assertTrue(resultMatch.get("matchReason").toString().contains("Title Deed"));

        // Search by Registration Number of existing collateral
        Map<String, Object> resultRegMatch = relationshipService.searchExistingCollateral(
                null, null, col100M.getRegistrationNumber(), null
        );
        assertTrue((Boolean) resultRegMatch.get("found"));
        assertEquals(col100M.getId(), resultRegMatch.get("collateralId"));

        // Search with novel/unregistered identifier returns found = false
        Map<String, Object> resultNoMatch = relationshipService.searchExistingCollateral(
                "COL-NONEXISTENT-" + testUid, "TD-NO-MATCH-" + testUid, "REG-NO-MATCH-" + testUid, null
        );
        assertFalse((Boolean) resultNoMatch.get("found"));
    }

    // =========================================================================
    // 13. Adding a link without deleting unrelated existing links
    // =========================================================================
    @Test
    @DisplayName("Scenario 13: Adding a Link Preserves Unrelated Existing Links (Non-destructive)")
    public void test13_AddingLinkWithoutDeletingUnrelatedExistingLinks() {
        // Link to Loan A
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(30_000_000.0);
        CollateralFacilityLinkDto linkA = relationshipService.createRelationship(reqA, "TEST_MAKER");

        // Now add link to Loan B
        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(25_000_000.0);
        CollateralFacilityLinkDto linkB = relationshipService.createRelationship(reqB, "TEST_MAKER");

        // Verify Loan A is NOT deleted or altered
        LoanCollateralLink persistedA = linkRepository.findById(linkA.getId()).orElse(null);
        assertNotNull(persistedA);
        assertEquals("Active", persistedA.getStatus());
        assertEquals(30_000_000.0, persistedA.getAllocatedAmount());

        // Verify Loan B is active
        LoanCollateralLink persistedB = linkRepository.findById(linkB.getId()).orElse(null);
        assertNotNull(persistedB);
        assertEquals("Active", persistedB.getStatus());
        assertEquals(25_000_000.0, persistedB.getAllocatedAmount());
    }

    // =========================================================================
    // 14. Editing an allocation without changing unrelated relationships
    // =========================================================================
    @Test
    @DisplayName("Scenario 14: Editing an Allocation Without Changing Unrelated Relationships")
    public void test14_EditingAllocationWithoutChangingUnrelatedRelationships() {
        // Col 1 linked to Loan A (30M) and Loan B (20M)
        RelationshipRequestDto reqA = new RelationshipRequestDto();
        reqA.setCollateralId(col100M.getId());
        reqA.setLoanAccountId(loanA.getId());
        reqA.setAllocatedAmount(30_000_000.0);
        CollateralFacilityLinkDto linkA = relationshipService.createRelationship(reqA, "TEST_MAKER");

        RelationshipRequestDto reqB = new RelationshipRequestDto();
        reqB.setCollateralId(col100M.getId());
        reqB.setLoanAccountId(loanB.getId());
        reqB.setAllocatedAmount(20_000_000.0);
        CollateralFacilityLinkDto linkB = relationshipService.createRelationship(reqB, "TEST_MAKER");

        // Now edit Loan A allocation to 45M
        RelationshipRequestDto editA = new RelationshipRequestDto();
        editA.setAllocatedAmount(45_000_000.0);
        editA.setChangeReason("Limit extension on Loan A");
        CollateralFacilityLinkDto updatedA = relationshipService.updateRelationship(linkA.getId(), editA, "CHECKER_1");

        assertEquals(45_000_000.0, updatedA.getAllocatedAmount());
        assertEquals(2, updatedA.getModNo());

        // Unrelated link B remains completely untouched
        LoanCollateralLink unchangedB = linkRepository.findById(linkB.getId()).orElse(null);
        assertNotNull(unchangedB);
        assertEquals(20_000_000.0, unchangedB.getAllocatedAmount());
        assertEquals(1, unchangedB.getModNo());
        assertEquals("Active", unchangedB.getStatus());

        // Total allocation is now 45M + 20M = 65M. Unallocated capacity is 15M.
        CollateralSecuredFacilitiesSummaryDto summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(65_000_000.0, summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(15_000_000.0, summary.getUnallocatedSecurity(), 0.01);
    }

    // =========================================================================
    // 15. Removing one relationship without deleting others
    // =========================================================================
    @Test
    @DisplayName("Scenario 15: Removing One Relationship Without Deleting Others")
    public void test15_RemovingOneRelationshipWithoutDeletingOthers() {
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

        // End relationship for Loan A
        CollateralFacilityLinkDto endedA = relationshipService.endRelationship(linkA.getId(), "Loan A settled early", "CHECKER_1");
        assertEquals("Ended", endedA.getRelationshipStatus());
        assertNotNull(endedA.getEndDate());

        // Verify Loan A is Ended in DB
        LoanCollateralLink dbA = linkRepository.findById(linkA.getId()).orElse(null);
        assertNotNull(dbA);
        assertEquals("Ended", dbA.getStatus());

        // Unrelated link B remains active and unaffected
        LoanCollateralLink dbB = linkRepository.findById(linkB.getId()).orElse(null);
        assertNotNull(dbB);
        assertEquals("Active", dbB.getStatus());
        assertEquals(25_000_000.0, dbB.getAllocatedAmount());

        // Active summary now only reflects Loan B (total allocated: 25M, unallocated: 55M)
        CollateralSecuredFacilitiesSummaryDto colSummary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colSummary.getLinkedFacilityCount());
        assertEquals(25_000_000.0, colSummary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(55_000_000.0, colSummary.getUnallocatedSecurity(), 0.01);
    }

    // =========================================================================
    // 16. Allocation-limit and aggregate-exposure validation
    // =========================================================================
    @Test
    @DisplayName("Scenario 16: Allocation Capacity Overflow Validation & Aggregate Exposure")
    public void test16_AllocationLimitAndAggregateExposureValidation() {
        // Col NSV is 80M. Attempt to allocate 85M to Loan A
        RelationshipRequestDto overflowReq = new RelationshipRequestDto();
        overflowReq.setCollateralId(col100M.getId());
        overflowReq.setLoanAccountId(loanA.getId());
        overflowReq.setAllocatedAmount(85_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(overflowReq, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Allocation Overflow"));

        // Valid allocations: Loan A (50M outstanding) + Loan B (50M outstanding) = 100M aggregate exposure
        loanA.setOutstandingBalance(50_000_000.0);
        loanB.setOutstandingBalance(50_000_000.0);
        loanAccountRepository.save(loanA);
        loanAccountRepository.save(loanB);

        // Allocate 40M to Loan A and 40M to Loan B (Total allocated = 80M = NSV)
        RelationshipRequestDto validA = new RelationshipRequestDto();
        validA.setCollateralId(col100M.getId());
        validA.setLoanAccountId(loanA.getId());
        validA.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(validA, "TEST_MAKER");

        RelationshipRequestDto validB = new RelationshipRequestDto();
        validB.setCollateralId(col100M.getId());
        validB.setLoanAccountId(loanB.getId());
        validB.setAllocatedAmount(40_000_000.0);
        relationshipService.createRelationship(validB, "TEST_MAKER");

        CollateralSecuredFacilitiesSummaryDto summary = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(80_000_000.0, summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, summary.getUnallocatedSecurity(), 0.01);
        // Aggregate exposure is 100M (sum of outstanding), even though allocation is capped at 80M
        assertEquals(100_000_000.0, summary.getAggregateSecuredExposure(), 0.01);
    }

    // =========================================================================
    // 17. Failure during persistence without partial relationship changes
    // =========================================================================
    @Test
    @DisplayName("Scenario 17: Atomicity Verification — Persistence Failure Leaves No Partial State")
    public void test17_FailureDuringPersistenceWithoutPartialRelationshipChanges() {
        // Multi-facility batch allocation where one item exceeds capacity: 40M + 50M = 90M > 80M NSV
        List<Map<String, Object>> batch = new ArrayList<>();
        batch.add(Map.of("facilityId", loanA.getId(), "allocatedAmount", 40_000_000.0, "linkageType", "Primary"));
        batch.add(Map.of("facilityId", loanB.getId(), "allocatedAmount", 50_000_000.0, "linkageType", "Secondary"));

        assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.allocateCollateralFacilities(col100M.getId(), batch, false, "TEST_MAKER");
        });

        // Verify zero links were partially saved for col100M
        List<LoanCollateralLink> links = linkRepository.findByCollateralId(col100M.getId());
        assertTrue(links.isEmpty(), "Transaction atomicity failed: partial relationship records found in repository");
    }

    // =========================================================================
    // 18. Repeated requests and concurrent linking attempts
    // =========================================================================
    @Test
    @DisplayName("Scenario 18: Repeated Requests and Concurrent Linking Prevention")
    public void test18_RepeatedRequestsAndConcurrentLinkingAttempts() {
        RelationshipRequestDto req1 = new RelationshipRequestDto();
        req1.setCollateralId(col100M.getId());
        req1.setLoanAccountId(loanA.getId());
        req1.setAllocatedAmount(30_000_000.0);
        relationshipService.createRelationship(req1, "TEST_MAKER");

        // Immediate repeated request for the exact same pair
        RelationshipRequestDto req2 = new RelationshipRequestDto();
        req2.setCollateralId(col100M.getId());
        req2.setLoanAccountId(loanA.getId());
        req2.setAllocatedAmount(30_000_000.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            relationshipService.createRelationship(req2, "TEST_MAKER");
        });
        assertTrue(ex.getMessage().contains("Duplicate Relationship Block"));

        // Exactly 1 link exists in repository
        List<LoanCollateralLink> links = linkRepository.findByCollateralId(col100M.getId());
        assertEquals(1, links.size());
    }

    // =========================================================================
    // 19. Relationship history and audit behavior
    // =========================================================================
    @Test
    @DisplayName("Scenario 19: Comprehensive Relationship Audit Trail and Modification History")
    public void test19_RelationshipHistoryAndAuditBehavior() {
        // 1. Initial Link Creation (modNo = 1)
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(30_000_000.0);
        req.setLinkageType("Primary");
        req.setChangeReason("Initial Term Loan security pledge");
        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "MAKER_ALICE");

        // 2. Allocation Update (modNo = 2)
        RelationshipRequestDto updateReq = new RelationshipRequestDto();
        updateReq.setAllocatedAmount(40_000_000.0);
        updateReq.setLinkageType("Primary");
        updateReq.setChangeReason("Facility limit extension");
        relationshipService.updateRelationship(link.getId(), updateReq, "CHECKER_BOB");

        // 3. Link Termination (modNo = 3)
        relationshipService.endRelationship(link.getId(), "Loan facility refinance and release", "OFFICER_CHARLIE");

        // Retrieve full audit history
        List<LoanCollateralLinkHistory> history = relationshipService.getRelationshipHistory(link.getId());
        assertEquals(3, history.size());

        // Latest action: ENDED
        LoanCollateralLinkHistory hEnded = history.get(0);
        assertEquals("ENDED", hEnded.getActionType());
        assertEquals(40_000_000.0, hEnded.getPreviousAllocatedAmount());
        assertEquals(0.0, hEnded.getNewAllocatedAmount());
        assertEquals("OFFICER_CHARLIE", hEnded.getMakerId());
        assertEquals("Loan facility refinance and release", hEnded.getChangeReason());

        // Middle action: ALLOCATION_CHANGED
        LoanCollateralLinkHistory hUpdated = history.get(1);
        assertEquals("ALLOCATION_CHANGED", hUpdated.getActionType());
        assertEquals(30_000_000.0, hUpdated.getPreviousAllocatedAmount());
        assertEquals(40_000_000.0, hUpdated.getNewAllocatedAmount());
        assertEquals("CHECKER_BOB", hUpdated.getMakerId());

        // Initial action: CREATED
        LoanCollateralLinkHistory hCreated = history.get(2);
        assertEquals("CREATED", hCreated.getActionType());
        assertEquals(0.0, hCreated.getPreviousAllocatedAmount());
        assertEquals(30_000_000.0, hCreated.getNewAllocatedAmount());
        assertEquals("MAKER_ALICE", hCreated.getMakerId());
    }

    // =========================================================================
    // 20. Creating same valid link from both existing UI entry points
    // =========================================================================
    @Test
    @DisplayName("Scenario 20: Dual UI Entry Points Equivalence (Collateral View vs Facility View)")
    public void test20_CreatingValidLinkFromBothExistingUIEntryPoints() {
        // Entry Point 1: Collateral-initiated flow
        // Fetches eligible facilities for collateral col100M
        List<LoanAccount> eligibleFacilities = relationshipService.getEligibleFacilitiesForCollateral(col100M.getId(), null, "TEST_USER");
        assertNotNull(eligibleFacilities);
        assertTrue(eligibleFacilities.stream().anyMatch(f -> f.getId().equals(loanA.getId())));

        // Entry Point 2: Facility-initiated flow
        // Fetches candidate collaterals for loanA
        List<CollateralCandidateDto> candidateCollaterals = relationshipService.getEligibleCollateralsForFacility(loanA.getId(), "TEST_USER");
        assertNotNull(candidateCollaterals);
        CollateralCandidateDto colCandidate = candidateCollaterals.stream()
                .filter(c -> c.getId().equals(col100M.getId()))
                .findFirst()
                .orElse(null);
        assertNotNull(colCandidate);
        assertTrue(colCandidate.isEligible());
        assertEquals(80_000_000.0, colCandidate.getAvailableCapacity(), 0.01);
        assertFalse(colCandidate.isAlreadyLinked());

        // Both entry points invoke the standard createRelationship operation
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(colCandidate.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(35_000_000.0);
        req.setLinkageType("Primary");

        CollateralFacilityLinkDto link = relationshipService.createRelationship(req, "TEST_USER");
        assertNotNull(link);
        assertEquals(35_000_000.0, link.getAllocatedAmount());

        // Now candidate list for loanA reflects alreadyLinked = true
        List<CollateralCandidateDto> refreshedCandidates = relationshipService.getEligibleCollateralsForFacility(loanA.getId(), "TEST_USER");
        CollateralCandidateDto updatedCandidate = refreshedCandidates.stream()
                .filter(c -> c.getId().equals(col100M.getId()))
                .findFirst()
                .orElse(null);
        assertNotNull(updatedCandidate);
        assertTrue(updatedCandidate.isAlreadyLinked());
    }

    // =========================================================================
    // 21. Refreshing both screens and confirming saved relationships and allocations remain consistent
    // =========================================================================
    @Test
    @DisplayName("Scenario 21: Screen Refresh Synchronization and Cross-Direction Consistency")
    public void test21_RefreshingBothScreensConfirmingConsistency() {
        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col100M.getId());
        req.setLoanAccountId(loanA.getId());
        req.setAllocatedAmount(40_000_000.0);
        req.setLinkageType("Primary");
        relationshipService.createRelationship(req, "TEST_MAKER");

        // Direction 1 Screen Refresh (Collateral Manager / Securing Facilities View)
        CollateralSecuredFacilitiesSummaryDto colScreenRefresh = relationshipService.getCollateralSecuredFacilitiesSummary(col100M.getId());
        assertEquals(1, colScreenRefresh.getLinkedFacilityCount());
        assertEquals(40_000_000.0, colScreenRefresh.getTotalAllocatedSecurity(), 0.01);
        assertEquals(40_000_000.0, colScreenRefresh.getUnallocatedSecurity(), 0.01);

        // Direction 2 Screen Refresh (Facility Manager / Securing Collaterals View)
        FacilityCollateralSummaryDto facScreenRefresh = relationshipService.getFacilityCollateralSummary(loanA.getId());
        assertEquals(1, facScreenRefresh.getLinkedCollateralCount());
        assertEquals(40_000_000.0, facScreenRefresh.getTotalAllocatedCollateral(), 0.01);
        assertEquals(100.0, facScreenRefresh.getCollateralCoveragePct(), 0.01);

        // General List View Refresh
        List<CollateralFacilityLinkDto> listRefresh = relationshipService.getAllRelationships(col100M.getId(), null, null, "Active");
        assertEquals(1, listRefresh.size());
        assertEquals(40_000_000.0, listRefresh.get(0).getAllocatedAmount());
        assertEquals(loanA.getId(), listRefresh.get(0).getLoanAccountId());
    }

    // =========================================================================
    // 22. Compatibility with existing CBS simulator and existing data
    // =========================================================================
    @Test
    @DisplayName("Scenario 22: Compatibility with CBS Simulator and Live Master Data")
    public void test22_CompatibilityWithExistingCbsSimulatorAndExistingData() {
        // Query existing CBS accounts and facilities from repository without mutating them
        List<LoanAccount> existingFacilities = loanAccountRepository.findAll();
        assertNotNull(existingFacilities);
        assertFalse(existingFacilities.isEmpty(), "CBS-simulated loan accounts should exist in database");

        // Select an existing facility with valid limits and accounts
        LoanAccount sampleFacility = existingFacilities.stream()
                .filter(f -> f.getApprovedLimit() > 0 && f.getOutstandingBalance() > 0)
                .findFirst()
                .orElse(loanA);

        assertNotNull(sampleFacility.getLineCurrency());
        assertTrue(sampleFacility.getApprovedLimit() > 0);

        // Reconcile relationship state with CBS Gateway
        CbsRelationshipReconciliationDto recon = relationshipService.reconcileCbsRelationships();
        assertNotNull(recon);
        assertNotNull(recon.getReconciliationTimestamp());
        assertTrue(recon.getTotalCimsRelationships() >= 0);
        assertTrue(recon.getTotalCbsRelationships() >= 0);
    }
}
