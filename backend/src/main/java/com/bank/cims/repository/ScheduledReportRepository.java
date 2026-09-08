package com.bank.cims.repository;

import com.bank.cims.model.ScheduledReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduledReportRepository extends JpaRepository<ScheduledReport, String> {
    List<ScheduledReport> findByStatus(String status);
}
