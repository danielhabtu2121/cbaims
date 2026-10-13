package com.bank.cims.repository;

import com.bank.cims.model.LoanCollateralLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface LoanCollateralLinkRepository extends JpaRepository<LoanCollateralLink, String> {
    List<LoanCollateralLink> findByLoanAccountId(String loanAccountId);
    List<LoanCollateralLink> findByLoanAccountIdIn(Collection<String> loanAccountIds);
    List<LoanCollateralLink> findByCollateralId(String collateralId);
    List<LoanCollateralLink> findByCollateralIdIn(Collection<String> collateralIds);
    List<LoanCollateralLink> findByFacilityId(String facilityId);
    List<LoanCollateralLink> findByFacilityIdIn(Collection<String> facilityIds);
    boolean existsByLoanAccountIdAndCollateralId(String loanAccountId, String collateralId);
    List<LoanCollateralLink> findByCollateralIdAndLoanAccountId(String collateralId, String loanAccountId);
    List<LoanCollateralLink> findByCollateralIdAndLoanAccountIdAndStatus(String collateralId, String loanAccountId, String status);
    List<LoanCollateralLink> findByCollateralIdAndStatus(String collateralId, String status);
    List<LoanCollateralLink> findByLoanAccountIdAndStatus(String loanAccountId, String status);
    List<LoanCollateralLink> findByFacilityIdAndStatus(String facilityId, String status);
    List<LoanCollateralLink> findByStatus(String status);
    boolean existsByCollateralIdAndLoanAccountIdAndStatus(String collateralId, String loanAccountId, String status);
    List<LoanCollateralLink> findByCustomerId(String customerId);
    void deleteByCollateralId(String collateralId);
    void deleteByLoanAccountId(String loanAccountId);
}
