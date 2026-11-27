package com.bank.cims.service;

import com.bank.cims.model.Collateral;
import com.bank.cims.model.InsurancePolicy;
import com.bank.cims.model.PolicyCollateralLink;
import com.bank.cims.repository.CollateralRepository;
import com.bank.cims.repository.InsurancePolicyRepository;
import com.bank.cims.repository.PolicyCollateralLinkRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages explicit multi-collateral insured-amount allocations per InsurancePolicy.
 * Enforces:
 * 1. Single-branch scope per policy (no cross-branch shared policies).
 * 2. Explicit positive allocatedInsuredAmount per collateral, with total <= policy.insuredAmount.
 */
@Service
public class PolicyCollateralAllocationService {

    @Autowired
    private PolicyCollateralLinkRepository policyCollateralLinkRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    public static class ResolvedCollateralPolicies {
        public final List<InsurancePolicy> policies;
        public final Map<String, Double> allocatedAmountByPolicyId;

        public ResolvedCollateralPolicies(List<InsurancePolicy> policies, Map<String, Double> allocatedAmountByPolicyId) {
            this.policies = policies;
            this.allocatedAmountByPolicyId = allocatedAmountByPolicyId;
        }
    }

    /**
     * Validates and persists PolicyCollateralLink rows for a policy.
     * Falls back to a single 100% allocation on policy.getCollateralId() if collateralAllocations is empty.
     */
    @Transactional
    public List<PolicyCollateralLink> validateAndSaveAllocations(InsurancePolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("Policy is required.");
        }
        List<PolicyCollateralLink> requested = policy.getCollateralAllocations();
        if (requested == null || requested.isEmpty()) {
            if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
                throw new IllegalArgumentException("At least one collateral must be selected for this policy.");
            }
            PolicyCollateralLink single = new PolicyCollateralLink();
            single.setCollateralId(policy.getCollateralId());
            single.setAllocatedInsuredAmount(policy.getInsuredAmount());
            single.setAllocationPct(100.0);
            requested = List.of(single);
        }

        double totalAllocated = 0.0;
        String policyBranch = null;
        Map<String, PolicyCollateralLink> deduped = new LinkedHashMap<>();
        String now = LocalDateTime.now().toString();

        for (PolicyCollateralLink item : requested) {
            if (item.getCollateralId() == null || item.getCollateralId().isBlank()) {
                throw new IllegalArgumentException("Each collateral allocation must specify a collateralId.");
            }
            Collateral col = collateralRepository.findById(item.getCollateralId().trim())
                    .or(() -> collateralRepository.findByCode(item.getCollateralId().trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Specified collateral not found: " + item.getCollateralId()));

            String colBranch = col.getBranch() != null ? col.getBranch().trim() : "";
            if (policyBranch == null) {
                policyBranch = colBranch;
            } else if (!policyBranch.equalsIgnoreCase(colBranch)) {
                throw new IllegalArgumentException(
                        "Cross-branch policy violation: All collaterals insured under a single policy must belong to the same branch ('"
                                + policyBranch + "' vs '" + colBranch + "').");
            }

            double allocAmt = item.getAllocatedInsuredAmount();
            if (allocAmt <= 0.0 && requested.size() == 1) {
                allocAmt = policy.getInsuredAmount();
            }
            if (allocAmt <= 0.0) {
                throw new IllegalArgumentException("Allocated insured amount must be greater than zero for collateral " + col.getCode() + ".");
            }

            if (deduped.containsKey(col.getId())) {
                throw new IllegalArgumentException("Duplicate collateral in policy allocations: " + col.getCode());
            }

            totalAllocated += allocAmt;

            PolicyCollateralLink link = new PolicyCollateralLink();
            link.setId("pcl-" + policy.getId() + "-" + UUID.randomUUID().toString().substring(0, 8));
            link.setPolicyId(policy.getId());
            link.setCollateralId(col.getId());
            link.setAllocatedInsuredAmount(allocAmt);
            double pct = policy.getInsuredAmount() > 0 ? Math.round((allocAmt / policy.getInsuredAmount()) * 10000.0) / 100.0 : 100.0;
            link.setAllocationPct(pct);
            link.setBranch(colBranch);
            link.setStatus("Active");
            link.setCreatedAt(now);
            link.setUpdatedAt(now);
            deduped.put(col.getId(), link);
        }

        if (policy.getInsuredAmount() > 0 && totalAllocated > policy.getInsuredAmount() + 0.01) {
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Allocation overflow: Total allocated insured amount (%.2f) exceeds policy Sum Insured (%.2f).",
                    totalAllocated, policy.getInsuredAmount()));
        }

        // Keep primary collateralId populated for backward compatibility
        String firstColId = deduped.keySet().iterator().next();
        policy.setCollateralId(firstColId);

        policyCollateralLinkRepository.deleteByPolicyId(policy.getId());
        List<PolicyCollateralLink> saved = policyCollateralLinkRepository.saveAll(new ArrayList<>(deduped.values()));
        policy.setCollateralAllocations(saved);
        return saved;
    }

    /**
     * Resolves all policies covering a collateral (via cims_policy_collateral_links + legacy collateralId)
     * along with each policy's explicit allocated insured amount for that collateral.
     */
    public ResolvedCollateralPolicies getPoliciesForCollateral(String collateralId, String collateralCode) {
        Set<String> lookupKeys = new LinkedHashSet<>();
        if (collateralId != null && !collateralId.isBlank()) lookupKeys.add(collateralId.trim());
        if (collateralCode != null && !collateralCode.isBlank()) lookupKeys.add(collateralCode.trim());
        if (lookupKeys.isEmpty()) {
            return new ResolvedCollateralPolicies(Collections.emptyList(), Collections.emptyMap());
        }

        Map<String, Double> allocatedByPolicyId = new HashMap<>();
        List<PolicyCollateralLink> links = policyCollateralLinkRepository.findByCollateralIdIn(lookupKeys);
        Set<String> linkedPolicyIds = new LinkedHashSet<>();
        for (PolicyCollateralLink link : links) {
            if ("Released".equalsIgnoreCase(link.getStatus()) || "Cancelled".equalsIgnoreCase(link.getStatus())) {
                continue;
            }
            if (link.getPolicyId() != null) {
                linkedPolicyIds.add(link.getPolicyId());
                allocatedByPolicyId.merge(link.getPolicyId(), link.getAllocatedInsuredAmount(), Double::sum);
            }
        }

        Map<String, InsurancePolicy> policyMap = new LinkedHashMap<>();
        if (!linkedPolicyIds.isEmpty()) {
            for (InsurancePolicy p : insurancePolicyRepository.findAllById(linkedPolicyIds)) {
                policyMap.put(p.getId(), p);
            }
        }

        // Backward-compatible fallback for any legacy policy not yet in cims_policy_collateral_links
        for (InsurancePolicy p : insurancePolicyRepository.findByCollateralIdIn(lookupKeys)) {
            if (!policyMap.containsKey(p.getId())) {
                policyMap.put(p.getId(), p);
                allocatedByPolicyId.putIfAbsent(p.getId(), p.getInsuredAmount());
            }
        }

        return new ResolvedCollateralPolicies(new ArrayList<>(policyMap.values()), allocatedByPolicyId);
    }

    /**
     * Marks only the released collateral's allocation link as Released without cancelling
     * the policy for any other collaterals still covered by the same policy.
     */
    @Transactional
    public void releaseCollateralFromPolicies(String collateralId, String collateralCode) {
        Set<String> lookupKeys = new LinkedHashSet<>();
        if (collateralId != null && !collateralId.isBlank()) lookupKeys.add(collateralId.trim());
        if (collateralCode != null && !collateralCode.isBlank()) lookupKeys.add(collateralCode.trim());
        if (lookupKeys.isEmpty()) return;

        List<PolicyCollateralLink> links = policyCollateralLinkRepository.findByCollateralIdIn(lookupKeys);
        String now = LocalDateTime.now().toString();
        for (PolicyCollateralLink link : links) {
            if (!"Released".equalsIgnoreCase(link.getStatus())) {
                link.setStatus("Released");
                link.setUpdatedAt(now);
            }
        }
        if (!links.isEmpty()) {
            policyCollateralLinkRepository.saveAll(links);
        }
    }

    /**
     * Populates transient collateralAllocations on a list of policies (e.g., for /api/state).
     */
    public void populateAllocations(List<InsurancePolicy> policies) {
        if (policies == null || policies.isEmpty()) return;
        List<String> policyIds = policies.stream().map(InsurancePolicy::getId).filter(Objects::nonNull).toList();
        if (policyIds.isEmpty()) return;
        Map<String, List<PolicyCollateralLink>> byPolicyId = policyCollateralLinkRepository.findByPolicyIdIn(policyIds)
                .stream()
                .filter(l -> !"Released".equalsIgnoreCase(l.getStatus()))
                .collect(Collectors.groupingBy(PolicyCollateralLink::getPolicyId));
        for (InsurancePolicy p : policies) {
            List<PolicyCollateralLink> allocs = byPolicyId.get(p.getId());
            if (allocs != null && !allocs.isEmpty()) {
                p.setCollateralAllocations(allocs);
            }
        }
    }
}
