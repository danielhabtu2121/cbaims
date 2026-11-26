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

    org.springframework.data.domain.Page<Collateral> findByOriginType(String originType, Pageable pageable);
    long countByOriginType(String originType);
    Optional<Collateral> findByCbsCollateralRef(String cbsCollateralRef);
    long countByOriginTypeAndDataQualityStatus(String originType, String dataQualityStatus);
    long countByOriginTypeAndEnrichmentStatus(String originType, String enrichmentStatus);
    List<Collateral> findByOriginType(String originType);
    List<Collateral> findByOriginTypeAndDataQualityStatus(String originType, String dataQualityStatus);

    @Query("SELECT c FROM Collateral c WHERE (:segment IS NULL OR :segment = '' OR UPPER(c.owningSegment) = UPPER(:segment)) " +
           "AND (:origin IS NULL OR :origin = '' OR UPPER(c.originType) = UPPER(:origin)) " +
           "AND (:applyBranchFilter = false OR (c.branch IS NOT NULL AND UPPER(TRIM(c.branch)) IN :branches)) " +
           "AND (:query IS NULL OR :query = '' OR LOWER(c.code) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR (c.description IS NOT NULL AND LOWER(c.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "OR (c.customerId IS NOT NULL AND LOWER(c.customerId) LIKE LOWER(CONCAT('%', :query, '%'))))")
    org.springframework.data.domain.Page<Collateral> findPaged(
            @Param("query") String query,
            @Param("segment") String segment,
            @Param("origin") String origin,
            @Param("applyBranchFilter") boolean applyBranchFilter,
            @Param("branches") Collection<String> branches,
            Pageable pageable);
}
