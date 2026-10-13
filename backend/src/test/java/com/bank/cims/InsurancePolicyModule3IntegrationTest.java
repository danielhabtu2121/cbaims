package com.bank.cims;

import com.bank.cims.dto.InsuranceComplianceDto;
import com.bank.cims.dto.WorkflowActionResultDto;
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
public class InsurancePolicyModule3IntegrationTest {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private InsuranceRequirementService insuranceRequirementService;

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
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private PolicyHistoryRepository policyHistoryRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private ApprovedInsurerRepository approvedInsurerRepository;

    @Autowired
    private UserRepository userRepository;

    private Customer testCustomer;
    private LoanAccount testLoan;
    private Collateral testCollateral;

    @BeforeEach
    public void setup() {
        String uid = UUID.randomUUID().toString().substring(0, 8);

        // Ensure maker and checker users exist
        if (userRepository.findById("cro_maker").isEmpty()) {
            User maker = new User();
            maker.setId("cro_maker");
            maker.setUsername("cro_maker");
            maker.setPassword("password");
            maker.setFullName("CRO Maker");
            maker.setRole("CRO_USER");
            maker.setBranch("Central Corporate Branch");
            maker.setSegment("Corporate Banking");
            maker.setActive(true);
            userRepository.save(maker);
        }
        if (userRepository.findById("brmgr_checker").isEmpty()) {
            User checker = new User();
            checker.setId("brmgr_checker");
            checker.setUsername("brmgr_checker");
            checker.setPassword("password");
            checker.setFullName("Branch Manager Checker");
            checker.setRole("BRMGR");
            checker.setBranch("Central Corporate Branch");
            checker.setSegment("Corporate Banking");
            checker.setActive(true);
            userRepository.save(checker);
        }

        // 1. Customer
        testCustomer = new Customer();
        testCustomer.setId("cust-m3-" + uid);
        testCustomer.setCif("CIF-M3-" + uid);
        testCustomer.setName("Module3 Industrial Corp");
        testCustomer.setSegment("Corporate Banking");
        testCustomer.setBranch("Central Corporate Branch");
        testCustomer.setStatus("Active");
        testCustomer.setAuthStat("A");
        testCustomer.setRecordStat("O");
        customerRepository.save(testCustomer);

        // 2. Loan Account (50M Limit, 40M Outstanding)
        testLoan = new LoanAccount();
        testLoan.setId("loan-m3-" + uid);
        testLoan.setLoanReference("LN-M3-" + uid);
        testLoan.setLineCode("LC-M3-" + uid);
        testLoan.setCustomerId(testCustomer.getId());
        testLoan.setFacilityType("Term Loan");
        testLoan.setApprovedLimit(50000000.0);
        testLoan.setOutstandingBalance(40000000.0);
        testLoan.setAvailableAmount(10000000.0);
        testLoan.setLineExpiryDate(LocalDate.now().plusYears(2).toString());
        testLoan.setStatus("Active");
        loanAccountRepository.save(testLoan);

        // 3. Collateral (Buildings, 50M Valuation)
        testCollateral = new Collateral();
        testCollateral.setId("col-m3-" + uid);
        testCollateral.setCode("COL-M3-" + uid);
        testCollateral.setDescription("Modern Manufacturing Plant");
        testCollateral.setCustomerId(testCustomer.getId());
        testCollateral.setCategory("Immovable Properties");
        testCollateral.setType("Commercial/Residential/Mixed-use Buildings");
        testCollateral.setCurrency("ETB");
        testCollateral.setValuationAmount(50000000.0);
        testCollateral.setHaircut(20.0);
        testCollateral.setBranch("Central Corporate Branch");
        testCollateral.setOwningSegment("Corporate Banking");
        testCollateral.setStatus("Active");
        testCollateral.setAuthStat("A");
        testCollateral.setRecordStat("O");
        collateralRepository.save(testCollateral);

        // 4. Link Loan and Collateral
        LoanCollateralLink link = new LoanCollateralLink();
        link.setId("link-m3-" + uid);
        link.setLoanAccountId(testLoan.getId());
        link.setCollateralId(testCollateral.getId());
        link.setLinkedPercent(100.0);
        link.setLinkedAmount(40000000.0);
        link.setStatus("Active");
        loanCollateralLinkRepository.save(link);

        // 5. Ensure Approved Insurer exists
        if (approvedInsurerRepository.findByNameIgnoreCase("Nyala Insurance Company").isEmpty()) {
            ApprovedInsurer ins = new ApprovedInsurer();
            ins.setId("ins-nyala-" + uid);
            ins.setName("Nyala Insurance Company");
            ins.setActive(true);
            approvedInsurerRepository.save(ins);
        }

        // Attach mandatory docs for collateral
        attachMandatoryDocs(testCollateral.getId());
    }

    private void attachMandatoryDocs(String collateralId) {
        String[] types = {
                "Title Deed / Property Ownership Certificate",
                "Approved Building Plan",
                "Valuation Report"
        };
        for (String t : types) {
            OwnershipDocument doc = new OwnershipDocument();
            doc.setId("doc-m3-" + UUID.randomUUID().toString().substring(0, 8));
            doc.setEntityId(collateralId);
            doc.setCollateralId(collateralId);
            doc.setEntityType("Collateral");
            doc.setType(t);
            doc.setName("Doc " + t);
            doc.setFileName(t.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase() + ".pdf");
            doc.setFileSize(102400L);
            doc.setContentType("application/pdf");
            doc.setFileContent("data:application/pdf;base64,JVBERi0xLjQKJ...");
            doc.setStatus("Active");
            doc.setVerificationStatus("Verified");
            doc.setUploadDate(LocalDate.now().toString());
            doc.setVersion(1);
            ownershipDocumentRepository.save(doc);
        }
    }

    @Test
    @DisplayName("Module 3 Rule 10: Under-insurance is strictly prohibited - Sum Insured >= MAX(Outstanding, Value)")
    public void testUnderInsuranceRejection() {
        // Collateral = 50M, Outstanding = 40M -> Requirement = 50M
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-underins-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-UNDERINS-001");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire and Lightning");
        policy.setInsuredAmount(45000000.0); // 45M < 50M -> Underinsured by 5M
        policy.setPremium(150000.0);
        policy.setEffectiveDate(LocalDate.now().toString());
        policy.setExpiryDate(LocalDate.now().plusYears(1).toString());

        // Live evaluation verifies underinsured
        InsuranceComplianceDto eval = insuranceRequirementService.evaluateCompliance(testCollateral.getId(), policy, testLoan.getId());
        assertEquals("UNDERINSURED", eval.getCoverageStatus());
        assertEquals(50000000.0, eval.getRequiredInsuranceAmount());
        assertEquals(5000000.0, eval.getCoverageGap());
        assertFalse(eval.isOverallCompliant());

        // Registration or activation must fail
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerInsurancePolicy(policy, "cro_maker");
        });
        assertTrue(ex.getMessage().contains("below the configured coverage requirement") || ex.getMessage().contains("Underinsured"));
    }

    @Test
    @DisplayName("Module 3 Rule 9: Approved Insurer Validation - Inactive / Unapproved Insurer Rejected")
    public void testUnapprovedInsurerRejection() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-badins-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-BADINS-001");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Bogus Unapproved Insurance Ltd");
        policy.setCoverageType("Fire and Lightning");
        policy.setInsuredAmount(55000000.0);
        policy.setPremium(180000.0);
        policy.setEffectiveDate(LocalDate.now().toString());
        policy.setExpiryDate(LocalDate.now().plusYears(1).toString());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerInsurancePolicy(policy, "cro_maker");
        });
        assertTrue(ex.getMessage().contains("not an active approved insurer"));
    }

    @Test
    @DisplayName("Module 3 Rule 14: Policy Validity - Minimum 1 Year Enforced")
    public void testPolicyValidityRejection() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-shortval-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-SHORTVAL-001");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire and Lightning");
        policy.setInsuredAmount(55000000.0);
        policy.setPremium(180000.0);
        policy.setEffectiveDate(LocalDate.now().toString());
        policy.setExpiryDate(LocalDate.now().plusMonths(6).toString()); // only 6 months

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerInsurancePolicy(policy, "cro_maker");
        });
        assertTrue(ex.getMessage().contains("Policy validity must be at least") || ex.getMessage().contains("365"));
    }

    @Test
    @DisplayName("Module 3 Rule 16: Duplicate Policy Prevention Across Collateral and Insurer")
    public void testDuplicatePolicyPrevention() {
        // Create first active policy
        InsurancePolicy pol1 = new InsurancePolicy();
        pol1.setId("pol-dup-1-" + UUID.randomUUID().toString().substring(0, 8));
        pol1.setPolicyNumber("POL-DUP-001");
        pol1.setCollateralId(testCollateral.getId());
        pol1.setCustomerId(testCustomer.getId());
        pol1.setInsurerName("Nyala Insurance Company");
        pol1.setCoverageType("Fire and Lightning");
        pol1.setInsuredAmount(50000000.0);
        pol1.setPremium(150000.0);
        pol1.setEffectiveDate(LocalDate.now().toString());
        pol1.setExpiryDate(LocalDate.now().plusYears(1).toString());

        Map<String, Object> regRes = cimsService.registerInsurancePolicy(pol1, "cro_maker");
        workflowExecutionService.approveWorkflowTask((String) regRes.get("workflowTaskId"), "brmgr_checker", "BRMGR", "Approve Pol 1");

        // Attempt second policy with same customer, collateral, and insurer
        InsurancePolicy pol2 = new InsurancePolicy();
        pol2.setId("pol-dup-2-" + UUID.randomUUID().toString().substring(0, 8));
        pol2.setPolicyNumber("POL-DUP-002");
        pol2.setCollateralId(testCollateral.getId());
        pol2.setCustomerId(testCustomer.getId());
        pol2.setInsurerName("Nyala Insurance Company");
        pol2.setCoverageType("Fire and Lightning");
        pol2.setInsuredAmount(50000000.0);
        pol2.setPremium(150000.0);
        pol2.setEffectiveDate(LocalDate.now().toString());
        pol2.setExpiryDate(LocalDate.now().plusYears(1).toString());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerInsurancePolicy(pol2, "cro_maker");
        });
        assertTrue(ex.getMessage().contains("already exists for this customer, collateral and insurer"));
    }

    @Test
    @DisplayName("Module 3 Full Lifecycle: Registration -> Approval -> Structured History -> Amendment -> Renewal")
    public void testFullPolicyLifecycleAndStructuredHistory() {
        // 1. Registration
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-lifecycle-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-LIFE-001");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire and Lightning");
        policy.setInsuredAmount(55000000.0);
        policy.setPremium(165000.0);
        policy.setEffectiveDate(LocalDate.now().toString());
        policy.setExpiryDate(LocalDate.now().plusYears(1).toString());

        Map<String, Object> regRes = cimsService.registerInsurancePolicy(policy, "cro_maker");
        assertTrue((Boolean) regRes.get("success"));
        String taskId = (String) regRes.get("workflowTaskId");
        assertNotNull(taskId);

        // Verify initial pending policy history record
        List<PolicyHistory> histList = policyHistoryRepository.findByPolicyIdOrderByTimestampDesc(policy.getId());
        assertFalse(histList.isEmpty(), "Structured policy history must be captured on registration");
        assertEquals("REGISTRATION_SUBMITTED", histList.get(0).getEventType());

        // 2. Checker Approval
        WorkflowActionResultDto apr = workflowExecutionService.approveWorkflowTask(taskId, "brmgr_checker", "BRMGR", "Approved registration");
        assertTrue(apr.isSuccess());

        InsurancePolicy activePol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Active", activePol.getStatus());

        // Verify approval structured history recorded
        histList = policyHistoryRepository.findByPolicyIdOrderByTimestampDesc(policy.getId());
        assertTrue(histList.stream().anyMatch(h -> "REGISTRATION_APPROVED".equals(h.getEventType())),
                "Structured history must contain REGISTRATION_APPROVED");

        // 3. Amendment (v1 -> v2)
        InsurancePolicy amendReq = new InsurancePolicy();
        amendReq.setInsuredAmount(60000000.0);
        amendReq.setPremium(180000.0);
        Map<String, Object> amendRes = cimsService.amendPolicy(policy.getId(), amendReq, "Collateral revalued upwards", "cro_maker");
        assertTrue((Boolean) amendRes.get("success"));
        String amendTaskId = (String) amendRes.get("workflowTaskId");

        // Approve Amendment
        workflowExecutionService.approveWorkflowTask(amendTaskId, "brmgr_checker", "BRMGR", "Approved higher coverage");
        InsurancePolicy amendedPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Active", amendedPol.getStatus());
        assertEquals(2, amendedPol.getVersion());
        assertEquals(60000000.0, amendedPol.getInsuredAmount());

        // 4. Renewal (old -> renewed into -> new)
        InsurancePolicy renewReq = new InsurancePolicy();
        renewReq.setPolicyNumber("POL-LIFE-002");
        renewReq.setInsuredAmount(65000000.0);
        renewReq.setPremium(195000.0);
        renewReq.setEffectiveDate(LocalDate.now().plusYears(1).toString());
        renewReq.setExpiryDate(LocalDate.now().plusYears(2).toString());

        Map<String, Object> renewRes = cimsService.renewPolicy(policy.getId(), renewReq, "cro_maker");
        assertTrue((Boolean) renewRes.get("success"));
        String renewTaskId = (String) renewRes.get("workflowTaskId");
        String newPolicyId = (String) renewRes.get("newPolicyId");

        // Approve Renewal
        workflowExecutionService.approveWorkflowTask(renewTaskId, "brmgr_checker", "BRMGR", "Approved renewal");

        // Verify old policy is Renewed and new policy is Active
        InsurancePolicy oldPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        InsurancePolicy newPol = insurancePolicyRepository.findById(newPolicyId).orElseThrow();

        assertEquals("Renewed", oldPol.getStatus(), "Previous policy must be Renewed");
        assertEquals("Active", newPol.getStatus(), "New renewal policy must be Active");
        assertEquals(oldPol.getId(), newPol.getRenewedFromPolicyId(), "New policy must link to predecessor");

        // Verify history on old policy contains RENEWED
        List<PolicyHistory> oldHist = policyHistoryRepository.findByPolicyIdOrderByTimestampDesc(oldPol.getId());
        assertTrue(oldHist.stream().anyMatch(h -> "RENEWED".equals(h.getEventType())));

        // Verify history on new policy contains RENEWAL_APPROVED
        List<PolicyHistory> newHist = policyHistoryRepository.findByPolicyIdOrderByTimestampDesc(newPol.getId());
        assertTrue(newHist.stream().anyMatch(h -> "RENEWAL_APPROVED".equals(h.getEventType())));
    }
}
