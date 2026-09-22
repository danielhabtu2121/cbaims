package com.bank.cims.repository;

import com.bank.cims.model.CbsAccCollLinkDtls;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CbsAccCollLinkDtlsRepository extends JpaRepository<CbsAccCollLinkDtls, String> {
    List<CbsAccCollLinkDtls> findByAccountNumber(String accountNumber);
    List<CbsAccCollLinkDtls> findByLinkedReferenceNo(String linkedReferenceNo);
    List<CbsAccCollLinkDtls> findBySyncStatus(String syncStatus);
}
