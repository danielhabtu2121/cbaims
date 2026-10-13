package com.bank.cims.repository;

import com.bank.cims.model.CimsExceptionAssignmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CimsExceptionAssignmentHistoryRepository extends JpaRepository<CimsExceptionAssignmentHistory, String> {
    List<CimsExceptionAssignmentHistory> findByExceptionIdOrderByAssignedAtDesc(String exceptionId);
    List<CimsExceptionAssignmentHistory> findByExceptionIdOrderByAssignedAtAsc(String exceptionId);
}
