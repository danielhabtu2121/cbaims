package com.bank.cims.controller;

import com.bank.cims.model.OwnershipDocument;
import com.bank.cims.repository.OwnershipDocumentRepository;
import com.bank.cims.service.CimsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private CimsService cimsService;

    @GetMapping
    public ResponseEntity<List<OwnershipDocument>> getDocuments(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String status) {
        if (entityType != null && entityId != null) {
            return ResponseEntity.ok(ownershipDocumentRepository.findByEntityTypeAndEntityId(entityType, entityId));
        }
        if (status != null && !status.isBlank() && !"All".equalsIgnoreCase(status)) {
            return ResponseEntity.ok(ownershipDocumentRepository.findAll().stream()
                    .filter(d -> status.equalsIgnoreCase(d.getStatus()) || status.equalsIgnoreCase(d.getVerificationStatus()))
                    .toList());
        }
        return ResponseEntity.ok(ownershipDocumentRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OwnershipDocument> getDocumentById(@PathVariable String id) {
        return ownershipDocumentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<OwnershipDocument>> getDocumentVersions(@PathVariable String id) {
        Optional<OwnershipDocument> docOpt = ownershipDocumentRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        OwnershipDocument doc = docOpt.get();
        String rootId = doc.getParentDocumentId() != null ? doc.getParentDocumentId() : doc.getId();

        List<OwnershipDocument> versions = ownershipDocumentRepository.findAll().stream()
                .filter(d -> d.getId().equals(rootId) || rootId.equals(d.getParentDocumentId()) || d.getId().equals(id))
                .sorted((a, b) -> Integer.compare(b.getVersion(), a.getVersion()))
                .toList();

        return ResponseEntity.ok(versions);
    }

    @PostMapping("/upload")
    public ResponseEntity<OwnershipDocument> uploadDocument(@RequestBody Map<String, Object> payload) {
        String entityType = (String) payload.getOrDefault("entityType", "Collateral");
        String entityId = (String) payload.get("entityId");
        String docName = (String) payload.get("docName");
        String docType = (String) payload.get("docType");
        String fileName = (String) payload.get("fileName");
        String contentType = (String) payload.getOrDefault("contentType", "application/pdf");
        String fileContent = (String) payload.get("fileContent");
        String remarks = (String) payload.get("remarks");
        String uploadedBy = (String) payload.getOrDefault("uploadedBy", "MGRCOLLDOC");
        String expiryDate = (String) payload.get("expiryDate");
        Long fileSize = CimsService.parseFileSize(payload.get("fileSize"));

        OwnershipDocument doc = cimsService.uploadDocument(entityType, entityId, docName, docType,
                fileName, fileSize, contentType, fileContent, remarks, uploadedBy, expiryDate);
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/{id}/version")
    public ResponseEntity<OwnershipDocument> uploadNewVersion(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload) {
        String fileName = (String) payload.get("fileName");
        String contentType = (String) payload.getOrDefault("contentType", "application/pdf");
        String fileContent = (String) payload.get("fileContent");
        String versionNotes = (String) payload.get("versionNotes");
        String uploadedBy = (String) payload.getOrDefault("uploadedBy", "MGRCOLLDOC");
        String newExpiryDate = (String) payload.get("expiryDate");
        Long fileSize = CimsService.parseFileSize(payload.get("fileSize"));

        OwnershipDocument doc = cimsService.uploadDocumentVersion(id, fileName, fileSize, contentType, fileContent, versionNotes, uploadedBy, newExpiryDate);
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/{id}/verify")
    public ResponseEntity<OwnershipDocument> verifyDocument(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload) {
        String status = (String) payload.getOrDefault("verificationStatus", "Verified");
        String remarks = (String) payload.getOrDefault("remarks", "Document verified by Collateral Officer");
        String verifiedBy = (String) payload.getOrDefault("verifiedBy", "COLLDOCOFF");

        OwnershipDocument doc = cimsService.verifyDocument(id, status, remarks, verifiedBy);
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<Map<String, Object>> archiveDocument(
            @PathVariable String id,
            @RequestParam(defaultValue = "MGRCOLLDOC") String userId) {
        ownershipDocumentRepository.findById(id).ifPresent(d -> {
            d.setStatus("Archived");
            ownershipDocumentRepository.save(d);
            cimsService.logAudit(userId, "MGRCOLLDOC", "ARCHIVE_DOCUMENT", "Document", id, "Status", "Active", "Archived", "Archived document " + d.getName());
        });
        return ResponseEntity.ok(Map.of("success", true, "message", "Document archived in DMS."));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Object> downloadDocument(@PathVariable String id) {
        Optional<OwnershipDocument> docOpt = ownershipDocumentRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        OwnershipDocument doc = docOpt.get();
        String fileName = doc.getFileName() != null ? doc.getFileName() : (doc.getName().endsWith(".pdf") ? doc.getName() : doc.getName() + ".pdf");
        String fileContent = doc.getFileContent();

        if (fileContent != null && fileContent.startsWith("data:")) {
            // Data URL content
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .body(Map.of("fileName", fileName, "dataUrl", fileContent, "contentType", doc.getContentType()));
        }

        String fallbackText = "Bank Collateral Insurance Management System (CIMS)\n" +
                "=======================================================\n" +
                "Document Name: " + doc.getName() + "\n" +
                "Document Type: " + doc.getType() + "\n" +
                "DMS Repository ID: " + doc.getId() + "\n" +
                "Target Entity: " + doc.getEntityType() + " (" + doc.getEntityId() + ")\n" +
                "Version: v" + doc.getVersion() + "\n" +
                "Verification Status: " + doc.getVerificationStatus() + "\n" +
                "Uploaded By: " + doc.getUploadedBy() + "\n" +
                "Upload Date: " + doc.getUploadDate() + "\n" +
                "Expiry Date: " + (doc.getExpiryDate() != null ? doc.getExpiryDate() : "N/A") + "\n\n" +
                "[OFFICIAL BANK DMS REPOSITORY ARCHIVE SEAL - VERIFIED]\n";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(fallbackText);
    }
}
