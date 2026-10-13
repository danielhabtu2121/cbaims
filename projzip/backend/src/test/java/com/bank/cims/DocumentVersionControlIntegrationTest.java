package com.bank.cims;

import com.bank.cims.model.AuditLog;
import com.bank.cims.model.Collateral;
import com.bank.cims.model.OwnershipDocument;
import com.bank.cims.repository.AuditLogRepository;
import com.bank.cims.repository.CollateralRepository;
import com.bank.cims.repository.OwnershipDocumentRepository;
import com.bank.cims.service.CimsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class DocumentVersionControlIntegrationTest {

    @Autowired
    private CimsService cimsService;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private String testCollateralId;

    @BeforeEach
    public void setUp() {
        String uid = UUID.randomUUID().toString().substring(0, 8);
        Collateral col = new Collateral();
        col.setId("col-ver-" + uid);
        col.setCode("COL-VER-" + uid);
        col.setType("Real Estate");
        col.setStatus("Active");
        col.setValuationAmount(15000000.0);
        col.setOwningSegment("Corporate Banking");
        col.setBranch("Main Branch");
        collateralRepository.save(col);
        testCollateralId = col.getId();
    }

    @Test
    @DisplayName("AC1 & AC2: Ingest initial document - assigns v1, records upload metadata, and logs audit")
    public void testInitialDocumentUpload() {
        OwnershipDocument doc1 = cimsService.uploadDocument(
                "Collateral",
                testCollateralId,
                "Commercial Title Deed #401",
                "Title Deed",
                "title_deed_v1.pdf",
                102400L,
                "application/pdf",
                "data:application/pdf;base64,JVBERi0xLjQK...",
                "Initial upload by maker",
                "COLLDOCOFF_TEST",
                "2031-12-31"
        );

        assertNotNull(doc1);
        assertEquals(1, doc1.getVersion());
        assertTrue(doc1.isLatest());
        assertEquals("Title Deed", doc1.getType());
        assertEquals("Commercial Title Deed #401", doc1.getName());
        assertEquals("COLLDOCOFF_TEST", doc1.getUploadedBy());
        assertNotNull(doc1.getUploadDate());
        assertNotNull(doc1.getUploadedAt());
        assertEquals("Pending Verification", doc1.getVerificationStatus());

        // Verify Audit Log was recorded
        List<AuditLog> logs = auditLogRepository.findAll().stream()
                .filter(l -> doc1.getId().equals(l.getEntityId()))
                .toList();
        assertFalse(logs.isEmpty(), "Audit log must be created for initial upload");
        assertTrue(logs.stream().anyMatch(l -> "UPLOAD_DOCUMENT".equals(l.getActionType())));
    }

    @Test
    @DisplayName("AC3: Accidental overwrite prevention - uploading duplicate type auto-commits sequential v2 without destroying v1")
    public void testAccidentalOverwritePrevention() {
        // Upload Version 1
        OwnershipDocument doc1 = cimsService.uploadDocument(
                "Collateral",
                testCollateralId,
                "Land Certificate A",
                "Title Deed",
                "deed_v1.pdf",
                50000L,
                "application/pdf",
                "data:application/pdf;base64,V1...",
                "First title registration",
                "OFFICER_A",
                "2030-01-01"
        );

        assertEquals(1, doc1.getVersion());
        assertTrue(doc1.isLatest());
        String doc1Id = doc1.getId();

        // Attempt to upload same document type for the same collateral without version id
        // System must detect collision, prevent silent overwrite, and commit as v2
        OwnershipDocument doc2 = cimsService.uploadDocument(
                "Collateral",
                testCollateralId,
                "Land Certificate A",
                "Title Deed",
                "deed_v2_updated.pdf",
                55000L,
                "application/pdf",
                "data:application/pdf;base64,V2...",
                "Second title registration update",
                "OFFICER_B",
                "2035-01-01",
                null,
                "Annual land boundary coordinates revision",
                false
        );

        assertNotNull(doc2);
        assertNotEquals(doc1Id, doc2.getId(), "New version must have its own distinct immutable record ID");
        assertEquals(2, doc2.getVersion(), "New version number must increment sequentially to v2");
        assertTrue(doc2.isLatest(), "Newest version must be marked isLatest = true");
        assertEquals("Annual land boundary coordinates revision", doc2.getVersionNotes());
        assertEquals(doc1Id, doc2.getParentDocumentId(), "Parent ID must link to the root document");

        // Verify AC4: Old version is intact and marked superseded (isLatest = false)
        OwnershipDocument reloadedDoc1 = ownershipDocumentRepository.findById(doc1Id).orElseThrow();
        assertEquals(1, reloadedDoc1.getVersion(), "v1 version number must remain immutable");
        assertFalse(reloadedDoc1.isLatest(), "v1 must be marked isLatest = false (superseded)");
        assertEquals("deed_v1.pdf", reloadedDoc1.getFileName(), "v1 original file content/name must be intact");

        // Verify version audit log
        List<AuditLog> vLogs = auditLogRepository.findAll().stream()
                .filter(l -> doc2.getId().equals(l.getEntityId()))
                .toList();
        assertTrue(vLogs.stream().anyMatch(l -> "NEW_DOCUMENT_VERSION".equals(l.getActionType())),
                "NEW_DOCUMENT_VERSION audit log must be recorded");
    }

    @Test
    @DisplayName("AC1 & AC4: Multi-version lineage v1 -> v2 -> v3 maintains sequential order and lineage integrity")
    public void testSequentialMultiVersionLineage() {
        OwnershipDocument v1 = cimsService.uploadDocument(
                "Collateral", testCollateralId, "Valuation Report", "Valuation Report",
                "val_v1.pdf", 20000L, "application/pdf", null, "Initial valuation", "VALUER_1", "2027-01-01"
        );
        assertEquals(1, v1.getVersion());

        OwnershipDocument v2 = cimsService.uploadDocumentVersion(
                v1.getId(), "val_v2.pdf", 22000L, "application/pdf", null,
                "Re-valuation 2027", "VALUER_2", "2028-01-01"
        );
        assertEquals(2, v2.getVersion());
        assertTrue(v2.isLatest());
        assertFalse(ownershipDocumentRepository.findById(v1.getId()).orElseThrow().isLatest());

        OwnershipDocument v3 = cimsService.uploadDocumentVersion(
                v2.getId(), "val_v3.pdf", 25000L, "application/pdf", null,
                "Final 2028 re-assessment", "VALUER_3", "2029-01-01"
        );
        assertEquals(3, v3.getVersion());
        assertTrue(v3.isLatest());
        assertEquals(v1.getId(), v3.getParentDocumentId(), "v3 root parent must point to v1");

        // Verify all 3 versions are still queryable and exist in database
        assertTrue(ownershipDocumentRepository.existsById(v1.getId()));
        assertTrue(ownershipDocumentRepository.existsById(v2.getId()));
        assertTrue(ownershipDocumentRepository.existsById(v3.getId()));

        assertFalse(ownershipDocumentRepository.findById(v1.getId()).orElseThrow().isLatest());
        assertFalse(ownershipDocumentRepository.findById(v2.getId()).orElseThrow().isLatest());
        assertTrue(ownershipDocumentRepository.findById(v3.getId()).orElseThrow().isLatest());
    }
}
