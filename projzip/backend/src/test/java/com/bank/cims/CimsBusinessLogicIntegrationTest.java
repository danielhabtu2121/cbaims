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
public class CimsBusinessLogicIntegrationTest {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

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
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    private Customer testCustomer;
    private LoanAccount facility1;
    private LoanAccount facility2;

    private void attachMandatoryDoc(String collateralId) {
        String[] types = {
            "Title Deed / Property Ownership Certificate",
            "Approved Building Plan",
            "Valuation Report"
        };
        for (String type : types) {
            OwnershipDocument doc = new OwnershipDocument();
            doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
            doc.setEntityId(collateralId);
            doc.setCollateralId(collateralId);
            doc.setEntityType("Collateral");
            doc.setType(type);
            doc.setName("Document - " + type);
            doc.setFileName(type.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase() + ".pdf");
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

    @BeforeEach
    public void setupTestData() {
        testCustomer = new Customer();
        testCustomer.setId("cust-test-" + System.currentTimeMillis());
        testCustomer.setCif("CIF-TEST-001");
        testCustomer.setName("Mohamed Enterprise Trading PLC");
        testCustomer.setSegment("Corporate Banking");
        testCustomer.setBranch("Bole Special Branch");
        testCustomer.setStatus("Active");
        testCustomer.setAuthStat("A");
        testCustomer.setRecordStat("O");
        customerRepository.save(testCustomer);

        facility1 = new LoanAccount();
        facility1.setId("fac-test-1-" + System.currentTimeMillis());
        facility1.setLoanReference("LN-EXP-001");
        facility1.setLineCode("LC-CORP-001");
        facility1.setCustomerId(testCustomer.getId());
        facility1.setFacilityType("Term Loan");
        facility1.setApprovedLimit(10000000.0);
        facility1.setOutstandingBalance(7500000.0);
        facility1.setAvailableAmount(2500000.0);
        facility1.setStatus("Active");
        loanAccountRepository.save(facility1);

        facility2 = new LoanAccount();
        facility2.setId("fac-test-2-" + System.currentTimeMillis());
        facility2.setLoanReference("LN-EXP-002");
        facility2.setLineCode("LC-CORP-002");
        facility2.setCustomerId(testCustomer.getId());
        facility2.setFacilityType("Overdraft Facility");
        facility2.setApprovedLimit(5000000.0);
        facility2.setOutstandingBalance(3000000.0);
        facility2.setAvailableAmount(2000000.0);
        facility2.setStatus("Active");
        loanAccountRepository.save(facility2);
    }

    @Test
    @DisplayName("Scenario 1: Customer 360 Aggregation")
    public void testCustomer360Aggregation() {
        Customer360Dto c360 = cimsService.getCustomer360(testCustomer.getId());
        assertNotNull(c360);
        assertEquals(testCustomer.getId(), c360.getCustomer().getId());
        assertEquals(2, c360.getFacilities().size());
    }

    @Test
    @DisplayName("Scenario 2: Collateral Registration with Multi-Facility Allocations")
    public void testCollateralRegistrationWithAllocations() {
        Collateral col = new Collateral();
        col.setId("col-test-101");
        col.setCode("COL-BOLE-BLD-01");
        col.setDescription("Commercial Building in Bole");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(20000000.0); // 20M Market Value
        col.setHaircut(20.0); // 20% haircut => 16M Net Security Value
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        List<Map<String, Object>> allocations = new ArrayList<>();
        allocations.add(Map.of("facilityId", facility1.getId(), "allocatedAmount", 10000000.0, "linkageType", "Primary"));
        allocations.add(Map.of("facilityId", facility2.getId(), "allocatedAmount", 5000000.0, "linkageType", "Secondary"));

        Map<String, Object> regResult = cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");
        assertTrue((Boolean) regResult.get("success"));

        // Verify collateral is in Pending Approval state
        Collateral savedCol = collateralRepository.findById("col-test-101").orElseThrow();
        assertEquals("Pending Approval", savedCol.getStatus());
        assertEquals("U", savedCol.getAuthStat());
        assertEquals(15000000.0, savedCol.getCurrentAllocation());

        // Verify links created
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId("col-test-101");
        assertEquals(2, links.size());
    }

    @Test
    @DisplayName("Scenario 3: Hard Validation - Allocation Overflow Rejection")
    public void testAllocationOverflowRejection() {
        Collateral col = new Collateral();
        col.setId("col-test-overflow");
        col.setCode("COL-OVERFLOW-01");
        col.setDescription("Small Warehouse");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(10000000.0); // 10M Market Value
        col.setHaircut(20.0); // 8M Net Security Value
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        // Attempting to allocate 12M (> 8M Net Value)
        List<Map<String, Object>> allocations = new ArrayList<>();
        allocations.add(Map.of("facilityId", facility1.getId(), "allocatedAmount", 12000000.0));

        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");
        });
    }

    @Test
    @DisplayName("Scenario 4: Hard Validation - Customer Isolation Enforcement")
    public void testCustomerIsolationEnforcement() {
        Customer otherCustomer = new Customer();
        otherCustomer.setId("cust-other-999");
        otherCustomer.setCif("CIF-OTHER-999");
        otherCustomer.setName("Other Borrower Ltd");
        otherCustomer.setSegment("Retail Banking");
        otherCustomer.setBranch("Piassa Branch");
        customerRepository.save(otherCustomer);

        LoanAccount otherFacility = new LoanAccount();
        otherFacility.setId("fac-other-999");
        otherFacility.setCustomerId(otherCustomer.getId());
        otherFacility.setLoanReference("LN-OTH-999");
        otherFacility.setLineCode("LC-OTH-999");
        otherFacility.setFacilityType("Term Loan");
        otherFacility.setApprovedLimit(5000000.0);
        otherFacility.setOutstandingBalance(4000000.0);
        loanAccountRepository.save(otherFacility);

        Collateral col = new Collateral();
        col.setId("col-test-iso");
        col.setCode("COL-ISO-01");
        col.setDescription("Warehouse");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(5000000.0);
        col.setHaircut(10.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        // Attempting to link other customer's facility
        List<Map<String, Object>> allocations = new ArrayList<>();
        allocations.add(Map.of("facilityId", otherFacility.getId(), "allocatedAmount", 2000000.0));

        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");
        });
    }

    @Test
    @DisplayName("Scenario 5: Dual Control - Maker Cannot Approve Own Submission")
    public void testDualControlMakerSelfApprovalBlocked() {
        Collateral col = new Collateral();
        col.setId("col-dual-control");
        col.setCode("COL-DC-01");
        col.setDescription("Factory Unit");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(10000000.0);
        col.setHaircut(20.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        Map<String, Object> result = cimsService.registerCollateralWithAllocations(col, Collections.emptyList(), "maker_john");
        String taskId = (String) result.get("workflowTaskId");

        // maker_john attempting to approve their own task
        assertThrows(IllegalStateException.class, () -> {
            workflowExecutionService.approveWorkflowTask(taskId, "maker_john", "BRMGR", "Self approval attempt");
        });
    }

    @Test
    @DisplayName("Scenario 6: Generic Maker-Checker Approval & Atomic Link Activation")
    public void testCheckerApprovalAndAtomicActivation() {
        Collateral col = new Collateral();
        col.setId("col-atomic-test");
        col.setCode("COL-ATOMIC-01");
        col.setDescription("Modern Office Block");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(25000000.0);
        col.setHaircut(20.0); // 20M net
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        List<Map<String, Object>> allocations = new ArrayList<>();
        allocations.add(Map.of("facilityId", facility1.getId(), "allocatedAmount", 8000000.0));

        Map<String, Object> result = cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");
        String taskId = (String) result.get("workflowTaskId");

        // Checker authorizes transaction
        WorkflowActionResultDto actionResult = workflowExecutionService.approveWorkflowTask(taskId, "brmgr_user", "BRMGR", "Collateral verified & accepted");
        assertTrue(actionResult.isSuccess());
        assertEquals("Active", actionResult.getEntityStatus());

        // Verify underlying database records
        Collateral authorizedCol = collateralRepository.findById("col-atomic-test").orElseThrow();
        assertEquals("Active", authorizedCol.getStatus());
        assertEquals("A", authorizedCol.getAuthStat());
        assertEquals("O", authorizedCol.getRecordStat());

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId("col-atomic-test");
        assertEquals("Active", links.get(0).getStatus());
        assertEquals("A", links.get(0).getAuthStat());
    }

    @Test
    @DisplayName("Scenario 7: Checker Return Workflow with Mandatory Remarks")
    public void testCheckerReturnWorkflow() {
        Collateral col = new Collateral();
        col.setId("col-return-test");
        col.setCode("COL-RET-01");
        col.setDescription("Land Parcel");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(5000000.0);
        col.setHaircut(20.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        Map<String, Object> result = cimsService.registerCollateralWithAllocations(col, Collections.emptyList(), "cro_user");
        String taskId = (String) result.get("workflowTaskId");

        // Checker returns task for correction
        WorkflowActionResultDto returnResult = workflowExecutionService.returnWorkflowTask(taskId, "brmgr_user", "BRMGR", "Title deed copy is blurred; please re-upload.");
        assertTrue(returnResult.isSuccess());
        assertEquals("Draft", returnResult.getEntityStatus());
        assertEquals("Returned", returnResult.getWorkflowStatus());

        Collateral draftCol = collateralRepository.findById("col-return-test").orElseThrow();
        assertEquals("Draft", draftCol.getStatus());
    }

    @Test
    @DisplayName("Scenario 8: Insurance Policy Full Lifecycle & Exposure Calculation")
    public void testInsurancePolicyLifecycleAndAdequacy() {
        Collateral col = new Collateral();
        col.setId("col-ins-lifecycle");
        col.setCode("COL-INS-01");
        col.setDescription("Commercial Depot");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(10000000.0);
        col.setHaircut(20.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        List<Map<String, Object>> allocations = new ArrayList<>();
        allocations.add(Map.of("facilityId", facility1.getId(), "allocatedAmount", 8000000.0));
        cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");

        // 1. Calculate Required Insurance
        ExposureAdequacySummaryDto adequacy = exposureCalculationService.calculateExposureAndAdequacy("col-ins-lifecycle");
        assertEquals(8000000.0, adequacy.getNetCollateralValue());
        assertEquals(10000000.0, adequacy.getRequiredInsuranceAmount()); // Max(Outstanding ETB 7.5M, Valuation ETB 10M) = ETB 10M

        // 2. Register Insurance Policy
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-life-001");
        policy.setPolicyNumber("POL-NYALA-888");
        policy.setCollateralId("col-ins-lifecycle");
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire & Allied Perils");
        policy.setInsuredAmount(10000000.0);
        policy.setPremium(35000.0);
        policy.setEffectiveDate("2026-08-01");
        policy.setExpiryDate("2027-08-01");

        // Attach policy document if mandatory
        OwnershipDocument pdoc = new OwnershipDocument();
        pdoc.setId("doc-pol-" + UUID.randomUUID().toString().substring(0, 8));
        pdoc.setEntityId(policy.getId());
        pdoc.setEntityType("Insurance Policy");
        pdoc.setType("Insurance Policy Schedule & Certificate");
        pdoc.setName("Policy Schedule Nyala");
        pdoc.setStatus("Active");
        pdoc.setVerificationStatus("Verified");
        pdoc.setUploadDate("2026-08-01");
        pdoc.setVersion(1);
        ownershipDocumentRepository.save(pdoc);

        Map<String, Object> polReg = cimsService.registerInsurancePolicy(policy, "cro_user");
        assertTrue((Boolean) polReg.get("success"));

        // Checker authorizes policy
        String polTaskId = (String) polReg.get("workflowTaskId");
        workflowExecutionService.approveWorkflowTask(polTaskId, "brmgr_user", "BRMGR", "Approved insurance cover");

        InsurancePolicy activePol = insurancePolicyRepository.findById("pol-life-001").orElseThrow();
        assertEquals("Active", activePol.getStatus());

        // 3. Amend Policy
        InsurancePolicy amendRequest = new InsurancePolicy();
        amendRequest.setInsuredAmount(12000000.0);
        amendRequest.setPremium(42000.0);
        Map<String, Object> amendRes = cimsService.amendPolicy("pol-life-001", amendRequest, "Increased asset value", "cro_user");
        assertTrue((Boolean) amendRes.get("success"));
        String amendTaskId = (String) amendRes.get("workflowTaskId");
        if (amendTaskId != null) {
            workflowExecutionService.approveWorkflowTask(amendTaskId, "brmgr_user", "BRMGR", "Approved policy amendment");
        }

        // 4. Endorse Policy
        Map<String, Object> endorseRes = cimsService.endorsePolicy("pol-life-001", "END-001", "Added bank co-insurance clause", "2026-09-01", null, "cro_user");
        assertTrue((Boolean) endorseRes.get("success"));
        String endorseTaskId = (String) endorseRes.get("workflowTaskId");
        if (endorseTaskId != null) {
            workflowExecutionService.approveWorkflowTask(endorseTaskId, "brmgr_user", "BRMGR", "Approved endorsement");
        }

        // 5. Close Policy
        Map<String, Object> closeRes = cimsService.closePolicy("pol-life-001", "Facility settled", "cro_user");
        assertTrue((Boolean) closeRes.get("success"));
        String closeTaskId = (String) closeRes.get("workflowTaskId");
        if (closeTaskId != null) {
            workflowExecutionService.approveWorkflowTask(closeTaskId, "brmgr_user", "BRMGR", "Approved closure");
        }
        assertEquals("Closed", insurancePolicyRepository.findById("pol-life-001").orElseThrow().getStatus());

        // 6. Reopen Policy
        Map<String, Object> reopenRes = cimsService.reopenPolicy("pol-life-001", "Reopened for new facility draw", "cro_user");
        assertTrue((Boolean) reopenRes.get("success"));
        String reopenTaskId = (String) reopenRes.get("workflowTaskId");
        if (reopenTaskId != null) {
            workflowExecutionService.approveWorkflowTask(reopenTaskId, "brmgr_user", "BRMGR", "Approved reopening");
        }
        assertEquals("Active", insurancePolicyRepository.findById("pol-life-001").orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Scenario 9: Register Collateral with Attached Documents & Verify Checker Approval Passes")
    public void testRegisterCollateralWithAttachedDocumentsAndCheckerApproval() {
        Collateral col = new Collateral();
        col.setId("col-doc-attach-test");
        col.setCode("COL-DOC-01");
        col.setDescription("Manufacturing Plant & Warehouse");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(15000000.0);
        col.setHaircut(20.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");

        List<Map<String, Object>> allocations = List.of(
            Map.of("facilityId", facility1.getId(), "allocatedAmount", 10000000.0, "linkageType", "Primary")
        );

        List<Map<String, Object>> documents = List.of(
            Map.of("name", "Title Deed Certificate #TD-2026-99", "type", "Title Deed / Property Ownership Certificate", "expiryDate", "2031-08-01", "fileName", "title_deed.pdf", "fileContent", "data:application/pdf;base64,JVBERi0xLjQKJ...", "fileSize", 102400),
            Map.of("name", "Approved City Building Plan #BP-441", "type", "Approved Building Plan", "expiryDate", "2031-08-01", "fileName", "building_plan.pdf", "fileContent", "data:application/pdf;base64,JVBERi0xLjQKJ...", "fileSize", 102400),
            Map.of("name", "Professional Valuation Report 2026", "type", "Valuation Report", "expiryDate", "2027-08-01", "fileName", "valuation_report.pdf", "fileContent", "data:application/pdf;base64,JVBERi0xLjQKJ...", "fileSize", 102400)
        );

        // Register collateral with allocations and documents
        Map<String, Object> regResult = cimsService.registerCollateralWithAllocations(col, allocations, documents, "cro_user");
        assertTrue((Boolean) regResult.get("success"));
        String taskId = (String) regResult.get("workflowTaskId");
        assertNotNull(taskId);

        // Verify documents are created in DMS repository with status 'Pending Verification'
        List<OwnershipDocument> savedDocs = ownershipDocumentRepository.findAll().stream()
            .filter(d -> "col-doc-attach-test".equals(d.getEntityId()) || "col-doc-attach-test".equals(d.getCollateralId()))
            .toList();
        assertEquals(3, savedDocs.size());
        for (OwnershipDocument d : savedDocs) {
            assertEquals("Pending Verification", d.getVerificationStatus());
        }

        // 1. Current Phase: Checker authorizes the registration task directly without blocking on external verification
        WorkflowActionResultDto approveResult = workflowExecutionService.approveWorkflowTask(
            taskId, "brmgr_user", "BRMGR", "Approved after Maker registration"
        );
        assertTrue(approveResult.isSuccess());
        assertEquals("Active", approveResult.getEntityStatus());

        Collateral activeCol = collateralRepository.findById("col-doc-attach-test").orElseThrow();
        assertEquals("A", activeCol.getAuthStat());
        assertEquals("O", activeCol.getRecordStat());
        assertEquals("Active", activeCol.getStatus());

        // 2. Document verification can still be performed independently without blocking the lifecycle
        for (OwnershipDocument d : savedDocs) {
            cimsService.verifyDocument(d.getId(), "Verified", "Authentic document copy recorded", "mgr_doc_user");
        }

        // Now register insurance policy with attached schedule document
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-doc-attach-01");
        policy.setPolicyNumber("POL-NYALA-999");
        policy.setCollateralId("col-doc-attach-test");
        policy.setCustomerId(testCustomer.getId());
        policy.setInsurerName("Nyala Insurance Company");
        policy.setCoverageType("Fire & Allied Perils");
        policy.setInsuredAmount(15000000.0);
        policy.setPremium(48000.0);
        policy.setEffectiveDate("2026-08-01");
        policy.setExpiryDate("2027-08-01");

        List<Map<String, Object>> policyDocs = List.of(
            Map.of("name", "Policy Schedule #POL-NYALA-999", "type", "Insurance Policy Schedule", "expiryDate", "2027-08-01")
        );

        Map<String, Object> polRegResult = cimsService.registerInsurancePolicy(policy, policyDocs, "cro_user");
        assertTrue((Boolean) polRegResult.get("success"));
        String polTaskId = (String) polRegResult.get("workflowTaskId");

        WorkflowActionResultDto polApproveResult = workflowExecutionService.approveWorkflowTask(
            polTaskId, "brmgr_user", "BRMGR", "Approved insurance cover"
        );
        assertTrue(polApproveResult.isSuccess());
        assertEquals("Active", polApproveResult.getEntityStatus());

        InsurancePolicy savedPolicy = insurancePolicyRepository.findById("pol-doc-attach-01").orElseThrow();
        assertEquals("Active", savedPolicy.getStatus());
    }

    @Test
    @DisplayName("Scenario 11: Policy Registration Strictly Rejects Without Valid Collateral (Zero Fallback)")
    public void testPolicyRegistrationStrictlyRejectsWithoutValidCollateral() {
        // 1. Missing collateralId
        InsurancePolicy p1 = new InsurancePolicy();
        p1.setPolicyNumber("POL-INVALID-001");
        p1.setCollateralId(null);
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.addPolicy(p1, "cro_user");
        });

        // 2. Non-existent collateralId
        InsurancePolicy p2 = new InsurancePolicy();
        p2.setPolicyNumber("POL-INVALID-002");
        p2.setCollateralId("col-non-existent-99999");
        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.addPolicy(p2, "cro_user");
        });

        // 3. Customer isolation mismatch
        Customer otherCust = new Customer();
        otherCust.setId("cust-mismatch-002");
        otherCust.setCif("CIF-MISMATCH-002");
        otherCust.setName("Other Firm Ltd");
        otherCust.setSegment("Corporate Banking");
        otherCust.setBranch("Bole Special Branch");
        otherCust.setStatus("Active");
        customerRepository.save(otherCust);

        Collateral col = new Collateral();
        col.setId("col-mismatch-test");
        col.setCode("COL-MM-01");
        col.setCustomerId(testCustomer.getId());
        col.setValuationAmount(5000000.0);
        col.setStatus("Active");
        collateralRepository.save(col);

        InsurancePolicy p3 = new InsurancePolicy();
        p3.setPolicyNumber("POL-MISMATCH-003");
        p3.setCollateralId(col.getId());
        p3.setCustomerId(otherCust.getId()); // Mismatched customer!

        assertThrows(IllegalArgumentException.class, () -> {
            cimsService.addPolicy(p3, "cro_user");
        });
    }

    @Test
    @DisplayName("Scenario 10: Policy Renewal and Replacement Lifecycle Linkages")
    public void testPolicyRenewalAndReplacement() {
        Collateral col = new Collateral();
        col.setId("col-rnw-test");
        col.setCode("COL-RNW-01");
        col.setDescription("Commercial Office Building");
        col.setCustomerId(testCustomer.getId());
        col.setCategory("Immovable Properties");
        col.setType("Commercial/Residential/Mixed-use Buildings");
        col.setCurrency("ETB");
        col.setValuationAmount(12000000.0);
        col.setHaircut(20.0);
        col.setBranch("Bole Special Branch");
        col.setOwningSegment("Corporate Banking");
        attachMandatoryDoc(col.getId());

        List<Map<String, Object>> allocations = List.of(
            Map.of("facilityId", facility1.getId(), "allocatedAmount", 8000000.0, "linkageType", "Primary")
        );
        cimsService.registerCollateralWithAllocations(col, allocations, "cro_user");

        // Initial policy
        InsurancePolicy initial = new InsurancePolicy();
        initial.setId("pol-orig-001");
        initial.setPolicyNumber("POL-ORIG-001");
        initial.setCollateralId(col.getId());
        initial.setCustomerId(testCustomer.getId());
        initial.setInsurerName("Nyala Insurance Company");
        initial.setCoverageType("Fire & Allied Perils");
        initial.setInsuredAmount(12000000.0);
        initial.setPremium(36000.0);
        initial.setEffectiveDate("2026-01-01");
        initial.setExpiryDate("2027-01-01");
        cimsService.registerInsurancePolicy(initial, "cro_user");

        // Renew policy
        InsurancePolicy renewalDraft = new InsurancePolicy();
        renewalDraft.setPolicyNumber("POL-RNW-002");
        renewalDraft.setInsuredAmount(12000000.0);
        renewalDraft.setPremium(38000.0);
        renewalDraft.setEffectiveDate("2027-01-01");
        renewalDraft.setExpiryDate("2028-01-01");

        Map<String, Object> rnwRes = cimsService.renewPolicy("pol-orig-001", renewalDraft, "cro_user");
        assertTrue((Boolean) rnwRes.get("success"));
        InsurancePolicy renewedPol = (InsurancePolicy) rnwRes.get("policy");
        assertEquals("pol-orig-001", renewedPol.getRenewedFromPolicyId());

        // Replace policy
        InsurancePolicy replacementDraft = new InsurancePolicy();
        replacementDraft.setPolicyNumber("POL-REP-003");
        replacementDraft.setInsurerName("Africa Insurance Company");
        replacementDraft.setCoverageType("Comprehensive Commercial");
        replacementDraft.setInsuredAmount(14000000.0);
        replacementDraft.setPremium(44000.0);
        replacementDraft.setEffectiveDate("2026-09-01");
        replacementDraft.setExpiryDate("2027-09-01");

        Map<String, Object> repRes = cimsService.replacePolicy("pol-orig-001", replacementDraft, "Insurer change", "cro_user");
        assertTrue((Boolean) repRes.get("success"));
        InsurancePolicy replacementPol = (InsurancePolicy) repRes.get("policy");
        assertEquals("pol-orig-001", replacementPol.getReplacesPolicyId());
    }
}
