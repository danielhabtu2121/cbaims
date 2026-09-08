package com.bank.cims.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cims_users")
public class User {
    @Id
    private String id;
    
    @Column(nullable = false, unique = true)
    private String username;
    
    @Column(nullable = false)
    private String password;
    
    @Column(name = "full_name", nullable = false)
    private String fullName;
    
    private String email;

    private String phone;
    
    @Column(nullable = false)
    private String role;
    
    @Column(nullable = false)
    private String branch;
    
    @Column(nullable = false)
    private String segment;
    
    private boolean active = true;

    public User() {}

    public User(String id, String username, String password, String fullName, String email, String role, String branch, String segment) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.email = email;
        this.role = role;
        this.branch = branch;
        this.segment = segment;
        this.active = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getBranchId() { return branch; }
    public String getName() { return fullName; }
    public String getPasswordHash() { return password; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    @Column(name = "segment_ids", columnDefinition = "TEXT")
    private String segmentIds;

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getSegmentIds() { return segmentIds; }
    public void setSegmentIds(String segmentIds) { this.segmentIds = segmentIds; }
}
