package com.bank.cims.repository;

import com.bank.cims.model.CbsFacility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CbsFacilityRepository extends JpaRepository<CbsFacility, String> {
    List<CbsFacility> findByCustomerCif(String customerCif);
    Optional<CbsFacility> findByLineCode(String lineCode);
    Optional<CbsFacility> findByLoanRefNo(String loanRefNo);
}
