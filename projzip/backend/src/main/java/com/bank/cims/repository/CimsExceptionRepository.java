package com.bank.cims.repository;

import com.bank.cims.model.CimsException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CimsExceptionRepository extends JpaRepository<CimsException, String> {
    List<CimsException> findByStatus(String status);
    List<CimsException> findByAssignedToRole(String assignedToRole);
    List<CimsException> findByEntityTypeAndEntityId(String entityType, String entityId);
}
