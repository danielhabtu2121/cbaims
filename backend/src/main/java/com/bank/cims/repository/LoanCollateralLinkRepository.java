package com.bank.cims.repository;

import com.bank.cims.model.LoanCollateralLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoanCollateralLinkRepository extends JpaRepository<LoanCollateralLink, String> {
    List<LoanCollateralLink> findByLoanAccountId(String loanAccountId);
    List<LoanCollateralLink> findByCollateralId(String collateralId);
    List<LoanCollateralLink> findByFacilityId(String facilityId);
    boolean existsByLoanAccountIdAndCollateralId(String loanAccountId, String collateralId);
    void deleteByCollateralId(String collateralId);
    void deleteByLoanAccountId(String loanAccountId);
}
