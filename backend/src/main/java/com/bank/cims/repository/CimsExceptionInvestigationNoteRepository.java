package com.bank.cims.repository;

import com.bank.cims.model.CimsExceptionInvestigationNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CimsExceptionInvestigationNoteRepository extends JpaRepository<CimsExceptionInvestigationNote, String> {
    List<CimsExceptionInvestigationNote> findByExceptionIdOrderByCreatedAtAsc(String exceptionId);
    List<CimsExceptionInvestigationNote> findByExceptionIdOrderByCreatedAtDesc(String exceptionId);
}
