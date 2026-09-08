package com.bank.cims.repository;

import com.bank.cims.model.ApprovalHierarchyConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApprovalHierarchyConfigRepository extends JpaRepository<ApprovalHierarchyConfig, String> {
    Optional<ApprovalHierarchyConfig> findByTransactionType(String transactionType);
}
