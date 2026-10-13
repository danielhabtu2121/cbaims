package com.bank.cims.repository;

import com.bank.cims.model.CbsSyncLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.util.Optional;

@Repository
public interface CbsSyncLogRepository extends JpaRepository<CbsSyncLog, String> {
    List<CbsSyncLog> findAllByOrderByTimestampDesc();
    Optional<CbsSyncLog> findFirstByOrderByTimestampDesc();
    Optional<CbsSyncLog> findFirstByResultOrderByTimestampDesc(String result);
    List<CbsSyncLog> findByEntityTypeOrderByTimestampDesc(String entityType);
    List<CbsSyncLog> findByResultOrderByTimestampDesc(String result);
}
