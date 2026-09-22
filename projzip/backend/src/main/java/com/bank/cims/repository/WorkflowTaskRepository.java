package com.bank.cims.repository;

import com.bank.cims.model.WorkflowTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowTaskRepository extends JpaRepository<WorkflowTask, String> {
    List<WorkflowTask> findByStatus(String status);
    List<WorkflowTask> findByCandidateRoleAndStatus(String candidateRole, String status);
    List<WorkflowTask> findByCandidateRoleIgnoreCaseAndStatus(String candidateRole, String status);
    List<WorkflowTask> findByMakerIdIgnoreCase(String makerId);
    List<WorkflowTask> findByMakerId(String makerId);
    List<WorkflowTask> findByEntityTypeAndEntityId(String entityType, String entityId);
}
