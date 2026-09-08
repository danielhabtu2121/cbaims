package com.bank.cims.repository;

import com.bank.cims.model.EscalationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EscalationRuleRepository extends JpaRepository<EscalationRule, String> {
}
