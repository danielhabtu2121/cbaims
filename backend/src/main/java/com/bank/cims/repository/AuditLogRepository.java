package com.bank.cims.repository;

import com.bank.cims.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    List<AuditLog> findByUserId(String userId);
    List<AuditLog> findByActionTypeAndEntityId(String actionType, String entityId);
    List<AuditLog> findTop500ByOrderByTimestampDesc();
}
