package com.bank.cims.repository;

import com.bank.cims.model.Collateral;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CollateralRepository extends JpaRepository<Collateral, String> {
    List<Collateral> findByCustomerId(String customerId);
    List<Collateral> findByOwningSegment(String owningSegment);
    Optional<Collateral> findByCode(String code);
    Optional<Collateral> findFirstByCodeIgnoreCase(String code);
}
