package com.bank.cims;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.CbsMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Full-stack HTTP + Security + JPA UAT Verification Suite (excluding DMS, SMS, Outlook, and Document Validation).
 */
@SpringBootTest
@AutoConfigureMockMvc
public class UatEndToEndVerificationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;

    @Autowired private UserRepository userRepository;
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private LoanAccountRepository loanAccountRepository;
    @Autowired private CollateralRepository collateralRepository;
    @Autowired private ApprovedInsurerRepository approvedInsurerRepository;
    @Autowired private InsurancePolicyRepository insurancePolicyRepository;

    private static final String TEST_PWD = "UatPass#2026!";

    @BeforeEach
    void setupFixtures() {
        ensureBranch("brn-bole", "CBS-001", "001", "Bole Branch");
        ensureBranch("brn-merkato", "CBS-002", "002", "Merkato Branch");

        ensureUser("usr-uat-sysadmin", "uat_sysadmin", "SYSADMIN", "Head Office", "ALL");
        ensureUser("usr-uat-cro-bole", "uat_cro_bole", "CRO", "Bole Branch", "Retail Banking");
        ensureUser("usr-uat-brmgr-bole", "uat_brmgr_bole", "BRMGR", "Bole Branch", "Retail Banking");
        ensureUser("usr-uat-rm-bole", "uat_rm_bole", "RM", "Bole Branch", "Retail Banking");
        ensureUser("usr-uat-auditor", "uat_auditor", "AUDITOR", "Head Office", "ALL");

        ensureInsurer("ins-nyala", "Nyala Insurance S.C.");

        Customer boleCust = ensureCustomer("cst-uat-bole", "CIF-UAT-BOLE", "Bole Retail Customer", "Bole Branch", "Retail Banking");
        Customer merkatoCust = ensureCustomer("cst-uat-merk", "CIF-UAT-MERK", "Merkato Corp Customer", "Merkato Branch", "Corporate Banking");

        ensureLoan("ln-uat-bole", "LN-UAT-BOLE-01", boleCust.getId(), "Bole Branch", "Retail Banking", 5_000_000.0);
        ensureLoan("ln-uat-merk", "LN-UAT-MERK-01", merkatoCust.getId(), "Merkato Branch", "Corporate Banking", 9_000_000.0);

        ensureCollateral("col-uat-bole-1", "COL-UAT-B1", boleCust.getId(), "Bole Branch", "Retail Banking", 10_000_000.0, 20.0);
        ensureCollateral("col-uat-bole-2", "COL-UAT-B2", boleCust.getId(), "Bole Branch", "Retail Banking", 6_000_000.0, 20.0);
        ensureCollateral("col-uat-merk-1", "COL-UAT-M1", merkatoCust.getId(), "Merkato Branch", "Corporate Banking", 15_000_000.0, 20.0);
    }

    private void ensureBranch(String id, String code, String cbsCode, String name) {
        if (branchRepository.findById(id).isEmpty()) {
            Branch b = new Branch();
            b.setId(id);
            b.setCode(code);
            b.setCbsBranchCode(cbsCode);
            b.setName(name);
            b.setType("Branch");
            b.setActive(true);
            branchRepository.save(b);
        }
    }

    private void ensureUser(String id, String username, String role, String branch, String segment) {
        User u = userRepository.findByUsernameIgnoreCase(username).orElseGet(User::new);
        if (u.getId() == null) u.setId(id);
        u.setUsername(username);
        u.setFullName(username.toUpperCase());
        u.setPassword(passwordEncoder.encode(TEST_PWD));
        u.setRole(role);
        u.setBranch(branch);
        u.setSegment(segment);
        u.setSegmentIds(segment);
        u.setActive(true);
        userRepository.save(u);
    }

    private void ensureInsurer(String id, String name) {
        if (approvedInsurerRepository.findById(id).isEmpty()) {
            ApprovedInsurer ins = new ApprovedInsurer();
            ins.setId(id);
            ins.setName(name);
            ins.setActive(true);
            approvedInsurerRepository.save(ins);
        }
    }

    private Customer ensureCustomer(String id, String cif, String name, String branch, String segment) {
        return customerRepository.findById(id).orElseGet(() -> {
            Customer c = new Customer();
            c.setId(id);
            c.setCif(cif);
            c.setName(name);
            c.setBranch(branch);
            c.setSegment(segment);
            c.setStatus("Active");
            return customerRepository.save(c);
        });
    }

    private void ensureLoan(String id, String ref, String custId, String branch, String segment, double bal) {
        if (loanAccountRepository.findById(id).isEmpty()) {
            LoanAccount la = new LoanAccount();
            la.setId(id);
            la.setLoanReference(ref);
            la.setCustomerId(custId);
            la.setBranch(branch);
            la.setSegment(segment);
            la.setFacilityType("Term Loan");
            la.setApprovedLimit(bal);
            la.setOutstandingBalance(bal);
            la.setStatus("Active");
            loanAccountRepository.save(la);
        }
    }

    private void ensureCollateral(String id, String code, String custId, String branch, String segment, double val, double haircut) {
        if (collateralRepository.findById(id).isEmpty()) {
            Collateral col = new Collateral();
            col.setId(id);
            col.setCode(code);
            col.setCustomerId(custId);
            col.setBranch(branch);
            col.setOwningSegment(segment);
            col.setCategory("Building");
            col.setType("Property");
            col.setOwnerType("Borrower-owned");
            col.setValuationAmount(val);
            col.setHaircut(haircut);
            col.setLimitContribution(val * (1.0 - haircut / 100.0));
            col.setStatus("Active");
            col.setOriginType("CBAIMS_REGISTERED");
            collateralRepository.save(col);
        }
    }

    private String loginAndGetToken(String username) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", username, "password", TEST_PWD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();
        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return json.get("token").asText();
    }

    @Test
    @DisplayName("TC-AUT-001/002/005/006/007/010/016: Auth, RBAC, Scope Isolation & Header Spoofing Protection")
    void testAuthRbacAndBranchSegmentScope() throws Exception {
        // TC-AUT-006: Unauthenticated request rejected
        mockMvc.perform(get("/api/state")).andExpect(status().isUnauthorized());

        // TC-AUT-002: Wrong password refused
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", "uat_sysadmin", "password", "Wrong!999"))))
                .andExpect(status().isUnauthorized());

        // TC-AUT-016: Forgot-password does not leak raw reset token
        MvcResult forgotRes = mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("identifier", "uat_sysadmin"))))
                .andExpect(status().isOk())
                .andReturn();
        String forgotBody = forgotRes.getResponse().getContentAsString();
        assertFalse(forgotBody.contains("resetToken"), "Forgot password must not expose raw resetToken");

        // TC-AUT-001 & TC-AUT-005: CRO logs in, cannot access /api/admin/**
        String croToken = loginAndGetToken("uat_cro_bole");
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + croToken))
                .andExpect(status().isForbidden());

        // TC-AUT-010: Caller-supplied X-User-Id cannot impersonate SYSADMIN
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + croToken)
                        .header("X-User-Id", "uat_sysadmin"))
                .andExpect(status().isForbidden());

        // TC-AUT-007: Bole Retail CRO sees only Bole Retail records, never Merkato Corporate
        MvcResult colPage = mockMvc.perform(get("/api/collaterals/paged?page=0&size=50")
                        .header("Authorization", "Bearer " + croToken))
                .andExpect(status().isOk())
                .andReturn();
        String colJson = colPage.getResponse().getContentAsString();
        assertTrue(colJson.contains("COL-UAT-B1"), "Bole CRO must see Bole collateral");
        assertFalse(colJson.contains("COL-UAT-M1"), "Bole CRO must NOT see Merkato collateral");

        MvcResult custPage = mockMvc.perform(get("/api/customers/paged?page=0&size=50")
                        .header("Authorization", "Bearer " + croToken))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(custPage.getResponse().getContentAsString().contains("CIF-UAT-BOLE"));
        assertFalse(custPage.getResponse().getContentAsString().contains("CIF-UAT-MERK"));

        // TC-AUT-006: Auditor is read-only (cannot save user or mutate)
        String auditorToken = loginAndGetToken("uat_auditor");
        mockMvc.perform(post("/api/admin/users/save")
                        .header("Authorization", "Bearer " + auditorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"rogue_user\"}"))
                .andExpect(status().isForbidden());

        // TC-AUD-005: SQL injection attempt in search returns 200 safely without error
        mockMvc.perform(get("/api/collaterals/paged?search=" + java.net.URLEncoder.encode("' OR 1=1 --", java.nio.charset.StandardCharsets.UTF_8))
                        .header("Authorization", "Bearer " + croToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-POL-001..005 & Multi-Collateral Existing Policy Allocation: Add Collateral to Existing Policy + Same-Branch Enforcement")
    void testInsurancePolicyAndAddCollateralToExistingPolicy() throws Exception {
        String croToken = loginAndGetToken("uat_cro_bole");

        // 1. Register a policy on COL-UAT-B1 with Sum Insured = 16,000,000 (covers 10M + 6M)
        String eff = LocalDate.now().toString();
        String exp = LocalDate.now().plusYears(1).toString();
        Map<String, Object> polPayload = Map.of(
                "policyNumber", "POL-UAT-MULTI-01",
                "insurerId", "ins-nyala",
                "insurerName", "Nyala Insurance S.C.",
                "collateralId", "col-uat-bole-1",
                "coverageType", "Fire & Lightning",
                "insuredAmount", 16_000_000.0,
                "premium", 45_000.0,
                "effectiveDate", eff,
                "expiryDate", exp,
                "status", "Draft"
        );
        mockMvc.perform(post("/api/policies/add")
                        .header("Authorization", "Bearer " + croToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(polPayload)))
                .andExpect(status().isOk());

        InsurancePolicy savedPol = insurancePolicyRepository.findByPolicyNumber("POL-UAT-MULTI-01").orElseThrow();

        // 2. Add a SECOND same-branch collateral (col-uat-bole-2) to this EXISTING policy (10M + 6M = 16M)
        Map<String, Object> allocPayload = Map.of(
                "collateralAllocations", List.of(
                        Map.of("collateralId", "col-uat-bole-1", "allocatedInsuredAmount", 10_000_000.0),
                        Map.of("collateralId", "col-uat-bole-2", "allocatedInsuredAmount", 6_000_000.0)
                )
        );
        mockMvc.perform(post("/api/policies/" + savedPol.getId() + "/allocations")
                        .header("Authorization", "Bearer " + croToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(allocPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.allocations", hasSize(2)));

        // 3. Cross-branch collateral (col-uat-merk-1 in Merkato Branch) on the same policy MUST be rejected
        Map<String, Object> crossBranchPayload = Map.of(
                "collateralAllocations", List.of(
                        Map.of("collateralId", "col-uat-bole-1", "allocatedInsuredAmount", 10_000_000.0),
                        Map.of("collateralId", "col-uat-merk-1", "allocatedInsuredAmount", 6_000_000.0)
                )
        );
        mockMvc.perform(post("/api/policies/" + savedPol.getId() + "/allocations")
                        .header("Authorization", "Bearer " + croToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(crossBranchPayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Cross-branch")));

        // 4. Allocation overflow (> Sum Insured 16M) MUST be rejected
        Map<String, Object> overflowPayload = Map.of(
                "collateralAllocations", List.of(
                        Map.of("collateralId", "col-uat-bole-1", "allocatedInsuredAmount", 12_000_000.0),
                        Map.of("collateralId", "col-uat-bole-2", "allocatedInsuredAmount", 6_000_000.0)
                )
        );
        mockMvc.perform(post("/api/policies/" + savedPol.getId() + "/allocations")
                        .header("Authorization", "Bearer " + croToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overflowPayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Allocation overflow")));
    }

    @Test
    @DisplayName("TC-DSH-001..003 & TC-ADM-013: Dashboards, Hierarchy, New User Segment/Branch Scoping, and CBS Mappings")
    void testDashboardsAdminNewUserScopingAndCbsMappings() throws Exception {
        String sysToken = loginAndGetToken("uat_sysadmin");
        String croToken = loginAndGetToken("uat_cro_bole");

        // Dashboards for SYSADMIN
        mockMvc.perform(get("/api/dashboard/summary?userId=uat_sysadmin")
                        .header("Authorization", "Bearer " + sysToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalOutstandingExposure").exists());

        mockMvc.perform(get("/api/dashboard/charts?userId=uat_sysadmin")
                        .header("Authorization", "Bearer " + sysToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/dashboard/hierarchy/bank?userId=uat_sysadmin")
                        .header("Authorization", "Bearer " + sysToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segments").isArray());

        // Branch/Segment user cannot access bank-wide hierarchy
        mockMvc.perform(get("/api/dashboard/hierarchy/bank?userId=uat_cro_bole")
                        .header("Authorization", "Bearer " + croToken))
                .andExpect(status().is4xxClientError());

        // TC-ADM-013: Create a new user via /api/admin/users/save with CBS segment code "MRETAIL" -> normalized & scoped
        Map<String, Object> newUser = Map.of(
                "username", "uat_new_merkato",
                "fullName", "New Merkato Officer",
                "password", TEST_PWD,
                "role", "CRO",
                "branch", "Merkato Branch",
                "segment", "CORPORATE",
                "active", true
        );
        mockMvc.perform(post("/api/admin/users/save")
                        .header("Authorization", "Bearer " + sysToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segment").value("Corporate Banking"));

        // New user logs in and is immediately scoped to Merkato Corporate Banking (cannot see Bole Retail)
        String newToken = loginAndGetToken("uat_new_merkato");
        MvcResult newColPage = mockMvc.perform(get("/api/collaterals/paged?page=0&size=50")
                        .header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(newColPage.getResponse().getContentAsString().contains("COL-UAT-M1"));
        assertFalse(newColPage.getResponse().getContentAsString().contains("COL-UAT-B1"));

        // Verify newly confirmed CBS mappings
        assertEquals("Vehicle", CbsMapper.resolveCollateralType("V"));
        assertEquals("Property", CbsMapper.resolveCollateralType("P"));
        assertEquals("Marketable Share", CbsMapper.resolveCollateralType("M"));
        assertEquals("Guarantee", CbsMapper.resolveCollateralType("G"));
        assertEquals("Building", CbsMapper.resolveCollateralCategory("1001"));
        assertEquals("Security Issued by Government", CbsMapper.resolveCollateralCategory("1012"));
        assertEquals("ESA Loan", CbsMapper.resolveFacilityType("ESAL"));
    }
}
