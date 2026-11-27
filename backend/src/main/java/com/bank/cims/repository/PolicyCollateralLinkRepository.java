package com.bank.cims.repository;

import com.bank.cims.model.PolicyCollateralLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface PolicyCollateralLinkRepository extends JpaRepository<PolicyCollateralLink, String> {
    List<PolicyCollateralLink> findByPolicyId(String policyId);
    List<PolicyCollateralLink> findByPolicyIdAndStatus(String policyId, String status);
    List<PolicyCollateralLink> findByPolicyIdIn(Collection<String> policyIds);
    List<PolicyCollateralLink> findByCollateralId(String collateralId);
    List<PolicyCollateralLink> findByCollateralIdIn(Collection<String> collateralIds);
    void deleteByPolicyId(String policyId);
}

