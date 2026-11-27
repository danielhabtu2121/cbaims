package com.bank.cims.service;

import com.bank.cims.model.Collateral;
import com.bank.cims.model.InsurancePolicy;
import com.bank.cims.model.PolicyCollateralLink;
import com.bank.cims.repository.CollateralRepository;
import com.bank.cims.repository.InsurancePolicyRepository;
import com.bank.cims.repository.PolicyCollateralLinkRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PolicyCollateralAllocationServiceTest {

    @Mock
    private PolicyCollateralLinkRepository policyCollateralLinkRepository;

    @Mock
    private CollateralRepository collateralRepository;

    @Mock
    private InsurancePolicyRepository insurancePolicyRepository;

    @InjectMocks
    private PolicyCollateralAllocationService allocationService;

    @Test
    @DisplayName("Allows multi-collateral policy within same branch with explicit allocated insured amounts")
    void testSameBranchMultiCollateralAllocationSuccess() {
        Collateral col1 = new Collateral();
        col1.setId("col-1");
        col1.setCode("COL-001");
        col1.setBranch("Bole Special Branch");

        Collateral col2 = new Collateral();
        col2.setId("col-2");
        col2.setCode("COL-002");
        col2.setBranch("Bole Special Branch");

        when(collateralRepository.findById("col-1")).thenReturn(Optional.of(col1));
        when(collateralRepository.findById("col-2")).thenReturn(Optional.of(col2));
        when(policyCollateralLinkRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-1");
        policy.setInsuredAmount(10_000_000.0);

        PolicyCollateralLink a1 = new PolicyCollateralLink();
        a1.setCollateralId("col-1");
        a1.setAllocatedInsuredAmount(6_000_000.0);

        PolicyCollateralLink a2 = new PolicyCollateralLink();
        a2.setCollateralId("col-2");
        a2.setAllocatedInsuredAmount(4_000_000.0);

        policy.setCollateralAllocations(List.of(a1, a2));

        List<PolicyCollateralLink> saved = allocationService.validateAndSaveAllocations(policy);
        assertEquals(2, saved.size());
        assertEquals("col-1", policy.getCollateralId());
        assertEquals(60.0, saved.get(0).getAllocationPct(), 0.01);
        assertEquals(40.0, saved.get(1).getAllocationPct(), 0.01);
    }

    @Test
    @DisplayName("Rejects cross-branch collaterals under the same policy")
    void testRejectsCrossBranchCollaterals() {
        Collateral col1 = new Collateral();
        col1.setId("col-1");
        col1.setCode("COL-001");
        col1.setBranch("Bole Special Branch");

        Collateral col2 = new Collateral();
        col2.setId("col-2");
        col2.setCode("COL-002");
        col2.setBranch("Kality Branch");

        when(collateralRepository.findById("col-1")).thenReturn(Optional.of(col1));
        when(collateralRepository.findById("col-2")).thenReturn(Optional.of(col2));

        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-2");
        policy.setInsuredAmount(10_000_000.0);

        PolicyCollateralLink a1 = new PolicyCollateralLink();
        a1.setCollateralId("col-1");
        a1.setAllocatedInsuredAmount(5_000_000.0);
        PolicyCollateralLink a2 = new PolicyCollateralLink();
        a2.setCollateralId("col-2");
        a2.setAllocatedInsuredAmount(5_000_000.0);
        policy.setCollateralAllocations(List.of(a1, a2));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> allocationService.validateAndSaveAllocations(policy));
        assertTrue(ex.getMessage().contains("Cross-branch policy violation"));
    }

    @Test
    @DisplayName("Rejects allocation overflow exceeding policy Sum Insured")
    void testRejectsAllocationOverflow() {
        Collateral col1 = new Collateral();
        col1.setId("col-1");
        col1.setCode("COL-001");
        col1.setBranch("Bole Special Branch");

        when(collateralRepository.findById("col-1")).thenReturn(Optional.of(col1));

        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-3");
        policy.setInsuredAmount(5_000_000.0);

        PolicyCollateralLink a1 = new PolicyCollateralLink();
        a1.setCollateralId("col-1");
        a1.setAllocatedInsuredAmount(6_000_000.0);
        policy.setCollateralAllocations(List.of(a1));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> allocationService.validateAndSaveAllocations(policy));
        assertTrue(ex.getMessage().contains("Allocation overflow"));
    }

    @Test
    @DisplayName("EffectiveInsuranceService uses explicit per-collateral allocation without double-counting")
    void testEffectiveInsuranceUsesExplicitAllocation() {
        EffectiveInsuranceService eis = new EffectiveInsuranceService();
        InsurancePolicy policy = new InsurancePolicy();
        policy.setId("pol-1");
        policy.setInsuredAmount(10_000_000.0);
        policy.setStatus("Active");
        policy.setAuthStat("A");
        policy.setRecordStat("O");
        policy.setEffectiveDate(LocalDate.now().minusDays(10).toString());
        policy.setExpiryDate(LocalDate.now().plusDays(100).toString());

        EffectiveInsuranceService.PolicyCategorizationResult res =
                eis.categorizePoliciesWithAllocations(List.of(policy), Map.of("pol-1", 3_500_000.0), LocalDate.now(), 30);

        assertEquals(3_500_000.0, res.totalActiveSumInsured, 0.01);
        assertEquals(1, res.activeValidPolicies.size());
    }
}
