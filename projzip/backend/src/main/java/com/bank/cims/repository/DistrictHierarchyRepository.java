package com.bank.cims.repository;

import com.bank.cims.model.DistrictHierarchy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DistrictHierarchyRepository extends JpaRepository<DistrictHierarchy, String> {
    List<DistrictHierarchy> findByDistrictName(String districtName);
}
