package com.bank.cims.repository;

import com.bank.cims.model.CbsCollateral;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CbsCollateralRepository extends JpaRepository<CbsCollateral, String> {
    List<CbsCollateral> findByCustomerCif(String customerCif);
    Optional<CbsCollateral> findByCollateralCode(String collateralCode);
}
