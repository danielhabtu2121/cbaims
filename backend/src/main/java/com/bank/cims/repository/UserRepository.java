package com.bank.cims.repository;

import com.bank.cims.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByUsername(String username);
    List<User> findByRoleIgnoreCaseAndActiveTrue(String role);
    List<User> findByRoleIgnoreCase(String role);
}
