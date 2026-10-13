package com.bank.cims.repository;

import com.bank.cims.model.CollateralOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollateralOwnerRepository extends JpaRepository<CollateralOwner, String> {
    List<CollateralOwner> findByCollateralId(String collateralId);
    List<CollateralOwner> findByCollateralIdAndStatus(String collateralId, String status);
}
