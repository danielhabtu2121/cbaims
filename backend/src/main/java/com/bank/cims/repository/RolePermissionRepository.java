package com.bank.cims.repository;

import com.bank.cims.model.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, String> {
    List<RolePermission> findByRoleCode(String roleCode);
    List<RolePermission> findByRoleCodeAndScreenName(String roleCode, String screenName);
    List<RolePermission> findByRoleCodeIgnoreCaseAndScreenNameIgnoreCase(String roleCode, String screenName);
    List<RolePermission> findByRoleCodeIgnoreCase(String roleCode);
}
