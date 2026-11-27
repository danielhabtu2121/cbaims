package com.bank.cims.service.cbs;

import com.bank.cims.model.*;
import com.bank.cims.repository.BranchRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dedicated Mapping Layer for CBS-to-CIMS canonical domain entities.
 * Handles deterministic field conversions, status mappings, and source metadata attribution.
 */
@Component
public class CbsMapper {

    private static final Map<String, String> FACILITY_TYPE_MAP = Map.ofEntries(
            Map.entry("0", "Short Term Loan"),
            Map.entry("1", "Medium-term Loan"),
            Map.entry("2", "Long-term Loan"),
            Map.entry("3", "Pre-shipment loans"),
            Map.entry("4", "Post shipment loans"),
            Map.entry("5", "Merchandise loans"),
            Map.entry("6", "Advance on LC"),
            Map.entry("7", "ECG loans"),
            Map.entry("8", "Others (USAID and others)"),
            // IFB Product Codes
            Map.entry("DMAG", "Diminishing Musharaka Agriculture"),
            Map.entry("DMCN", "Diminishing Musharaka Construction"),
            Map.entry("DMDS", "Diminishing Musharaka Domestic Service"),
            Map.entry("DMDT", "Diminishing Musharaka Domestic Trade"),
            Map.entry("DMEX", "Diminishing Musharaka Export"),
            Map.entry("DMIM", "Diminishing Musharaka Import"),
            Map.entry("DMMF", "Diminishing Musharaka Manufacturing"),
            Map.entry("DMMN", "Diminishing Musharaka Mining"),
            Map.entry("DMRS", "Diminishing Musharaka Realestate"),
            Map.entry("DMTR", "Diminishing Musharaka Transport"),
            Map.entry("IJAG", "Ijara Agriculture"),
            Map.entry("IJCN", "Ijara Construction"),
            Map.entry("IJPC", "Ijara Personal/Consumer"),
            Map.entry("IJRS", "Ijara Realestate"),
            Map.entry("IJTR", "Ijara Transport"),
            Map.entry("ISAG", "Istisna Agriculture"),
            Map.entry("ISCN", "Istisna Construction"),
            Map.entry("ISDS", "Istisna Domestic Service"),
            Map.entry("ISDT", "Istisna Domestic Trade"),
            Map.entry("ISEX", "Istisna Export"),
            Map.entry("ISMF", "Istisna Manufacturing"),
            Map.entry("ISMN", "Istisna Mining"),
            Map.entry("ISRS", "Istisna Realestate"),
            Map.entry("MDAG", "Mudaraba Agriculture"),
            Map.entry("MDCN", "Mudaraba Construction"),
            Map.entry("MDDS", "Mudaraba Domestic Service"),
            Map.entry("MDDT", "Mudaraba Domestic Trade"),
            Map.entry("MDEX", "Mudaraba Export"),
            Map.entry("MDMF", "Mudaraba Manufacturing"),
            Map.entry("MDMN", "Mudaraba Mining"),
            Map.entry("MDRS", "Mudaraba Realestate"),
            Map.entry("MDTR", "Mudaraba Transport"),
            Map.entry("MODF", "MURABAHA MOBILE DEVICE FINANCING"),
            Map.entry("MRAG", "Murabaha Agriculture"),
            Map.entry("MRCN", "Murabaha Construction"),
            Map.entry("MRDS", "Murabaha Domestic Service"),
            Map.entry("MRDT", "Murabaha Domestic Trade"),
            Map.entry("MREX", "Murabaha Export"),
            Map.entry("MRIM", "Murabaha Import"),
            Map.entry("MRMF", "Murabaha Manufacturing"),
            Map.entry("MRMN", "Murabaha Mining"),
            Map.entry("MRPC", "Murabaha Personal/Consumer"),
            Map.entry("MRRS", "Murabaha Realestate"),
            Map.entry("MRTR", "Murabaha Transport"),
            Map.entry("MSAG", "Musharaka Agriculture"),
            Map.entry("MSCN", "Musharaka Construction"),
            Map.entry("MSDS", "Musharaka Domestic Service"),
            Map.entry("MSEX", "Musharaka Export"),
            Map.entry("MSIM", "Musharaka Import"),
            Map.entry("MSMF", "Musharaka Manufacturing"),
            Map.entry("MSMN", "Musharaka Mining"),
            Map.entry("MSRS", "Musharaka Realestate"),
            Map.entry("MSTR", "Musharaka Transport"),
            Map.entry("OVAF", "Qard Overseas Employment Agency Financing"),
            Map.entry("QASM", "Qard SME"),
            Map.entry("SLAG", "Salam Agriculture"),
            Map.entry("SLMN", "Salam Mining"),
            Map.entry("MRSP", "MURABAHA SHORT TERM SMART POS FINANCING"),
            Map.entry("MLCS", "MURABAHA L/C SETTLEMENT FINANCING"),
            Map.entry("MRCO", "Murabaha Consumer"),
            Map.entry("MRTA", "Murabaha Taxi Finanacing"),
            Map.entry("SWHF", "Sharik Ware House Financing"),
            Map.entry("TWHF", "Tijara Ware House Financing"),
            Map.entry("ILCM", "Import L/C margin-Sharik"),
            Map.entry("ILCS", "Import L/C settlement-Sharik"),
            Map.entry("MREA", "Murabaha Personal/Consumer-Employment Agency Financing"),
            Map.entry("MRSC", "Murabaha Consumer Staff"),
            Map.entry("MSMR", "MURABAHA MESMER FINANCING"),
            Map.entry("MUPL", "Murabah Financing- Plus Financing"),
            Map.entry("QAPL", "Qard Murabah Financing- Plus"),
            Map.entry("REVC", "Revolving Valuchain Financing"),
            Map.entry("PAIS", "Parallal istisna"),
            Map.entry("PASL", "Parallal selam"),
            Map.entry("TIAG", "Tijara Agriculture"),
            Map.entry("TIMF", "Tijara Manufacturing"),
            Map.entry("TIDT", "Tijara Domestic Trade"),
            // Conventional Product Codes (TESTER.XLSX)
            Map.entry("MNGL", "Mining TermLoan"),
            Map.entry("IMPT", "Import Term Loans"),
            Map.entry("EXPT", "Export Term Loans"),
            Map.entry("TRST", "Transport Term Loans"),
            Map.entry("CMWF", "Construction,Machinery&Working Fund"),
            Map.entry("MNFG", "Manufacturing Term Loans"),
            Map.entry("RLST", "Real Estate Term Loans"),
            Map.entry("SMFM", "SME Credit finance-Manufacturing"),
            Map.entry("MCFD", "Master Card Foundation"),
            Map.entry("AECT", "AEC TERM LOAN"),
            Map.entry("RVCF", "REVOLVING VALUE CHAIN FINANCING"),
            Map.entry("IPTL", "Insurance Premium Financing"),
            Map.entry("BIME", "Bridge loan International Meeting"),
            Map.entry("SMFA", "SME Credit finance-Agro Processing"),
            Map.entry("SMFC", "SME Credit finance-Construction"),
            Map.entry("SMFT", "SME Credit finance-Tourism"),
            Map.entry("DSTL", "STAFF DUBE ALE"),
            Map.entry("FNLP", "FLY NOW PAY LATER LAON Services"),
            Map.entry("MACF", "Master Card Foundation-MESMER"),
            Map.entry("FXEX", "FX Export Term Loans"),
            Map.entry("AGSC", "Agricultural supply chain financing"),
            Map.entry("SMKF", "DBE SME- KFW"),
            Map.entry("RCFI", "Revolving Credit Facility Import"),
            Map.entry("HOTR", "special financing-Hotel and Tourism"),
            Map.entry("SMIP", "DBE-Innovation Project Loan"),
            Map.entry("POTL", "POS Device Purchase Financing"),
            Map.entry("TPMF", "Third Party Machinery Financing"),
            Map.entry("AGCR", "Agricultural Term Loans"),
            Map.entry("DMTS", "Domestic Trade And Services"),
            Map.entry("DBAL", "Dube Ale Loan Services"),
            Map.entry("PERS", "Personal Loans"),
            Map.entry("EDFI", "Student Loan"),
            Map.entry("SMAD", "DBE SME- ADELE")
    );

    private static final Map<String, String> BUSINESS_SEGMENT_MAP = Map.ofEntries(
            Map.entry("0", "Corporate Banking"),
            Map.entry("CORPORATE", "Corporate Banking"),
            Map.entry("CORPORATE BANKING", "Corporate Banking"),
            Map.entry("CORPORATE BANKING CUSTOMERS", "Corporate Banking"),
            Map.entry("1", "MSME Banking"),
            Map.entry("MSME", "MSME Banking"),
            Map.entry("MSME BANKING", "MSME Banking"),
            Map.entry("MSME BANKING CUSTOMERS", "MSME Banking"),
            Map.entry("2", "Retail Banking"),
            Map.entry("MRETAIL", "Retail Banking"),
            Map.entry("RETAIL", "Retail Banking"),
            Map.entry("RETAIL BANKING", "Retail Banking"),
            Map.entry("2RETAIL BANKING CUSTOMERS", "Retail Banking"),
            Map.entry("RETAIL BANKING CUSTOMERS", "Retail Banking"),
            Map.entry("IFB", "Interest-Free Banking (IFB)"),
            Map.entry("INTEREST-FREE BANKING", "Interest-Free Banking (IFB)"),
            Map.entry("INTEREST FREE BANKING", "Interest-Free Banking (IFB)"),
            Map.entry("INTEREST-FREE BANKING (IFB)", "Interest-Free Banking (IFB)")
    );

    @Autowired(required = false)
    private BranchRepository branchRepository;

    private final Map<String, String> branchNameByCode = new ConcurrentHashMap<>();

    public void refreshBranchCache(List<Branch> branches) {
        branchNameByCode.clear();
        if (branches == null) return;
        for (Branch b : branches) {
            if (b.getName() == null || b.getName().isBlank()) continue;
            String name = b.getName().trim();
            indexBranchKey(b.getCbsBranchCode(), name);
            indexBranchKey(b.getCode(), name);
            if (b.getCode() != null && b.getCode().toUpperCase().startsWith("CBS-")) {
                indexBranchKey(b.getCode().substring(4), name);
            }
            branchNameByCode.putIfAbsent(name.toUpperCase(), name);
        }
    }

    private void indexBranchKey(String rawKey, String name) {
        if (rawKey == null || rawKey.isBlank()) return;
        String key = rawKey.trim().toUpperCase();
        branchNameByCode.putIfAbsent(key, name);
        String stripped = key.replaceFirst("^0+(?!$)", "");
        if (!stripped.isEmpty()) {
            branchNameByCode.putIfAbsent(stripped, name);
        }
    }

    public String resolveBranchName(String rawBranch) {
        if (rawBranch == null || rawBranch.isBlank()) return null;
        if (branchNameByCode.isEmpty() && branchRepository != null) {
            refreshBranchCache(branchRepository.findAll());
        }
        String trimmed = rawBranch.trim();
        String upper = trimmed.toUpperCase();
        String match = branchNameByCode.get(upper);
        if (match != null) return match;
        String stripped = upper.replaceFirst("^0+(?!$)", "");
        match = branchNameByCode.get(stripped);
        if (match != null) return match;
        if (stripped.matches("\\d{1,3}")) {
            String padded = String.format("%03d", Integer.parseInt(stripped));
            match = branchNameByCode.get(padded);
            if (match != null) return match;
            match = branchNameByCode.get("CBS-" + padded);
            if (match != null) return match;
        }
        return trimmed;
    }

    public static String resolveFacilityType(String rawType) {
        if (rawType == null || rawType.isBlank()) return "Term Loan";
        String key = normalizeNumericCode(rawType).toUpperCase();
        return FACILITY_TYPE_MAP.getOrDefault(key, rawType.trim());
    }

    public static String resolveBusinessSegment(String rawSegment) {
        if (rawSegment == null || rawSegment.isBlank()) return null;
        String key = normalizeNumericCode(rawSegment).toUpperCase(java.util.Locale.ROOT);
        return BUSINESS_SEGMENT_MAP.getOrDefault(key, rawSegment.trim());
    }

    public static boolean isPlaceholderSegment(String segment) {
        if (segment == null || segment.isBlank()) return true;
        String upper = segment.trim().toUpperCase(java.util.Locale.ROOT);
        return upper.equals("GENERAL") || upper.equals("UNSEGMENTED")
                || upper.equals("SHORT") || upper.equals("MEDIUM") || upper.equals("LONG");
    }

    private static String normalizeNumericCode(String raw) {
        String trimmed = raw.trim();
        if (trimmed.endsWith(".0")) {
            trimmed = trimmed.substring(0, trimmed.length() - 2);
        }
        if (trimmed.matches("\\d+")) {
            return trimmed.replaceFirst("^0+(?!$)", "");
        }
        return trimmed;
    }

    /**
     * Maps incoming CBS Customer onto CIMS Customer master entity.
     * Updates source-owned fields while preserving CIMS identity.
     */
    public Customer mapCustomer(CbsCustomer cc, Customer existing, String sourceSystem) {
        Customer cust = existing != null ? existing : new Customer();
        if (cust.getId() == null || cust.getId().isBlank()) {
            cust.setId(cc.getId() != null ? cc.getId() : "cst-" + UUID.randomUUID().toString().substring(0, 8));
        }

        cust.setCif(cc.getCif() != null ? cc.getCif().trim() : null);

        String fullName = cc.getFullName();
        if (fullName != null && !fullName.isBlank()) {
            cust.setName(fullName.trim());
        } else if (existing != null && existing.getName() != null && !existing.getName().isBlank()) {
            cust.setName(existing.getName().trim());
        } else if (cc.getCif() != null && !cc.getCif().isBlank()) {
            cust.setName("CBS Customer " + cc.getCif().trim());
        } else {
            cust.setName("Unnamed Customer");
        }

        cust.setCustomerType(cc.getCustomerType() != null && !cc.getCustomerType().isBlank() ? cc.getCustomerType() : "Individual");
        cust.setNationalId(cc.getNationalId());
        cust.setBusinessRegNo(cc.getBusinessRegNo());
        cust.setTaxIdNo(cc.getTaxIdNo());
        cust.setDobOrIncorp(cc.getDobOrIncorp());
        cust.setGender(cc.getGender());
        cust.setPhone(cc.getPhone());
        cust.setEmail(cc.getEmail());
        cust.setAddress(cc.getAddress());

        String segment = resolveBusinessSegment(cc.getBusinessSegment());
        String existingSeg = existing != null ? resolveBusinessSegment(existing.getSegment()) : null;
        if (!isPlaceholderSegment(segment)) {
            cust.setSegment(segment);
        } else if (!isPlaceholderSegment(existingSeg)) {
            cust.setSegment(existingSeg);
        } else {
            cust.setSegment("General");
        }

        cust.setBranch(resolveBranchName(cc.getBranch()));
        cust.setRiskRating(cc.getRiskRating() != null && !cc.getRiskRating().isBlank() ? cc.getRiskRating() : "Medium");
        cust.setStatus(cc.getCustomerStatus() != null && !cc.getCustomerStatus().isBlank() ? cc.getCustomerStatus() : "Active");

        // Source metadata
        cust.setOriginType("CBS_IMPORTED");
        cust.setCbsSourceRef(cust.getCif());
        cust.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        cust.setCbsSyncStatus("Synced");
        cust.setCbsSyncedAt(LocalDateTime.now().toString());

        return cust;
    }

    /**
     * Maps incoming CBS Facility onto CIMS LoanAccount master entity.
     * Accurately synchronizes limits, balances, and source statuses (including closures).
     */
    public LoanAccount mapFacility(CbsFacility cf, LoanAccount existing, Customer matchedCustomer, String sourceSystem) {
        LoanAccount la = existing != null ? existing : new LoanAccount();
        if (la.getId() == null || la.getId().isBlank()) {
            la.setId(cf.getId() != null ? cf.getId() : "fac-" + UUID.randomUUID().toString().substring(0, 8));
        }

        la.setLoanReference(cf.getLoanRefNo() != null ? cf.getLoanRefNo().trim() : null);
        la.setLineCode(cf.getLineCode());
        la.setAccountNumber(cf.getLoanRefNo());

        if (matchedCustomer != null) {
            la.setCustomerId(matchedCustomer.getId());
        } else if (cf.getCustomerCif() != null) {
            la.setCustomerId(cf.getCustomerCif().trim());
        }

        la.setFacilityType(cf.getFacilityType());
        la.setLineCurrency(cf.getLineCurrency() != null ? cf.getLineCurrency() : "ETB");
        la.setRevolvingLine(cf.isRevolvingLine());
        la.setLineStartDate(cf.getLineStartDate());
        la.setLineExpiryDate(cf.getLineExpiryDate());
        la.setApprovedLimit(cf.getApprovedLimit());
        la.setOutstandingBalance(cf.getOutstandingAmount());
        la.setAvailableAmount(cf.getAvailableAmount());
        la.setCollateralContribution(cf.getCollateralContribution());
        la.setCollateralPct(cf.getCollateralPct());
        String segment = resolveBusinessSegment(cf.getBusinessSegment());
        String existingSeg = existing != null ? resolveBusinessSegment(existing.getSegment()) : null;
        String custSeg = matchedCustomer != null ? resolveBusinessSegment(matchedCustomer.getSegment()) : null;
        if (!isPlaceholderSegment(segment)) {
            la.setSegment(segment);
        } else if (!isPlaceholderSegment(existingSeg)) {
            la.setSegment(existingSeg);
        } else if (!isPlaceholderSegment(custSeg)) {
            la.setSegment(custSeg);
        } else {
            la.setSegment("Corporate Banking");
        }

        String branch = resolveBranchName(cf.getBranch());
        if (branch != null && !branch.isBlank()) {
            la.setBranch(branch);
        } else if (existing != null && existing.getBranch() != null && !existing.getBranch().isBlank()) {
            la.setBranch(resolveBranchName(existing.getBranch()));
        } else if (matchedCustomer != null && matchedCustomer.getBranch() != null && !matchedCustomer.getBranch().isBlank()) {
            la.setBranch(resolveBranchName(matchedCustomer.getBranch()));
        } else {
            la.setBranch("Head Office");
        }

        String facType = cf.getFacilityType();
        if (facType != null && !facType.isBlank()) {
            la.setFacilityType(resolveFacilityType(facType));
        } else if (existing != null && existing.getFacilityType() != null && !existing.getFacilityType().isBlank()) {
            la.setFacilityType(resolveFacilityType(existing.getFacilityType()));
        } else {
            la.setFacilityType("Term Loan");
        }
        la.setRmUserId(cf.getRelationshipManager());
        la.setNextReviewDueDate(cf.getNextReviewDate());

        // Status & Loan Closure synchronization
        String limitStatus = cf.getLimitStatus() != null ? cf.getLimitStatus() : "Active";
        if ("Closed".equalsIgnoreCase(limitStatus) || "Matured".equalsIgnoreCase(limitStatus) || "Liquidated".equalsIgnoreCase(limitStatus)) {
            la.setStatus("Closed");
        } else {
            la.setStatus(limitStatus);
        }

        // Source metadata
        la.setOriginType("CBS_IMPORTED");
        la.setCbsSourceRef(la.getLoanReference());
        la.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        la.setCbsSyncStatus("Synced");
        la.setCbsSyncedAt(LocalDateTime.now().toString());

        return la;
    }

    /**
     * Maps incoming CBS Collateral onto CIMS Collateral canonical entity.
     * Enforces strict distinction between Collateral Type (Asset Class) and Ownership Type.
     * Fully preserves Haircut and Limit Contribution.
     */
    public Collateral mapCollateral(CbsCollateral ccol, Collateral existing, Customer matchedCustomer, String sourceSystem) {
        Collateral col = existing != null ? existing : new Collateral();
        if (col.getId() == null || col.getId().isBlank()) {
            col.setId(ccol.getId() != null ? ccol.getId() : "col-" + UUID.randomUUID().toString().substring(0, 8));
        }

        col.setCode(ccol.getCollateralCode() != null ? ccol.getCollateralCode().trim() : null);

        if (matchedCustomer != null) {
            col.setCustomerId(matchedCustomer.getId());
        } else if (ccol.getCustomerCif() != null) {
            col.setCustomerId(ccol.getCustomerCif().trim());
        }

        col.setDescription(ccol.getDescription());
        col.setCategory(ccol.getCategory());

        // CRITICAL: Distinct mapping for Type vs Ownership Type
        col.setType(ccol.getCollateralType() != null ? ccol.getCollateralType() : "Building");
        col.setOwnerType(ccol.getOwnershipType() != null ? ccol.getOwnershipType() : "Borrower-owned");

        col.setCurrency(ccol.getCurrency() != null ? ccol.getCurrency() : "ETB");
        col.setValuationAmount(ccol.getCollateralValue());

        // Haircut preservation
        col.setHaircut(ccol.getHaircut());

        // Limit contribution calculation / preservation
        if (ccol.getLimitContribution() > 0) {
            col.setLimitContribution(ccol.getLimitContribution());
        } else {
            double effectiveHaircut = ccol.getHaircut();
            col.setLimitContribution(ccol.getCollateralValue() * (1.0 - (effectiveHaircut / 100.0)));
        }

        col.setStartDate(ccol.getStartDate());
        col.setReviewDate(ccol.getReviewDate());
        col.setTangible(ccol.isTangible());

        // Safe non-null fallback for PostgreSQL NOT NULL constraint on owning_segment
        String colSegment = resolveBusinessSegment(ccol.getBusinessSegment());
        String existingSeg = existing != null ? resolveBusinessSegment(existing.getOwningSegment()) : null;
        String custSeg = matchedCustomer != null ? resolveBusinessSegment(matchedCustomer.getSegment()) : null;
        if (!isPlaceholderSegment(colSegment)) {
            col.setOwningSegment(colSegment);
        } else if (!isPlaceholderSegment(existingSeg)) {
            col.setOwningSegment(existingSeg);
        } else if (!isPlaceholderSegment(custSeg)) {
            col.setOwningSegment(custSeg);
        } else {
            col.setOwningSegment("Corporate Banking");
        }

        // Safe non-null fallback for PostgreSQL NOT NULL constraint on branch
        String colBranch = resolveBranchName(ccol.getBranch());
        if (colBranch != null && !colBranch.isBlank()) {
            col.setBranch(colBranch);
        } else if (existing != null && existing.getBranch() != null && !existing.getBranch().isBlank()) {
            col.setBranch(resolveBranchName(existing.getBranch()));
        } else if (matchedCustomer != null && matchedCustomer.getBranch() != null && !matchedCustomer.getBranch().isBlank()) {
            col.setBranch(resolveBranchName(matchedCustomer.getBranch()));
        } else {
            col.setBranch("Head Office");
        }

        // Safe non-null fallback for status
        if (existing != null && existing.getStatus() != null && !existing.getStatus().isBlank()) {
            col.setStatus(existing.getStatus().trim());
        } else {
            col.setStatus("Active");
        }

        col.setZipCode(ccol.getZipCode());

        // Source metadata & enrichment readiness
        col.setOriginType("CBS_IMPORTED");
        col.setCbsCollateralRef(col.getCode());
        if (col.getEnrichmentStatus() == null || col.getEnrichmentStatus().isBlank() || "NOT_APPLICABLE".equalsIgnoreCase(col.getEnrichmentStatus())) {
            col.setEnrichmentStatus("PENDING_ENRICHMENT");
        }
        if ((col.getDataQualityStatus() == null || col.getDataQualityStatus().isBlank() || "COMPLETE".equalsIgnoreCase(col.getDataQualityStatus()))
                && !"APPROVED".equalsIgnoreCase(col.getEnrichmentStatus())) {
            col.setDataQualityStatus("INCOMPLETE");
        }
        col.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        col.setCbsSyncStatus("Synced");
        col.setCbsSyncedAt(LocalDateTime.now().toString());

        return col;
    }

    /**
     * Maps incoming CBS Linkage details onto CIMS LoanCollateralLink entity.
     * Ensures distinct facility identity vs loan account identity and cross-collateral support.
     */
    public LoanCollateralLink mapLink(
            CbsAccCollLinkDtls cl,
            LoanCollateralLink existing,
            LoanAccount matchedLoan,
            Collateral matchedCollateral,
            String sourceSystem) {

        LoanCollateralLink link = existing != null ? existing : new LoanCollateralLink();
        if (link.getId() == null || link.getId().isBlank()) {
            link.setId(cl.getId() != null ? cl.getId() : "link-" + UUID.randomUUID().toString().substring(0, 8));
        }

        // Account & Facility Identity mapping
        link.setAccountNumber(cl.getAccountNumber());
        if (matchedLoan != null) {
            link.setLoanAccountId(matchedLoan.getId());
            // Facility identity distinction
            link.setFacilityId(matchedLoan.getLineCode() != null && !matchedLoan.getLineCode().isBlank()
                    ? matchedLoan.getLineCode()
                    : matchedLoan.getId());
        } else {
            link.setLoanAccountId(cl.getAccountNumber());
            link.setFacilityId(cl.getAccountNumber());
        }

        // Collateral Identity mapping
        if (matchedCollateral != null) {
            link.setCollateralId(matchedCollateral.getId());
        } else {
            link.setCollateralId(cl.getLinkedReferenceNo());
        }

        link.setBranchCode(cl.getBranchCode());
        link.setLinkageType(cl.getLinkageType() != null ? cl.getLinkageType() : "Primary");
        link.setLinkedReferenceNo(cl.getLinkedReferenceNo());
        link.setDescription(cl.getDescription());
        link.setLinkageCurrency(cl.getLinkageCurrency() != null ? cl.getLinkageCurrency() : "ETB");
        link.setOverallAmount(cl.getOverallAmount());
        link.setCollateralCategory(cl.getCollateralCategory());
        link.setHaircut(cl.getHaircut());
        link.setLimitAmount(cl.getLimitAmount());

        double effectiveLinkedAmt = cl.getLinkedAmount() > 0 ? cl.getLinkedAmount()
                : (cl.getLimitAmount() > 0 ? cl.getLimitAmount()
                        : (existing != null && existing.getLinkedAmount() > 0 ? existing.getLinkedAmount()
                                : (matchedCollateral != null ? matchedCollateral.getValuationAmount() : 0.0)));

        link.setAllocatedAmount(effectiveLinkedAmt);
        link.setLinkedAmount(effectiveLinkedAmt);
        link.setLinkedPercent(cl.getLinkedPercentNumber() > 0 ? cl.getLinkedPercentNumber()
                : (existing != null && existing.getLinkedPercent() > 0 ? existing.getLinkedPercent() : 100.0));
        link.setUtilOrder(cl.getUtilOrder());
        link.setReinstateOrder(cl.getReinstateOrder());
        link.setUtilAmount(cl.getUtilAmount());
        link.setStatus("Active");
        link.setTakenOver(cl.getTakenOver() != null ? cl.getTakenOver() : "N");

        // Source metadata
        link.setSource(sourceSystem != null ? sourceSystem : "CBS_SIM");
        link.setSourceRecordId(cl.getId());
        link.setCbsSyncStatus("Synced");
        link.setCbsSyncedAt(LocalDateTime.now().toString());

        return link;
    }

    /**
     * Maps incoming 16-column Oracle Customer View Row onto CBAIMS Customer entity.
     * Preserves exact source CIF string, leading zeros, and original status metadata.
     */
    public Customer mapCustomerViewRow(com.bank.cims.dto.cbs.CbsCustomerViewRow row, Customer existing, String sourceSystem) {
        Customer cust = existing != null ? existing : new Customer();
        if (cust.getId() == null || cust.getId().isBlank()) {
            cust.setId("cst-cbs-" + UUID.randomUUID().toString().substring(0, 8));
        }

        cust.setCif(row.getCustomerNo() != null ? row.getCustomerNo().trim() : null);
        cust.setCbsSourceRef(row.getCustomerNo() != null ? row.getCustomerNo().trim() : null);
        cust.setOriginType("CBS_IMPORTED");
        cust.setName(row.getCustomerName1() != null && !row.getCustomerName1().isBlank()
                ? row.getCustomerName1().trim()
                : (row.getCustomerNo() != null && !row.getCustomerNo().isBlank() ? "CBS Customer " + row.getCustomerNo().trim() : "Unnamed Customer"));
        cust.setCustomerType(row.getCustomerType() != null && !row.getCustomerType().isBlank() ? row.getCustomerType() : "Individual");
        cust.setNationalId(row.getPNationalId());
        cust.setBusinessRegNo(row.getPassportNo());
        cust.setTaxIdNo(row.getTaxidNo());
        cust.setPhone(row.getMobileNumber());
        cust.setEmail(row.getEmail());
        cust.setAddress(row.getAddress());
        String seg = resolveBusinessSegment(row.getBusinessSegment());
        cust.setSegment(seg != null && !seg.isBlank() ? seg : "General");
        cust.setBranch(resolveBranchName(row.getBranchCode()));

        // Status mapping
        if ("A".equalsIgnoreCase(row.getCustomerStatus())) {
            cust.setStatus("Active");
        } else if ("C".equalsIgnoreCase(row.getCustomerStatus())) {
            cust.setStatus("Closed");
        } else {
            cust.setStatus(row.getCustomerStatus());
        }

        cust.setRecordStat(row.getRecordStat());
        cust.setAuthStat(row.getAuthStat());
        cust.setMakerDtStamp(row.getMakerDate());

        cust.setSource(sourceSystem != null ? sourceSystem : "CBS_ORACLE");
        cust.setCbsSyncStatus("Synced");
        cust.setCbsSyncedAt(LocalDateTime.now().toString());

        return cust;
    }

    /**
     * Maps incoming 15-column Oracle Facility View Row onto CBAIMS LoanAccount entity.
     * Stores external FACILTY_ID separately from internal CBAIMS ID and account number.
     * Preserves exact sanction amount and balance without fabricating zeros.
     */
    public LoanAccount mapFacilityViewRow(com.bank.cims.dto.cbs.CbsFacilityViewRow row, LoanAccount existing, Customer matchedCustomer, String sourceSystem) {
        LoanAccount la = existing != null ? existing : new LoanAccount();
        if (la.getId() == null || la.getId().isBlank()) {
            la.setId("fac-cbs-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String accNo = row.getAccountNumber() != null ? row.getAccountNumber().trim() : null;
        la.setLoanReference(accNo);
        la.setAccountNumber(accNo);
        la.setCbsSourceRef(accNo);
        la.setOriginType("CBS_IMPORTED");

        if (row.getFaciltyId() != null) {
            la.setCbsFacilityId(row.getFaciltyId().toPlainString());
            la.setLineCode(row.getFaciltyId().toPlainString());
        } else {
            la.setCbsFacilityId(null);
            la.setLineCode(accNo);
        }

        if (matchedCustomer != null) {
            la.setCustomerId(matchedCustomer.getId());
            la.setCustomerMatchStatus("MATCHED");
        } else if (row.getCustomerId() != null) {
            la.setCustomerId(row.getCustomerId().trim());
            la.setCustomerMatchStatus("UNRESOLVED");
        }

        la.setFacilityType(resolveFacilityType(row.getProductCode()));
        la.setSegment(resolveBusinessSegment(row.getBusinessSegment()));
        la.setBranch(resolveBranchName(row.getBranchCode()));

        if (row.getSancationAmount() != null) {
            la.setApprovedLimit(row.getSancationAmount().doubleValue());
        } else {
            la.setApprovedLimit(0.0);
        }

        if (row.getOutstandingBalance() != null) {
            la.setOutstandingBalance(row.getOutstandingBalance().doubleValue());
        } else {
            la.setOutstandingBalance(0.0);
        }

        if (row.getMaturityDate() != null) {
            la.setLineExpiryDate(row.getMaturityDate().toString());
        }
        if (row.getValueDate() != null) {
            la.setLineStartDate(row.getValueDate().toString());
        }

        // Status mapping
        String actStatus = row.getAccountStatus();
        if ("C".equalsIgnoreCase(actStatus) || "Closed".equalsIgnoreCase(actStatus)) {
            la.setStatus("Closed");
        } else if ("A".equalsIgnoreCase(actStatus)) {
            la.setStatus("Active");
        } else {
            la.setStatus(actStatus != null ? actStatus : "Active");
        }

        la.setRecordStat(row.getLoanStatus());
        la.setAuthStat(row.getAuthStat());
        la.setSource(sourceSystem != null ? sourceSystem : "CBS_ORACLE");
        la.setCbsSyncStatus("Synced");
        la.setCbsSyncedAt(LocalDateTime.now().toString());

        return la;
    }

    /**
     * Maps incoming 31-column Oracle Collateral View Row onto CBAIMS Collateral entity.
     * ZERO fallback defaults: Missing type, currency, or ownership remain explicitly null/unmapped
     * so that Data Quality workbench can truthfully flag missing required fields.
     */
    public Collateral mapCollateralViewRow(com.bank.cims.dto.cbs.CbsCollateralViewRow row, Collateral existing, Customer matchedCustomer, String sourceSystem) {
        Collateral col = existing != null ? existing : new Collateral();
        if (col.getId() == null || col.getId().isBlank()) {
            col.setId("col-cbs-" + UUID.randomUUID().toString().substring(0, 8));
        }

        String colCode = row.getCollateralCode() != null ? row.getCollateralCode().trim() : null;
        col.setCode(colCode);
        col.setCbsCollateralRef(colCode);
        col.setOriginType("CBS_IMPORTED");
        col.setDescription(row.getCollateralDescription());

        // Do not default type, currency, ownerType or segment!
        col.setType(row.getCollateralType());
        col.setCategory(row.getCollateralCategory() != null ? row.getCollateralCategory().toString() : null);
        col.setCurrency(row.getCollateralCurrency());
        col.setOwnerType(row.getOwnerBorrowerRelationship());
        col.setOwningSegment(null); // Explicitly unmapped until organizational routing resolves it
        col.setBranch(resolveBranchName(row.getBranchCode()));
        if (col.getEnrichmentStatus() == null || col.getEnrichmentStatus().isBlank() || "NOT_APPLICABLE".equalsIgnoreCase(col.getEnrichmentStatus())) {
            col.setEnrichmentStatus("PENDING_ENRICHMENT");
        }

        if (row.getCollateralValue() != null) {
            col.setValuationAmount(row.getCollateralValue().doubleValue());
        } else {
            col.setValuationAmount(0.0);
        }

        col.setChargeType(row.getChargeType());
        col.setSecured("Y".equalsIgnoreCase(row.getSecured()));
        col.setTangible("Y".equalsIgnoreCase(row.getTangible()));

        if (row.getStartDate() != null) col.setStartDate(row.getStartDate().toString());
        if (row.getReviewDate() != null) col.setReviewDate(row.getReviewDate().toString());

        if (matchedCustomer != null) {
            col.setCustomerId(matchedCustomer.getId());
        } else if (row.getCollateralOwnerCif() != null) {
            col.setCustomerId(row.getCollateralOwnerCif().trim());
        }

        col.setSource(sourceSystem != null ? sourceSystem : "CBS_ORACLE");
        col.setCbsSyncStatus("Synced");
        col.setCbsSyncedAt(LocalDateTime.now().toString());

        return col;
    }
}
