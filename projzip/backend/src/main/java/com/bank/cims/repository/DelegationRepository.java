package com.bank.cims.repository;

import com.bank.cims.model.Delegation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DelegationRepository extends JpaRepository<Delegation, String> {
    List<Delegation> findByDelegatorIdAndStatus(String delegatorId, String status);
    List<Delegation> findByDelegateIdAndStatus(String delegateId, String status);
}
