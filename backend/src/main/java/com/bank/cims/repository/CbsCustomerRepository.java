package com.bank.cims.repository;

import com.bank.cims.model.CbsCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CbsCustomerRepository extends JpaRepository<CbsCustomer, String> {
    Optional<CbsCustomer> findByCif(String cif);
}
