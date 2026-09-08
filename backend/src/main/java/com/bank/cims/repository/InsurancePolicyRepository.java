package com.bank.cims.repository;

import com.bank.cims.model.InsurancePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InsurancePolicyRepository extends JpaRepository<InsurancePolicy, String> {
    List<InsurancePolicy> findByCollateralId(String collateralId);
    List<InsurancePolicy> findByCustomerId(String customerId);
    List<InsurancePolicy> findByStatus(String status);
    Optional<InsurancePolicy> findByPolicyNumber(String policyNumber);
}
