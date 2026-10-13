package com.bank.cims.repository;

import com.bank.cims.dto.OwnershipDocumentSummaryDto;
import com.bank.cims.model.OwnershipDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OwnershipDocumentRepository extends JpaRepository<OwnershipDocument, String> {
    List<OwnershipDocument> findByCollateralId(String collateralId);
    List<OwnershipDocument> findByCollateralIdIn(Collection<String> collateralIds);
    List<OwnershipDocument> findByEntityTypeAndEntityId(String entityType, String entityId);
    List<OwnershipDocument> findByEntityId(String entityId);
    default List<OwnershipDocument> findByCustomerId(String customerId) {
        return findByEntityId(customerId);
    }

    @Query("SELECT new com.bank.cims.dto.OwnershipDocumentSummaryDto(d.id, d.entityType, d.entityId, d.collateralId, d.name, d.type, d.verificationStatus, d.status, d.expiryDate, d.version, d.isLatest) FROM OwnershipDocument d")
    List<OwnershipDocumentSummaryDto> findAllSummaries();

    @Query("SELECT new com.bank.cims.dto.OwnershipDocumentSummaryDto(d.id, d.entityType, d.entityId, d.collateralId, d.name, d.type, d.verificationStatus, d.status, d.expiryDate, d.version, d.isLatest) FROM OwnershipDocument d WHERE d.collateralId IN :collateralIds")
    List<OwnershipDocumentSummaryDto> findSummariesByCollateralIdIn(@Param("collateralIds") Collection<String> collateralIds);
}
