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
    default Optional<Customer> findByCif(String cif) {
        return findFirstByCifIgnoreCase(cif);
    }

    List<Customer> findByBranch(String branch);
    List<Customer> findByBranchIn(Collection<String> branches);
    List<Customer> findBySegment(String segment);
    List<Customer> findBySegmentIn(Collection<String> segments);

    @Query("SELECT c FROM Customer c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(c.cif) LIKE LOWER(CONCAT('%', :query, '%')) OR (c.taxIdNo IS NOT NULL AND LOWER(c.taxIdNo) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Customer> searchCustomers(@Param("query") String query, Pageable pageable);
}
