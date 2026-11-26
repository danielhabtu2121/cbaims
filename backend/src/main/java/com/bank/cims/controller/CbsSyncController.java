package com.bank.cims.controller;

import com.bank.cims.dto.cbs.CbsThreeViewImportResultDto;
import com.bank.cims.dto.cbs.CbsThreeViewPreviewDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CbsEnrichmentService;
import com.bank.cims.service.CbsSyncService;
import com.bank.cims.service.cbs.CbsConnectionStatus;
import com.bank.cims.service.cbs.CbsGateway;
import com.bank.cims.service.cbs.CbsThreeViewImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/cbs")
@CrossOrigin(origins = "*")
public class CbsSyncController {

    @Autowired
    private CbsSyncService cbsSyncService;

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private CbsThreeViewImportService threeViewImportService;

    @Autowired
    private CbsEnrichmentService enrichmentService;

    @Autowired
    private CbsCustomerRawSnapshotRepository customerSnapshotRepository;

    @Autowired
    private CbsFacilityRawSnapshotRepository facilitySnapshotRepository;

    @Autowired
    private CbsCollateralRawSnapshotRepository collateralSnapshotRepository;

    @Autowired
    private CbsCustomerProvenanceLogRepository customerProvenanceRepository;

    @Autowired
    private CbsFacilityProvenanceLogRepository facilityProvenanceRepository;

    @Autowired
    private CbsUnresolvedEntityRepository unresolvedEntityRepository;

    @Autowired
    private CbsDuplicateCollisionRepository duplicateCollisionRepository;

    @Autowired
    private CbsCodeMappingRepository codeMappingRepository;

    private String getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            return auth.getName();
        }
        return "AUTHORIZED_USER";
    }

    // =========================================================================
    // Connection Status & Truthful Health Check
    // =========================================================================

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        return ResponseEntity.ok(cbsSyncService.getCbsSyncStatus());
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getCbsHealth() {
        CbsConnectionStatus conn = cbsGateway.checkConnectionStatus();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("mode", cbsGateway.getMode());
        resp.put("status", conn.getStatus());
        resp.put("message", conn.getMessage());
        resp.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/mode")
    public ResponseEntity<Map<String, Object>> setCbsMode(@RequestBody Map<String, String> body) {
        String newMode = body != null ? body.get("mode") : null;
        if (newMode == null || (!newMode.equalsIgnoreCase("SIMULATOR") && !newMode.equalsIgnoreCase("REAL"))) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Invalid mode. Allowed values are 'SIMULATOR' or 'REAL'."
            ));
        }
        cbsGateway.setMode(newMode);
        return ResponseEntity.ok(Map.of(
            "message", "CBS mode updated to " + cbsGateway.getMode(),
            "mode", cbsGateway.getMode()
        ));
    }

    @GetMapping("/schema/validate")
    public ResponseEntity<Map<String, Object>> validateSchema() {
        return ResponseEntity.ok(cbsGateway.validateSchema());
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getCbsConfig() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("mode", cbsGateway.getMode());
        com.bank.cims.service.cbs.RealCbsAdapter rca = cbsGateway.getRealCbsAdapter();
        if (rca != null) {
            resp.put("oracle", rca.getConfigSummary());
        }
        CbsConnectionStatus conn = cbsGateway.checkConnectionStatus();
        resp.put("connectionStatus", conn.getStatus());
        resp.put("connectionMessage", conn.getMessage());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/config")
    public ResponseEntity<Map<String, Object>> updateCbsConfig(@RequestBody Map<String, Object> body) {
        if (body != null) {
            String newMode = (String) body.get("mode");
            if (newMode != null && (newMode.equalsIgnoreCase("SIMULATOR") || newMode.equalsIgnoreCase("REAL"))) {
                cbsGateway.setMode(newMode);
            }
            com.bank.cims.service.cbs.RealCbsAdapter rca = cbsGateway.getRealCbsAdapter();
            if (rca != null) {
                String jdbcUrl = (String) body.get("jdbcUrl");
                String username = (String) body.get("username");
                String password = (String) body.get("password");
                String schema = (String) body.get("schema");
                String customerView = (String) body.get("customerView");
                String facilityView = (String) body.get("facilityView");
                String collateralView = (String) body.get("collateralView");
                rca.updateConfig(jdbcUrl, username, password, schema, customerView, facilityView, collateralView);
            }
        }
        return getCbsConfig();
    }

    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody(required = false) Map<String, String> body) {
        com.bank.cims.service.cbs.RealCbsAdapter rca = cbsGateway.getRealCbsAdapter();
        if (rca == null) {
            return ResponseEntity.ok(Map.of(
                    "status", "ERROR",
                    "message", "Real CBS Adapter is not available in context."
            ));
        }

        String testUrl = body != null ? body.get("jdbcUrl") : null;
        String testUser = body != null ? body.get("username") : null;
        String testPass = body != null ? body.get("password") : null;

        CbsConnectionStatus status = rca.testAdhocConnection(testUrl, testUser, testPass);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("mode", "REAL");
        resp.put("status", status.getStatus());
        resp.put("message", status.getMessage());
        resp.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(resp);
    }

    // =========================================================================
    // Three-View Dry-Run Preview & Import Execution
    // =========================================================================

    @GetMapping("/three-views/preview")
    public ResponseEntity<CbsThreeViewPreviewDto> previewThreeViews() {
        return ResponseEntity.ok(threeViewImportService.previewThreeViews());
    }

    @PostMapping("/three-views/import")
    public ResponseEntity<CbsThreeViewImportResultDto> executeThreeViewsImport(
            @RequestParam(required = false) String batchRef,
            @RequestParam(required = false, defaultValue = "50") Integer chunkSize) {
        String user = getCurrentUser();
        return ResponseEntity.ok(threeViewImportService.executeThreeViewsImport(batchRef, user, chunkSize));
    }

    // =========================================================================
    // Raw Snapshots for Customer, Facility, and Collateral
    // =========================================================================

    @GetMapping("/snapshots/customer/{cifOrId}")
    public ResponseEntity<?> getCustomerSnapshot(@PathVariable String cifOrId) {
        Optional<CbsCustomerRawSnapshot> snap = customerSnapshotRepository.findFirstByCbsCustomerNoOrderByCreatedAtDesc(cifOrId)
                .or(() -> customerSnapshotRepository.findFirstByCustomerIdOrderByCreatedAtDesc(cifOrId));
        return snap.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/snapshots/facility/{accOrId}")
    public ResponseEntity<?> getFacilitySnapshot(@PathVariable String accOrId) {
        Optional<CbsFacilityRawSnapshot> snap = facilitySnapshotRepository.findFirstByAccountNumberOrderByCreatedAtDesc(accOrId)
                .or(() -> facilitySnapshotRepository.findFirstByFacilityIdOrderByCreatedAtDesc(accOrId));
        return snap.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/snapshots/collateral/{codeOrId}")
    public ResponseEntity<?> getCollateralSnapshot(@PathVariable String codeOrId) {
        Optional<CbsCollateralRawSnapshot> snap = collateralSnapshotRepository.findFirstByCbsCollateralRefOrderByCreatedAtDesc(codeOrId)
                .or(() -> collateralSnapshotRepository.findFirstByCollateralIdOrderByCreatedAtDesc(codeOrId));
        return snap.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/snapshots/collateral/{codeOrId}/all")
    public ResponseEntity<List<CbsCollateralRawSnapshot>> getAllCollateralSnapshots(@PathVariable String codeOrId) {
        List<CbsCollateralRawSnapshot> snaps = collateralSnapshotRepository.findAllByCbsCollateralRefOrderByCreatedAtDesc(codeOrId);
        return ResponseEntity.ok(snaps);
    }

    // =========================================================================
    // Field-Level Provenance Logs for Customer & Facility
    // =========================================================================

    @GetMapping("/provenance/customer/{customerId}")
    public ResponseEntity<List<CbsCustomerProvenanceLog>> getCustomerProvenance(@PathVariable String customerId) {
        return ResponseEntity.ok(customerProvenanceRepository.findByCustomerIdOrderByChangedAtDesc(customerId));
    }

    @GetMapping("/provenance/facility/{facilityId}")
    public ResponseEntity<List<CbsFacilityProvenanceLog>> getFacilityProvenance(@PathVariable String facilityId) {
        return ResponseEntity.ok(facilityProvenanceRepository.findByFacilityIdOrderByChangedAtDesc(facilityId));
    }

    // =========================================================================
    // Customer & Facility Enrichment Endpoints
    // =========================================================================

    @PostMapping("/customers/{id}/enrich")
    public ResponseEntity<Customer> enrichCustomer(@PathVariable String id, @RequestBody Map<String, Object> req) {
        String user = getCurrentUser();
        return ResponseEntity.ok(enrichmentService.enrichCustomer(id, req, user));
    }

    @PostMapping("/facilities/{id}/enrich")
    public ResponseEntity<LoanAccount> enrichFacility(@PathVariable String id, @RequestBody Map<String, Object> req) {
        String user = getCurrentUser();
        return ResponseEntity.ok(enrichmentService.enrichFacility(id, req, user));
    }

    // =========================================================================
    // Unresolved Entities & Duplicate Collision Queues
    // =========================================================================

    @GetMapping("/unresolved-entities")
    public ResponseEntity<List<CbsUnresolvedEntity>> getUnresolvedEntities(@RequestParam(required = false, defaultValue = "UNRESOLVED") String status) {
        return ResponseEntity.ok(unresolvedEntityRepository.findByStatusOrderByCreatedAtDesc(status));
    }

    @PostMapping("/unresolved-entities/{id}/resolve")
    public ResponseEntity<Map<String, String>> resolveEntity(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        CbsUnresolvedEntity ent = unresolvedEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Unresolved entity not found: " + id));
        ent.setStatus("RESOLVED");
        ent.setResolvedBy(getCurrentUser());
        ent.setResolvedAt(LocalDateTime.now().toString());
        unresolvedEntityRepository.save(ent);
        return ResponseEntity.ok(Map.of("message", "Entity marked as resolved"));
    }

    @GetMapping("/duplicate-collisions")
    public ResponseEntity<List<CbsDuplicateCollision>> getDuplicateCollisions(@RequestParam(required = false, defaultValue = "PENDING_REVIEW") String status) {
        return ResponseEntity.ok(duplicateCollisionRepository.findByStatusOrderByCreatedAtDesc(status));
    }

    @PostMapping("/duplicate-collisions/{id}/resolve")
    public ResponseEntity<Map<String, String>> resolveCollision(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        CbsDuplicateCollision col = duplicateCollisionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Collision review not found: " + id));
        String decision = body.getOrDefault("decision", "RESOLVED_KEEP_SEPARATE");
        col.setStatus(decision);
        col.setReviewedBy(getCurrentUser());
        col.setReviewedAt(LocalDateTime.now().toString());
        col.setReviewNotes(body.get("notes"));
        duplicateCollisionRepository.save(col);
        return ResponseEntity.ok(Map.of("message", "Collision resolved with decision " + decision));
    }

    // =========================================================================
    // Configurable Code Mappings
    // =========================================================================

    @GetMapping("/code-mappings")
    public ResponseEntity<List<CbsCodeMapping>> getCodeMappings(@RequestParam(required = false) String type) {
        if (type != null && !type.isBlank()) {
            return ResponseEntity.ok(codeMappingRepository.findByMappingTypeAndActiveTrue(type.toUpperCase()));
        }
        return ResponseEntity.ok(codeMappingRepository.findAll());
    }

    @PostMapping("/code-mappings")
    public ResponseEntity<CbsCodeMapping> saveCodeMapping(@RequestBody CbsCodeMapping mapping) {
        if (mapping.getId() == null || mapping.getId().isBlank()) {
            mapping.setId("map-" + UUID.randomUUID().toString().substring(0, 8));
            mapping.setCreatedAt(LocalDateTime.now().toString());
        }
        mapping.setUpdatedAt(LocalDateTime.now().toString());
        mapping.setCreatedBy(getCurrentUser());
        return ResponseEntity.ok(codeMappingRepository.save(mapping));
    }

    // =========================================================================
    // Legacy Sync Endpoints
    // =========================================================================

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

    @PostMapping("/sync/collateral/{collateralCode}")
    public ResponseEntity<Map<String, Object>> syncCollateral(
            @PathVariable String collateralCode,
            @RequestHeader(value = "X-User-Id", defaultValue = "SYSTEM") String userId) {
        return ResponseEntity.ok(cbsSyncService.syncCollateralFromCbs(collateralCode, userId));
    }

    @GetMapping("/sync/logs")
    public ResponseEntity<List<CbsSyncLog>> getSyncLogs() {
        return ResponseEntity.ok(cbsSyncService.getCbsSyncLogs());
    }
}
