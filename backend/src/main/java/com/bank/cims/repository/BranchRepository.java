package com.bank.cims.repository;

import com.bank.cims.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BranchRepository extends JpaRepository<Branch, String> {
    Optional<Branch> findByCode(String code);
    List<Branch> findByParentDistrictId(String parentDistrictId);
}
