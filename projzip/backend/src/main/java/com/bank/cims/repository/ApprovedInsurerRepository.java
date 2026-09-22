package com.bank.cims.repository;

import com.bank.cims.model.ApprovedInsurer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApprovedInsurerRepository extends JpaRepository<ApprovedInsurer, String> {
    Optional<ApprovedInsurer> findByNameIgnoreCase(String name);
}
