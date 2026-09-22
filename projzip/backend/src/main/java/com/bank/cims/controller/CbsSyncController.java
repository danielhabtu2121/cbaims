package com.bank.cims.controller;

import com.bank.cims.model.CbsSyncLog;
import com.bank.cims.service.CbsSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cbs")
@CrossOrigin(origins = "*")
public class CbsSyncController {

    @Autowired
    private CbsSyncService cbsSyncService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        return ResponseEntity.ok(cbsSyncService.getCbsSyncStatus());
    }

    @PostMapping("/sync/all")
    public ResponseEntity<Map<String, Object>> syncAll(@RequestHeader(value = "X-User-Id", defaultValue = "SYSTEM") String userId) {
        return ResponseEntity.ok(cbsSyncService.syncAllFromCbs(userId));
    }

    @PostMapping("/sync/customer/{cif}")
    public ResponseEntity<Map<String, Object>> syncCustomer(
            @PathVariable String cif,
            @RequestHeader(value = "X-User-Id", defaultValue = "SYSTEM") String userId) {
        return ResponseEntity.ok(cbsSyncService.syncCustomerFromCbs(cif, userId));
    }

    @PostMapping("/sync/facility/{loanRef}")
    public ResponseEntity<Map<String, Object>> syncFacility(
            @PathVariable String loanRef,
            @RequestHeader(value = "X-User-Id", defaultValue = "SYSTEM") String userId) {
        return ResponseEntity.ok(cbsSyncService.syncFacilityFromCbs(loanRef, userId));
    }

    @GetMapping("/sync/logs")
    public ResponseEntity<List<CbsSyncLog>> getSyncLogs() {
        return ResponseEntity.ok(cbsSyncService.getCbsSyncLogs());
    }
}
