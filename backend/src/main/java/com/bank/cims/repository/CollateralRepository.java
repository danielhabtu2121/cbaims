package com.bank.cims.repository;

import com.bank.cims.model.Collateral;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CollateralRepository extends JpaRepository<Collateral, String> {
    List<Collateral> findByCustomerId(String customerId);
    List<Collateral> findByCustomerIdIn(Collection<String> customerIds);
    List<Collateral> findByOwningSegment(String owningSegment);
    List<Collateral> findByOwningSegmentIn(Collection<String> owningSegments);
    List<Collateral> findByBranch(String branch);
    List<Collateral> findByBranchIn(Collection<String> branches);
    List<Collateral> findByBranchAndOwningSegment(String branch, String owningSegment);
    Optional<Collateral> findByCode(String code);
    Optional<Collateral> findFirstByCodeIgnoreCase(String code);

    @Query("SELECT c FROM Collateral c WHERE LOWER(c.code) LIKE LOWER(CONCAT('%', :query, '%')) OR (c.description IS NOT NULL AND LOWER(c.description) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Collateral> searchCollaterals(@Param("query") String query, Pageable pageable);

    @Query("SELECT c FROM Collateral c ORDER BY c.valuationAmount DESC")
    List<Collateral> findTopByMarketValue(Pageable pageable);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Collateral c WHERE c.id = :id")
    Optional<Collateral> findByIdForUpdate(@Param("id") String id);
}
