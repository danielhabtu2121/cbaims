package com.bank.cims;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class ThirdPartyCollateralRemediationIntegrationTest {

    @Autowired
    private CollateralFacilityRelationshipService relationshipService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private EffectiveInsuranceService effectiveInsuranceService;

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

    private Customer borrowerA;
    private Customer borrowerB;
    private LoanAccount loanA1;
    private LoanAccount loanA2;
    private LoanAccount loanB1;

    @BeforeEach
    public void setUp() {
        String uid = UUID.randomUUID().toString().substring(0, 6);

        // Borrower A
        borrowerA = new Customer();
        borrowerA.setId("cust-a-" + uid);
        borrowerA.setCif("CIF-A-" + uid);
        borrowerA.setName("Borrower A Corp " + uid);
        borrowerA.setSegment("Corporate Banking");
        borrowerA.setCustomerType("Corporate");
        borrowerA.setStatus("Active");
        customerRepository.save(borrowerA);

        // Borrower B
        borrowerB = new Customer();
        borrowerB.setId("cust-b-" + uid);
        borrowerB.setCif("CIF-B-" + uid);
        borrowerB.setName("Borrower B Ltd " + uid);
        borrowerB.setSegment("Commercial Banking");
        borrowerB.setCustomerType("Corporate");
        borrowerB.setStatus("Active");
        customerRepository.save(borrowerB);

        // Facilities for Borrower A
        loanA1 = new LoanAccount();
        loanA1.setId("fac-a1-" + uid);
        loanA1.setLoanReference("LN-A1-" + uid);
        loanA1.setLineCode("FAC-A1-" + uid);
        loanA1.setCustomerId(borrowerA.getId());
        loanA1.setFacilityType("Term Loan");
        loanA1.setApprovedLimit(50_000_000.0);
        loanA1.setOutstandingBalance(40_000_000.0);
        loanA1.setStatus("Active");
        loanA1.setSegment("Corporate Banking");
        loanA1.setBranch("BRN-001");
        loanAccountRepository.save(loanA1);

        loanA2 = new LoanAccount();
        loanA2.setId("fac-a2-" + uid);
        loanA2.setLoanReference("LN-A2-" + uid);
        loanA2.setLineCode("FAC-A2-" + uid);
        loanA2.setCustomerId(borrowerA.getId());
        loanA2.setFacilityType("Overdraft Facility");
        loanA2.setApprovedLimit(30_000_000.0);
        loanA2.setOutstandingBalance(25_000_000.0);
        loanA2.setStatus("Active");
        loanA2.setSegment("Corporate Banking");
        loanA2.setBranch("BRN-001");
        loanAccountRepository.save(loanA2);

        // Facility for Borrower B
        loanB1 = new LoanAccount();
        loanB1.setId("fac-b1-" + uid);
        loanB1.setLoanReference("LN-B1-" + uid);
        loanB1.setLineCode("FAC-B1-" + uid);
        loanB1.setCustomerId(borrowerB.getId());
        loanB1.setFacilityType("Term Loan");
        loanB1.setApprovedLimit(20_000_000.0);
        loanB1.setOutstandingBalance(15_000_000.0);
        loanB1.setStatus("Active");
        loanB1.setSegment("Commercial Banking");
        loanB1.setBranch("BRN-002");
        loanAccountRepository.save(loanB1);
    }

    private Collateral createBaseCollateral(String codePrefix, String ownerType, double valAmount, double haircut) {
        String uid = UUID.randomUUID().toString().substring(0, 6);
        Collateral col = new Collateral();
        col.setId("col-" + codePrefix.toLowerCase() + "-" + uid);
        col.setCode(codePrefix + "-" + uid);
        col.setCustomerId(borrowerA.getId());
        col.setDescription("Commercial Property " + uid);
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setOwnerType(ownerType);
        col.setCurrency("ETB");
        col.setValuationAmount(valAmount);
        col.setHaircut(haircut);
        col.setNsv(valAmount * (1.0 - (haircut / 100.0)));
        col.setStatus("Active");
        col.setOwningSegment("Corporate Banking");
        col.setBranch("BRN-001");
        col.setAuthStat("A");
        col.setRecordStat("O");
        return collateralRepository.save(col);
    }

    private OwnershipDocument createDoc(String collateralId, String docType, String docName) {
        OwnershipDocument doc = new OwnershipDocument();
        doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
        doc.setCollateralId(collateralId);
        doc.setEntityId(collateralId);
        doc.setEntityType("Collateral");
        doc.setType(docType);
        doc.setName(docName);
        doc.setFileName(docName.toLowerCase().replace(" ", "_") + ".pdf");
        doc.setFileContent("JVBERi0xLjQKJcTl8uXr...valid-content");
        doc.setDmsRef("DMS-REF-" + System.currentTimeMillis());
        doc.setStatus("Active");
        doc.setVerificationStatus("Recorded");
        doc.setUploadDate(LocalDate.now().toString());
        return documentRepository.save(doc);
    }

    @Test
    @DisplayName("Scenario 1: Borrower-owned collateral registration & credit facility linking")
    public void test01_borrowerOwnedCollateralRegistrationAndLink() {
        Collateral col = createBaseCollateral("COL-BORR", "Borrower-owned", 100_000_000.0, 20.0);
        assertEquals(80_000_000.0, col.getNsv());

        // Link to Borrower A's loan
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 50_000_000.0)),
                "TEST_USER"
        );

        List<LoanCollateralLink> links = linkRepository.findByCollateralId(col.getId());
        assertEquals(1, links.size());
        assertEquals("Active", links.get(0).getStatus());
        assertEquals(50_000_000.0, links.get(0).getAllocatedAmount());
        assertEquals(loanA1.getId(), links.get(0).getLoanAccountId());
    }

    @Test
    @DisplayName("Scenario 2: Third-party collateral registration, legal owner validation, consent docs, and link")
    public void test02_thirdPartyCollateralRegistrationOwnershipValidationConsentDocsAndLink() {
        Collateral col = createBaseCollateral("COL-3RD", "Third-party-owned", 100_000_000.0, 20.0);

        // Add legal owner
        CollateralOwner legalOwner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 6),
                "Abebe Tadesse", "+251911223344", col.getId(), "Third-Party Owner", 100.0);
        legalOwner.setOwnershipType("Third-party-owned");
        legalOwner.setOwnerType("Individual");
        legalOwner.setIdNumber("ET-ID-881920");
        legalOwner.setTin("TIN-100299");
        legalOwner.setRelationshipToBorrower("Shareholder");
        legalOwner.setConsentInfo("Pledge Consent Notarized 2026");
        legalOwner.setPledgeAgreementRef("PLG-AGR-2026-001");
        legalOwner.setStatus("Active");
        collateralOwnerRepository.save(legalOwner);

        col.setOwners(new ArrayList<>(List.of(legalOwner)));
        collateralRepository.save(col);

        // Add mandatory third-party documents
        createDoc(col.getId(), "Third-Party Consent and Pledge Agreement", "Executed Third-Party Pledge Agreement");
        createDoc(col.getId(), "Letter of Consent", "Official Letter of Consent from Legal Owner");

        // Validate ownership and mandatory docs via ValidationService
        assertDoesNotThrow(() -> validationService.validateOwnership(col));
        assertDoesNotThrow(() -> validationService.validateThirdPartyMandatoryDocuments(col));

        // Link to Borrower A facility
        assertDoesNotThrow(() -> relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 60_000_000.0)),
                "TEST_USER"
        ));

        List<LoanCollateralLink> links = linkRepository.findByCollateralId(col.getId());
        assertEquals(1, links.size());
        assertEquals(60_000_000.0, links.get(0).getAllocatedAmount());
    }

    @Test
    @DisplayName("Scenario 3: Third-party collateral multi-facility allocation within NSV capacity")
    public void test03_thirdPartyCollateralMultiFacilityAllocationWithinNSV() {
        Collateral col = createBaseCollateral("COL-MULTI", "Third-party-owned", 100_000_000.0, 20.0);
        assertEquals(80_000_000.0, col.getNsv());

        CollateralOwner legalOwner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 6),
                "Dawit Holdings PLC", "+251911556677", col.getId(), "Third-Party Owner", 100.0);
        legalOwner.setOwnershipType("Third-party-owned");
        legalOwner.setOwnerType("Corporate");
        legalOwner.setBusinessRegNo("REG-99120");
        legalOwner.setTin("TIN-889922");
        legalOwner.setRelationshipToBorrower("Parent Company");
        legalOwner.setConsentInfo("Board Resolution & Consent");
        legalOwner.setPledgeAgreementRef("PLG-REF-9921");
        legalOwner.setStatus("Active");
        collateralOwnerRepository.save(legalOwner);
        col.setOwners(new ArrayList<>(List.of(legalOwner)));
        collateralRepository.save(col);

        createDoc(col.getId(), "Third-Party Consent and Pledge Agreement", "Corporate Pledge Agreement");
        createDoc(col.getId(), "Letter of Consent", "Board Consent Letter");

        // Allocate 50M to Loan A1, 30M to Loan A2 (Total 80M = NSV)
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(
                        Map.of("facilityId", loanA1.getId(), "allocatedAmount", 50_000_000.0),
                        Map.of("facilityId", loanA2.getId(), "allocatedAmount", 30_000_000.0)
                ),
                "TEST_USER"
        );

        CollateralSecuredFacilitiesSummaryDto summary = relationshipService.getCollateralSecuredFacilitiesSummary(col.getId());
        assertEquals(80_000_000.0, summary.getTotalAllocatedSecurity(), 0.01);
        assertEquals(0.0, summary.getUnallocatedSecurity(), 0.01);
        assertEquals(2, summary.getSecuredFacilities().size());
    }

    @Test
    @DisplayName("Scenario 4: Joint ownership validation requiring 100% and at least 2 active owners")
    public void test04_jointOwnershipValidationRules() {
        Collateral col = createBaseCollateral("COL-JOINT", "Jointly-owned", 50_000_000.0, 20.0);

        // Case A: Single owner with 100% -> must reject (< 2 owners)
        CollateralOwner o1 = new CollateralOwner("o1", "Owner One", "0911", col.getId(), "Joint Owner", 100.0);
        o1.setStatus("Active");
        Exception exSingle = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateJointOwnership(List.of(o1)));
        assertTrue(exSingle.getMessage().contains("At least two") || exSingle.getMessage().contains("at least two"));

        // Case B: Two owners summing to 90% -> must reject
        CollateralOwner o2 = new CollateralOwner("o2", "Owner Two", "0912", col.getId(), "Joint Owner", 30.0);
        o1.setPercentage(60.0);
        o2.setStatus("Active");
        Exception exDeficit = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateJointOwnership(List.of(o1, o2)));
        assertTrue(exDeficit.getMessage().contains("100.00%"));

        // Case C: Two owners summing to 110% -> must reject
        o2.setPercentage(50.0); // 60 + 50 = 110
        Exception exSurplus = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateJointOwnership(List.of(o1, o2)));
        assertTrue(exSurplus.getMessage().contains("100.00%"));

        // Case D: Two owners summing to exactly 100% (60% + 40%) -> must succeed
        o2.setPercentage(40.0);
        assertDoesNotThrow(() -> validationService.validateJointOwnership(List.of(o1, o2)));
    }

    @Test
    @DisplayName("Scenario 5: Rejection of third-party collateral missing legal owner identity or documented relationship")
    public void test05_rejectionThirdPartyCollateralMissingIdentityOrRelationship() {
        Collateral col = createBaseCollateral("COL-INV3RD", "Third-party-owned", 40_000_000.0, 20.0);

        // 1. Missing owners entirely
        col.setOwners(Collections.emptyList());
        Exception exNoOwners = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyOwnership(col));
        assertTrue(exNoOwners.getMessage().contains("At least one legal owner") || exNoOwners.getMessage().contains("mandatory"));

        // 2. Placeholder name
        CollateralOwner owner = new CollateralOwner("o1", "Third-Party Owner", "0911", col.getId(), "Third-Party", 100.0);
        owner.setOwnerType("Individual");
        owner.setIdNumber("ET-ID-12345");
        owner.setRelationshipToBorrower("Shareholder");
        owner.setConsentInfo("Consent Ref 123");
        owner.setStatus("Active");
        col.setOwners(List.of(owner));
        Exception exName = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyOwnership(col));
        assertTrue(exName.getMessage().contains("valid legal name"));

        // 3. Missing relationshipToBorrower
        owner.setName("Valid Legal Person");
        owner.setRelationshipToBorrower("   ");
        Exception exRel = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyOwnership(col));
        assertTrue(exRel.getMessage().contains("explicitly specified relationship"));

        // 4. Missing legal identification (National ID and TIN empty)
        owner.setRelationshipToBorrower("Guarantor");
        owner.setIdNumber("  ");
        owner.setTin("  ");
        Exception exId = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyOwnership(col));
        assertTrue(exId.getMessage().contains("must have National ID") || exId.getMessage().contains("valid identification"));

        // 5. Missing consent/pledge reference
        owner.setIdNumber("ET-ID-9922");
        owner.setConsentInfo("  ");
        owner.setPledgeAgreementRef("  ");
        Exception exConsent = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyOwnership(col));
        assertTrue(exConsent.getMessage().contains("consent details or pledge agreement reference"));
    }

    @Test
    @DisplayName("Scenario 6: Rejection of third-party collateral missing consent/pledge documents")
    public void test06_rejectionThirdPartyCollateralMissingConsentPledgeDocuments() {
        Collateral col = createBaseCollateral("COL-NODOC", "Third-party-owned", 50_000_000.0, 20.0);

        CollateralOwner legalOwner = new CollateralOwner("o1", "Tigist Alemu", "0911223344", col.getId(), "Third-Party Owner", 100.0);
        legalOwner.setOwnershipType("Third-party-owned");
        legalOwner.setOwnerType("Individual");
        legalOwner.setIdNumber("ET-ID-554433");
        legalOwner.setRelationshipToBorrower("Director");
        legalOwner.setConsentInfo("Notarized consent reference");
        legalOwner.setPledgeAgreementRef("PLG-2026-99");
        legalOwner.setStatus("Active");
        collateralOwnerRepository.save(legalOwner);
        col.setOwners(new ArrayList<>(List.of(legalOwner)));
        collateralRepository.save(col);

        // No documents uploaded for this collateral
        Exception exDocs = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateThirdPartyMandatoryDocuments(col));
        assertTrue(exDocs.getMessage().contains("Third-Party Consent and Pledge Agreement") || exDocs.getMessage().contains("Letter of Consent"));
    }

    @Test
    @DisplayName("Scenario 7: Customer isolation enforcement (borrower-owned cannot cross-link)")
    public void test07_customerIsolationEnforcement() {
        // Collateral registered under Borrower A as Borrower-owned
        Collateral colA = createBaseCollateral("COL-CUST-A", "Borrower-owned", 60_000_000.0, 20.0);

        // Attempting to link Borrower A's collateral to Borrower B's facility (loanB1)
        Exception exIso = assertThrows(IllegalArgumentException.class, () ->
                relationshipService.allocateCollateralFacilities(
                        colA.getId(),
                        List.of(Map.of("facilityId", loanB1.getId(), "allocatedAmount", 30_000_000.0)),
                        "TEST_USER"
                ));
        assertTrue(exIso.getMessage().contains("Borrower validation failed") || exIso.getMessage().contains("Customer Isolation"));
    }

    @Test
    @DisplayName("Scenario 8: Allocation overflow rejection (> NSV)")
    public void test08_allocationOverflowRejection() {
        Collateral col = createBaseCollateral("COL-OVERFLOW", "Borrower-owned", 100_000_000.0, 20.0);
        assertEquals(80_000_000.0, col.getNsv());

        // Attempting to allocate 85,000,000.0 (> 80,000,000.0 NSV)
        Exception exOverflow = assertThrows(IllegalArgumentException.class, () ->
                relationshipService.allocateCollateralFacilities(
                        col.getId(),
                        List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 85_000_000.0)),
                        "TEST_USER"
                ));
        assertTrue(exOverflow.getMessage().contains("exceeds net collateral value") || exOverflow.getMessage().contains("exceeds collateral Net Security Value"));
    }

    @Test
    @DisplayName("Scenario 9: Multi-allocation with facility deallocation and historical link retention")
    public void test09_multiAllocationWithFacilityDeallocationAndHistoricalRetention() {
        Collateral col = createBaseCollateral("COL-DEALLOC", "Borrower-owned", 100_000_000.0, 20.0);

        // Step 1: Allocate to Loan A1 and Loan A2
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(
                        Map.of("facilityId", loanA1.getId(), "allocatedAmount", 40_000_000.0),
                        Map.of("facilityId", loanA2.getId(), "allocatedAmount", 30_000_000.0)
                ),
                "MAKER_USER"
        );

        List<LoanCollateralLink> initialLinks = linkRepository.findByCollateralId(col.getId());
        assertEquals(2, initialLinks.stream().filter(l -> "Active".equalsIgnoreCase(l.getStatus())).count());

        // Step 2: Re-allocate with only Loan A1 (50M) -> Loan A2 should be deallocated/ended
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 50_000_000.0)),
                "MAKER_USER"
        );

        List<LoanCollateralLink> updatedLinks = linkRepository.findByCollateralId(col.getId());
        // Verify active link
        List<LoanCollateralLink> activeLinks = updatedLinks.stream()
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()))
                .toList();
        assertEquals(1, activeLinks.size());
        assertEquals(loanA1.getId(), activeLinks.get(0).getLoanAccountId());
        assertEquals(50_000_000.0, activeLinks.get(0).getAllocatedAmount());

        // Verify deallocated link retained as Historical / Ended without deletion
        List<LoanCollateralLink> inactiveLinks = updatedLinks.stream()
                .filter(l -> !"Active".equalsIgnoreCase(l.getStatus()))
                .toList();
        assertEquals(1, inactiveLinks.size());
        assertEquals(loanA2.getId(), inactiveLinks.get(0).getLoanAccountId());
        assertNotNull(inactiveLinks.get(0).getEndDate());
    }

    @Test
    @DisplayName("Scenario 10: Change of collateral ownership with authStat = 'U' and historical owner retention")
    public void test10_changeCollateralOwnershipWithAuthStatUAndHistoricalRetention() {
        Collateral col = createBaseCollateral("COL-CHANGE-OWN", "Borrower-owned", 80_000_000.0, 20.0);

        // Initial Owner
        CollateralOwner initialOwner = new CollateralOwner("init-own-" + UUID.randomUUID().toString().substring(0, 5),
                "Original Borrower Owner", "0911000000", col.getId(), "Borrower", 100.0);
        initialOwner.setStatus("Active");
        collateralOwnerRepository.save(initialOwner);
        col.setOwners(new ArrayList<>(List.of(initialOwner)));
        collateralRepository.save(col);

        // Upload mandatory third-party documents required by central banking policy
        createDoc(col.getId(), "Third-Party Consent and Pledge Agreement", "Group Restructuring Pledge Agreement");
        createDoc(col.getId(), "Letter of Consent", "Corporate Letter of Consent");

        // Prepare change payload
        Map<String, Object> changePayload = new HashMap<>();
        changePayload.put("newOwnerName", "New Legal Owner Corp");
        changePayload.put("newOwnershipType", "Third-party-owned");
        changePayload.put("newOwnerType", "Corporate");
        changePayload.put("idNumber", "REG-882200");
        changePayload.put("tin", "TIN-992211");
        changePayload.put("relationshipToBorrower", "Parent Company");
        changePayload.put("consentInfo", "Board Resolution 2026/01");
        changePayload.put("pledgeAgreementRef", "PLG-NEW-2026");
        changePayload.put("ownershipPercentage", 100.0);
        changePayload.put("reason", "Asset pledge transfer via group restructuring");
        changePayload.put("effectiveDate", LocalDate.now().toString());

        // Execute change
        Map<String, Object> result = cimsService.changeCollateralOwnership(col.getId(), changePayload, "MAKER_USER");
        assertTrue((Boolean) result.get("success"));

        // Verify Collateral status
        Collateral updatedCol = collateralRepository.findById(col.getId()).orElseThrow();
        assertEquals("Third-party-owned", updatedCol.getOwnerType());
        assertEquals("U", updatedCol.getAuthStat()); // Requires checker approval

        // Verify Owner records in collateral
        List<CollateralOwner> owners = updatedCol.getOwners();
        assertEquals(2, owners.size());

        // Previous owner is Historical / Superseded
        CollateralOwner histOwner = owners.stream().filter(o -> "Historical".equalsIgnoreCase(o.getStatus())).findFirst().orElseThrow();
        assertEquals("Original Borrower Owner", histOwner.getName());
        assertNotNull(histOwner.getSupersededDate());

        // New owner is Active, requires authorization ("U")
        CollateralOwner activeOwner = owners.stream().filter(o -> "Active".equalsIgnoreCase(o.getStatus())).findFirst().orElseThrow();
        assertEquals("New Legal Owner Corp", activeOwner.getName());
        assertEquals("U", activeOwner.getAuthStat());
        assertEquals("Parent Company", activeOwner.getRelationshipToBorrower());
    }

    @Test
    @DisplayName("Scenario 11: Collateral release blocked if active linked facility has outstanding balance > 0")
    public void test11_collateralReleaseBlockedWhenActiveFacilityHasOutstandingBalance() {
        Collateral col = createBaseCollateral("COL-REL-TEST", "Borrower-owned", 80_000_000.0, 20.0);

        // Link to Loan A1 which has outstanding balance of 40M
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 50_000_000.0)),
                "TEST_USER"
        );

        // ValidationService validateCollateralRelease should throw
        Exception exRel = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateCollateralRelease(col.getId()));
        assertTrue(exRel.getMessage().contains("Collateral cannot be released") && exRel.getMessage().contains("outstanding secured exposure"));

        // Relationship-aware validation check should return eligibleForRelease = false
        Map<String, Object> relCheck = relationshipService.validateCollateralRelease(col.getId());
        assertFalse((Boolean) relCheck.get("eligibleForRelease"));
        assertTrue(((String) relCheck.get("message")).contains("cannot be released") || ((String) relCheck.get("message")).contains("outstanding exposure"));
    }

    @Test
    @DisplayName("Scenario 12: Expired policy handling and active link exposure calculation without double-counting")
    public void test12_exposureCalculationAndExpiredPolicyHandling() {
        Collateral col = createBaseCollateral("COL-EXP-CALC", "Borrower-owned", 80_000_000.0, 20.0);

        // Link to Loan A1
        relationshipService.allocateCollateralFacilities(
                col.getId(),
                List.of(Map.of("facilityId", loanA1.getId(), "allocatedAmount", 50_000_000.0)),
                "TEST_USER"
        );

        // Add Expired Insurance Policy
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 6));
        policy.setPolicyNumber("POL-EXP-001");
        policy.setCollateralId(col.getId());
        policy.setInsuredAmount(80_000_000.0);
        policy.setStatus("Expired");
        policy.setEffectiveDate(LocalDate.now().minusMonths(14).toString());
        policy.setExpiryDate(LocalDate.now().minusMonths(2).toString());
        policyRepository.save(policy);

        // Check exposure and adequacy calculation
        ExposureAdequacySummaryDto exposureSummary = exposureCalculationService.calculateExposureAndAdequacy(col.getId());
        assertNotNull(exposureSummary);
        assertEquals(loanA1.getApprovedLimit(), exposureSummary.getTotalFacilityLimit());
        assertEquals(loanA1.getOutstandingBalance(), exposureSummary.getTotalOutstandingExposure());

        // Policy is expired, so currentInsuredAmount must be 0
        assertEquals(0.0, exposureSummary.getCurrentInsuredAmount(), 0.01);
        assertEquals("UNDERINSURED", exposureSummary.getAdequacyStatus());
    }
}
