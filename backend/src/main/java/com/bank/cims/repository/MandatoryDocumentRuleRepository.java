package com.bank.cims.repository;

import com.bank.cims.model.MandatoryDocumentRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MandatoryDocumentRuleRepository extends JpaRepository<MandatoryDocumentRule, String> {
    List<MandatoryDocumentRule> findByCollateralCategory(String collateralCategory);
}
