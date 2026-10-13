package com.bank.cims.repository;

import com.bank.cims.model.LoanCollateralLinkHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoanCollateralLinkHistoryRepository extends JpaRepository<LoanCollateralLinkHistory, String> {
    List<LoanCollateralLinkHistory> findByLinkIdOrderByMakerDtStampDesc(String linkId);
    List<LoanCollateralLinkHistory> findByCollateralIdOrderByMakerDtStampDesc(String collateralId);
    List<LoanCollateralLinkHistory> findByLoanAccountIdOrderByMakerDtStampDesc(String loanAccountId);
    List<LoanCollateralLinkHistory> findByFacilityIdOrderByMakerDtStampDesc(String facilityId);
    List<LoanCollateralLinkHistory> findByCustomerIdOrderByMakerDtStampDesc(String customerId);
}
