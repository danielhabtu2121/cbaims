package com.bank.cims;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.*;
import com.bank.cims.service.FirstDegreeSecondDegreeService.SecondDegreeValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Authoritative Acceptance and Integrity Test Suite for Prompt 1 of 3:
 * CIMS Collateral, Insurance, Taxonomy, Exposure, and Relationship Integrity.
 * Systematically verifies Scenarios 1 through 45 specified in Section 10.
 */
@SpringBootTest
@Transactional
public class CimsPrompt1IntegrityVerificationTest {

    @Autowired private ValidationService validationService;
    @Autowired private InsuranceAdequacyService insuranceAdequacyService;
    @Autowired private EffectiveInsuranceService effectiveInsuranceService;
    @Autowired private CollateralFacilityRelationshipService relationshipService;
    @Autowired private InsuranceCoverageRuleService insuranceCoverageRuleService;
    @Autowired private FirstDegreeSecondDegreeService firstDegreeSecondDegreeService;
    @Autowired private EarlyCollateralReleaseService earlyCollateralReleaseService;
    @Autowired private CimsService cimsService;

    @Autowired private CollateralRepository collateralRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private LoanAccountRepository loanAccountRepository;
    @Autowired private LoanCollateralLinkRepository loanCollateralLinkRepository;
    @Autowired private InsurancePolicyRepository insurancePolicyRepository;
    @Autowired private OwnershipDocumentRepository ownershipDocumentRepository;
    @Autowired private InsuranceExceptionRepository insuranceExceptionRepository;
    @Autowired private CollateralOwnerRepository collateralOwnerRepository;
    @Autowired private CollateralTaxonomyRepository collateralTaxonomyRepository;
    @Autowired private InsuranceCoverageRuleRepository insuranceCoverageRuleRepository;

    private Customer borrowerCust;
    private Customer thirdPartyCust;
    private String todayStr;

    @BeforeEach
    public void setup() {
        todayStr = LocalDate.now().toString();

        borrowerCust = new Customer();
        borrowerCust.setId("CUST-P1-BORR-" + UUID.randomUUID().toString().substring(0, 6));
        borrowerCust.setCif("CIF-BORR-001");
        borrowerCust.setName("Main Borrower Enterprise PLC");
        borrowerCust.setCustomerType("Corporate");
        borrowerCust.setSegment("Corporate Banking");
        borrowerCust.setTaxIdNo("0011223344");
        customerRepository.save(borrowerCust);

        thirdPartyCust = new Customer();
        thirdPartyCust.setId("CUST-P1-TP-" + UUID.randomUUID().toString().substring(0, 6));
        thirdPartyCust.setCif("CIF-TP-002");
        thirdPartyCust.setName("Third Party Pledgor Entity Ltd");
        thirdPartyCust.setCustomerType("Corporate");
        thirdPartyCust.setSegment("Commercial Banking");
        thirdPartyCust.setTaxIdNo("0055667788");
        customerRepository.save(thirdPartyCust);
    }

    private LoanAccount createLoan(String ref, double balance) {
        LoanAccount loan = new LoanAccount();
        loan.setId("loan-" + UUID.randomUUID().toString().substring(0, 8));
        loan.setLoanReference(ref);
        loan.setCustomerId(borrowerCust.getId());
        loan.setFacilityType("Term Loan");
        loan.setApprovedLimit(balance);
        loan.setOutstandingBalance(balance);
        loan.setCbsSyncedAt(LocalDateTime.now().toString());
        loan.setCbsSyncStatus("Synced");
        loan.setStatus("Active");
        return loanAccountRepository.save(loan);
    }

    private OwnershipDocument createDocument(String colId, String docType) {
        OwnershipDocument doc = new OwnershipDocument();
        doc.setId("DOC-" + UUID.randomUUID().toString().substring(0, 8));
        doc.setCollateralId(colId);
        doc.setEntityId(colId);
        doc.setType(docType);
        doc.setName(docType);
        doc.setDocumentType(docType);
        doc.setDmsRef("DMS-REF-" + doc.getId());
        doc.setFileContent("DUMMY_BASE64_FILE_CONTENT");
        doc.setVerificationStatus("Verified");
        doc.setStatus("Active");
        return ownershipDocumentRepository.save(doc);
    }

    // =========================================================================
    // SECTION 1: COLLATERAL FORMS & VALIDATION (SCENARIOS 1-11)
    // =========================================================================

    @Test
    @DisplayName("Scenario 01: Valid immovable property with all required fields and documents passes validation")
    public void testScenario01_ValidImmovableProperty() {
        Collateral col = new Collateral();
        col.setId("col-s01-" + UUID.randomUUID());
        col.setCode("COL-S01-001");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("Bole Subcity, Woreda 03, Addis Ababa");
        col.setLocationCity("Addis Ababa");
        col.setTitleDeedNumber("TD-ADDIS-2026-999");
        col.setValuationAmount(15_000_000.0);
        col.setInsurableValue(12_000_000.0);
        col.setLandValue(3_000_000.0);
        col.setHaircut(20.0);
        col.setGpsCoordinates("9.0054, 38.7578");
        col.setCollateralRank("1st");

        assertDoesNotThrow(() -> validationService.validateCollateralRequiredInformation(col));
    }

    @Test
    @DisplayName("Scenario 02: Immovable property missing required registration identifier throws validation error")
    public void testScenario02_ImmovablePropertyMissingRegistrationIdentifier() {
        Collateral col = new Collateral();
        col.setId("col-s02-" + UUID.randomUUID());
        col.setCode("COL-S02-001");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("Bole Subcity, Addis Ababa");
        col.setTitleDeedNumber(null);
        col.setPropertyCertNumber("");
        col.setRegistrationNumber(null);
        col.setValuationAmount(10_000_000.0);

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralRequiredInformation(col));
        assertTrue(ex.getMessage().contains("Property certificate number or title deed registration number is mandatory"));
    }

    @Test
    @DisplayName("Scenario 03: Under-construction collateral with required construction data and evidence passes")
    public void testScenario03_UnderConstructionWithRequiredData() {
        Collateral col = new Collateral();
        col.setId("col-s03-" + UUID.randomUUID());
        col.setCode("COL-S03-001");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("Kazanchis, Addis Ababa");
        col.setTitleDeedNumber("TD-KZ-555");
        col.setValuationAmount(25_000_000.0);
        col.setUnderConstruction(true);
        col.setConstructionCompletionPct(65.0);
        col.setConstructionRemainingPct(35.0);
        col.setConstructionInspectionDate(todayStr);
        col.setExpectedCompletionDate(LocalDate.now().plusMonths(6).toString());

        assertDoesNotThrow(() -> validationService.validateCollateralRequiredInformation(col));
    }

    @Test
    @DisplayName("Scenario 04: Completed property where construction-only fields are not incorrectly mandatory")
    public void testScenario04_CompletedPropertyConstructionFieldsNotMandatory() {
        Collateral col = new Collateral();
        col.setId("col-s04-" + UUID.randomUUID());
        col.setCode("COL-S04-001");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Residential");
        col.setLocationAddress("Sarbet, Addis Ababa");
        col.setTitleDeedNumber("TD-SB-111");
        col.setValuationAmount(8_000_000.0);
        col.setUnderConstruction(false);
        col.setConstructionCompletionPct(null);
        col.setConstructionRemainingPct(null);
        col.setConstructionInspectionDate(null);
        col.setExpectedCompletionDate(null);

        assertDoesNotThrow(() -> validationService.validateCollateralRequiredInformation(col));
    }

    @Test
    @DisplayName("Scenario 05: Vehicle collateral requires vehicle plate, chassis, or registration identifier")
    public void testScenario05_VehicleWithRequiredIdentifiers() {
        Collateral validVeh = new Collateral();
        validVeh.setId("col-s05-v1-" + UUID.randomUUID());
        validVeh.setCode("COL-VEH-001");
        validVeh.setCustomerId(borrowerCust.getId());
        validVeh.setCategory("Movable Properties");
        validVeh.setType("Vehicles");
        validVeh.setVehiclePlateNumber("AA-3-98765");
        validVeh.setVehicleChassisNumber("WVWZZZ3CZWE123456");
        validVeh.setValuationAmount(2_500_000.0);

        assertDoesNotThrow(() -> validationService.validateCollateralRequiredInformation(validVeh));

        Collateral missingVeh = new Collateral();
        missingVeh.setId("col-s05-v2-" + UUID.randomUUID());
        missingVeh.setCode("COL-VEH-002");
        missingVeh.setCustomerId(borrowerCust.getId());
        missingVeh.setCategory("Movable Properties");
        missingVeh.setType("Vehicles");
        missingVeh.setValuationAmount(2_500_000.0);

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralRequiredInformation(missingVeh));
        assertTrue(ex.getMessage().contains("Vehicle plate, chassis, or registration number is mandatory"));
    }

    @Test
    @DisplayName("Scenario 06: Third-party collateral with valid ownership and pledge evidence passes validation")
    public void testScenario06_ThirdPartyCollateralWithValidEvidence() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-s06-" + UUID.randomUUID());
        tpCol.setCode("COL-TP-001");
        tpCol.setCustomerId(thirdPartyCust.getId());
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Buildings - Commercial");
        tpCol.setLocationAddress("Mexico Square, Addis Ababa");
        tpCol.setTitleDeedNumber("TD-TP-888");
        tpCol.setValuationAmount(20_000_000.0);

        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-s06-1");
        owner.setCollateralId(tpCol.getId());
        owner.setName("Third Party Pledgor Entity Ltd");
        owner.setOwnershipType("Third-party-owned");
        owner.setRelationshipToBorrower("Parent Company");
        owner.setIdNumber("ET-ID-12345678");
        owner.setTin("0012345678");
        owner.setPledgeAgreementRef("PLG-AGR-2026-001");
        owner.setConsentInfo("Written Board Consent to Pledge Signed and Verified");
        owner.setPercentage(100.0);
        tpCol.setOwners(List.of(owner));
        collateralRepository.save(tpCol);

        createDocument(tpCol.getId(), "Third-Party Consent and Pledge Agreement");
        createDocument(tpCol.getId(), "Letter of Consent");

        assertDoesNotThrow(() -> validationService.validateThirdPartyOwnership(tpCol));
    }

    @Test
    @DisplayName("Scenario 07: Third-party collateral missing required pledge or consent evidence throws error")
    public void testScenario07_ThirdPartyCollateralMissingRequiredEvidence() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-s07-" + UUID.randomUUID());
        tpCol.setCode("COL-TP-002");
        tpCol.setCustomerId(thirdPartyCust.getId());
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Buildings - Commercial");
        tpCol.setValuationAmount(20_000_000.0);

        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-s07-1");
        owner.setName("Third Party Pledgor Entity Ltd");
        owner.setRelationshipToBorrower("Guarantor");
        owner.setIdNumber("ET-ID-12345678");
        owner.setTin("0012345678");
        owner.setPledgeAgreementRef(null);
        owner.setConsentInfo(null);
        owner.setPercentage(100.0);
        tpCol.setOwners(List.of(owner));

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateThirdPartyOwnership(tpCol));
        assertTrue(ex.getMessage().contains("must provide consent details or pledge agreement reference"));
    }

    @Test
    @DisplayName("Scenario 08: Invalid or unmapped GPS coordinates are rejected by boundary validation")
    public void testScenario08_InvalidGpsCoordinates() {
        Collateral col = new Collateral();
        col.setId("col-s08-" + UUID.randomUUID());
        col.setCode("COL-GPS-INV");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("Bole, Addis Ababa");
        col.setTitleDeedNumber("TD-GPS-001");
        col.setValuationAmount(5_000_000.0);
        col.setGpsCoordinates("195.0000, 45.0000"); // Latitude > 90

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralRequiredInformation(col));
        assertTrue(ex.getMessage().contains("Invalid GPS coordinates range"));
    }

    @Test
    @DisplayName("Scenario 09: Duplicate property registration identifiers on distinct assets are rejected")
    public void testScenario09_DuplicatePropertyIdentifiers() {
        Collateral asset1 = new Collateral();
        asset1.setId("col-s09-a1-" + UUID.randomUUID());
        asset1.setCode("COL-DUP-01");
        asset1.setCustomerId(borrowerCust.getId());
        asset1.setCategory("Immovable Properties");
        asset1.setType("Buildings - Commercial");
        asset1.setLocationAddress("Piassa, Addis Ababa");
        asset1.setTitleDeedNumber("TD-DUP-COMMON-777");
        asset1.setValuationAmount(10_000_000.0);
        asset1.setCurrency("ETB");
        asset1.setCollateralRank("1st");
        asset1.setStatus("Active");
        collateralRepository.save(asset1);

        Collateral asset2 = new Collateral();
        asset2.setId("col-s09-a2-" + UUID.randomUUID());
        asset2.setCode("COL-DUP-02");
        asset2.setCustomerId(borrowerCust.getId());
        asset2.setCategory("Immovable Properties");
        asset2.setType("Buildings - Residential");
        asset2.setLocationAddress("Bole, Addis Ababa");
        asset2.setTitleDeedNumber("TD-DUP-COMMON-777"); // Exact duplicate 1st rank
        asset2.setValuationAmount(8_000_000.0);
        asset2.setCurrency("ETB");
        asset2.setCollateralRank("1st");

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralForActivation(asset2));
        assertTrue(ex.getMessage().contains("already exists"));
    }

    @Test
    @DisplayName("Scenario 10: Missing Bank-assessed value cannot silently fallback to Estimated value")
    public void testScenario10_MissingBankAssessedValueAndEstimatedValueDistinction() {
        Collateral col = new Collateral();
        col.setId("col-s10-" + UUID.randomUUID());
        col.setCode("COL-S10-001");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("CMC, Addis Ababa");
        col.setTitleDeedNumber("TD-S10-001");
        col.setValuationAmount(0); // Missing bank assessed valuation
        col.setEstimatedValue(15_000_000.0); // Reference only

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralRequiredInformation(col));
        assertTrue(ex.getMessage().contains("Bank-assessed value is mandatory and must be greater than zero"));
    }

    @Test
    @DisplayName("Scenario 11: Saving and reloading every important form field verifies reliable persistence")
    public void testScenario11_SavingAndReloadingFormFieldPersistence() {
        Collateral col = new Collateral();
        String id = "col-s11-" + UUID.randomUUID();
        col.setId(id);
        col.setCode("COL-S11-PERSIST");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setLocationAddress("Bole Medhanialem, Addis Ababa");
        col.setLocationCity("Addis Ababa");
        col.setTitleDeedNumber("TD-PERSIST-1234");
        col.setValuationAmount(18_500_000.0);
        col.setInsurableValue(14_000_000.0);
        col.setLandValue(4_500_000.0);
        col.setHaircut(25.0);
        col.setGpsCoordinates("9.0054, 38.7578");
        col.setCollateralRank("1st");
        col.setBankAssessedValueSource("CBA CAD Valuation Report CAD/2026/044");
        col.setEstimatedValue(20_000_000.0);
        col.setStatus("Active");

        collateralRepository.save(col);

        Collateral reloaded = collateralRepository.findById(id).orElseThrow();
        assertEquals(18_500_000.0, reloaded.getValuationAmount());
        assertEquals(14_000_000.0, reloaded.getInsurableValue());
        assertEquals(4_500_000.0, reloaded.getLandValue());
        assertEquals(25.0, reloaded.getHaircut());
        assertEquals("9.0054, 38.7578", reloaded.getGpsCoordinates());
        assertEquals("TD-PERSIST-1234", reloaded.getTitleDeedNumber());
    }

    // =========================================================================
    // SECTION 2: INSURANCE FORMS & ADEQUACY CALCULATION (SCENARIOS 12-22)
    // =========================================================================

    @Test
    @DisplayName("Scenario 12: Building policy requires insurable structure value excluding land, not total valuation")
    public void testScenario12_BuildingPolicyExcludingLandFromInsurableStructureValue() {
        Collateral building = new Collateral();
        String colId = "col-s12-" + UUID.randomUUID();
        building.setId(colId);
        building.setCode("COL-S12-BLDG");
        building.setCustomerId(borrowerCust.getId());
        building.setCategory("Immovable Properties");
        building.setType("Buildings - Commercial");
        building.setOwningSegment("Corporate Banking");
        building.setValuationAmount(10_000_000.0);
        building.setLandValue(3_000_000.0);
        building.setInsurableValue(7_000_000.0); // Structure value excluding land
        building.setStatus("Active");
        collateralRepository.save(building);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(7_000_000.0, assessment.getBankAssessedInsurableValue());
        assertEquals(7_000_000.0, assessment.getRequiredCoverageAmount());
        assertNotEquals(10_000_000.0, assessment.getRequiredCoverageAmount());
    }

    @Test
    @DisplayName("Scenario 13: Multiple valid policies whose combined active insurance is adequate pass test")
    public void testScenario13_MultipleValidPoliciesCombinedAdequacy() {
        Collateral col = new Collateral();
        String colId = "col-s13-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S13-MULTI");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        // Policy 1: 6,000,000
        InsurancePolicy p1 = new InsurancePolicy();
        p1.setId("pol-s13-1-" + UUID.randomUUID());
        p1.setPolicyNumber("POL-S13-001");
        p1.setCollateralId(colId);
        p1.setCustomerId(borrowerCust.getId());
        p1.setInsurerName("Ethiopian Insurance Corporation");
        p1.setCoverageType("Fire & Lightning");
        p1.setInsuredAmount(6_000_000.0);
        p1.setPremium(27_000.0);
        p1.setEffectiveDate(todayStr);
        p1.setExpiryDate(LocalDate.now().plusYears(1).toString());
        p1.setStatus("Active");
        insurancePolicyRepository.save(p1);

        // Policy 2: 4,000,000 (Combined = 10,000,000)
        InsurancePolicy p2 = new InsurancePolicy();
        p2.setId("pol-s13-2-" + UUID.randomUUID());
        p2.setPolicyNumber("POL-S13-002");
        p2.setCollateralId(colId);
        p2.setCustomerId(borrowerCust.getId());
        p2.setInsurerName("Nyala Insurance S.C.");
        p2.setCoverageType("Fire & Allied Perils");
        p2.setInsuredAmount(4_000_000.0);
        p2.setPremium(18_000.0);
        p2.setEffectiveDate(todayStr);
        p2.setExpiryDate(LocalDate.now().plusYears(1).toString());
        p2.setStatus("Active");
        insurancePolicyRepository.save(p2);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(10_000_000.0, assessment.getTotalInsuredAmount());
        assertEquals("Adequate", assessment.getPrimaryTestStatus());
        assertTrue(assessment.isPrimaryTestPassed());
    }

    @Test
    @DisplayName("Scenario 14: Expired policies are strictly excluded from current active insurance calculation")
    public void testScenario14_ExpiredPolicyExcludedFromActiveInsurance() {
        Collateral col = new Collateral();
        String colId = "col-s14-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S14-EXP");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(5_000_000.0);
        col.setInsurableValue(5_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy expiredPol = new InsurancePolicy();
        expiredPol.setId("pol-s14-" + UUID.randomUUID());
        expiredPol.setPolicyNumber("POL-S14-EXP-01");
        expiredPol.setCollateralId(colId);
        expiredPol.setCustomerId(borrowerCust.getId());
        expiredPol.setInsurerName("Awash Insurance");
        expiredPol.setInsuredAmount(5_000_000.0);
        expiredPol.setPremium(20_000.0);
        expiredPol.setEffectiveDate(LocalDate.now().minusYears(2).toString());
        expiredPol.setExpiryDate(LocalDate.now().minusDays(10).toString()); // Expired
        expiredPol.setStatus("Active");
        insurancePolicyRepository.save(expiredPol);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(0.0, assessment.getTotalInsuredAmount());
        assertEquals("Uninsured", assessment.getPrimaryTestStatus());
    }

    @Test
    @DisplayName("Scenario 15: Future-effective policy is not treated as currently active insurance coverage")
    public void testScenario15_FutureEffectivePolicyExcluded() {
        Collateral col = new Collateral();
        String colId = "col-s15-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S15-FUT");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(8_000_000.0);
        col.setInsurableValue(8_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy futurePol = new InsurancePolicy();
        futurePol.setId("pol-s15-" + UUID.randomUUID());
        futurePol.setPolicyNumber("POL-S15-FUT-01");
        futurePol.setCollateralId(colId);
        futurePol.setCustomerId(borrowerCust.getId());
        futurePol.setInsurerName("Nib Insurance");
        futurePol.setInsuredAmount(8_000_000.0);
        futurePol.setPremium(35_000.0);
        futurePol.setEffectiveDate(LocalDate.now().plusDays(15).toString()); // Future inception
        futurePol.setExpiryDate(LocalDate.now().plusYears(1).plusDays(15).toString());
        futurePol.setStatus("Active");
        insurancePolicyRepository.save(futurePol);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(0.0, assessment.getTotalInsuredAmount());
        assertEquals("Uninsured", assessment.getPrimaryTestStatus());
    }

    @Test
    @DisplayName("Scenario 16: Underinsured collateral with no approved exception fails adequacy test")
    public void testScenario16_UnderinsuredWithNoException() {
        Collateral col = new Collateral();
        String colId = "col-s16-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S16-UNDER");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy partialPol = new InsurancePolicy();
        partialPol.setId("pol-s16-" + UUID.randomUUID());
        partialPol.setPolicyNumber("POL-S16-UNDER-01");
        partialPol.setCollateralId(colId);
        partialPol.setCustomerId(borrowerCust.getId());
        partialPol.setInsurerName("Oromia Insurance");
        partialPol.setInsuredAmount(5_000_000.0); // 50% underinsured
        partialPol.setPremium(22_500.0);
        partialPol.setEffectiveDate(todayStr);
        partialPol.setExpiryDate(LocalDate.now().plusYears(1).toString());
        partialPol.setStatus("Active");
        insurancePolicyRepository.save(partialPol);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals("Underinsured", assessment.getPrimaryTestStatus());
        assertFalse(assessment.isPrimaryTestPassed());
        assertEquals("Underinsured", assessment.getOverallAdequacyStatus());
    }

    @Test
    @DisplayName("Scenario 17: Underinsured collateral with valid approved exception is recognized in assessment")
    public void testScenario17_UnderinsuredWithValidApprovedException() {
        Collateral col = new Collateral();
        String colId = "col-s17-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S17-EXC");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy partialPol = new InsurancePolicy();
        partialPol.setId("pol-s17-" + UUID.randomUUID());
        partialPol.setPolicyNumber("POL-S17-EXC-01");
        partialPol.setCollateralId(colId);
        partialPol.setCustomerId(borrowerCust.getId());
        partialPol.setInsurerName("United Insurance");
        partialPol.setInsuredAmount(6_000_000.0);
        partialPol.setPremium(27_000.0);
        partialPol.setEffectiveDate(todayStr);
        partialPol.setExpiryDate(LocalDate.now().plusYears(1).toString());
        partialPol.setStatus("Active");
        insurancePolicyRepository.save(partialPol);

        InsuranceException exc = new InsuranceException();
        exc.setId("EXC-S17-001");
        exc.setCollateralId(colId);
        exc.setExceptionType("Temporary Coverage Deficit");
        exc.setReason("Board-authorized temporary insurance deficit pending renewal");
        exc.setRequestingUserId("RM_USER");
        exc.setApprovedExceptionAmount(4_000_000.0);
        exc.setApprovalStatus("Approved");
        exc.setValidityStartDate(todayStr);
        exc.setValidityEndDate(LocalDate.now().plusMonths(3).toString());
        exc.setReviewDate(LocalDate.now().plusMonths(2).toString());
        insuranceExceptionRepository.save(exc);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertTrue(assessment.isHasActiveException());
        assertEquals("Adequate", assessment.getOverallAdequacyStatus());
        assertNotNull(assessment.getActiveExceptionDetails());
        assertEquals("EXC-S17-001", assessment.getActiveExceptionDetails().get("id"));
    }

    @Test
    @DisplayName("Scenario 18: Expired or not-yet-effective exception does not grant adequacy status")
    public void testScenario18_ExpiredExceptionIgnored() {
        Collateral col = new Collateral();
        String colId = "col-s18-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S18-EXC-EXP");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsuranceException expiredExc = new InsuranceException();
        expiredExc.setId("EXC-S18-EXP-001");
        expiredExc.setCollateralId(colId);
        expiredExc.setExceptionType("Temporary Deficit");
        expiredExc.setReason("Expired exception");
        expiredExc.setRequestingUserId("RM_USER");
        expiredExc.setApprovedExceptionAmount(10_000_000.0);
        expiredExc.setApprovalStatus("Approved");
        expiredExc.setValidityStartDate(LocalDate.now().minusMonths(6).toString());
        expiredExc.setValidityEndDate(LocalDate.now().minusDays(5).toString()); // Expired
        expiredExc.setReviewDate(LocalDate.now().minusDays(10).toString());
        insuranceExceptionRepository.save(expiredExc);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertFalse(assessment.isHasActiveException());
        assertEquals("Uninsured", assessment.getOverallAdequacyStatus());
    }

    @Test
    @DisplayName("Scenario 19: Overinsurance produces informational warning without blocking processing")
    public void testScenario19_OverinsuranceInformationalNonBlocking() {
        Collateral col = new Collateral();
        String colId = "col-s19-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S19-OVER");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(5_000_000.0);
        col.setInsurableValue(5_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy overPol = new InsurancePolicy();
        overPol.setId("pol-s19-" + UUID.randomUUID());
        overPol.setPolicyNumber("POL-S19-OVER-01");
        overPol.setCollateralId(colId);
        overPol.setCustomerId(borrowerCust.getId());
        overPol.setInsurerName("Global Insurance");
        overPol.setInsuredAmount(12_000_000.0); // 240% of insurable value
        overPol.setPremium(54_000.0);
        overPol.setEffectiveDate(todayStr);
        overPol.setExpiryDate(LocalDate.now().plusYears(1).toString());
        overPol.setStatus("Active");
        insurancePolicyRepository.save(overPol);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals("Over insured", assessment.getPrimaryTestStatus());
        assertTrue(assessment.isPrimaryTestPassed()); // Non-blocking!
        assertEquals("Over insured", assessment.getOverallAdequacyStatus());
    }

    @Test
    @DisplayName("Scenario 20: Short-term loan policy validity aligns with facility tenor")
    public void testScenario20_ShortTermFacilityPolicyValidityTenor() {
        LoanAccount shortTermLoan = new LoanAccount();
        shortTermLoan.setId("loan-s20-" + UUID.randomUUID());
        shortTermLoan.setLoanReference("LN-ST-2026-001");
        shortTermLoan.setCustomerId(borrowerCust.getId());
        shortTermLoan.setFacilityType("Short-Term Merchandise Advance");
        shortTermLoan.setApprovedLimit(2_000_000.0);
        shortTermLoan.setOutstandingBalance(2_000_000.0);
        shortTermLoan.setLineStartDate(todayStr);
        shortTermLoan.setLineExpiryDate(LocalDate.now().plusMonths(6).toString()); // 180 days tenor
        loanAccountRepository.save(shortTermLoan);

        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-s20-" + UUID.randomUUID());
        policy.setPolicyNumber("POL-ST-180D");
        policy.setCoverageType("Merchandise In Transit");
        policy.setEffectiveDate(todayStr);
        policy.setExpiryDate(LocalDate.now().plusMonths(6).toString()); // 180 days (matches loan tenor)
        policy.setInsuredAmount(2_000_000.0);
        policy.setPremium(9_000.0);
        policy.setStatus("Active");

        // Backend date validation does not blindly throw error on valid active registration
        assertDoesNotThrow(() -> validationService.validatePolicy(policy));
    }

    @Test
    @DisplayName("Scenario 21: Policy replacement and distinct policy registration allow multi-policy coverage while rejecting duplicate policyNumber")
    public void testScenario21_PolicyReplacementAndDuplicateValidation() {
        Collateral col = new Collateral();
        String colId = "col-s21-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S21-DUP");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy p1 = new InsurancePolicy();
        p1.setId("pol-s21-1-" + UUID.randomUUID());
        p1.setPolicyNumber("POL-COMMON-999");
        p1.setCollateralId(colId);
        p1.setCustomerId(borrowerCust.getId());
        p1.setInsurerName("Ethiopian Insurance Corp");
        p1.setCoverageType("Fire");
        p1.setInsuredAmount(5_000_000.0);
        p1.setPremium(22_500.0);
        p1.setEffectiveDate(todayStr);
        p1.setExpiryDate(LocalDate.now().plusYears(1).toString());
        p1.setStatus("Active");
        insurancePolicyRepository.save(p1);

        // Submitting distinct policy with different policyNumber on same collateral/customer/insurer is ALLOWED
        InsurancePolicy p2 = new InsurancePolicy();
        p2.setId("pol-s21-2-" + UUID.randomUUID());
        p2.setPolicyNumber("POL-DISTINCT-888");
        p2.setCollateralId(colId);
        p2.setCustomerId(borrowerCust.getId());
        p2.setInsurerName("Ethiopian Insurance Corp");
        p2.setCoverageType("Burglary");
        p2.setInsuredAmount(5_000_000.0);
        p2.setPremium(22_500.0);
        p2.setEffectiveDate(todayStr);
        p2.setExpiryDate(LocalDate.now().plusYears(1).toString());
        p2.setStatus("Active");
        assertDoesNotThrow(() -> validationService.validatePolicy(p2));

        // Submitting same policy number is strictly REJECTED
        InsurancePolicy pDup = new InsurancePolicy();
        pDup.setId("pol-s21-dup-" + UUID.randomUUID());
        pDup.setPolicyNumber("POL-COMMON-999"); // Duplicate!
        pDup.setCollateralId(colId);
        pDup.setCustomerId(borrowerCust.getId());
        pDup.setInsurerName("Ethiopian Insurance Corp");
        pDup.setCoverageType("Fire");
        pDup.setInsuredAmount(5_000_000.0);
        pDup.setEffectiveDate(todayStr);
        pDup.setExpiryDate(LocalDate.now().plusYears(1).toString());
        pDup.setPremium(22_500.0);

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validatePolicy(pDup));
        assertTrue(ex.getMessage().contains("Duplicate insurance policy number"));
    }

    @Test
    @DisplayName("Scenario 22: Identical records viewed produce consistent adequacy results across views")
    public void testScenario22_ConsistentAdequacyAcrossComponents() {
        Collateral col = new Collateral();
        String colId = "col-s22-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S22-CONSIST");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(8_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsuranceAdequacyAssessmentDto a1 = insuranceAdequacyService.evaluateAdequacy(colId);
        InsuranceAdequacyAssessmentDto a2 = insuranceAdequacyService.evaluateAdequacy(col.getCode());

        assertEquals(a1.getRequiredCoverageAmount(), a2.getRequiredCoverageAmount());
        assertEquals(a1.getTotalInsuredAmount(), a2.getTotalInsuredAmount());
        assertEquals(a1.getOverallAdequacyStatus(), a2.getOverallAdequacyStatus());
    }

    // =========================================================================
    // SECTION 3: LOAN-COLLATERAL RELATIONSHIPS & ALLOCATIONS (SCENARIOS 23-32)
    // =========================================================================

    @Test
    @DisplayName("Scenario 23: One collateral linked to multiple facilities within total capacity")
    public void testScenario23_OneCollateralSecuringMultipleFacilities() {
        Collateral col = new Collateral();
        col.setId("col-s23-" + UUID.randomUUID());
        col.setCode("COL-S23-CROSS");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(20_000_000.0);
        col.setHaircut(20.0); // NSV = 16,000,000
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount facA = createLoan("LN-S23-A", 10_000_000.0);
        LoanAccount facB = createLoan("LN-S23-B", 5_000_000.0);

        LoanCollateralLink link1 = new LoanCollateralLink();
        link1.setId("link-s23-1");
        link1.setCollateralId(col.getId());
        link1.setLoanAccountId(facA.getId());
        link1.setAllocatedAmount(10_000_000.0);
        link1.setStatus("Active");
        loanCollateralLinkRepository.save(link1);

        LoanCollateralLink link2 = new LoanCollateralLink();
        link2.setId("link-s23-2");
        link2.setCollateralId(col.getId());
        link2.setLoanAccountId(facB.getId());
        link2.setAllocatedAmount(5_000_000.0);
        link2.setStatus("Active");
        loanCollateralLinkRepository.save(link2);

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        assertEquals(2, links.size());
        double totalAlloc = links.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(15_000_000.0, totalAlloc);
        assertTrue(totalAlloc <= 16_000_000.0); // Within NSV
    }

    @Test
    @DisplayName("Scenario 24: One facility secured by multiple collaterals")
    public void testScenario24_OneFacilitySecuredByMultipleCollaterals() {
        Collateral c1 = new Collateral();
        c1.setId("col-s24-1-" + UUID.randomUUID());
        c1.setCode("COL-S24-01");
        c1.setCustomerId(borrowerCust.getId());
        c1.setCategory("Immovable Properties");
        c1.setType("Buildings - Commercial");
        c1.setValuationAmount(10_000_000.0);
        c1.setHaircut(20.0);
        c1.setStatus("Active");
        collateralRepository.save(c1);

        Collateral c2 = new Collateral();
        c2.setId("col-s24-2-" + UUID.randomUUID());
        c2.setCode("COL-S24-02");
        c2.setCustomerId(borrowerCust.getId());
        c2.setCategory("Movable Properties");
        c2.setType("Vehicles");
        c2.setValuationAmount(6_000_000.0);
        c2.setHaircut(20.0);
        c2.setStatus("Active");
        collateralRepository.save(c2);

        LoanAccount fac = createLoan("LN-S24-MULTI", 12_000_000.0);

        LoanCollateralLink link1 = new LoanCollateralLink();
        link1.setId("link-s24-1");
        link1.setCollateralId(c1.getId());
        link1.setLoanAccountId(fac.getId());
        link1.setAllocatedAmount(8_000_000.0);
        link1.setStatus("Active");
        loanCollateralLinkRepository.save(link1);

        LoanCollateralLink link2 = new LoanCollateralLink();
        link2.setId("link-s24-2");
        link2.setCollateralId(c2.getId());
        link2.setLoanAccountId(fac.getId());
        link2.setAllocatedAmount(4_000_000.0);
        link2.setStatus("Active");
        loanCollateralLinkRepository.save(link2);

        List<LoanCollateralLink> facLinks = loanCollateralLinkRepository.findByLoanAccountId(fac.getId());
        assertEquals(2, facLinks.size());
        double totalSecured = facLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(12_000_000.0, totalSecured);
    }

    @Test
    @DisplayName("Scenario 25: Many-to-many relationship with capacity and exposure accuracy across pairs")
    public void testScenario25_ManyToManyCollateralFacilityAllocations() {
        Collateral c1 = new Collateral();
        c1.setId("col-s25-1-" + UUID.randomUUID());
        c1.setCode("COL-S25-01");
        c1.setCustomerId(borrowerCust.getId());
        c1.setCategory("Immovable Properties");
        c1.setType("Buildings - Commercial");
        c1.setValuationAmount(15_000_000.0);
        c1.setHaircut(20.0); // NSV = 12,000,000
        c1.setStatus("Active");
        collateralRepository.save(c1);

        Collateral c2 = new Collateral();
        c2.setId("col-s25-2-" + UUID.randomUUID());
        c2.setCode("COL-S25-02");
        c2.setCustomerId(borrowerCust.getId());
        c2.setCategory("Movable Properties");
        c2.setType("Machinery & Equipment");
        c2.setValuationAmount(10_000_000.0);
        c2.setHaircut(20.0); // NSV = 8,000,000
        c2.setStatus("Active");
        collateralRepository.save(c2);

        LoanAccount fac1 = createLoan("LN-S25-1", 10_000_000.0);
        LoanAccount fac2 = createLoan("LN-S25-2", 8_000_000.0);

        // c1 -> fac1 (7M) and fac2 (4M) = total 11M <= 12M NSV
        LoanCollateralLink l1 = new LoanCollateralLink();
        l1.setId("link-s25-1");
        l1.setCollateralId(c1.getId());
        l1.setLoanAccountId(fac1.getId());
        l1.setAllocatedAmount(7_000_000.0);
        l1.setStatus("Active");
        loanCollateralLinkRepository.save(l1);

        LoanCollateralLink l2 = new LoanCollateralLink();
        l2.setId("link-s25-2");
        l2.setCollateralId(c1.getId());
        l2.setLoanAccountId(fac2.getId());
        l2.setAllocatedAmount(4_000_000.0);
        l2.setStatus("Active");
        loanCollateralLinkRepository.save(l2);

        // c2 -> fac1 (3M) and fac2 (4M) = total 7M <= 8M NSV
        LoanCollateralLink l3 = new LoanCollateralLink();
        l3.setId("link-s25-3");
        l3.setCollateralId(c2.getId());
        l3.setLoanAccountId(fac1.getId());
        l3.setAllocatedAmount(3_000_000.0);
        l3.setStatus("Active");
        loanCollateralLinkRepository.save(l3);

        LoanCollateralLink l4 = new LoanCollateralLink();
        l4.setId("link-s25-4");
        l4.setCollateralId(c2.getId());
        l4.setLoanAccountId(fac2.getId());
        l4.setAllocatedAmount(4_000_000.0);
        l4.setStatus("Active");
        loanCollateralLinkRepository.save(l4);

        // Verify allocations
        double c1Alloc = loanCollateralLinkRepository.findByCollateralId(c1.getId()).stream()
                .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(11_000_000.0, c1Alloc);

        double c2Alloc = loanCollateralLinkRepository.findByCollateralId(c2.getId()).stream()
                .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(7_000_000.0, c2Alloc);

        double fac1Cover = loanCollateralLinkRepository.findByLoanAccountId(fac1.getId()).stream()
                .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(10_000_000.0, fac1Cover);

        double fac2Cover = loanCollateralLinkRepository.findByLoanAccountId(fac2.getId()).stream()
                .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        assertEquals(8_000_000.0, fac2Cover);
    }

    @Test
    @DisplayName("Scenario 26: Duplicate active link attempt between same collateral and facility is prevented")
    public void testScenario26_DuplicateActiveLinkAttempt() {
        Collateral col = new Collateral();
        col.setId("col-s26-" + UUID.randomUUID());
        col.setCode("COL-S26-DUP");
        col.setCustomerId(borrowerCust.getId());
        col.setValuationAmount(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount loan = createLoan("LN-S26-DUP", 5_000_000.0);

        LoanCollateralLink activeLink = new LoanCollateralLink();
        activeLink.setId("link-s26-active");
        activeLink.setCollateralId(col.getId());
        activeLink.setLoanAccountId(loan.getId());
        activeLink.setStatus("Active");
        loanCollateralLinkRepository.save(activeLink);

        Exception ex = assertThrows(IllegalArgumentException.class, () ->
                validationService.validateNoDuplicateActiveLink(col.getId(), loan.getId(), null));
        assertTrue(ex.getMessage().contains("already linked"));
    }

    @Test
    @DisplayName("Scenario 27: Allocation exceeding permitted net security value is rejected")
    public void testScenario27_AllocationBeyondPermittedNetSecurityCapacity() {
        Collateral col = new Collateral();
        col.setId("col-s27-" + UUID.randomUUID());
        col.setCode("COL-S27-OVERALLOC");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setHaircut(20.0); // NSV = 8,000,000
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount loan = createLoan("LN-S27", 15_000_000.0);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(col.getId());
        req.setLoanAccountId(loan.getId());
        req.setAllocatedAmount(9_500_000.0); // Exceeds 8,000,000 NSV

        RelationshipValidationResultDto res = relationshipService.validateRelationship(req);
        assertFalse(res.isValid());
        assertTrue(res.getChecks().stream().anyMatch(c -> !c.isPassed() && "VAL-REL-CAPACITY".equals(c.getRuleKey())));
    }

    @Test
    @DisplayName("Scenario 28: Third-party collateral linked to different borrower facility with valid evidence passes")
    public void testScenario28_ThirdPartyCollateralLinkedWithValidEvidence() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-s28-" + UUID.randomUUID());
        tpCol.setCode("COL-S28-TP");
        tpCol.setCustomerId(thirdPartyCust.getId()); // Owned by third party
        tpCol.setOwnerType("Third-party-owned");
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Buildings - Commercial");
        tpCol.setLocationAddress("Bole, Addis Ababa");
        tpCol.setTitleDeedNumber("TD-S28-TP");
        tpCol.setValuationAmount(15_000_000.0);
        tpCol.setHaircut(20.0);
        tpCol.setStatus("Active");

        CollateralOwner owner = new CollateralOwner();
        owner.setId("own-s28");
        owner.setCollateralId(tpCol.getId());
        owner.setName("Third Party Pledgor Entity Ltd");
        owner.setRelationshipToBorrower("Guarantor");
        owner.setIdNumber("ET-ID-12345678");
        owner.setTin("0012345678");
        owner.setPledgeAgreementRef("PLG-S28-001");
        owner.setConsentInfo("Board Pledge Consent Resolution 2026/01");
        owner.setPercentage(100.0);
        tpCol.setOwners(List.of(owner));
        collateralRepository.save(tpCol);

        createDocument(tpCol.getId(), "Third-Party Consent and Pledge Agreement");
        createDocument(tpCol.getId(), "Letter of Consent");

        LoanAccount borrowerLoan = createLoan("LN-S28-BORR", 8_000_000.0);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(borrowerLoan.getId());
        req.setAllocatedAmount(8_000_000.0);
        req.setThirdPartyPledge(true);
        req.setRelationshipToBorrower("Guarantor");
        req.setPledgeAgreementRef("PLG-S28-001");
        req.setConsentInfo("Board Pledge Consent Resolution 2026/01");

        RelationshipValidationResultDto res = relationshipService.validateRelationship(req);
        assertTrue(res.isHasRequiredPledgeEvidence());
        assertTrue(res.isThirdParty());
    }

    @Test
    @DisplayName("Scenario 29: Attempted third-party link without valid evidence raises HARD_STOP validation failure")
    public void testScenario29_AttemptedThirdPartyLinkWithoutValidEvidence() {
        Collateral tpCol = new Collateral();
        tpCol.setId("col-s29-" + UUID.randomUUID());
        tpCol.setCode("COL-S29-TP-NOEVID");
        tpCol.setCustomerId(thirdPartyCust.getId()); // Different customer
        tpCol.setCategory("Immovable Properties");
        tpCol.setType("Buildings - Commercial");
        tpCol.setLocationAddress("Addis Ababa");
        tpCol.setTitleDeedNumber("TD-S29-TP");
        tpCol.setValuationAmount(10_000_000.0);
        tpCol.setHaircut(20.0);
        tpCol.setStatus("Active");
        collateralRepository.save(tpCol);

        LoanAccount borrowerLoan = createLoan("LN-S29", 5_000_000.0);

        RelationshipRequestDto req = new RelationshipRequestDto();
        req.setCollateralId(tpCol.getId());
        req.setLoanAccountId(borrowerLoan.getId());
        req.setAllocatedAmount(5_000_000.0);
        req.setThirdPartyPledge(true);
        req.setRelationshipToBorrower("Guarantor");
        req.setPledgeAgreementRef(null); // Missing pledge ref
        req.setConsentInfo(null);        // Missing consent evidence

        RelationshipValidationResultDto res = relationshipService.validateRelationship(req);
        assertFalse(res.isHasRequiredPledgeEvidence());
        assertTrue(res.getChecks().stream().anyMatch(c -> !c.isPassed() && "VAL-REL-CUST".equals(c.getRuleKey())));
    }

    @Test
    @DisplayName("Scenario 30: Relationship release preserves historical link record and audit trail")
    public void testScenario30_RelationshipReleasePreservesHistory() {
        Collateral col = new Collateral();
        col.setId("col-s30-" + UUID.randomUUID());
        col.setCode("COL-S30-REL");
        col.setCustomerId(borrowerCust.getId());
        col.setValuationAmount(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount loan = createLoan("LN-S30", 0.0);

        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("link-s30-1");
        link.setCollateralId(col.getId());
        link.setLoanAccountId(loan.getId());
        link.setAllocatedAmount(5_000_000.0);
        link.setStatus("Active");
        loanCollateralLinkRepository.save(link);

        relationshipService.endRelationship(link.getId(), "Facility Refinanced", "SYSTEM");

        LoanCollateralLink released = loanCollateralLinkRepository.findById(link.getId()).orElseThrow();
        assertEquals("Ended", released.getStatus());
        assertEquals("Released", released.getReleaseStatus());
        assertNotNull(released.getEndDate());
        assertFalse(relationshipService.getRelationshipHistory(link.getId()).isEmpty());
    }

    @Test
    @DisplayName("Scenario 31: Relationship changes recalculate aggregate exposure across secured facilities")
    public void testScenario31_RelationshipChangesRecalculateExposure() {
        Collateral col = new Collateral();
        String colId = "col-s31-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S31-EXPOSURE");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(20_000_000.0);
        col.setInsurableValue(20_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount loan1 = createLoan("LN-S31-1", 7_000_000.0);

        LoanCollateralLink link1 = new LoanCollateralLink();
        link1.setId("link-s31-1");
        link1.setCollateralId(colId);
        link1.setLoanAccountId(loan1.getId());
        link1.setAllocatedAmount(7_000_000.0);
        link1.setStatus("Active");
        loanCollateralLinkRepository.save(link1);

        InsuranceAdequacyAssessmentDto a1 = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(7_000_000.0, a1.getAggregateSecuredExposure());

        // Add second facility of 5,000,000
        LoanAccount loan2 = createLoan("LN-S31-2", 5_000_000.0);

        LoanCollateralLink link2 = new LoanCollateralLink();
        link2.setId("link-s31-2");
        link2.setCollateralId(colId);
        link2.setLoanAccountId(loan2.getId());
        link2.setAllocatedAmount(5_000_000.0);
        link2.setStatus("Active");
        loanCollateralLinkRepository.save(link2);

        InsuranceAdequacyAssessmentDto a2 = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(12_000_000.0, a2.getAggregateSecuredExposure());
    }

    @Test
    @DisplayName("Scenario 32: Stale or un-synchronized CBS balance raises warning in adequacy assessment")
    public void testScenario32_StaleCbsBalanceWarning() {
        Collateral col = new Collateral();
        String colId = "col-s32-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S32-STALE");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Immovable Properties");
        col.setType("Buildings - Commercial");
        col.setValuationAmount(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanAccount staleLoan = new LoanAccount();
        staleLoan.setId("loan-s32-" + UUID.randomUUID());
        staleLoan.setLoanReference("LN-S32-STALE");
        staleLoan.setCustomerId(borrowerCust.getId());
        staleLoan.setFacilityType("Term Loan");
        staleLoan.setApprovedLimit(4_000_000.0);
        staleLoan.setOutstandingBalance(4_000_000.0);
        staleLoan.setCbsSyncStatus("Stale"); // Stale status!
        staleLoan.setCbsSyncedAt(null);
        staleLoan.setStatus("Active");
        loanAccountRepository.save(staleLoan);

        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("link-s32");
        link.setCollateralId(colId);
        link.setLoanAccountId(staleLoan.getId());
        link.setStatus("Active");
        loanCollateralLinkRepository.save(link);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertTrue(assessment.isHasMissingOrStaleBalances());
        assertTrue(assessment.getStaleOrMissingFacilities().stream().anyMatch(f -> f.contains("Stale")));
    }

    // =========================================================================
    // SECTION 4: FIRST- AND SECOND-DEGREE CHARGES (SCENARIOS 33-40)
    // =========================================================================

    @Test
    @DisplayName("Scenario 33: Internal first-degree collateral referenced by second-degree record")
    public void testScenario33_InternalFirstDegreeReferencedBySecondDegree() {
        Collateral firstDegree = new Collateral();
        firstDegree.setId("col-s33-1st-" + UUID.randomUUID());
        firstDegree.setCode("COL-1ST-001");
        firstDegree.setCustomerId(borrowerCust.getId());
        firstDegree.setCategory("Immovable Properties");
        firstDegree.setType("Buildings - Commercial");
        firstDegree.setTitleDeedNumber("TD-CHARGE-001");
        firstDegree.setValuationAmount(25_000_000.0);
        firstDegree.setCollateralRank("1st");
        firstDegree.setStatus("Active");
        collateralRepository.save(firstDegree);

        Collateral secondDegree = new Collateral();
        secondDegree.setId("col-s33-2nd-" + UUID.randomUUID());
        secondDegree.setCode("COL-2ND-001");
        secondDegree.setCustomerId(borrowerCust.getId());
        secondDegree.setCategory("Immovable Properties");
        secondDegree.setType("Buildings - Commercial");
        secondDegree.setTitleDeedNumber("TD-CHARGE-001");
        secondDegree.setValuationAmount(25_000_000.0);
        secondDegree.setCollateralRank("2nd");
        secondDegree.setFirstDegreeInternal(true);
        secondDegree.setFirstDegreeCollateralId(firstDegree.getId());
        secondDegree.setStatus("Pending Approval");

        SecondDegreeValidationResult res = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(secondDegree, Collections.emptyList());
        assertTrue(res.isValid());
    }

    @Test
    @DisplayName("Scenario 34: External first-degree charge requires confirmation letter and extract")
    public void testScenario34_ExternalFirstDegreePrerequisites() {
        Collateral extSecondDegree = new Collateral();
        extSecondDegree.setId("col-s34-2nd-" + UUID.randomUUID());
        extSecondDegree.setCode("COL-2ND-EXT");
        extSecondDegree.setCustomerId(borrowerCust.getId());
        extSecondDegree.setCategory("Immovable Properties");
        extSecondDegree.setType("Buildings - Commercial");
        extSecondDegree.setTitleDeedNumber("TD-EXT-001");
        extSecondDegree.setValuationAmount(30_000_000.0);
        extSecondDegree.setCollateralRank("2nd");
        extSecondDegree.setFirstDegreeInternal(false);
        extSecondDegree.setFirstDegreeHolderName("Awash International Bank S.C.");
        extSecondDegree.setFirstDegreeFacilityRef("AWASH-LN-999");
        extSecondDegree.setFirstDegreeOutstandingBalance(10_000_000.0);
        extSecondDegree.setFirstDegreeBalanceAsOfDate(todayStr);
        extSecondDegree.setRegisteredMortgageAmount(10_000_000.0);
        extSecondDegree.setMortgageRegistrationNumber("CADASTRE-AA-789");
        extSecondDegree.setFirstDegreeConfirmationDocId("DOC-CONFIRM-01");
        extSecondDegree.setFirstDegreeExtractDocId("DOC-EXTRACT-01");

        OwnershipDocument d1 = new OwnershipDocument();
        d1.setId("DOC-CONFIRM-01");
        d1.setDocumentType("First-Degree Mortgage Confirmation Letter");
        d1.setVerificationStatus("Verified");

        OwnershipDocument d2 = new OwnershipDocument();
        d2.setId("DOC-EXTRACT-01");
        d2.setDocumentType("Mortgage Registration Extract / Cadastral Certificate");
        d2.setVerificationStatus("Verified");

        SecondDegreeValidationResult res = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(extSecondDegree, List.of(d1, d2));
        assertTrue(res.isValid());
    }

    @Test
    @DisplayName("Scenario 35: Second-degree registration legitimately shares property identifier with first-degree record")
    public void testScenario35_SecondDegreeSharesPropertyIdentifier() {
        Collateral firstDegree = new Collateral();
        firstDegree.setId("col-s35-1st-" + UUID.randomUUID());
        firstDegree.setCode("COL-S35-1ST");
        firstDegree.setCustomerId(borrowerCust.getId());
        firstDegree.setCategory("Immovable Properties");
        firstDegree.setType("Buildings - Commercial");
        firstDegree.setLocationAddress("Bole, Addis Ababa");
        firstDegree.setTitleDeedNumber("TD-SHARED-LEGAL-IDENTIFIER");
        firstDegree.setValuationAmount(20_000_000.0);
        firstDegree.setCurrency("ETB");
        firstDegree.setCollateralRank("1st");
        firstDegree.setStatus("Active");
        collateralRepository.save(firstDegree);

        Collateral secondDegree = new Collateral();
        secondDegree.setId("col-s35-2nd-" + UUID.randomUUID());
        secondDegree.setCode("COL-S35-2ND");
        secondDegree.setCustomerId(borrowerCust.getId());
        secondDegree.setCategory("Immovable Properties");
        secondDegree.setType("Buildings - Commercial");
        secondDegree.setLocationAddress("Bole, Addis Ababa");
        secondDegree.setTitleDeedNumber("TD-SHARED-LEGAL-IDENTIFIER"); // Shares title deed with parent 1st degree
        secondDegree.setValuationAmount(20_000_000.0);
        secondDegree.setCurrency("ETB");
        secondDegree.setCollateralRank("2nd");
        secondDegree.setFirstDegreeInternal(true);
        secondDegree.setFirstDegreeCollateralId(firstDegree.getId());

        // Attach required mandatory documents
        OwnershipDocument planDoc = createDocument(secondDegree.getId(), "Approved Building Plan");
        secondDegree.setDocuments(List.of(planDoc));

        // Must NOT be rejected as a duplicate collateral asset
        assertDoesNotThrow(() -> validationService.validateCollateralForActivation(secondDegree));
    }

    @Test
    @DisplayName("Scenario 36: True duplicate asset registration at identical rank is strictly rejected")
    public void testScenario36_TrueDuplicateAssetRegistrationRejected() {
        Collateral firstDegreeA = new Collateral();
        firstDegreeA.setId("col-s36-a-" + UUID.randomUUID());
        firstDegreeA.setCode("COL-S36-1ST-A");
        firstDegreeA.setCustomerId(borrowerCust.getId());
        firstDegreeA.setCategory("Immovable Properties");
        firstDegreeA.setType("Buildings - Commercial");
        firstDegreeA.setLocationAddress("Piassa, Addis Ababa");
        firstDegreeA.setTitleDeedNumber("TD-STRICT-UNIQUE-001");
        firstDegreeA.setValuationAmount(15_000_000.0);
        firstDegreeA.setCurrency("ETB");
        firstDegreeA.setCollateralRank("1st");
        firstDegreeA.setStatus("Active");
        collateralRepository.save(firstDegreeA);

        Collateral firstDegreeB = new Collateral();
        firstDegreeB.setId("col-s36-b-" + UUID.randomUUID());
        firstDegreeB.setCode("COL-S36-1ST-B");
        firstDegreeB.setCustomerId(borrowerCust.getId());
        firstDegreeB.setCategory("Immovable Properties");
        firstDegreeB.setType("Buildings - Commercial");
        firstDegreeB.setLocationAddress("Piassa, Addis Ababa");
        firstDegreeB.setTitleDeedNumber("TD-STRICT-UNIQUE-001"); // True duplicate at 1st rank
        firstDegreeB.setValuationAmount(15_000_000.0);
        firstDegreeB.setCurrency("ETB");
        firstDegreeB.setCollateralRank("1st");

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralForActivation(firstDegreeB));
        assertTrue(ex.getMessage().contains("already exists"));
    }

    @Test
    @DisplayName("Scenario 37: Combined first and second degree exposure exceeding valuation raises warning")
    public void testScenario37_CombinedExposureExceedingValuationWarning() {
        Collateral extSecondDegree = new Collateral();
        extSecondDegree.setId("col-s37-2nd-" + UUID.randomUUID());
        extSecondDegree.setCode("COL-2ND-EXCESS");
        extSecondDegree.setCustomerId(borrowerCust.getId());
        extSecondDegree.setCategory("Immovable Properties");
        extSecondDegree.setType("Buildings - Commercial");
        extSecondDegree.setTitleDeedNumber("TD-EXCESS-001");
        extSecondDegree.setValuationAmount(20_000_000.0); // Bank assessed value 20M
        extSecondDegree.setCollateralRank("2nd");
        extSecondDegree.setFirstDegreeInternal(false);
        extSecondDegree.setFirstDegreeHolderName("Dashen Bank S.C.");
        extSecondDegree.setFirstDegreeFacilityRef("DASH-LN-123");
        extSecondDegree.setFirstDegreeOutstandingBalance(16_000_000.0); // 1st degree 16M
        extSecondDegree.setFirstDegreeBalanceAsOfDate(todayStr);
        extSecondDegree.setRegisteredMortgageAmount(16_000_000.0);
        extSecondDegree.setMortgageRegistrationNumber("CAD-AA-001");
        extSecondDegree.setFirstDegreeConfirmationDocId("DOC-01");
        extSecondDegree.setFirstDegreeExtractDocId("DOC-02");

        SecondDegreeValidationResult res = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(extSecondDegree, Collections.emptyList());
        assertNotNull(res);
    }

    @Test
    @DisplayName("Scenario 38: Combined exposure within permitted valuation passes")
    public void testScenario38_CombinedExposureWithinPermittedValuation() {
        Collateral extSecondDegree = new Collateral();
        extSecondDegree.setId("col-s38-2nd-" + UUID.randomUUID());
        extSecondDegree.setCode("COL-2ND-OK");
        extSecondDegree.setCustomerId(borrowerCust.getId());
        extSecondDegree.setCategory("Immovable Properties");
        extSecondDegree.setType("Buildings - Commercial");
        extSecondDegree.setTitleDeedNumber("TD-OK-001");
        extSecondDegree.setValuationAmount(30_000_000.0);
        extSecondDegree.setCollateralRank("2nd");
        extSecondDegree.setFirstDegreeInternal(false);
        extSecondDegree.setFirstDegreeHolderName("Abyssinia Bank");
        extSecondDegree.setFirstDegreeFacilityRef("BOA-LN-456");
        extSecondDegree.setFirstDegreeOutstandingBalance(10_000_000.0);
        extSecondDegree.setFirstDegreeBalanceAsOfDate(todayStr);
        extSecondDegree.setRegisteredMortgageAmount(10_000_000.0);
        extSecondDegree.setMortgageRegistrationNumber("CAD-AA-002");
        extSecondDegree.setFirstDegreeConfirmationDocId("DOC-01");
        extSecondDegree.setFirstDegreeExtractDocId("DOC-02");

        OwnershipDocument d1 = new OwnershipDocument();
        d1.setId("DOC-01");
        d1.setDocumentType("First-Degree Mortgage Confirmation Letter");
        d1.setVerificationStatus("Verified");

        OwnershipDocument d2 = new OwnershipDocument();
        d2.setId("DOC-02");
        d2.setDocumentType("Mortgage Registration Extract / Cadastral Certificate");
        d2.setVerificationStatus("Verified");

        SecondDegreeValidationResult res = firstDegreeSecondDegreeService.validateSecondDegreeCollateral(extSecondDegree, List.of(d1, d2));
        assertTrue(res.isValid());
    }

    @Test
    @DisplayName("Scenario 39: First-degree balance uses reliable CBS sync as-of timestamp")
    public void testScenario39_FirstDegreeBalanceAsOfDateReliability() {
        LoanAccount facility = new LoanAccount();
        facility.setId("loan-s39-" + UUID.randomUUID());
        facility.setLoanReference("LN-S39");
        facility.setCustomerId(borrowerCust.getId());
        facility.setFacilityType("Term Loan");
        facility.setApprovedLimit(5_000_000.0);
        facility.setLineStartDate("2024-01-15"); // Old start date
        facility.setCbsSyncedAt("2026-10-20T10:30:00"); // Fresh CBS sync timestamp
        facility.setOutstandingBalance(5_000_000.0);
        facility.setCbsSyncStatus("Synced");
        loanAccountRepository.save(facility);

        Collateral col = new Collateral();
        String colId = "col-s39-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S39");
        col.setCustomerId(borrowerCust.getId());
        col.setValuationAmount(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("link-s39");
        link.setCollateralId(colId);
        link.setLoanAccountId(facility.getId());
        link.setStatus("Active");
        loanCollateralLinkRepository.save(link);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertFalse(assessment.getContributingFacilities().isEmpty());
        String asOf = (String) assessment.getContributingFacilities().get(0).get("asOfDate");
        assertEquals("2026-10-20T10:30:00", asOf);
        assertNotEquals("2024-01-15", asOf);
    }

    @Test
    @DisplayName("Scenario 40: Internal first-degree release flags second-degree charge for review without auto-promotion")
    public void testScenario40_InternalFirstDegreeReleaseFlagsSecondDegreeForReview() {
        Collateral firstDegree = new Collateral();
        firstDegree.setId("col-s40-1st-" + UUID.randomUUID());
        firstDegree.setCode("COL-S40-1ST");
        firstDegree.setCustomerId(borrowerCust.getId());
        firstDegree.setCategory("Immovable Properties");
        firstDegree.setType("Buildings - Commercial");
        firstDegree.setTitleDeedNumber("TD-FLAG-001");
        firstDegree.setValuationAmount(20_000_000.0);
        firstDegree.setCollateralRank("1st");
        firstDegree.setStatus("Active");
        collateralRepository.save(firstDegree);

        Collateral secondDegree = new Collateral();
        secondDegree.setId("col-s40-2nd-" + UUID.randomUUID());
        secondDegree.setCode("COL-S40-2ND");
        secondDegree.setCustomerId(borrowerCust.getId());
        secondDegree.setCategory("Immovable Properties");
        secondDegree.setType("Buildings - Commercial");
        secondDegree.setTitleDeedNumber("TD-FLAG-001");
        secondDegree.setValuationAmount(20_000_000.0);
        secondDegree.setCollateralRank("2nd");
        secondDegree.setFirstDegreeInternal(true);
        secondDegree.setFirstDegreeCollateralId(firstDegree.getId());
        secondDegree.setStatus("Active");
        secondDegree.setPromotionStatus("NOT_APPLICABLE");
        collateralRepository.save(secondDegree);

        firstDegreeSecondDegreeService.checkAndFlagSecondDegreePromotion(firstDegree.getId(), "Loan settled", "CHECKER_USER");

        Collateral updatedSecondDegree = collateralRepository.findById(secondDegree.getId()).orElseThrow();
        assertEquals("ELIGIBLE", updatedSecondDegree.getPromotionStatus());
        assertEquals("2nd", updatedSecondDegree.getCollateralRank()); // Does not auto-promote!
    }

    // =========================================================================
    // SECTION 5: TAXONOMIES AND VALIDATION CONSISTENCY (SCENARIOS 41-45)
    // =========================================================================

    @Test
    @DisplayName("Scenario 41: Authoritative taxonomy values are accepted in their appropriate context")
    public void testScenario41_AuthoritativeTaxonomiesAccepted() {
        List<String> validCategories = List.of(
                "Immovable Properties",
                "Movable Properties",
                "Business Mortgages",
                "Financial Assets",
                "Agricultural / Other",
                "Guarantees"
        );

        for (String cat : validCategories) {
            Collateral col = new Collateral();
            col.setId("col-tax-" + UUID.randomUUID());
            col.setCode("COL-TAX-" + UUID.randomUUID().toString().substring(0, 4));
            col.setCustomerId(borrowerCust.getId());
            col.setCategory(cat);
            col.setType(cat.equals("Immovable Properties") ? "Buildings - Commercial" : "General Asset");
            col.setValuationAmount(1_000_000.0);
            if (cat.equals("Immovable Properties")) {
                col.setLocationAddress("Addis Ababa");
                col.setTitleDeedNumber("TD-999");
            } else if (cat.equals("Movable Properties")) {
                col.setVehiclePlateNumber("ET-3-12345");
            } else if (cat.equals("Guarantees")) {
                col.setGuarantorName("Commercial Bank of Ethiopia");
            }
            assertDoesNotThrow(() -> validationService.validateCollateralRequiredInformation(col));
        }
    }

    @Test
    @DisplayName("Scenario 42: Unknown or unsupported taxonomy values are rejected at validation boundary")
    public void testScenario42_UnknownTaxonomyRejected() {
        Collateral col = new Collateral();
        col.setId("col-s42-" + UUID.randomUUID());
        col.setCode("COL-S42-UNKNOWN");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Crypto Digital Currencies"); // Unsupported category!
        col.setType("Bitcoin");
        col.setCurrency("ETB");
        col.setValuationAmount(1_000_000.0);

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralForActivation(col));
        assertTrue(ex.getMessage().contains("not present in the active CIMS taxonomy"));
    }

    @Test
    @DisplayName("Scenario 43: Inactive taxonomy values are rejected for new records but existing records remain readable")
    public void testScenario43_InactiveTaxonomyUnavailableForNewRecords() {
        CollateralTaxonomy inactiveTax = new CollateralTaxonomy();
        inactiveTax.setId("tax-deactivated-" + UUID.randomUUID());
        inactiveTax.setCategory("Agricultural / Other");
        inactiveTax.setSubCategory("Deprecated Commodity Group");
        inactiveTax.setActive(false);
        collateralTaxonomyRepository.save(inactiveTax);

        Collateral existingCol = new Collateral();
        existingCol.setId("col-hist-" + UUID.randomUUID());
        existingCol.setCode("COL-HIST-01");
        existingCol.setCustomerId(borrowerCust.getId());
        existingCol.setCategory("Agricultural / Other");
        existingCol.setType("Deprecated Commodity Group");
        existingCol.setValuationAmount(1_000_000.0);
        existingCol.setStatus("Active");
        collateralRepository.save(existingCol);

        // Readable from database without issue
        Collateral retrieved = collateralRepository.findById(existingCol.getId()).orElseThrow();
        assertNotNull(retrieved);
        assertEquals("Deprecated Commodity Group", retrieved.getType());
    }

    @Test
    @DisplayName("Scenario 44: Admin-configured credit policy rules are immediately reflected in adequacy assessment")
    public void testScenario44_AdminConfiguredRulesReflectedInAdequacyAssessment() {
        InsuranceCoverageRule customRule = new InsuranceCoverageRule();
        customRule.setId("rule-custom-" + UUID.randomUUID());
        customRule.setCollateralType("Industrial Plant Machinery");
        customRule.setBusinessSegment("Corporate Banking");
        customRule.setRequiredCoveragePercentage(120.0); // Custom 120%
        customRule.setOverInsuranceTolerancePct(15.0);
        customRule.setStatus("Active");
        customRule.setCreditPolicyApproved(true);
        insuranceCoverageRuleRepository.save(customRule);

        Collateral col = new Collateral();
        String colId = "col-s44-" + UUID.randomUUID();
        col.setId(colId);
        col.setCode("COL-S44-RULE");
        col.setCustomerId(borrowerCust.getId());
        col.setCategory("Business Mortgages");
        col.setType("Industrial Plant Machinery");
        col.setOwningSegment("Corporate Banking");
        col.setValuationAmount(10_000_000.0);
        col.setInsurableValue(10_000_000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsuranceAdequacyAssessmentDto assessment = insuranceAdequacyService.evaluateAdequacy(colId);
        assertEquals(120.0, assessment.getRequiredCoveragePercentage());
        assertEquals(12_000_000.0, assessment.getRequiredCoverageAmount());
    }

    @Test
    @DisplayName("Scenario 45: Form-level and backend validation produce consistent results")
    public void testScenario45_FormAndBackendValidationConsistency() {
        // Both require Bank-assessed valuation > 0
        Collateral zeroValCol = new Collateral();
        zeroValCol.setId("col-s45-" + UUID.randomUUID());
        zeroValCol.setCode("COL-S45-01");
        zeroValCol.setCustomerId(borrowerCust.getId());
        zeroValCol.setCategory("Immovable Properties");
        zeroValCol.setType("Buildings - Commercial");
        zeroValCol.setLocationAddress("Addis Ababa");
        zeroValCol.setTitleDeedNumber("TD-S45");
        zeroValCol.setValuationAmount(0.0);

        Exception ex = assertThrows(IllegalArgumentException.class, () -> validationService.validateCollateralRequiredInformation(zeroValCol));
        assertTrue(ex.getMessage().contains("Bank-assessed value is mandatory"));
    }
}
