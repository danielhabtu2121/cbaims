package com.bank.cims.controller;

import com.bank.cims.model.CimsException;
import com.bank.cims.repository.CimsExceptionRepository;
import com.bank.cims.service.CimsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exceptions")
@CrossOrigin(origins = "*")
public class ExceptionController {

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CimsService cimsService;

    @GetMapping
    public ResponseEntity<List<CimsException>> getExceptions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {
        if (status != null && !status.isBlank()) {
            return ResponseEntity.ok(cimsExceptionRepository.findByStatus(status));
        }
        if (role != null && !role.isBlank()) {
            return ResponseEntity.ok(cimsExceptionRepository.findByAssignedToRole(role));
        }
        return ResponseEntity.ok(cimsExceptionRepository.findAll());
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveException(
            @PathVariable String id,
            @RequestParam(defaultValue = "Renew Policy") String correctiveAction,
            @RequestParam(defaultValue = "Resolved by officer") String resolutionNotes,
            @RequestParam String userId) {
        cimsService.resolveException(id, correctiveAction, resolutionNotes, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Exception " + id + " resolved."));
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<Map<String, Object>> escalateException(
            @PathVariable String id,
            @RequestParam(defaultValue = "DISTDIR") String escalationRole,
            @RequestParam String userId) {
        cimsService.escalateException(id, escalationRole, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Exception " + id + " escalated."));
    }

    @PostMapping("/scan-now")
    public ResponseEntity<Map<String, Object>> triggerScan() {
        cimsService.scanAndGenerateExceptions();
        return ResponseEntity.ok(Map.of("success", true, "message", "Automated exception scan completed."));
    }
}
