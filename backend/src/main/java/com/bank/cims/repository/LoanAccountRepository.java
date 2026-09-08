package com.bank.cims.repository;

import com.bank.cims.model.LoanAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanAccountRepository extends JpaRepository<LoanAccount, String> {
    List<LoanAccount> findByCustomerId(String customerId);
    Optional<LoanAccount> findByLoanReference(String loanReference);
    Optional<LoanAccount> findFirstByLoanReferenceIgnoreCase(String loanReference);
    Optional<LoanAccount> findFirstByLineCodeIgnoreCase(String lineCode);
}
