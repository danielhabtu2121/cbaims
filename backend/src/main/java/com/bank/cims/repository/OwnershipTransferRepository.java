package com.bank.cims.repository;

import com.bank.cims.model.OwnershipTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OwnershipTransferRepository extends JpaRepository<OwnershipTransfer, String> {
    List<OwnershipTransfer> findByStatus(String status);
}
