package com.bank.cims.controller;

import com.bank.cims.model.AuditLog;
import com.bank.cims.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
@CrossOrigin(origins = "*")
public class AuditController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @GetMapping
    public ResponseEntity<List<AuditLog>> getAuditLogs(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String userId) {
        // Immutable query endpoint - no DELETE or UPDATE mappings exist
        return ResponseEntity.ok(auditLogRepository.findAll());
    }
}
