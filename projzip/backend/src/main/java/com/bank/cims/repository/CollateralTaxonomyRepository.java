package com.bank.cims.repository;

import com.bank.cims.model.CollateralTaxonomy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollateralTaxonomyRepository extends JpaRepository<CollateralTaxonomy, String> {
    List<CollateralTaxonomy> findByCategory(String category);
    List<CollateralTaxonomy> findByCategoryIgnoreCase(String category);
}
