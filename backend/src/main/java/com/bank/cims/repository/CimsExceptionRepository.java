package com.bank.cims.repository;

import com.bank.cims.model.CimsException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CimsExceptionRepository extends JpaRepository<CimsException, String> {
    List<CimsException> findByStatus(String status);
    List<CimsException> findByStatusNot(String status);
    List<CimsException> findByStatusNotIgnoreCase(String status);
    List<CimsException> findByStatusIn(Collection<String> statuses);
    List<CimsException> findByAssignedToRole(String assignedToRole);
    List<CimsException> findByAssignedToUserId(String assignedToUserId);
    List<CimsException> findByEntityTypeAndEntityId(String entityType, String entityId);
    List<CimsException> findByEntityTypeAndEntityIdAndStatus(String entityType, String entityId, String status);
    List<CimsException> findByBusinessSegment(String businessSegment);
    List<CimsException> findByBusinessSegmentIn(Collection<String> segments);
    List<CimsException> findByBranch(String branch);
    List<CimsException> findByBranchIn(Collection<String> branches);
    List<CimsException> findByExceptionType(String exceptionType);

    Optional<CimsException> findFirstByEntityTypeAndEntityIdAndExceptionType(String entityType, String entityId, String exceptionType);
    Optional<CimsException> findFirstByEntityTypeAndEntityIdAndExceptionTypeAndStatusIn(String entityType, String entityId, String exceptionType, Collection<String> statuses);
    boolean existsByEntityTypeAndEntityIdAndExceptionTypeAndStatusIn(String entityType, String entityId, String exceptionType, Collection<String> statuses);

    @Query("SELECT e FROM CimsException e WHERE " +
           "(:status IS NULL OR LOWER(e.status) = LOWER(:status)) AND " +
           "(:severity IS NULL OR LOWER(e.severity) = LOWER(:severity)) AND " +
           "(:exceptionType IS NULL OR LOWER(e.exceptionType) = LOWER(:exceptionType)) AND " +
           "(:assignedRole IS NULL OR LOWER(e.assignedToRole) = LOWER(:assignedRole)) AND " +
           "(:assignedUserId IS NULL OR e.assignedToUserId = :assignedUserId) AND " +
           "(:segment IS NULL OR LOWER(e.businessSegment) = LOWER(:segment)) AND " +
           "(:branch IS NULL OR LOWER(e.branch) = LOWER(:branch))")
    List<CimsException> findFiltered(
            @Param("status") String status,
            @Param("severity") String severity,
            @Param("exceptionType") String exceptionType,
            @Param("assignedRole") String assignedRole,
            @Param("assignedUserId") String assignedUserId,
            @Param("segment") String segment,
            @Param("branch") String branch
    );
}
