package com.bank.cims.repository;

import com.bank.cims.model.PolicyHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PolicyHistoryRepository extends JpaRepository<PolicyHistory, String> {
    List<PolicyHistory> findByPolicyIdOrderByTimestampAsc(String policyId);
    List<PolicyHistory> findByPolicyIdOrderByTimestampDesc(String policyId);
}
