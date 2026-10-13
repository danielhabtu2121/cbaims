package com.bank.cims.repository;

import com.bank.cims.model.LoanAccount;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LoanAccountRepository extends JpaRepository<LoanAccount, String> {
    List<LoanAccount> findByCustomerId(String customerId);
    List<LoanAccount> findByCustomerIdIn(Collection<String> customerIds);
    List<LoanAccount> findByBranch(String branch);
    List<LoanAccount> findByBranchIn(Collection<String> branches);
    List<LoanAccount> findBySegment(String segment);
    List<LoanAccount> findBySegmentIn(Collection<String> segments);
    List<LoanAccount> findByRmUserId(String rmUserId);
    Optional<LoanAccount> findByLoanReference(String loanReference);
    Optional<LoanAccount> findFirstByLoanReferenceIgnoreCase(String loanReference);
    Optional<LoanAccount> findFirstByLineCodeIgnoreCase(String lineCode);

    @Query("SELECT l FROM LoanAccount l WHERE LOWER(l.loanReference) LIKE LOWER(CONCAT('%', :query, '%')) OR (l.accountNumber IS NOT NULL AND LOWER(l.accountNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<LoanAccount> searchLoanAccounts(@Param("query") String query, Pageable pageable);

    @Query("SELECT l FROM LoanAccount l ORDER BY l.outstandingBalance DESC")
    List<LoanAccount> findTopByOutstandingBalance(Pageable pageable);
}
