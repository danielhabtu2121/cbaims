package com.bank.cims.repository;

import com.bank.cims.model.ApprovalHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalHistoryRepository extends JpaRepository<ApprovalHistory, String> {
    List<ApprovalHistory> findByWorkflowTaskIdOrderByDecidedAtDesc(String workflowTaskId);
}
