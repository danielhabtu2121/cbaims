package com.bank.cims.repository;

import com.bank.cims.model.ExceptionRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExceptionRequestRepository extends JpaRepository<ExceptionRequest, String> {
    List<ExceptionRequest> findByStatus(String status);
}
