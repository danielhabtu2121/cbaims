package com.bank.cims.service.cbs;

import com.bank.cims.dto.CollateralQualityFindingDto;
import com.bank.cims.dto.cbs.CbsCollateralViewRow;
import com.bank.cims.dto.cbs.CbsCustomerViewRow;
import com.bank.cims.dto.cbs.CbsFacilityViewRow;
import com.bank.cims.dto.cbs.CbsThreeViewImportResultDto;
import com.bank.cims.dto.cbs.CbsThreeViewPreviewDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CollateralDataQualityService;
import com.bank.cims.service.ExposureCalculationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Production Three-View Import Orchestrator for CBS Integration.
 * Orchestrates Customer -> Facility -> Collateral -> Embedded Relationship imports
 * strictly in dependency order, with immutable source snapshot preservation,
 * duplicate collision review, organizational routing, and truthful data quality assessment.
 * 
 * Strict Zero Writes to CBS.
 */
@Service
public class CbsThreeViewImportService {

    private static final Logger log = LoggerFactory.getLogger(CbsThreeViewImportService.class);

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private CbsMapper cbsMapper;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private CollateralOwnerRepository collateralOwnerRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    @Autowired
    private DistrictHierarchyRepository districtHierarchyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CbsCodeMappingRepository codeMappingRepository;

    @Autowired
    private CbsImportBatchRepository batchRepository;

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
    private CbsCollateralProvenanceLogRepository collateralProvenanceRepository;

    @Autowired
    private CbsUnresolvedEntityRepository unresolvedEntityRepository;

    @Autowired
    private CbsUnresolvedLinkageRepository unresolvedLinkageRepository;

    @Autowired
    private CbsDuplicateCollisionRepository duplicateCollisionRepository;

    @Autowired
    private CbsCollateralDuplicateReviewRepository collateralDuplicateReviewRepository;

    @Autowired
    private CollateralDataQualityService dataQualityService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // =========================================================================
    // Dry-Run Preview of Three Views
    // =========================================================================

    public CbsThreeViewPreviewDto previewThreeViews() {
        CbsThreeViewPreviewDto preview = new CbsThreeViewPreviewDto();
        preview.setCbsMode(cbsGateway.getMode());

        CbsConnectionStatus connStatus = cbsGateway.checkConnectionStatus();
        preview.setConnectionStatus(connStatus.getStatus() + ": " + connStatus.getMessage());

        Map<String, Object> schemaCheck = cbsGateway.validateSchema();
        preview.setSchemaStatus(String.valueOf(schemaCheck.get("status")));

        List<CbsFacilityViewRow> facilities = cbsGateway.fetchFacilityViewRows();
        List<CbsCollateralViewRow> collaterals = cbsGateway.fetchCollateralViewRows();

        Set<String> neededPreviewCifs = new HashSet<>();
        for (CbsFacilityViewRow f : facilities) {
            if (f.getCustomerId() != null && !f.getCustomerId().isBlank()) neededPreviewCifs.add(f.getCustomerId().trim());
        }
        for (CbsCollateralViewRow c : collaterals) {
            if (c.getCollateralOwnerCif() != null && !c.getCollateralOwnerCif().isBlank()) neededPreviewCifs.add(c.getCollateralOwnerCif().trim());
            if (c.getBorrowerCif() != null && !c.getBorrowerCif().isBlank()) neededPreviewCifs.add(c.getBorrowerCif().trim());
        }

        List<CbsCustomerViewRow> customers = ("REAL".equalsIgnoreCase(cbsGateway.getMode()) && !neededPreviewCifs.isEmpty())
                ? cbsGateway.fetchCustomerViewRowsByCifs(neededPreviewCifs)
                : cbsGateway.fetchCustomerViewRows();

        preview.setTotalCustomerRows(customers.size());
        preview.setTotalFacilityRows(facilities.size());
        preview.setTotalCollateralRows(collaterals.size());

        // Preload lookups
        Set<String> existingCbaimsCustCifs = customerRepository.findAll().stream()
                .filter(c -> "CBAIMS_REGISTERED".equalsIgnoreCase(c.getOriginType()) && c.getCif() != null)
                .map(c -> c.getCif().trim().toUpperCase())
                .collect(Collectors.toSet());

        Set<String> existingCbaimsLoanRefs = loanAccountRepository.findAll().stream()
                .filter(l -> "CBAIMS_REGISTERED".equalsIgnoreCase(l.getOriginType()) && l.getLoanReference() != null)
                .map(l -> l.getLoanReference().trim().toUpperCase())
                .collect(Collectors.toSet());

        Set<String> existingCbaimsColCodes = collateralRepository.findAll().stream()
                .filter(c -> "CBAIMS_REGISTERED".equalsIgnoreCase(c.getOriginType()) && c.getCode() != null)
                .map(c -> c.getCode().trim().toUpperCase())
                .collect(Collectors.toSet());

        Set<String> validBranches = branchRepository.findAll().stream()
                .flatMap(b -> java.util.stream.Stream.of(b.getCode(), b.getName()))
                .filter(Objects::nonNull)
                .map(s -> s.trim().toUpperCase())
                .collect(Collectors.toSet());

        Set<String> validSegments = businessSegmentRepository.findAll().stream()
                .flatMap(s -> java.util.stream.Stream.of(s.getCode(), s.getName()))
                .filter(Objects::nonNull)
                .map(s -> s.trim().toUpperCase())
                .collect(Collectors.toSet());

        // Load custom code mappings for segments and branches
        for (CbsCodeMapping m : codeMappingRepository.findByMappingTypeAndActiveTrue("SEGMENT")) {
            validSegments.add(m.getSourceCode().trim().toUpperCase());
        }
        for (CbsCodeMapping m : codeMappingRepository.findByMappingTypeAndActiveTrue("BRANCH")) {
            validBranches.add(m.getSourceCode().trim().toUpperCase());
        }

        // Customer preview evaluation
        Set<String> previewCustCifs = new HashSet<>();
        int validCust = 0, invalidCust = 0, custCollisions = 0;
        int unmappedBr = 0, unmappedSeg = 0;

        for (CbsCustomerViewRow c : customers) {
            if (c.getCustomerNo() == null || c.getCustomerNo().isBlank()) {
                invalidCust++;
                preview.getIssuesDetected().add("Customer row missing CUSTOMER_NO");
                continue;
            }
            String cif = c.getCustomerNo().trim().toUpperCase();
            previewCustCifs.add(cif);

            if (existingCbaimsCustCifs.contains(cif)) {
                custCollisions++;
                preview.getIssuesDetected().add("Customer CIF " + cif + " collides with existing CBAIMS Registered Customer");
            } else {
                validCust++;
            }

            if (c.getBranchCode() != null && !validBranches.contains(c.getBranchCode().trim().toUpperCase())) {
                unmappedBr++;
            }
            if (c.getBusinessSegment() != null && !validSegments.contains(c.getBusinessSegment().trim().toUpperCase())) {
                unmappedSeg++;
            }
        }
        preview.setValidCustomers(validCust);
        preview.setInvalidCustomers(invalidCust);
        preview.setCustomerCollisionsWithCbaims(custCollisions);

        // Facility preview evaluation
        Set<String> previewFacilityAccs = new HashSet<>();
        int validFac = 0, invalidFac = 0, facCollisions = 0, unmatchedFacCust = 0;

        for (CbsFacilityViewRow f : facilities) {
            if (f.getAccountNumber() == null || f.getAccountNumber().isBlank()) {
                invalidFac++;
                preview.getIssuesDetected().add("Facility row missing ACCOUNT_NUMBER");
                continue;
            }
            String accNo = f.getAccountNumber().trim().toUpperCase();
            previewFacilityAccs.add(accNo);

            if (existingCbaimsLoanRefs.contains(accNo)) {
                facCollisions++;
                preview.getIssuesDetected().add("Facility Account " + accNo + " collides with existing CBAIMS Registered Loan");
            } else {
                validFac++;
            }

            if (f.getCustomerId() != null) {
                String cId = f.getCustomerId().trim().toUpperCase();
                if (!previewCustCifs.contains(cId) && customerRepository.findByCifIgnoreCase(cId).isEmpty()) {
                    unmatchedFacCust++;
                    preview.getIssuesDetected().add("Facility " + accNo + " references unimported Customer CIF " + cId);
                }
            }

            if (f.getBranchCode() != null && !validBranches.contains(f.getBranchCode().trim().toUpperCase())) {
                unmappedBr++;
            }
            if (f.getBusinessSegment() != null && !validSegments.contains(f.getBusinessSegment().trim().toUpperCase())) {
                unmappedSeg++;
            }
        }
        preview.setValidFacilities(validFac);
        preview.setInvalidFacilities(invalidFac);
        preview.setFacilityCollisionsWithCbaims(facCollisions);
        preview.setUnmatchedFacilityCustomers(unmatchedFacCust);

        // Collateral preview evaluation
        Map<String, Integer> colCodeCounts = new HashMap<>();
        int validCol = 0, invalidCol = 0, colCollisions = 0;
        int totalLinks = 0, validLinks = 0, unmatchedLinks = 0;

        for (CbsCollateralViewRow col : collaterals) {
            if (col.getCollateralCode() == null || col.getCollateralCode().isBlank()) {
                invalidCol++;
                preview.getIssuesDetected().add("Collateral row missing COLLATERAL_CODE");
                continue;
            }
            String code = col.getCollateralCode().trim().toUpperCase();
            colCodeCounts.put(code, colCodeCounts.getOrDefault(code, 0) + 1);

            if (existingCbaimsColCodes.contains(code)) {
                colCollisions++;
                preview.getIssuesDetected().add("Collateral " + code + " collides with existing CBAIMS Registered Asset");
            } else {
                validCol++;
            }

            if (col.getBranchCode() != null && !validBranches.contains(col.getBranchCode().trim().toUpperCase())) {
                unmappedBr++;
            }

            // Embedded linkage checks
            if (col.getAccountNumber() != null && !col.getAccountNumber().isBlank()) {
                totalLinks++;
                String linkAcc = col.getAccountNumber().trim().toUpperCase();
                if (previewFacilityAccs.contains(linkAcc) || loanAccountRepository.findByLoanReference(linkAcc).isPresent()) {
                    validLinks++;
                } else {
                    unmatchedLinks++;
                    preview.getIssuesDetected().add("Collateral " + code + " linked to account " + linkAcc + " not found in facilities");
                }
            }
        }

        int repeatedCodes = (int) colCodeCounts.values().stream().filter(c -> c > 1).count();
        preview.setValidCollaterals(validCol);
        preview.setInvalidCollaterals(invalidCol);
        preview.setCollateralCollisionsWithCbaims(colCollisions);
        preview.setRepeatedCollateralCodes(repeatedCodes);

        preview.setTotalLinkageRows(totalLinks);
        preview.setValidLinkages(validLinks);
        preview.setUnmatchedFacilityLinkages(unmatchedLinks);

        preview.setUnmappedBranches(unmappedBr);
        preview.setUnmappedSegments(unmappedSeg);

        // Sample Rows (up to 10 each)
        preview.setSampleCustomers(customers.stream().limit(10).collect(Collectors.toList()));
        preview.setSampleFacilities(facilities.stream().limit(10).collect(Collectors.toList()));
        preview.setSampleCollaterals(collaterals.stream().limit(10).collect(Collectors.toList()));

        return preview;
    }

    // =========================================================================
    // Production 3-View Import Execution (Dependency Order)
    // =========================================================================

    @Transactional
    public CbsThreeViewImportResultDto executeThreeViewsImport(String batchRef, String userId, Integer chunkSize) {
        int effectiveChunkSize = (chunkSize != null && chunkSize > 0) ? chunkSize : 50;
        String startTime = LocalDateTime.now().toString();
        String batchId = "batch-" + UUID.randomUUID().toString().substring(0, 8);
        String finalBatchRef = (batchRef != null && !batchRef.isBlank()) ? batchRef.trim() : "CBS-3V-" + System.currentTimeMillis();

        CbsImportBatch batch = new CbsImportBatch();
        batch.setId(batchId);
        batch.setBatchReference(finalBatchRef);
        batch.setStartTime(startTime);
        batch.setStatus("RUNNING");
        batch.setSourceSystem("REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "CBS_ORACLE_REAL" : "CBS_SIM");
        batch.setCreatedBy(userId != null ? userId : "SYSTEM_IMPORTER");
        batch = batchRepository.save(batch);

        CbsThreeViewImportResultDto result = new CbsThreeViewImportResultDto();
        result.setBatchId(batchId);
        result.setBatchReference(finalBatchRef);
        result.setStartTime(startTime);

        // Step 1: Bulk Fetch from Adapter (Facilities & Collaterals first to isolate required customer CIFs)
        List<CbsFacilityViewRow> facilityRows = cbsGateway.fetchFacilityViewRows();
        List<CbsCollateralViewRow> collateralRows = cbsGateway.fetchCollateralViewRows();

        Set<String> neededImportCifs = new HashSet<>();
        for (CbsFacilityViewRow f : facilityRows) {
            if (f.getCustomerId() != null && !f.getCustomerId().isBlank()) neededImportCifs.add(f.getCustomerId().trim());
        }
        for (CbsCollateralViewRow c : collateralRows) {
            if (c.getCollateralOwnerCif() != null && !c.getCollateralOwnerCif().isBlank()) neededImportCifs.add(c.getCollateralOwnerCif().trim());
            if (c.getBorrowerCif() != null && !c.getBorrowerCif().isBlank()) neededImportCifs.add(c.getBorrowerCif().trim());
        }

        List<CbsCustomerViewRow> customerRows = ("REAL".equalsIgnoreCase(cbsGateway.getMode()) && !neededImportCifs.isEmpty())
                ? cbsGateway.fetchCustomerViewRowsByCifs(neededImportCifs)
                : cbsGateway.fetchCustomerViewRows();

        batch.setCustomerRows(customerRows.size());
        batch.setFacilityRows(facilityRows.size());
        batch.setCollateralRows(collateralRows.size());
        result.setCustomerRows(customerRows.size());
        result.setFacilityRows(facilityRows.size());
        result.setCollateralRows(collateralRows.size());

        // Step 2: Pre-load in-memory lookups to eliminate N+1 queries
        Map<String, Customer> customersByCif = customerRepository.findAll().stream()
                .filter(c -> c.getCif() != null && !c.getCif().isBlank())
                .collect(Collectors.toMap(c -> c.getCif().trim().toUpperCase(), c -> c, (a, b) -> a));

        Map<String, LoanAccount> loanByRef = loanAccountRepository.findAll().stream()
                .filter(l -> l.getLoanReference() != null && !l.getLoanReference().isBlank())
                .collect(Collectors.toMap(l -> l.getLoanReference().trim().toUpperCase(), l -> l, (a, b) -> a));

        Map<String, Collateral> collateralsByCode = collateralRepository.findAll().stream()
                .filter(c -> c.getCode() != null && !c.getCode().isBlank())
                .collect(Collectors.toMap(c -> c.getCode().trim().toUpperCase(), c -> c, (a, b) -> a));

        Map<String, Branch> branchMap = new HashMap<>();
        for (Branch b : branchRepository.findAll()) {
            if (b.getCode() != null) branchMap.put(b.getCode().trim().toUpperCase(), b);
            if (b.getName() != null) branchMap.put(b.getName().trim().toUpperCase(), b);
        }

        Map<String, BusinessSegment> segmentMap = new HashMap<>();
        for (BusinessSegment s : businessSegmentRepository.findAll()) {
            if (s.getCode() != null) segmentMap.put(s.getCode().trim().toUpperCase(), s);
            if (s.getName() != null) segmentMap.put(s.getName().trim().toUpperCase(), s);
        }

        Map<String, String> districtByBranch = new HashMap<>();
        for (DistrictHierarchy dh : districtHierarchyRepository.findAll()) {
            if (dh.getBranchName() != null) districtByBranch.put(dh.getBranchName().trim().toUpperCase(), dh.getDistrictName());
        }

        List<User> activeCros = userRepository.findByRoleIgnoreCaseAndActiveTrue("CRO");

        // Load custom code mappings
        Map<String, String> customCodeMap = new HashMap<>();
        for (CbsCodeMapping m : codeMappingRepository.findAll()) {
            if (m.isActive()) {
                customCodeMap.put(m.getMappingType().toUpperCase() + ":" + m.getSourceCode().trim().toUpperCase(), m.getTargetValue());
            }
        }

        String sourceSystem = "REAL".equalsIgnoreCase(cbsGateway.getMode()) ? "CBS_ORACLE_REAL" : "CBS_SIM";
        int snapshotsCount = 0;

        // =====================================================================
        // STAGE 1: IMPORT CUSTOMERS (FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER)
        // =====================================================================
        int custImported = 0, custCollisions = 0, custFailed = 0;
        List<Customer> customersToSave = new ArrayList<>();

        for (CbsCustomerViewRow crow : customerRows) {
            try {
                if (crow.getCustomerNo() == null || crow.getCustomerNo().isBlank()) {
                    custFailed++;
                    continue;
                }
                String cifKey = crow.getCustomerNo().trim().toUpperCase();

                // 1. Immutable Raw Snapshot
                CbsCustomerRawSnapshot snap = new CbsCustomerRawSnapshot();
                snap.setId("snap-cst-" + UUID.randomUUID().toString().substring(0, 8));
                snap.setBatchId(batchId);
                snap.setCbsCustomerNo(crow.getCustomerNo().trim());
                snap.setRawPayloadJson(objectMapper.writeValueAsString(crow));
                snap.setSourceStatus(crow.getCustomerStatus());
                customerSnapshotRepository.save(snap);
                snapshotsCount++;

                Customer existing = customersByCif.get(cifKey);

                // Duplicate Collision check with CBAIMS Registered Asset
                if (existing != null && "CBAIMS_REGISTERED".equalsIgnoreCase(existing.getOriginType())) {
                    custCollisions++;
                    CbsDuplicateCollision dup = new CbsDuplicateCollision();
                    dup.setId("dup-cst-" + UUID.randomUUID().toString().substring(0, 8));
                    dup.setEntityType("CUSTOMER");
                    dup.setBatchId(batchId);
                    dup.setSourceKey(crow.getCustomerNo().trim());
                    dup.setCbaimsTargetId(existing.getId());
                    dup.setMatchReason("CIF matches existing CBAIMS Registered Customer. Overwrite prevented.");
                    duplicateCollisionRepository.save(dup);
                    continue;
                }

                // Idempotency: If already CBS_IMPORTED, retain enriched local master without overwriting
                if (existing != null && "CBS_IMPORTED".equalsIgnoreCase(existing.getOriginType())) {
                    snap.setCustomerId(existing.getId());
                    customerSnapshotRepository.save(snap);
                    continue;
                }

                // Map new Customer
                Customer cust = cbsMapper.mapCustomerViewRow(crow, null, sourceSystem);
                cust.setImportBatchId(batchId);
                cust.setImportDate(startTime);

                // Organizational Routing: Branch, Segment, District, CRO
                resolveCustomerOrg(cust, crow, branchMap, segmentMap, districtByBranch, activeCros, customCodeMap, batchId);

                customersToSave.add(cust);
                customersByCif.put(cifKey, cust);
                snap.setCustomerId(cust.getId());
                customerSnapshotRepository.save(snap);
                custImported++;

                if (customersToSave.size() >= effectiveChunkSize) {
                    customerRepository.saveAll(customersToSave);
                    customersToSave.clear();
                }
            } catch (Exception e) {
                log.error("Failed importing customer {}: {}", crow.getCustomerNo(), e.getMessage());
                custFailed++;
            }
        }
        if (!customersToSave.isEmpty()) {
            customerRepository.saveAll(customersToSave);
            customersToSave.clear();
        }

        // =====================================================================
        // STAGE 2: IMPORT FACILITIES (FCUBSLIVE.STVWCBS_CBAIMS_FACILITY)
        // =====================================================================
        int facImported = 0, facCollisions = 0, facUnmatchedCust = 0, facFailed = 0;
        List<LoanAccount> facilitiesToSave = new ArrayList<>();

        for (CbsFacilityViewRow frow : facilityRows) {
            try {
                if (frow.getAccountNumber() == null || frow.getAccountNumber().isBlank()) {
                    facFailed++;
                    continue;
                }
                String accKey = frow.getAccountNumber().trim().toUpperCase();

                // 1. Immutable Raw Snapshot
                CbsFacilityRawSnapshot snap = new CbsFacilityRawSnapshot();
                snap.setId("snap-fac-" + UUID.randomUUID().toString().substring(0, 8));
                snap.setBatchId(batchId);
                snap.setAccountNumber(frow.getAccountNumber().trim());
                snap.setCbsFacilityRef(frow.getFaciltyId() != null ? frow.getFaciltyId().toPlainString() : null);
                snap.setRawPayloadJson(objectMapper.writeValueAsString(frow));
                snap.setSourceStatus(frow.getAccountStatus());
                facilitySnapshotRepository.save(snap);
                snapshotsCount++;

                LoanAccount existing = loanByRef.get(accKey);

                // Duplicate Collision check with CBAIMS Registered Facility
                if (existing != null && "CBAIMS_REGISTERED".equalsIgnoreCase(existing.getOriginType())) {
                    facCollisions++;
                    CbsDuplicateCollision dup = new CbsDuplicateCollision();
                    dup.setId("dup-fac-" + UUID.randomUUID().toString().substring(0, 8));
                    dup.setEntityType("FACILITY");
                    dup.setBatchId(batchId);
                    dup.setSourceKey(frow.getAccountNumber().trim());
                    dup.setCbaimsTargetId(existing.getId());
                    dup.setMatchReason("Account number matches existing CBAIMS Registered Loan. Overwrite prevented.");
                    duplicateCollisionRepository.save(dup);
                    continue;
                }

                // Idempotency: Retain enriched local master
                if (existing != null && "CBS_IMPORTED".equalsIgnoreCase(existing.getOriginType())) {
                    snap.setFacilityId(existing.getId());
                    facilitySnapshotRepository.save(snap);
                    continue;
                }

                // Customer Resolution
                Customer matchedCust = null;
                if (frow.getCustomerId() != null) {
                    matchedCust = customersByCif.get(frow.getCustomerId().trim().toUpperCase());
                }

                LoanAccount fac = cbsMapper.mapFacilityViewRow(frow, null, matchedCust, sourceSystem);
                fac.setImportBatchId(batchId);
                fac.setImportDate(startTime);

                if (matchedCust == null) {
                    facUnmatchedCust++;
                    CbsUnresolvedEntity unres = new CbsUnresolvedEntity();
                    unres.setId("unres-fac-" + UUID.randomUUID().toString().substring(0, 8));
                    unres.setEntityType("FACILITY");
                    unres.setBatchId(batchId);
                    unres.setSourceKey(frow.getAccountNumber().trim());
                    unres.setReason("Customer CIF not resolved in CBAIMS: " + frow.getCustomerId());
                    unres.setStatus("UNRESOLVED");
                    unresolvedEntityRepository.save(unres);
                }

                // Organizational Routing: Branch, Segment, District, CRO
                resolveFacilityOrg(fac, frow, branchMap, segmentMap, districtByBranch, activeCros, customCodeMap, batchId);

                facilitiesToSave.add(fac);
                loanByRef.put(accKey, fac);
                snap.setFacilityId(fac.getId());
                facilitySnapshotRepository.save(snap);
                facImported++;

                if (facilitiesToSave.size() >= effectiveChunkSize) {
                    loanAccountRepository.saveAll(facilitiesToSave);
                    facilitiesToSave.clear();
                }
            } catch (Exception e) {
                log.error("Failed importing facility {}: {}", frow.getAccountNumber(), e.getMessage());
                facFailed++;
            }
        }
        if (!facilitiesToSave.isEmpty()) {
            loanAccountRepository.saveAll(facilitiesToSave);
            facilitiesToSave.clear();
        }

        // =====================================================================
        // STAGE 3: IMPORT COLLATERAL MASTERS & EMBEDDED RELATIONSHIPS
        // (FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL)
        // =====================================================================
        int colImported = 0, colCollisions = 0, colFailed = 0;
        int linkRows = 0, linkImported = 0, linkUnresolved = 0;

        List<Collateral> collateralsToSave = new ArrayList<>();
        Set<String> affectedColIds = new HashSet<>();

        // Group rows by collateral code to handle multiple embedded linkage lines
        Map<String, List<CbsCollateralViewRow>> rowsByColCode = new LinkedHashMap<>();
        for (CbsCollateralViewRow crow : collateralRows) {
            if (crow.getCollateralCode() == null || crow.getCollateralCode().isBlank()) {
                colFailed++;
                continue;
            }
            String code = crow.getCollateralCode().trim().toUpperCase();
            rowsByColCode.computeIfAbsent(code, k -> new ArrayList<>()).add(crow);
        }

        for (Map.Entry<String, List<CbsCollateralViewRow>> entry : rowsByColCode.entrySet()) {
            String colCodeKey = entry.getKey();
            List<CbsCollateralViewRow> groupRows = entry.getValue();
            CbsCollateralViewRow masterRow = groupRows.get(0);

            try {
                // 1. Immutable Raw Snapshot for every source line
                for (CbsCollateralViewRow row : groupRows) {
                    CbsCollateralRawSnapshot snap = new CbsCollateralRawSnapshot();
                    snap.setId("snap-col-" + UUID.randomUUID().toString().substring(0, 8));
                    snap.setBatchId(batchId);
                    snap.setCbsCollateralRef(masterRow.getCollateralCode().trim());
                    snap.setRawPayloadJson(objectMapper.writeValueAsString(row));
                    snap.setSourceStatus(row.getStatus());
                    collateralSnapshotRepository.save(snap);
                    snapshotsCount++;
                }

                Collateral existing = collateralsByCode.get(colCodeKey);

                // Duplicate Collision check with CBAIMS Registered Asset
                if (existing != null && "CBAIMS_REGISTERED".equalsIgnoreCase(existing.getOriginType())) {
                    colCollisions++;
                    CbsCollateralDuplicateReview dup = new CbsCollateralDuplicateReview();
                    dup.setId("dup-col-" + UUID.randomUUID().toString().substring(0, 8));
                    dup.setBatchId(batchId);
                    dup.setCbsCollateralRef(masterRow.getCollateralCode().trim());
                    dup.setPotentialCbaimsCollateralId(existing.getId());
                    dup.setMatchReason("Collateral code collision with CBAIMS Registered Asset. Overwrite prevented.");
                    dup.setStatus("PENDING_REVIEW");
                    collateralDuplicateReviewRepository.save(dup);
                    continue;
                }

                Collateral col;
                boolean isNew = false;
                if (existing != null && "CBS_IMPORTED".equalsIgnoreCase(existing.getOriginType())) {
                    // Retain existing enriched collateral master
                    col = existing;
                } else {
                    isNew = true;
                    // Customer Resolution
                    Customer matchedCust = null;
                    if (masterRow.getCollateralOwnerCif() != null) {
                        matchedCust = customersByCif.get(masterRow.getCollateralOwnerCif().trim().toUpperCase());
                    }

                    col = cbsMapper.mapCollateralViewRow(masterRow, null, matchedCust, sourceSystem);
                    col.setImportBatchId(batchId);
                    col.setImportDate(startTime);
                    col.setStatus("Active");

                    // Ownership separation: Third-party vs Borrower
                    if (masterRow.getCollateralOwnerCif() != null) {
                        CollateralOwner owner = new CollateralOwner();
                        owner.setId("own-" + UUID.randomUUID().toString().substring(0, 8));
                        owner.setCollateralId(col.getId());
                        owner.setCif(masterRow.getCollateralOwnerCif().trim());
                        owner.setName(matchedCust != null ? matchedCust.getName() : "Owner " + masterRow.getCollateralOwnerCif().trim());

                        boolean isThirdParty = masterRow.getBorrowerCif() != null
                                && !masterRow.getBorrowerCif().trim().equalsIgnoreCase(masterRow.getCollateralOwnerCif().trim());

                        owner.setOwnerType(isThirdParty ? "Third-Party" : "Borrower");
                        owner.setOwnershipPercentage(100.0);
                        col.getOwners().add(owner);
                    }

                    // Organizational Routing Precedence (Section 13.5)
                    resolveCollateralOrg(col, masterRow, groupRows, branchMap, segmentMap, districtByBranch, activeCros, customCodeMap, loanByRef, batchId);

                    // Initial Data Quality Assessment
                    List<CollateralQualityFindingDto> findings = dataQualityService.evaluateDataQuality(col);
                    String qualityStatus = dataQualityService.calculateRecordQualityStatus(col, findings);
                    col.setDataQualityStatus(qualityStatus);

                    collateralsToSave.add(col);
                    collateralsByCode.put(colCodeKey, col);
                    colImported++;
                }

                affectedColIds.add(col.getId());

                // Process Embedded Linkages for all rows in this collateral group
                for (CbsCollateralViewRow linkRow : groupRows) {
                    if (linkRow.getAccountNumber() == null || linkRow.getAccountNumber().isBlank()) {
                        continue;
                    }
                    linkRows++;
                    String linkAcc = linkRow.getAccountNumber().trim().toUpperCase();
                    LoanAccount matchedFacility = loanByRef.get(linkAcc);

                    if (matchedFacility != null) {
                        // Check if relationship already exists
                        boolean linkExists = loanCollateralLinkRepository.findByLoanAccountId(matchedFacility.getId())
                                .stream().anyMatch(l -> col.getId().equals(l.getCollateralId()));

                        if (!linkExists) {
                            LoanCollateralLink link = new LoanCollateralLink();
                            link.setId("link-cbs-" + UUID.randomUUID().toString().substring(0, 8));
                            link.setLoanAccountId(matchedFacility.getId());
                            link.setCollateralId(col.getId());
                            link.setAccountNumber(matchedFacility.getLoanReference());
                            link.setFacilityId(matchedFacility.getLineCode() != null ? matchedFacility.getLineCode() : matchedFacility.getId());
                            link.setLinkedReferenceNo(col.getCode());
                            link.setBranchCode(linkRow.getBranchCode() != null ? linkRow.getBranchCode() : col.getBranch());
                            link.setLinkageType(linkRow.getLinkageType() != null ? linkRow.getLinkageType() : "Primary");

                            double amt = linkRow.getLinkedAmount() != null ? linkRow.getLinkedAmount().doubleValue() :
                                    (linkRow.getLimitAmount() != null ? linkRow.getLimitAmount().doubleValue() : col.getValuationAmount());

                            link.setLinkedAmount(amt);
                            link.setAllocatedAmount(amt);
                            link.setLinkedPercent(linkRow.getAllocationPercent() != null ? linkRow.getAllocationPercent().doubleValue() : 100.0);
                            link.setUtilOrder(linkRow.getUtilOrder() != null ? linkRow.getUtilOrder().intValue() : 1);
                            link.setStatus("Active");
                            link.setSource(sourceSystem);
                            link.setCbsSyncStatus("Synced");
                            link.setCbsSyncedAt(startTime);
                            loanCollateralLinkRepository.save(link);
                            linkImported++;
                        }
                    } else {
                        linkUnresolved++;
                        CbsUnresolvedLinkage unres = new CbsUnresolvedLinkage();
                        unres.setId("unres-link-" + UUID.randomUUID().toString().substring(0, 8));
                        unres.setBatchId(batchId);
                        unres.setCbsCollateralRef(col.getCode());
                        unres.setCimsCollateralId(col.getId());
                        unres.setAccountNumber(linkRow.getAccountNumber().trim());
                        unres.setBranchCode(linkRow.getBranchCode());
                        unres.setLinkageType(linkRow.getLinkageType());
                        unres.setLinkedAmount(linkRow.getLinkedAmount() != null ? linkRow.getLinkedAmount().doubleValue() : 0.0);
                        unres.setStatus("UNRESOLVED");
                        unres.setNotes("Account number " + linkRow.getAccountNumber() + " could not be resolved in CBAIMS Facilities.");
                        unresolvedLinkageRepository.save(unres);
                    }
                }

                if (collateralsToSave.size() >= effectiveChunkSize) {
                    collateralRepository.saveAll(collateralsToSave);
                    collateralsToSave.clear();
                }
            } catch (Exception e) {
                log.error("Failed importing collateral master {}: {}", colCodeKey, e.getMessage());
                colFailed++;
            }
        }
        if (!collateralsToSave.isEmpty()) {
            collateralRepository.saveAll(collateralsToSave);
            collateralsToSave.clear();
        }

        // =====================================================================
        // STAGE 4: EXPOSURE RECALCULATION & QUALITY RE-ASSESSMENT
        // =====================================================================
        for (String colId : affectedColIds) {
            try {
                exposureCalculationService.calculateExposureAndAdequacy(colId);
                dataQualityService.assessAndPersistQuality(colId);
            } catch (Exception ex) {
                log.warn("Skipped post-import calculation for {}: {}", colId, ex.getMessage());
            }
        }

        // Finalize Batch Statistics
        String endTime = LocalDateTime.now().toString();
        batch.setEndTime(endTime);
        batch.setCustomerImported(custImported);
        batch.setCustomerFailed(custFailed);
        batch.setFacilityImported(facImported);
        batch.setFacilityFailed(facFailed);
        batch.setCollateralImported(colImported);
        batch.setCollateralFailed(colFailed);
        batch.setLinkRows(linkRows);
        batch.setLinkImported(linkImported);
        batch.setLinkUnresolved(linkUnresolved);
        batch.setPotentialDuplicatesCount(custCollisions + facCollisions + colCollisions);
        batch.setUnresolvedLinksCount(linkUnresolved);
        batch.setTotalRows(customerRows.size() + facilityRows.size() + collateralRows.size());
        batch.setImportedCount(custImported + facImported + colImported);
        batch.setFailedCount(custFailed + facFailed + colFailed);

        String batchStatus = (custFailed == 0 && facFailed == 0 && colFailed == 0 && linkUnresolved == 0)
                ? "COMPLETED" : "COMPLETED_WITH_WARNINGS";
        batch.setStatus(batchStatus);
        batchRepository.save(batch);

        // Populate Result DTO
        result.setEndTime(endTime);
        result.setStatus(batchStatus);
        result.setCustomerImported(custImported);
        result.setCustomerCollisions(custCollisions);
        result.setCustomerFailed(custFailed);

        result.setFacilityImported(facImported);
        result.setFacilityCollisions(facCollisions);
        result.setFacilityUnmatchedCustomers(facUnmatchedCust);
        result.setFacilityFailed(facFailed);

        result.setCollateralImported(colImported);
        result.setCollateralCollisions(colCollisions);
        result.setCollateralFailed(colFailed);

        result.setLinkageRows(linkRows);
        result.setLinkageImported(linkImported);
        result.setLinkageUnresolved(linkUnresolved);

        result.setRawSnapshotsSaved(snapshotsCount);

        log.info("Finished CBS Three-View import batch {}: Cust({}/{}), Fac({}/{}), Col({}/{}), Links({}/{})",
                finalBatchRef, custImported, customerRows.size(), facImported, facilityRows.size(),
                colImported, collateralRows.size(), linkImported, linkRows);

        return result;
    }

    // =========================================================================
    // Organizational Routing Helper Methods
    // =========================================================================

    private void resolveCustomerOrg(Customer cust, CbsCustomerViewRow row, Map<String, Branch> branchMap,
                                    Map<String, BusinessSegment> segmentMap, Map<String, String> districtByBranch,
                                    List<User> activeCros, Map<String, String> customCodeMap, String batchId) {
        String brCode = row.getBranchCode() != null ? row.getBranchCode().trim().toUpperCase() : null;
        Branch branch = brCode != null ? branchMap.get(brCode) : null;
        if (branch != null) {
            cust.setBranch(branch.getName());
            String dist = districtByBranch.get(branch.getName().toUpperCase());
            cust.setDistrict(dist != null ? dist : branch.getParentDistrictId());
        } else if (brCode != null) {
            cust.setBranch(brCode);
            recordUnresolvedOrg("CUSTOMER", cust.getCif(), "Unmapped Branch Code: " + brCode, batchId);
        }

        String segCode = row.getBusinessSegment() != null ? row.getBusinessSegment().trim().toUpperCase() : null;
        if (segCode != null) {
            String mappedSeg = customCodeMap.get("SEGMENT:" + segCode);
            BusinessSegment seg = mappedSeg != null ? segmentMap.get(mappedSeg.toUpperCase()) : segmentMap.get(segCode);
            if (seg != null) {
                cust.setSegment(seg.getName());
            } else if (mappedSeg != null) {
                cust.setSegment(mappedSeg);
            } else {
                cust.setSegment(segCode);
                recordUnresolvedOrg("CUSTOMER", cust.getCif(), "Unmapped Business Segment: " + segCode, batchId);
            }
        }

        // CRO Assignment
        User assignedCro = findMatchingCro(cust.getBranch(), cust.getDistrict(), cust.getSegment(), activeCros);
        if (assignedCro != null) {
            cust.setAssignedCro(assignedCro.getUsername());
        }
    }

    private void resolveFacilityOrg(LoanAccount fac, CbsFacilityViewRow row, Map<String, Branch> branchMap,
                                    Map<String, BusinessSegment> segmentMap, Map<String, String> districtByBranch,
                                    List<User> activeCros, Map<String, String> customCodeMap, String batchId) {
        String brCode = row.getBranchCode() != null ? row.getBranchCode().trim().toUpperCase() : null;
        Branch branch = brCode != null ? branchMap.get(brCode) : null;
        if (branch != null) {
            fac.setBranch(branch.getName());
            String dist = districtByBranch.get(branch.getName().toUpperCase());
            fac.setDistrict(dist != null ? dist : branch.getParentDistrictId());
        } else if (brCode != null) {
            fac.setBranch(brCode);
            recordUnresolvedOrg("FACILITY", fac.getLoanReference(), "Unmapped Branch Code: " + brCode, batchId);
        }

        String segCode = row.getBusinessSegment() != null ? row.getBusinessSegment().trim().toUpperCase() : null;
        if (segCode != null) {
            String mappedSeg = customCodeMap.get("SEGMENT:" + segCode);
            BusinessSegment seg = mappedSeg != null ? segmentMap.get(mappedSeg.toUpperCase()) : segmentMap.get(segCode);
            if (seg != null) {
                fac.setSegment(seg.getName());
            } else if (mappedSeg != null) {
                fac.setSegment(mappedSeg);
            } else {
                fac.setSegment(segCode);
                recordUnresolvedOrg("FACILITY", fac.getLoanReference(), "Unmapped Business Segment: " + segCode, batchId);
            }
        }

        // CRO Assignment
        User assignedCro = findMatchingCro(fac.getBranch(), fac.getDistrict(), fac.getSegment(), activeCros);
        if (assignedCro != null) {
            fac.setAssignedCro(assignedCro.getUsername());
            fac.setRmUserId(assignedCro.getUsername());
        }
    }

    private void resolveCollateralOrg(Collateral col, CbsCollateralViewRow masterRow, List<CbsCollateralViewRow> groupRows,
                                      Map<String, Branch> branchMap, Map<String, BusinessSegment> segmentMap,
                                      Map<String, String> districtByBranch, List<User> activeCros,
                                      Map<String, String> customCodeMap, Map<String, LoanAccount> loanByRef, String batchId) {
        // 1. Branch precedence
        String brCode = masterRow.getBranchCode() != null ? masterRow.getBranchCode().trim().toUpperCase() : null;
        Branch branch = brCode != null ? branchMap.get(brCode) : null;
        if (branch != null) {
            col.setBranch(branch.getName());
            String dist = districtByBranch.get(branch.getName().toUpperCase());
            col.setDistrict(dist != null ? dist : branch.getParentDistrictId());
        } else if (brCode != null) {
            col.setBranch(brCode);
            recordUnresolvedOrg("COLLATERAL", col.getCode(), "Unmapped Branch Code: " + brCode, batchId);
        }

        // 2. Owning Segment resolution from linked facilities (Section 13.5)
        Set<String> linkedSegments = new HashSet<>();
        for (CbsCollateralViewRow r : groupRows) {
            if (r.getAccountNumber() != null) {
                LoanAccount fac = loanByRef.get(r.getAccountNumber().trim().toUpperCase());
                if (fac != null && fac.getSegment() != null && !fac.getSegment().isBlank()) {
                    linkedSegments.add(fac.getSegment());
                }
            }
        }

        if (linkedSegments.size() == 1) {
            col.setOwningSegment(linkedSegments.iterator().next());
        } else if (linkedSegments.size() > 1) {
            col.setOwningSegment("Cross-Segment");
            recordUnresolvedOrg("COLLATERAL", col.getCode(), "Cross-segment security across multiple segments: " + linkedSegments, batchId);
        } else if (col.getOwningSegment() == null || col.getOwningSegment().isBlank()) {
            col.setOwningSegment("Corporate Banking");
        }

        // 3. CRO Assignment
        User assignedCro = findMatchingCro(col.getBranch(), col.getDistrict(), col.getOwningSegment(), activeCros);
        if (assignedCro != null) {
            col.setAssignedCro(assignedCro.getUsername());
        }
    }

    private User findMatchingCro(String branch, String district, String segment, List<User> activeCros) {
        if (activeCros == null || activeCros.isEmpty()) return null;

        for (User u : activeCros) {
            boolean branchMatch = branch != null && u.getBranch() != null && branch.equalsIgnoreCase(u.getBranch());
            boolean districtMatch = district != null && u.getDistrict() != null && district.equalsIgnoreCase(u.getDistrict());
            boolean segMatch = segment == null || u.getSegment() == null || segment.equalsIgnoreCase(u.getSegment());

            if ((branchMatch || districtMatch) && segMatch) {
                return u;
            }
        }
        return null;
    }

    private void recordUnresolvedOrg(String entityType, String sourceKey, String reason, String batchId) {
        CbsUnresolvedEntity unres = new CbsUnresolvedEntity();
        unres.setId("unres-org-" + UUID.randomUUID().toString().substring(0, 8));
        unres.setEntityType(entityType);
        unres.setBatchId(batchId);
        unres.setSourceKey(sourceKey != null ? sourceKey : "UNKNOWN");
        unres.setReason(reason);
        unres.setStatus("ORGANIZATIONAL_MAPPING_REQUIRED");
        unresolvedEntityRepository.save(unres);
    }
}

