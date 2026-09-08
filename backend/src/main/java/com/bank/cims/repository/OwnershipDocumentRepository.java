package com.bank.cims.repository;

import com.bank.cims.model.OwnershipDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OwnershipDocumentRepository extends JpaRepository<OwnershipDocument, String> {
    List<OwnershipDocument> findByCollateralId(String collateralId);
    List<OwnershipDocument> findByEntityTypeAndEntityId(String entityType, String entityId);
}
