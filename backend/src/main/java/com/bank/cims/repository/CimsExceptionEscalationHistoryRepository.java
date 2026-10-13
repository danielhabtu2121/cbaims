package com.bank.cims.repository;

import com.bank.cims.model.CimsExceptionEscalationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CimsExceptionEscalationHistoryRepository extends JpaRepository<CimsExceptionEscalationHistory, String> {
    List<CimsExceptionEscalationHistory> findByExceptionIdOrderByEscalatedAtDesc(String exceptionId);
    List<CimsExceptionEscalationHistory> findByExceptionIdOrderByEscalatedAtAsc(String exceptionId);
}
