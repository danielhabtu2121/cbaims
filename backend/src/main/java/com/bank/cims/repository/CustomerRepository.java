package com.bank.cims.repository;

import com.bank.cims.model.Customer;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    Optional<Customer> findFirstByCifIgnoreCase(String cif);
    Optional<Customer> findByCifIgnoreCase(String cif);
    Optional<Customer> findFirstByNameIgnoreCase(String name);
    default Optional<Customer> findByCif(String cif) {
        return findFirstByCifIgnoreCase(cif);
    }

    Optional<Customer> findFirstByNationalIdIgnoreCase(String nationalId);
    Optional<Customer> findFirstByTaxIdNoIgnoreCase(String taxIdNo);
    Optional<Customer> findFirstByBusinessRegNoIgnoreCase(String businessRegNo);

    List<Customer> findByBranch(String branch);
    List<Customer> findByBranchIn(Collection<String> branches);
    List<Customer> findBySegment(String segment);
    List<Customer> findBySegmentIn(Collection<String> segments);

    @Query("SELECT c FROM Customer c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(c.cif) LIKE LOWER(CONCAT('%', :query, '%')) OR (c.taxIdNo IS NOT NULL AND LOWER(c.taxIdNo) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Customer> searchCustomers(@Param("query") String query, Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE (:segment IS NULL OR :segment = '' OR UPPER(c.segment) = UPPER(:segment)) " +
           "AND (:query IS NULL OR :query = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(c.cif) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR (c.taxIdNo IS NOT NULL AND LOWER(c.taxIdNo) LIKE LOWER(CONCAT('%', :query, '%'))))")
    org.springframework.data.domain.Page<Customer> findPaged(@Param("query") String query, @Param("segment") String segment, Pageable pageable);
}
