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

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class PolicyLifecycleIntegrationTest {

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
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private Customer testCustomer;
    private LoanAccount testFacility;
    private Collateral testCollateral;

    @BeforeEach
    public void setUp() {
        String uid = UUID.randomUUID().toString().substring(0, 8);

        // 1. Setup Customer
        testCustomer = new Customer();
        testCustomer.setId("cust-plc-" + uid);
        testCustomer.setCif("CIF-PLC-" + uid);
        testCustomer.setName("Abyssinia Trading Enterprises");
        testCustomer.setSegment("Corporate Banking");
        testCustomer.setBranch("Bole Special Branch");
        testCustomer.setStatus("Active");
        testCustomer.setAuthStat("A");
        testCustomer.setRecordStat("O");
        customerRepository.save(testCustomer);

        // 2. Setup Loan Account
        testFacility = new LoanAccount();
        testFacility.setId("fac-plc-" + uid);
        testFacility.setLoanReference("LN-PLC-" + uid);
        testFacility.setLineCode("LC-PLC-" + uid);
        testFacility.setCustomerId(testCustomer.getId());
        testFacility.setFacilityType("Term Loan");
        testFacility.setApprovedLimit(10000000.0);
        testFacility.setOutstandingBalance(7000000.0);
        testFacility.setAvailableAmount(3000000.0);
        testFacility.setStatus("Active");
        loanAccountRepository.save(testFacility);

        // 3. Setup Collateral
        testCollateral = new Collateral();
        testCollateral.setId("col-plc-" + uid);
        testCollateral.setCode("COL-PLC-" + uid);
        testCollateral.setDescription("Headquarters Commercial Tower");
        testCollateral.setCustomerId(testCustomer.getId());
        testCollateral.setCategory("Immovable Properties");
        testCollateral.setType("Commercial/Residential/Mixed-use Buildings");
        testCollateral.setCurrency("ETB");
        testCollateral.setValuationAmount(5000000.0);
        testCollateral.setHaircut(20.0);
        testCollateral.setBranch("Bole Special Branch");
        testCollateral.setOwningSegment("Corporate Banking");
        testCollateral.setStatus("Active");
        testCollateral.setAuthStat("A");
        testCollateral.setRecordStat("O");
        collateralRepository.save(testCollateral);

        // Attach mandatory documents for collateral
        attachMandatoryCollateralDocs(testCollateral.getId());
    }

    private void attachMandatoryCollateralDocs(String collateralId) {
        String[] types = {
                "Title Deed / Property Ownership Certificate",
                "Approved Building Plan",
                "Valuation Report"
        };
        for (String t : types) {
            OwnershipDocument doc = new OwnershipDocument();
            doc.setId("doc-col-" + UUID.randomUUID().toString().substring(0, 8));
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
            doc.setUploadDate("2026-08-01");
            doc.setVersion(1);
            ownershipDocumentRepository.save(doc);
        }
    }

    private OwnershipDocument attachPolicyDoc(String policyId, String verificationStatus) {
        OwnershipDocument pdoc = new OwnershipDocument();
        pdoc.setId("doc-pol-" + UUID.randomUUID().toString().substring(0, 8));
        pdoc.setEntityId(policyId);
        pdoc.setEntityType("Insurance Policy");
        pdoc.setType("Insurance Policy Schedule & Certificate");
        pdoc.setName("Policy Schedule & Certificate");
        pdoc.setFileName("policy_schedule.pdf");
        pdoc.setFileSize(204800L);
        pdoc.setContentType("application/pdf");
        pdoc.setFileContent("data:application/pdf;base64,JVBERi0xLjQKJ...");
        pdoc.setStatus("Active");
        pdoc.setVerificationStatus(verificationStatus != null ? verificationStatus : "Pending Verification");
        pdoc.setUploadDate("2026-08-01");
        pdoc.setVersion(1);
        return ownershipDocumentRepository.save(pdoc);
    }

    private InsurancePolicy createBasePolicy(String policyNumber, double insuredAmount, double premium) {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber(policyNumber);
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire & Allied Perils");
        policy.setInsuredAmount(insuredAmount);
        policy.setPremium(premium);
        policy.setEffectiveDate("2026-08-01");
        policy.setExpiryDate("2027-08-01");
        attachPolicyDoc(policy.getId(), "Pending Verification");
        return policy;
    }

    @Test
    @DisplayName("Scenario 1: Registration - Workflow, Initial History & Audit Trail")
    public void test01_Registration_ThroughWorkflowWithHistoryAndAudit() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-REG-01", 12000000.0, 36000.0);

        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        assertTrue((Boolean) regResult.get("success"));
        String taskId = (String) regResult.get("workflowTaskId");
        assertNotNull(taskId, "Workflow task ID must be generated");

        // Verify initial pending state
        InsurancePolicy pendingPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Pending Approval", pendingPol.getStatus());
        assertEquals("U", pendingPol.getAuthStat());
        assertEquals("U", pendingPol.getRecordStat());
        assertEquals(1, pendingPol.getVersion());
        assertEquals("cro_user", pendingPol.getMakerId());
        assertNotNull(pendingPol.getHistoryJson());
        assertTrue(pendingPol.getHistoryJson().contains("REGISTRATION"), "History must record REGISTRATION event");

        // Checker approves task
        WorkflowActionResultDto approval = workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Approved policy registration");
        assertTrue(approval.isSuccess());

        // Verify activated state
        InsurancePolicy activePol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Active", activePol.getStatus());
        assertEquals("A", activePol.getAuthStat());
        assertEquals("O", activePol.getRecordStat());
        assertEquals("brmgr_user", activePol.getCheckerId());
        assertNotNull(activePol.getCheckerDtStamp());
        assertTrue(activePol.getHistoryJson().contains("REGISTRATION_APPROVED"), "History must record REGISTRATION_APPROVED");

        // Verify Audit Log exists
        List<AuditLog> logs = auditLogRepository.findByActionTypeAndEntityId("POLICY_REGISTRATION", policy.getId());
        assertFalse(logs.isEmpty(), "Audit log must be recorded for registration");
    }

    @Test
    @DisplayName("Scenario 2: Amendment - Requires Approval, Increments Version & Preserves Previous Values")
    public void test02_Amendment_RequiresApprovalAndPreservesPreviousValues() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-AMD-01", 10000000.0, 30000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve registration");

        // Mandatory reason check
        InsurancePolicy amendReq = new InsurancePolicy();
        amendReq.setInsuredAmount(14000000.0);
        amendReq.setPremium(42000.0);
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.amendPolicy(policy.getId(), amendReq, "", "cro_user");
        }, "Empty amendment reason must be rejected");

        // Valid amendment
        Map<String, Object> amendResult = cimsService.amendPolicy(policy.getId(), amendReq, "Increased collateral valuation adjustment", "cro_user");
        assertTrue((Boolean) amendResult.get("success"));
        String taskId = (String) amendResult.get("workflowTaskId");
        assertNotNull(taskId);

        // Check pending amendment state
        InsurancePolicy pendingAmend = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Pending Approval", pendingAmend.getStatus());
        assertEquals(2, pendingAmend.getVersion(), "Version must increment to 2");
        assertEquals(14000000.0, pendingAmend.getInsuredAmount());
        // Verify previous value preserved in history
        assertTrue(pendingAmend.getHistoryJson().contains("10000000"), "Previous insured amount must be recorded in history");
        assertTrue(pendingAmend.getHistoryJson().contains("Increased collateral valuation adjustment"));

        // Checker approves amendment
        workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Approve amendment");
        InsurancePolicy activePol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Active", activePol.getStatus());
        assertEquals("A", activePol.getAuthStat());
        assertTrue(activePol.getHistoryJson().contains("AMENDMENT_APPROVED"));
    }

    @Test
    @DisplayName("Scenario 3: Endorsements - Multiple Remain Linked To Original Policy")
    public void test03_Endorsements_MultipleRemainLinkedToOriginal() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-END-01", 12000000.0, 36000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Issue Endorsement 1
        Map<String, Object> end1 = cimsService.endorsePolicy(policy.getId(), "END-001", "Bank Co-Insurance Clause Endorsement", "2026-09-01", null, "cro_user");
        assertTrue((Boolean) end1.get("success"));
        workflowExecutionService.approveWorkflowTask((String) end1.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Endorsement 1");

        // Issue Endorsement 2
        Map<String, Object> end2 = cimsService.endorsePolicy(policy.getId(), "END-002", "Hazard Warranty Update Endorsement", "2026-10-01", null, "cro_user");
        assertTrue((Boolean) end2.get("success"));
        workflowExecutionService.approveWorkflowTask((String) end2.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Endorsement 2");

        // Check Endorsements Repository & Count
        List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyId(policy.getId());
        assertEquals(2, endorsements.size(), "Two endorsements must be linked to policy");
        for (PolicyEndorsement pe : endorsements) {
            assertEquals("O", pe.getRecordStat());
            assertEquals("A", pe.getAuthStat());
            assertEquals("brmgr_user", pe.getCheckerId());
        }

        InsurancePolicy pol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals(2, pol.getEndorsementCount(), "Endorsement count must be 2");

        // Verify History API returns both endorsements
        Map<String, Object> history = cimsService.getPolicyHistory(policy.getId());
        List<?> historyEndorsements = (List<?>) history.get("endorsements");
        assertEquals(2, historyEndorsements.size());
    }

    @Test
    @DisplayName("Scenario 4: Renewal - Maintains Chain, Sets Predecessor to Renewed, Preserves Old Record")
    public void test04_Renewal_MaintainsChainAndUpdatesOldPolicy() {
        InsurancePolicy oldPolicy = createBasePolicy("POL-ORIG-001", 12000000.0, 36000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(oldPolicy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Renew Policy
        InsurancePolicy renewalReq = new InsurancePolicy();
        renewalReq.setInsuredAmount(13000000.0);
        renewalReq.setPremium(39000.0);
        renewalReq.setExpiryDate("2028-08-01");

        Map<String, Object> renewResult = cimsService.renewPolicy(oldPolicy.getId(), renewalReq, "cro_user");
        assertTrue((Boolean) renewResult.get("success"));
        String renewTaskId = (String) renewResult.get("workflowTaskId");
        String newPolicyId = (String) renewResult.get("newPolicyId");
        assertNotNull(newPolicyId);

        InsurancePolicy newPolicy = insurancePolicyRepository.findById(newPolicyId).orElseThrow();
        assertEquals(oldPolicy.getId(), newPolicy.getRenewedFromPolicyId(), "New policy must link to predecessor");
        assertEquals("Pending Approval", newPolicy.getStatus());

        // Checker authorizes renewal
        workflowExecutionService.approveWorkflowTask(renewTaskId, "brmgr_user", "BRMGR", "Approve Renewal");

        // Verify new policy is Active
        InsurancePolicy activeNew = insurancePolicyRepository.findById(newPolicyId).orElseThrow();
        assertEquals("Active", activeNew.getStatus());

        // Verify old policy is Renewed (NOT deleted)
        InsurancePolicy updatedOld = insurancePolicyRepository.findById(oldPolicy.getId()).orElseThrow();
        assertEquals("Renewed", updatedOld.getStatus(), "Original policy must have status 'Renewed'");
        assertTrue(updatedOld.getHistoryJson().contains("RENEWED"), "Old policy history must contain RENEWED event");

        // Verify lineage in History API
        Map<String, Object> newHistory = cimsService.getPolicyHistory(newPolicyId);
        assertNotNull(newHistory.get("renewedFrom"), "Predecessor policy must be linked in history");
    }

    @Test
    @DisplayName("Scenario 5: Replacement - Maintains Chain, Sets Predecessor to Replaced, Preserves Old Record")
    public void test05_Replacement_MaintainsChainAndPreservesOldPolicy() {
        InsurancePolicy oldPolicy = createBasePolicy("POL-ORIG-REPL-01", 12000000.0, 36000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(oldPolicy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Replacement with new Insurer
        InsurancePolicy replacement = new InsurancePolicy();
        replacement.setPolicyNumber("POL-NEW-AWASH-01");
        replacement.setInsurerName("Awash Insurance Company");
        replacement.setCoverageType("Comprehensive Fire & Engineering");
        replacement.setInsuredAmount(12000000.0);
        replacement.setPremium(38000.0);
        replacement.setEffectiveDate("2026-08-01");
        replacement.setExpiryDate("2027-08-01");

        // Mandatory reason check
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.replacePolicy(oldPolicy.getId(), replacement, " ", "cro_user");
        }, "Mandatory replacement reason required");

        Map<String, Object> repResult = cimsService.replacePolicy(oldPolicy.getId(), replacement, "Insurer downgrade; replacing with Awash Insurance", "cro_user");
        assertTrue((Boolean) repResult.get("success"));
        String taskId = (String) repResult.get("workflowTaskId");
        String replacementId = (String) repResult.get("replacementPolicyId");

        // Approve Replacement
        workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Approve Replacement");

        InsurancePolicy activeReplacement = insurancePolicyRepository.findById(replacementId).orElseThrow();
        assertEquals("Active", activeReplacement.getStatus());
        assertEquals(oldPolicy.getId(), activeReplacement.getReplacesPolicyId());

        InsurancePolicy updatedOld = insurancePolicyRepository.findById(oldPolicy.getId()).orElseThrow();
        assertEquals("Replaced", updatedOld.getStatus(), "Original policy must have status 'Replaced'");
        assertTrue(updatedOld.getHistoryJson().contains("REPLACED"));
    }

    @Test
    @DisplayName("Scenario 6: Cancellation - Rejects Blank Reason, Submits Workflow, Checker Approves")
    public void test06_Cancellation_RejectsWithoutReasonAndRequiresApproval() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-CANCEL-01", 10000000.0, 30000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Missing reason rejected
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.cancelPolicy(policy.getId(), null, "cro_user");
        });
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.cancelPolicy(policy.getId(), "   ", "cro_user");
        });

        // Valid cancellation
        Map<String, Object> cancelResult = cimsService.cancelPolicy(policy.getId(), "Borrower settled facility in full", "cro_user");
        assertTrue((Boolean) cancelResult.get("success"));
        String taskId = (String) cancelResult.get("workflowTaskId");

        InsurancePolicy pendingCancel = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Cancellation Pending", pendingCancel.getStatus());
        assertEquals("Borrower settled facility in full", pendingCancel.getCancellationReason());

        // Checker approves cancellation
        workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Confirmed facility settlement");

        InsurancePolicy cancelledPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Cancelled", cancelledPol.getStatus());
        assertEquals("A", cancelledPol.getAuthStat());
        assertTrue(cancelledPol.getHistoryJson().contains("CANCELLATION_APPROVED"));
    }

    @Test
    @DisplayName("Scenario 7: Closure - Retains Policy Record In Database Without Deletion")
    public void test07_Closure_RetainsPolicyRecordWithoutDeletion() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-CLOSE-01", 10000000.0, 30000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Mandatory reason check
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.closePolicy(policy.getId(), "", "cro_user");
        });

        Map<String, Object> closeResult = cimsService.closePolicy(policy.getId(), "Policy matured without claim", "cro_user");
        assertTrue((Boolean) closeResult.get("success"));
        String taskId = (String) closeResult.get("workflowTaskId");

        InsurancePolicy pendingClose = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Closure Pending", pendingClose.getStatus());

        // Checker approves closure
        workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Approved closure");

        InsurancePolicy closedPol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Closed", closedPol.getStatus());
        assertEquals("Policy matured without claim", closedPol.getClosureReason());
        // Verify record is preserved in database
        assertTrue(insurancePolicyRepository.existsById(policy.getId()), "Closed policy must remain in database");
    }

    @Test
    @DisplayName("Scenario 8: Reopening - Requires Approval, Coverage Validation, And Activates")
    public void test08_Reopening_RequiresApprovalAndActivates() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-REOPEN-01", 12000000.0, 36000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve");

        // Close Policy first
        Map<String, Object> closeRes = cimsService.closePolicy(policy.getId(), "Temporary closure", "cro_user");
        workflowExecutionService.approveWorkflowTask((String) closeRes.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve close");

        // Reopen Policy without reason should fail
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.reopenPolicy(policy.getId(), "  ", "cro_user");
        });

        // Valid Reopen
        Map<String, Object> reopenRes = cimsService.reopenPolicy(policy.getId(), "Loan facility extended for 12 months", "cro_user");
        assertTrue((Boolean) reopenRes.get("success"));
        String taskId = (String) reopenRes.get("workflowTaskId");

        InsurancePolicy pendingReopen = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Reopen Pending", pendingReopen.getStatus());

        // Checker approves reopening
        workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Approved reopening");

        InsurancePolicy activePol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertEquals("Active", activePol.getStatus());
        assertEquals("A", activePol.getAuthStat());
        assertTrue(activePol.getHistoryJson().contains("REOPEN_APPROVED"));
    }

    @Test
    @DisplayName("Scenario 9: Maker-Checker - Separation of Duties Enforced (Maker cannot approve own work)")
    public void test09_MakerChecker_SeparationOfDutiesEnforced() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-DUAL-01", 10000000.0, 30000.0);
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        String taskId = (String) regResult.get("workflowTaskId");

        // Maker attempts self-approval -> Must throw IllegalStateException
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            workflowExecutionService.approveWorkflowTask(taskId, "cro_user", "BRMGR", "Attempting self-approval");
        });
        assertTrue(ex.getMessage().contains("Dual Control Violation") || ex.getMessage().contains("Maker"));

        // Different checker user approves successfully
        WorkflowActionResultDto result = workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Proper checker authorization");
        assertTrue(result.isSuccess());
        assertEquals("Active", insurancePolicyRepository.findById(policy.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Scenario 10: Chronological Immutability - Complete Audit Trail Across Multiple Actions")
    public void test10_History_ChronologicalImmutability() {
        InsurancePolicy policy = createBasePolicy("POL-TEST-HIST-01", 10000000.0, 30000.0);

        // 1. Register & Approve
        Map<String, Object> reg = cimsService.registerInsurancePolicy(policy, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) reg.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Reg");

        // 2. Amend & Approve
        InsurancePolicy amendReq = new InsurancePolicy();
        amendReq.setInsuredAmount(11000000.0);
        Map<String, Object> amd = cimsService.amendPolicy(policy.getId(), amendReq, "First amendment reason", "cro_user");
        workflowExecutionService.approveWorkflowTask((String) amd.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Amend");

        // 3. Endorse & Approve
        Map<String, Object> end = cimsService.endorsePolicy(policy.getId(), "END-HIST-01", "Added special clause", "2026-09-15", null, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) end.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Endorse");

        // 4. Retrieve complete history
        Map<String, Object> history = cimsService.getPolicyHistory(policy.getId());
        assertNotNull(history);

        List<?> timeline = (List<?>) history.get("historyTimeline");
        assertNotNull(timeline);
        assertTrue(timeline.size() >= 5, "Timeline must record Registration, Approval, Amendment, Amendment Approval, and Endorsement");

        // Verify original registration information is completely preserved
        InsurancePolicy pol = insurancePolicyRepository.findById(policy.getId()).orElseThrow();
        assertTrue(pol.getHistoryJson().contains("REGISTRATION"));
        assertTrue(pol.getHistoryJson().contains("AMENDMENT"));
        assertTrue(pol.getHistoryJson().contains("ENDORSEMENT"));
    }

    @Test
    @DisplayName("Scenario 11: Document Validation - Document Presence Satisfies Mandatory Rule Without Premature Verification Blocker")
    public void test11_Documents_ValidationBehavesWithoutPrematureVerificationBlocker() {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        policy.setPolicyNumber("POL-TEST-DOC-01");
        policy.setCollateralId(testCollateral.getId());
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire & Allied Perils");
        policy.setInsuredAmount(12000000.0);
        policy.setPremium(36000.0);
        policy.setEffectiveDate("2026-08-01");
        policy.setExpiryDate("2027-08-01");

        // Document is attached with status "Pending Verification" (Document Officer has not verified yet)
        attachPolicyDoc(policy.getId(), "Pending Verification");

        // Registration succeeds without being blocked by lack of 4-eyes document verification
        Map<String, Object> regResult = cimsService.registerInsurancePolicy(policy, "cro_user");
        assertTrue((Boolean) regResult.get("success"));

        // Checker can authorize policy
        WorkflowActionResultDto approval = workflowExecutionService.approveWorkflowTask(
                (String) regResult.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approved without verification blocker");
        assertTrue(approval.isSuccess());
        assertEquals("Active", insurancePolicyRepository.findById(policy.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Scenario 12: Customer Profile - Customer 360 Aggregates Active, Renewed, and Historical Policies")
    public void test12_CustomerHistory_MaintainsAllPoliciesAcrossLifecycle() {
        // Policy 1: Initial policy that gets Renewed
        InsurancePolicy pol1 = createBasePolicy("POL-CUST-001", 10000000.0, 30000.0);
        Map<String, Object> reg1 = cimsService.registerInsurancePolicy(pol1, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) reg1.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve 1");

        // Renew Policy 1 -> Creates Policy 2
        InsurancePolicy renReq = new InsurancePolicy();
        renReq.setInsuredAmount(11000000.0);
        renReq.setExpiryDate("2028-08-01");
        Map<String, Object> renRes = cimsService.renewPolicy(pol1.getId(), renReq, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) renRes.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Renewal");

        // Policy 3: Separate policy that gets Closed
        InsurancePolicy pol3 = createBasePolicy("POL-CUST-003", 5000000.0, 15000.0);
        pol3.setInsurerName("Awash Insurance Company");
        Map<String, Object> reg3 = cimsService.registerInsurancePolicy(pol3, "cro_user");
        workflowExecutionService.approveWorkflowTask((String) reg3.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve 3");
        Map<String, Object> closeRes = cimsService.closePolicy(pol3.getId(), "Retired facility", "cro_user");
        workflowExecutionService.approveWorkflowTask((String) closeRes.get("workflowTaskId"), "brmgr_user", "BRMGR", "Approve Close");

        // Customer 360 lookup
        Customer360Dto c360 = cimsService.getCustomer360(testCustomer.getId());
        assertNotNull(c360);
        assertNotNull(c360.getInsurancePolicies());

        // Verify Customer 360 includes active and historical policies
        List<InsurancePolicy> custPolicies = c360.getInsurancePolicies();
        assertTrue(custPolicies.size() >= 3, "Customer 360 must retain all active and historical policies");
        assertTrue(custPolicies.stream().anyMatch(p -> "Renewed".equalsIgnoreCase(p.getStatus())), "Renewed policy must be present");
        assertTrue(custPolicies.stream().anyMatch(p -> "Active".equalsIgnoreCase(p.getStatus())), "Active renewal policy must be present");
        assertTrue(custPolicies.stream().anyMatch(p -> "Closed".equalsIgnoreCase(p.getStatus())), "Closed policy must be present");
    }
}
