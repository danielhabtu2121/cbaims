package com.bank.cims.repository;

import com.bank.cims.model.InsurancePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface InsurancePolicyRepository extends JpaRepository<InsurancePolicy, String> {
    List<InsurancePolicy> findByCollateralId(String collateralId);
    List<InsurancePolicy> findByCollateralIdIn(Collection<String> collateralIds);
    List<InsurancePolicy> findByCollateralIdAndStatus(String collateralId, String status);
    List<InsurancePolicy> findByCustomerId(String customerId);
    List<InsurancePolicy> findByCustomerIdAndStatus(String customerId, String status);
    List<InsurancePolicy> findByStatus(String status);
    Optional<InsurancePolicy> findByPolicyNumber(String policyNumber);
    Optional<InsurancePolicy> findByPolicyNumberIgnoreCase(String policyNumber);
    List<InsurancePolicy> findByReplacesPolicyId(String replacesPolicyId);
    List<InsurancePolicy> findByRenewedFromPolicyId(String renewedFromPolicyId);
    List<InsurancePolicy> findByInsurerId(String insurerId);
    List<InsurancePolicy> findByLoanAccountId(String loanAccountId);
}
