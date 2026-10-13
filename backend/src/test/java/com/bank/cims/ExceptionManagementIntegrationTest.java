package com.bank.cims;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class ExceptionManagementIntegrationTest {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CimsExceptionInvestigationNoteRepository noteRepository;

    @Autowired
    private CimsExceptionEscalationHistoryRepository escalationHistoryRepository;

    @Autowired
    private CimsExceptionAssignmentHistoryRepository assignmentHistoryRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private ApprovedInsurerRepository approvedInsurerRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private com.bank.cims.service.WorkflowExecutionService workflowExecutionService;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Test
    public void testExceptionScanDetectsAndAssignsExceptionsIdempotently() {
        // Run scan 1
        ScanResultDto result1 = cimsService.scanAndGenerateExceptions();
        assertNotNull(result1);
        assertTrue(result1.getPoliciesEvaluated() >= 0);
        assertTrue(result1.getCollateralsEvaluated() >= 0);

        List<CimsException> openExceptions1 = cimsExceptionRepository.findByStatus("Open");
        assertFalse(openExceptions1.isEmpty(), "At least one exception should be detected in seeded data");

        // Verify that exceptions have contextual fields populated (Requirement §6)
        CimsException first = openExceptions1.get(0);
        assertNotNull(first.getId());
        assertNotNull(first.getExceptionType());
        assertNotNull(first.getSeverity());
        assertNotNull(first.getAssignedToRole(), "Every exception must have an assigned role (US-12.2)");
        assertNotNull(first.getSlaDueDate(), "Every exception must have SLA due date calculated");

        int initialOpenCount = openExceptions1.size();

        // Run scan 2 (Idempotency test - Requirement §23)
        ScanResultDto result2 = cimsService.scanAndGenerateExceptions();
        assertNotNull(result2);

        List<CimsException> openExceptions2 = cimsExceptionRepository.findByStatus("Open");
        assertEquals(initialOpenCount, openExceptions2.size(), "Scan must be idempotent and not create duplicate open exceptions");
    }

    @Test
    public void testSupportedBrdExceptionCategoriesDetected() {
        cimsService.scanAndGenerateExceptions();
        List<CimsException> all = cimsExceptionRepository.findAll();

        boolean hasExpiredOrUnderinsured = all.stream().anyMatch(e ->
                "Expired Policy".equalsIgnoreCase(e.getExceptionType()) ||
                "Underinsured Collateral".equalsIgnoreCase(e.getExceptionType()) ||
                "Missing Insurance".equalsIgnoreCase(e.getExceptionType()) ||
                "Missing Mandatory Document".equalsIgnoreCase(e.getExceptionType())
        );
        assertTrue(hasExpiredOrUnderinsured, "Scanner must detect core BRD exception types");
    }

    @Test
    public void testExceptionAssignmentLifecycleAndHistory() {
        cimsService.scanAndGenerateExceptions();
        CimsException exc = cimsExceptionRepository.findAll().stream()
                .filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No open exception for assignment test"));

        String originalRole = exc.getAssignedToRole();

        // Perform controlled reassignment (US-12.2 & Requirement §8)
        ExceptionAssignmentRequest req = new ExceptionAssignmentRequest();
        req.setAssignedRole("BRMGR");
        req.setReason("Reassigning to Branch Manager for immediate operational action");

        cimsService.assignException(exc.getId(), req, "usr-cro");

        // Verify update in repository
        CimsException updated = cimsExceptionRepository.findById(exc.getId()).orElseThrow();
        assertEquals("BRMGR", updated.getAssignedToRole());
        assertEquals("usr-cro", updated.getAssignedBy());

        // Verify persistent assignment history (Requirement §8)
        List<CimsExceptionAssignmentHistory> asgnHistory = assignmentHistoryRepository.findByExceptionIdOrderByAssignedAtAsc(exc.getId());
        assertFalse(asgnHistory.isEmpty(), "Assignment history must be historically recorded");
        assertTrue(asgnHistory.stream().anyMatch(h -> "BRMGR".equals(h.getNewRole())));

        // Verify investigation note was added for the assignment
        List<CimsExceptionInvestigationNote> notes = noteRepository.findByExceptionIdOrderByCreatedAtAsc(exc.getId());
        assertTrue(notes.stream().anyMatch(n -> n.getNoteText().contains("Reassigned")));
    }

    @Test
    public void testResolutionValidationAndMultiRecordInvestigationNotes() {
        cimsService.scanAndGenerateExceptions();
        CimsException exc = cimsExceptionRepository.findAll().stream()
                .filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus()))
                .findFirst()
                .orElseThrow();

        // 1. Validation: blank notes must be rejected (Requirement §48)
        ExceptionResolutionRequest invalidReq = new ExceptionResolutionRequest();
        invalidReq.setCorrectiveAction("Renew Policy");
        invalidReq.setResolutionNotes("   ");

        assertThrows(IllegalArgumentException.class, () ->
                cimsService.resolveException(exc.getId(), invalidReq, "usr-brmgr")
        );

        // 2. Validation: blank corrective action must be rejected
        ExceptionResolutionRequest invalidActionReq = new ExceptionResolutionRequest();
        invalidActionReq.setCorrectiveAction("");
        invalidActionReq.setResolutionNotes("Valid notes but no action");

        assertThrows(IllegalArgumentException.class, () ->
                cimsService.resolveException(exc.getId(), invalidActionReq, "usr-brmgr")
        );

        // 3. Append investigation notes (US-12.3 & Requirement §7)
        ExceptionInvestigationNoteRequest noteReq1 = new ExceptionInvestigationNoteRequest();
        noteReq1.setNoteText("Contacted customer regarding overdue policy endorsement.");
        cimsService.addInvestigationNote(exc.getId(), noteReq1, "usr-cro");

        ExceptionInvestigationNoteRequest noteReq2 = new ExceptionInvestigationNoteRequest();
        noteReq2.setNoteText("Customer submitted renewed policy certificate from approved insurer.");
        cimsService.addInvestigationNote(exc.getId(), noteReq2, "usr-cro");

        List<CimsExceptionInvestigationNote> notes = noteRepository.findByExceptionIdOrderByCreatedAtAsc(exc.getId());
        assertTrue(notes.size() >= 2, "Multiple chronological investigation notes must be preserved");

        // 4. Successful Resolution with Supporting Evidence via Authorized Override (US-12.3 & Requirement §10, §20, §32)
        ExceptionResolutionRequest validReq = new ExceptionResolutionRequest();
        validReq.setCorrectiveAction("Renew Policy");
        validReq.setResolutionNotes("Policy renewed and verified against insurance certificate.");
        validReq.setEvidenceDocument("DOC-POL-CERT-2026-001");
        validReq.setOverride(true);
        validReq.setOverrideReason("Branch Credit Committee waiver ref WM-2026-0914");

        cimsService.resolveException(exc.getId(), validReq, "usr-brmgr");

        CimsException resolved = cimsExceptionRepository.findById(exc.getId()).orElseThrow();
        assertEquals("Resolved", resolved.getStatus());
        assertEquals("Renew Policy", resolved.getCorrectiveAction());
        assertEquals("DOC-POL-CERT-2026-001", resolved.getEvidenceDocument());
        assertEquals("usr-brmgr", resolved.getResolvedBy());
        assertNotNull(resolved.getResolvedAt());
        assertTrue(resolved.getResolutionNotes().contains("AUTHORIZED OVERRIDE"));

        // 5. Resolving an already resolved exception must be rejected (Requirement §19)
        assertThrows(IllegalStateException.class, () ->
                cimsService.resolveException(exc.getId(), validReq, "usr-brmgr")
        );
    }

    @Test
    public void testUnderinsuredResolutionBlockedUntilAdequateOrOverride() {
        // Seed a dedicated underinsured collateral and policy to test resolution gating deterministically
        Collateral testCol = new Collateral();
        testCol.setId("col-under-test-" + System.currentTimeMillis());
        testCol.setCode("C-UNDER-" + System.currentTimeMillis());
        testCol.setCategory("Vehicle");
        testCol.setType("Commercial Vehicle");
        testCol.setCurrency("ETB");
        testCol.setValuationAmount(1_000_000.0);
        testCol.setInsuredAmount(400_000.0);
        testCol.setNetInsuranceCoveragePct(40.0);
        testCol.setOwningSegment("Corporate Banking");
        testCol.setBranch("Addis Ababa Main Branch");
        testCol.setStatus("Under-Insured");
        testCol.setAuthStat("A");
        testCol.setRecordStat("O");
        collateralRepository.save(testCol);

        InsurancePolicy testPol = new InsurancePolicy();
        testPol.setId("pol-under-test-" + System.currentTimeMillis());
        testPol.setPolicyNumber("POL-UNDER-" + System.currentTimeMillis());
        testPol.setCollateralId(testCol.getId());
        testPol.setCustomerId("CUST-001");
        testPol.setInsurerName("Nyala Insurance Company");
        testPol.setInsuredAmount(400_000.0);
        testPol.setCoverageType("Comprehensive Motor");
        testPol.setStatus("Active");
        testPol.setEffectiveDate(LocalDate.now().minusMonths(1).toString());
        testPol.setExpiryDate(LocalDate.now().plusMonths(6).toString());
        insurancePolicyRepository.save(testPol);

        CimsException underinsured = new CimsException();
        underinsured.setId("exc-test-under-" + System.currentTimeMillis());
        underinsured.setExceptionType("Underinsured Collateral");
        underinsured.setEntityType("Collateral");
        underinsured.setEntityId(testCol.getId());
        underinsured.setSeverity("High");
        underinsured.setDescription("Collateral " + testCol.getCode() + " net coverage is below 100% threshold.");
        underinsured.setCollateralId(testCol.getId());
        underinsured.setStatus("Open");
        cimsExceptionRepository.save(underinsured);

        final String excId = underinsured.getId();

        // 1. Normal resolution must fail because underlying coverage is still inadequate (§31 & §47)
        ExceptionResolutionRequest normalReq = new ExceptionResolutionRequest();
        normalReq.setCorrectiveAction("Increase Insured Amount");
        normalReq.setResolutionNotes("Attempting resolution without increasing insured amount");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                cimsService.resolveException(excId, normalReq, "usr-brmgr")
        );
        assertTrue(ex.getMessage().contains("Cannot resolve Underinsured Collateral") || ex.getMessage().contains("threshold"),
                "Resolution must fail with meaningful error explaining the coverage gap: " + ex.getMessage());

        // 2. Maker role (e.g. CRO) cannot grant an Authorized Override (§32 & §37)
        ExceptionResolutionRequest makerOverrideReq = new ExceptionResolutionRequest();
        makerOverrideReq.setCorrectiveAction("Authorized Exception / Management Override");
        makerOverrideReq.setResolutionNotes("Maker attempting override");
        makerOverrideReq.setOverride(true);
        makerOverrideReq.setOverrideReason("Unauthorized maker waiver");

        assertThrows(IllegalStateException.class, () ->
                cimsService.resolveException(excId, makerOverrideReq, "usr-cro")
        );

        // 3. Authorized Override requires a non-blank overrideReason
        ExceptionResolutionRequest blankReasonReq = new ExceptionResolutionRequest();
        blankReasonReq.setCorrectiveAction("Authorized Exception / Management Override");
        blankReasonReq.setResolutionNotes("Notes without reason");
        blankReasonReq.setOverride(true);
        blankReasonReq.setOverrideReason("   ");

        assertThrows(IllegalArgumentException.class, () ->
                cimsService.resolveException(excId, blankReasonReq, "usr-brmgr")
        );

        // 4. Authorized Override by Checker (BRMGR) succeeds (§32)
        ExceptionResolutionRequest validOverrideReq = new ExceptionResolutionRequest();
        validOverrideReq.setCorrectiveAction("Authorized Exception / Management Override");
        validOverrideReq.setResolutionNotes("Temporary waiver approved pending next policy endorsement cycle");
        validOverrideReq.setOverride(true);
        validOverrideReq.setOverrideReason("Credit Committee Sanction Memo CC-2026-0922");
        validOverrideReq.setEvidenceDocument("MEMO-CC-2026-0922");

        cimsService.resolveException(excId, validOverrideReq, "usr-brmgr");

        CimsException resolved = cimsExceptionRepository.findById(excId).orElseThrow();
        assertEquals("Resolved", resolved.getStatus());
        assertTrue(resolved.getResolutionNotes().contains("AUTHORIZED OVERRIDE"));
        assertTrue(resolved.getResolutionNotes().contains("CC-2026-0922"));
    }

    @Test
    public void testAddExceptionEvidenceAndRecordCorrectiveAction() {
        cimsService.scanAndGenerateExceptions();
        CimsException exc = cimsExceptionRepository.findAll().stream()
                .filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus()))
                .findFirst()
                .orElseThrow();

        // Test attaching evidence
        ExceptionEvidenceRequest evReq = new ExceptionEvidenceRequest();
        evReq.setDocumentId("DOC-EVID-999");
        evReq.setDocumentName("Comprehensive Policy Endorsement Schedule");
        evReq.setDmsRef("DMS://2026/POL/999.PDF");
        evReq.setNotes("Verified original endorsement stamped by insurer.");

        cimsService.addExceptionEvidence(exc.getId(), evReq, "usr-cro");

        CimsException withEv = cimsExceptionRepository.findById(exc.getId()).orElseThrow();
        assertNotNull(withEv.getEvidenceDocument());
        assertTrue(withEv.getEvidenceDocument().contains("999.PDF") || withEv.getEvidenceDocument().contains("DOC-EVID-999"));

        // Test recording corrective action
        ExceptionCorrectiveActionRequest actReq = new ExceptionCorrectiveActionRequest();
        actReq.setCorrectiveAction("Renew Policy with Approved Insurer");
        actReq.setActionNotes("Customer agreed to sign renewal schedule by Friday.");
        actReq.setTargetCompletionDate("2026-10-15");

        cimsService.recordExceptionCorrectiveAction(exc.getId(), actReq, "usr-cro");

        CimsException withAct = cimsExceptionRepository.findById(exc.getId()).orElseThrow();
        assertEquals("Renew Policy with Approved Insurer", withAct.getCorrectiveAction());

        // Verify investigation notes captured both events
        List<CimsExceptionInvestigationNote> notes = noteRepository.findByExceptionIdOrderByCreatedAtAsc(exc.getId());
        assertTrue(notes.stream().anyMatch(n -> n.getNoteText().contains("Evidence Document Associated")));
        assertTrue(notes.stream().anyMatch(n -> n.getNoteText().contains("Corrective Action Logged")));
    }

    @Test
    public void testEscalationHierarchyAndPersistentHistory() {
        cimsService.scanAndGenerateExceptions();
        CimsException exc = cimsExceptionRepository.findAll().stream()
                .filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus()))
                .findFirst()
                .orElseThrow();

        int initialLevel = exc.getEscalationLevel() != null ? exc.getEscalationLevel() : 0;

        // Manual Escalation (US-12.4 & Requirement §18)
        ExceptionEscalationRequest escReq = new ExceptionEscalationRequest();
        escReq.setEscalationRole("DISTDIR");
        escReq.setReason("SLA target breached, escalating to District Business Manager");

        cimsService.escalateException(exc.getId(), escReq, "usr-brmgr");

        CimsException escalated = cimsExceptionRepository.findById(exc.getId()).orElseThrow();
        assertEquals("Escalated", escalated.getStatus());
        assertEquals("DISTDIR", escalated.getAssignedToRole());
        assertEquals(initialLevel + 1, escalated.getEscalationLevel());

        // Verify Escalation History recorded
        List<CimsExceptionEscalationHistory> history = escalationHistoryRepository.findByExceptionIdOrderByEscalatedAtAsc(exc.getId());
        assertFalse(history.isEmpty(), "Escalation history must be recorded in database");
        assertTrue(history.stream().anyMatch(h -> "DISTDIR".equals(h.getNewRole())));
    }

    @Test
    public void testReadOnlyRolesCannotMutateExceptions() {
        cimsService.scanAndGenerateExceptions();
        CimsException exc = cimsExceptionRepository.findAll().stream()
                .filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus()))
                .findFirst()
                .orElseThrow();

        // Auditor (read-only) attempts resolution -> Must throw Exception (Requirement §11 & §29)
        ExceptionResolutionRequest resReq = new ExceptionResolutionRequest();
        resReq.setCorrectiveAction("Renew Policy");
        resReq.setResolutionNotes("Auditor closing exception");

        assertThrows(IllegalStateException.class, () ->
                cimsService.resolveException(exc.getId(), resReq, "usr-auditor")
        );

        // Auditor attempts assignment -> Must throw Exception
        ExceptionAssignmentRequest asgReq = new ExceptionAssignmentRequest();
        asgReq.setAssignedRole("BRMGR");
        asgReq.setReason("Auditor reassigning");

        assertThrows(IllegalStateException.class, () ->
                cimsService.assignException(exc.getId(), asgReq, "usr-auditor")
        );
    }

    @Test
    public void testScopedExceptionsAndSummaryKpiCalculation() {
        cimsService.scanAndGenerateExceptions();

        // Bank-wide user sees full population
        List<CimsException> execScoped = cimsService.getScopedExceptions(null, null, null, null, null, null, "usr-exec", "EXEC");
        assertFalse(execScoped.isEmpty());

        // Summary metrics
        ExceptionSummaryDto summary = cimsService.getExceptionSummary("usr-exec", "EXEC");
        assertNotNull(summary);
        assertTrue(summary.getTotalOpen() >= 0);
        assertTrue(summary.getCritical() >= 0);
        assertTrue(summary.getHigh() >= 0);
        assertTrue(summary.getDueSoon() >= 0);
        assertTrue(summary.getOverdue() >= 0);
    }

    @Test
    public void testEntryTimeValidationAndExceptionApprovalWorkflowResumption() {
        if (customerRepository.findById("CUST-001").isEmpty()) {
            Customer cust = new Customer();
            cust.setId("CUST-001");
            cust.setCif("CUST-001");
            cust.setName("Test Enterprise Client");
            cust.setCustomerType("Corporate");
            cust.setSegment("Corporate Banking");
            cust.setBranch("Addis Ababa Main Branch");
            cust.setStatus("Active");
            cust.setRecordStat("O");
            cust.setAuthStat("A");
            customerRepository.save(cust);
        }
        if (approvedInsurerRepository.findByNameIgnoreCase("Nyala Insurance Company").isEmpty()) {
            ApprovedInsurer ins = new ApprovedInsurer();
            ins.setId("ins-nyala");
            ins.setName("Nyala Insurance Company");
            ins.setActive(true);
            approvedInsurerRepository.save(ins);
        }

        // 1. Setup test collateral
        Collateral col = new Collateral();
        col.setId("col-entry-test-" + System.currentTimeMillis());
        col.setCode("C-ENTRY-" + System.currentTimeMillis());
        col.setCustomerId("CUST-001");
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(2_000_000.0);
        col.setInsuredAmount(0.0);
        col.setOwningSegment("Corporate Banking");
        col.setBranch("Addis Ababa Main Branch");
        col.setStatus("Active");
        col.setAuthStat("A");
        col.setRecordStat("O");
        collateralRepository.save(col);

        // 2. Step 1 & 3: RO fills policy form with Underinsurance (800k vs 2M required)
        InsurancePolicy draftPol = new InsurancePolicy();
        draftPol.setPolicyNumber("POL-ENTRY-" + System.currentTimeMillis());
        draftPol.setCollateralId(col.getId());
        draftPol.setCustomerId("CUST-001");
        draftPol.setInsurerName("Nyala Insurance Company");
        draftPol.setCoverageType("Fire and Lightning");
        draftPol.setInsuredAmount(800_000.0); // 800k < 2M -> Underinsured!
        draftPol.setPremium(25_000.0);
        draftPol.setEffectiveDate(LocalDate.now().toString());
        draftPol.setExpiryDate(LocalDate.now().plusYears(1).toString());

        // Step 1: Pre-validation returns immediate structured result
        PolicyPreValidationResultDto preVal = cimsService.preValidatePolicyRegistration(draftPol, Collections.emptyList());
        assertNotNull(preVal);
        assertFalse(preVal.isValid(), "Validation must fail when underinsured or missing schedule/title deed");
        assertTrue(preVal.isCanSubmitAsException(), "Failed rules should be overrideable with exception");
        assertFalse(preVal.isHasHardBlock(), "Underinsurance and missing documents are not hard blocks");

        // Step 4 & 5: RO clicks 'Submit as Exception' with justification & comments
        EntryTimeExceptionRequest req = new EntryTimeExceptionRequest();
        req.setPolicy(draftPol);
        req.setExceptionType("Underinsured Collateral");
        req.setFailedRequirement("Coverage Adequacy (ETB 800,000 vs ETB 2,000,000)");
        req.setReason("Co-insurance endorsement from secondary underwriter pending issue within 14 days.");
        req.setComments("Temporary waiver approved per Credit Memo CR-2026-901.");
        req.setEvidenceDocument("CR-MEMO-2026-901.pdf");

        Map<String, Object> subResult = cimsService.submitEntryTimeException(req, "usr-cro");
        assertTrue((Boolean) subResult.get("success"));
        String excId = (String) subResult.get("exceptionId");
        String polId = (String) subResult.get("policyId");
        String taskId = (String) subResult.get("workflowTaskId");

        // Policy is preserved in 'Pending Exception Approval' (RO input is preserved)
        InsurancePolicy savedPol = insurancePolicyRepository.findById(polId).orElseThrow();
        assertEquals("Pending Exception Approval", savedPol.getStatus());

        // CimsException is created immediately with assigned approver
        CimsException exc = cimsExceptionRepository.findById(excId).orElseThrow();
        assertEquals("Pending Exception Approval", exc.getStatus());
        assertEquals("Underinsured Collateral", exc.getExceptionType());
        assertNotNull(exc.getAssignedToRole(), "Configured approver role must be assigned");

        // Workflow task exists for exception approval
        WorkflowTask wfTask = workflowTaskRepository.findById(taskId).orElseThrow();
        assertEquals("APPROVE_EXCEPTION", wfTask.getActionType());
        assertEquals("Pending", wfTask.getStatus());

        // Step 7 & 8: Configured Approver (BRMGR) decides to APPROVE exception
        WorkflowActionResultDto appResult = workflowExecutionService.approveWorkflowTask(taskId, "usr-brmgr", "BRMGR", "Approved per Credit Committee sanction");
        assertTrue(appResult.isSuccess());

        // Verify CimsException is now Resolved/Approved
        CimsException approvedExc = cimsExceptionRepository.findById(excId).orElseThrow();
        assertEquals("Resolved", approvedExc.getStatus());
        assertTrue(approvedExc.getResolutionNotes().contains("AUTHORIZED OVERRIDE"));

        // Step 8: Transaction resumed! Policy transitions to 'Pending Approval' for standard checker review
        InsurancePolicy resumedPol = insurancePolicyRepository.findById(polId).orElseThrow();
        assertEquals("Pending Approval", resumedPol.getStatus(), "Policy must transition to Pending Approval and resume normal workflow");
    }
}
