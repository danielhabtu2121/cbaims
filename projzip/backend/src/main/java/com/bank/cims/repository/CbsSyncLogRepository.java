package com.bank.cims.repository;

import com.bank.cims.model.CbsSyncLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CbsSyncLogRepository extends JpaRepository<CbsSyncLog, String> {
    List<CbsSyncLog> findAllByOrderByTimestampDesc();
}
