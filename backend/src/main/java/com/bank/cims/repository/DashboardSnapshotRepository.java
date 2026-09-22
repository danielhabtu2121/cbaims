package com.bank.cims.repository;

import com.bank.cims.model.DashboardSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DashboardSnapshotRepository extends JpaRepository<DashboardSnapshot, String> {

    Optional<DashboardSnapshot> findBySnapshotDateAndScopeLevelAndScopeId(String snapshotDate, String scopeLevel, String scopeId);

    List<DashboardSnapshot> findByScopeLevelAndScopeIdOrderBySnapshotDateAsc(String scopeLevel, String scopeId);

    List<DashboardSnapshot> findTop30ByScopeLevelAndScopeIdOrderBySnapshotDateDesc(String scopeLevel, String scopeId);
}
