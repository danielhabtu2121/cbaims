package com.bank.cims.repository;

import com.bank.cims.model.BusinessSegment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BusinessSegmentRepository extends JpaRepository<BusinessSegment, String> {
    Optional<BusinessSegment> findByName(String name);
}
