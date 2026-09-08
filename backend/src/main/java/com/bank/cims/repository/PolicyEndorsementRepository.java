package com.bank.cims.repository;

import com.bank.cims.model.PolicyEndorsement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PolicyEndorsementRepository extends JpaRepository<PolicyEndorsement, String> {
    List<PolicyEndorsement> findByPolicyId(String policyId);
    List<PolicyEndorsement> findByPolicyIdOrderByEffectiveDateDesc(String policyId);
}
