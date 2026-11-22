package com.bank.cims.service.cbs;

import com.bank.cims.dto.cbs.CbsCollateralViewRow;
import com.bank.cims.dto.cbs.CbsCustomerViewRow;
import com.bank.cims.dto.cbs.CbsFacilityViewRow;
import com.bank.cims.model.*;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

/**
 * Production Oracle Three-View CBS Source Adapter (OracleThreeViewCbsAdapter).
 * Connects directly to CBS Oracle database via JDBC:
 * Target Host: 10.41.30.114:1521 / Service: FCUBUAT / Schema: FCUBSLIVE
 * Permitted Source Egress: CBAIMS Deployment Server 172.22.11.55
 * 
 * Implements strict read-only access to the three CBS Oracle views:
 * 1. FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER (16 columns)
 * 2. FCUBSLIVE.STVWCBS_CBAIMS_FACILITY (15 columns, including FACILTY_ID and SANCATION_AMOUNT)
 * 3. FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL (31 columns, with embedded facility linkages)
 *
 * ZERO write-back to CBS. Passwords strictly redacted from logs and diagnostics.
 */
@Component("realCbsAdapter")
public class RealCbsAdapter implements CbsAdapter {

    private static final Logger log = LoggerFactory.getLogger(RealCbsAdapter.class);

    @Value("${cims.cbs.mode:REAL}")
    private String mode;

    @Value("${cims.cbs.oracle.jdbc-url:jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT}")
    private String jdbcUrl;

    @Value("${cims.cbs.oracle.username:CBAIMSUSER}")
    private String username;

    @Value("${cims.cbs.oracle.password:CBaims@12345!}")
    private String password;

    @Value("${cims.cbs.oracle.schema:FCUBSLIVE}")
    private String schema;

    @Value("${cims.cbs.oracle.customer-view:FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER}")
    private String customerView;

    @Value("${cims.cbs.oracle.facility-view:FCUBSLIVE.STVWCBS_CBAIMS_FACILITY}")
    private String facilityView;

    @Value("${cims.cbs.oracle.collateral-view:FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL}")
    private String collateralView;

    @Value("${cims.cbs.oracle.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${cims.cbs.oracle.read-timeout-ms:15000}")
    private int readTimeoutMs;

    @Value("${cims.cbs.oracle.maximum-pool-size:5}")
    private int maxPoolSize;

    @Value("${cims.cbs.oracle.minimum-idle:1}")
    private int minIdle;

    @Value("${cims.cbs.oracle.fetch-size:500}")
    private int fetchSize;

    private HikariDataSource dataSource;
    private final Object poolLock = new Object();

    // =========================================================================
    // Connection Pool Management
    // =========================================================================

    public boolean isConfigured() {
        return jdbcUrl != null && !jdbcUrl.isBlank()
                && username != null && !username.isBlank()
                && password != null && !password.isBlank();
    }

    private HikariDataSource getDataSource() {
        if (!isConfigured()) {
            throw new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE,
                    "REAL CBS NOT CONFIGURED: Oracle JDBC URL, username, or password is not configured."
            );
        }
        synchronized (poolLock) {
            if (dataSource == null || dataSource.isClosed()) {
                HikariConfig config = new HikariConfig();
                config.setPoolName("CbaimsOraclePool");
                config.setJdbcUrl(jdbcUrl.trim());
                config.setUsername(username.trim());
                config.setPassword(password.trim());
                config.setDriverClassName("oracle.jdbc.OracleDriver");
                config.setMaximumPoolSize(maxPoolSize > 0 ? maxPoolSize : 5);
                config.setMinimumIdle(minIdle >= 0 ? minIdle : 1);
                config.setConnectionTimeout(connectTimeoutMs > 0 ? connectTimeoutMs : 5000);
                config.setValidationTimeout(3000);
                config.setIdleTimeout(30000);
                config.setMaxLifetime(60000);
                config.setReadOnly(true);
                // Security: Prevent auto-commit and ensure strict read-only
                config.setAutoCommit(false);
                config.setConnectionTestQuery("SELECT 1 FROM DUAL");
                dataSource = new HikariDataSource(config);
                log.info("Initialized dedicated read-only Oracle CBS connection pool to {}", redactJdbcUrl(jdbcUrl));
            }
            return dataSource;
        }
    }

    private Connection getReadOnlyConnection() throws SQLException {
        Connection conn = getDataSource().getConnection();
        conn.setReadOnly(true);
        return conn;
    }

    @PreDestroy
    public void closePool() {
        synchronized (poolLock) {
            if (dataSource != null && !dataSource.isClosed()) {
                log.info("Closing Oracle CBS connection pool.");
                dataSource.close();
                dataSource = null;
            }
        }
    }

    public static String redactJdbcUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("(?i):[^/@]+@", ":****@");
    }

    // =========================================================================
    // Truthful Connection Status & Health Check
    // =========================================================================

    @Override
    public CbsConnectionStatus checkConnectionStatus() {
        if (!isConfigured()) {
            return new CbsConnectionStatus(
                    "REAL",
                    "NOT_CONFIGURED",
                    "REAL CBS NOT CONFIGURED: Bank Oracle database credentials (CIMS_CBS_PASSWORD) are not yet configured."
            );
        }

        try (Connection conn = getReadOnlyConnection();
             Statement stmt = conn.createStatement()) {
            stmt.setQueryTimeout(Math.max(1, connectTimeoutMs / 1000));
            try (ResultSet rs = stmt.executeQuery("SELECT 1 FROM DUAL")) {
                if (rs.next()) {
                    return new CbsConnectionStatus(
                            "REAL",
                            "AVAILABLE",
                            "Real CBS Oracle database connected successfully to " + redactJdbcUrl(jdbcUrl) + " (Schema: " + schema + ")"
                    );
                }
            }
        } catch (SQLException e) {
            return classifySqlException(e);
        } catch (Exception e) {
            Throwable root = e;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            if (root instanceof SQLException sqlEx) {
                return classifySqlException(sqlEx);
            }
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.toLowerCase().contains("the network adapter could not establish the connection")
                    || msg.toLowerCase().contains("io error")
                    || msg.toLowerCase().contains("timed out")
                    || msg.toLowerCase().contains("connection refused")) {
                return new CbsConnectionStatus("REAL", "NETWORK_UNAVAILABLE", "Cannot reach Oracle server at " + redactJdbcUrl(jdbcUrl) + ": Network connection timed out / host unreachable from this environment.");
            }
            return new CbsConnectionStatus("REAL", "ERROR", "Unexpected connection error: " + e.getMessage());
        }

        return new CbsConnectionStatus("REAL", "QUERY_FAILED", "Unexpected response from Oracle DUAL check");
    }

    private CbsConnectionStatus classifySqlException(SQLException e) {
        int errorCode = e.getErrorCode();
        String msg = e.getMessage() != null ? e.getMessage() : "Unknown Oracle error";

        if (errorCode == 1017) { // ORA-01017: invalid username/password
            log.error("Oracle authentication failed for user {}", username);
            return new CbsConnectionStatus("REAL", "AUTHENTICATION_FAILED", "Authentication failed for Oracle user: " + username);
        } else if (errorCode == 942) { // ORA-00942: table or view does not exist
            return new CbsConnectionStatus("REAL", "VIEW_ACCESS_DENIED", "One or more required views do not exist or access is denied in schema " + schema);
        } else if (msg.toLowerCase().contains("the network adapter could not establish the connection")
                || msg.toLowerCase().contains("io error")
                || msg.toLowerCase().contains("io exception")
                || msg.toLowerCase().contains("socket")
                || msg.toLowerCase().contains("timed out")
                || msg.toLowerCase().contains("connection refused")) {
            return new CbsConnectionStatus("REAL", "NETWORK_UNAVAILABLE", "Cannot reach Oracle server at " + redactJdbcUrl(jdbcUrl) + ": Network connection timed out / host unreachable from this environment.");
        }
        return new CbsConnectionStatus("REAL", "QUERY_FAILED", "Oracle connection error (ORA-" + errorCode + "): " + msg);
    }

    // =========================================================================
    // Schema Validation for all 3 views (62 columns total)
    // =========================================================================

    @Override
    public Map<String, Object> validateSchema() {
        Map<String, Object> result = new LinkedHashMap<>();
        if (!isConfigured()) {
            result.put("status", "NOT_CONFIGURED");
            result.put("message", "Oracle database credentials not configured.");
            return result;
        }

        List<String> expectedCustomerCols = List.of(
                "CUSTOMER_NO", "CUSTOMER_NAME1", "CUSTOMER_TYPE", "P_NATIONAL_ID",
                "PASSPORT_NO", "MOBILE_NUMBER", "E_MAIL", "TAXID_NO", "ADDRESS",
                "CUSTOMER_STATUS", "BUSINESS_SEGMENT", "RM_CODE", "BRANCH_CODE",
                "MAKER_DATE", "RECORD_STAT", "AUTH_STAT"
        );

        List<String> expectedFacilityCols = List.of(
                "ACCOUNT_NUMBER", "CUSTOMER_ID", "CUSTOMER_TYPE", "FACILTY_ID",
                "BRANCH_CODE", "PRODUCT_CODE", "BUSINESS_SEGMENT", "SANCATION_AMOUNT",
                "OUTSTANDING_BALANCE", "MATURITY_DATE", "ACCOUNT_STATUS", "VALUE_DATE",
                "LOAN_STATUS", "BOOK_DATE", "AUTH_STAT"
        );

        List<String> expectedCollateralCols = List.of(
                "COLLATERAL_CODE", "COLLATERAL_TYPE", "COLLATERAL_DESCRIPTION",
                "COLLATERAL_VALUE", "VALUATION_DATE", "RECORD_STAT", "COLLATERAL_OWNER_CIF",
                "COLLATERAL_CATEGORY", "COLLATERAL_CURRENCY", "START_DATE", "END_DATE",
                "REVIEW_DATE", "CHARGE_TYPE", "SECURED", "TANGIBLE", "BRANCH_CODE",
                "AUTH_STAT", "ACCOUNT_NUMBER", "FACILITY_ID", "LINKAGE_TYPE",
                "LIMIT_AMOUNT", "ALLOCATION_PERCENT", "LINKED_AMOUNT", "CATEGORY_ID",
                "STATUS", "EFFECTIVE_DATE", "UTIL_ORDER", "MAKER_DATE", "BORROWER_CIF",
                "OWNER_BORROWER_RELATIONSHIP", "GUARANTEE_INDICATOR"
        );

        Map<String, List<String>> missingColsByView = new LinkedHashMap<>();
        Map<String, List<String>> verifiedColsByView = new LinkedHashMap<>();
        int totalColsVerified = 0;

        try (Connection conn = getReadOnlyConnection()) {
            DatabaseMetaData meta = conn.getMetaData();

            validateViewColumns(meta, customerView, expectedCustomerCols, missingColsByView, verifiedColsByView);
            validateViewColumns(meta, facilityView, expectedFacilityCols, missingColsByView, verifiedColsByView);
            validateViewColumns(meta, collateralView, expectedCollateralCols, missingColsByView, verifiedColsByView);

            for (List<String> verified : verifiedColsByView.values()) {
                totalColsVerified += verified.size();
            }

            if (missingColsByView.isEmpty() && totalColsVerified == 62) {
                result.put("status", "AVAILABLE");
                result.put("message", "All 3 Oracle views and all 62 columns validated successfully against " + schema);
                result.put("totalColumnsVerified", totalColsVerified);
                result.put("views", verifiedColsByView);
            } else {
                result.put("status", "SCHEMA_MISMATCH");
                result.put("message", "Schema mismatch: missing required columns in Oracle views");
                result.put("missingColumns", missingColsByView);
                result.put("verifiedColumns", verifiedColsByView);
                result.put("totalColumnsVerified", totalColsVerified);
            }
        } catch (SQLException e) {
            log.error("Failed to validate schema against Oracle database", e);
            result.put("status", "QUERY_FAILED");
            result.put("message", "Schema validation query failed: " + e.getMessage());
        }

        return result;
    }

    private void validateViewColumns(DatabaseMetaData meta, String fullViewName, List<String> expectedCols,
                                     Map<String, List<String>> missingMap, Map<String, List<String>> verifiedMap) throws SQLException {
        String viewOnly = fullViewName.contains(".") ? fullViewName.substring(fullViewName.indexOf('.') + 1) : fullViewName;
        String viewSchema = fullViewName.contains(".") ? fullViewName.substring(0, fullViewName.indexOf('.')) : schema;

        Set<String> actualCols = new HashSet<>();
        try (ResultSet rs = meta.getColumns(null, viewSchema.toUpperCase(), viewOnly.toUpperCase(), null)) {
            while (rs.next()) {
                actualCols.add(rs.getString("COLUMN_NAME").toUpperCase());
            }
        }

        // Fallback: If metadata search with schema is empty, try without schema prefix
        if (actualCols.isEmpty()) {
            try (ResultSet rs = meta.getColumns(null, null, viewOnly.toUpperCase(), null)) {
                while (rs.next()) {
                    actualCols.add(rs.getString("COLUMN_NAME").toUpperCase());
                }
            }
        }

        List<String> missing = new ArrayList<>();
        List<String> verified = new ArrayList<>();

        for (String expected : expectedCols) {
            if (actualCols.contains(expected.toUpperCase())) {
                verified.add(expected);
            } else {
                missing.add(expected);
            }
        }

        if (!missing.isEmpty()) {
            missingMap.put(fullViewName, missing);
        }
        verifiedMap.put(fullViewName, verified);
    }

    // =========================================================================
    // 3-View Queries: Customers, Facilities, Collateral
    // =========================================================================

    @Override
    public List<CbsCustomerViewRow> fetchCustomerViewRows() {
        String sql = "SELECT CUSTOMER_NO, CUSTOMER_NAME1, CUSTOMER_TYPE, P_NATIONAL_ID, PASSPORT_NO, " +
                "MOBILE_NUMBER, E_MAIL, TAXID_NO, ADDRESS, CUSTOMER_STATUS, BUSINESS_SEGMENT, RM_CODE, " +
                "BRANCH_CODE, MAKER_DATE, RECORD_STAT, AUTH_STAT FROM " + customerView;

        List<CbsCustomerViewRow> rows = new ArrayList<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setQueryTimeout(Math.max(1, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 500);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CbsCustomerViewRow row = new CbsCustomerViewRow();
                    row.setCustomerNo(rs.getString("CUSTOMER_NO"));
                    row.setCustomerName1(rs.getString("CUSTOMER_NAME1"));
                    row.setCustomerType(rs.getString("CUSTOMER_TYPE"));
                    row.setPNationalId(rs.getString("P_NATIONAL_ID"));
                    row.setPassportNo(rs.getString("PASSPORT_NO"));
                    row.setMobileNumber(rs.getString("MOBILE_NUMBER"));
                    row.setEmail(rs.getString("E_MAIL"));
                    row.setTaxidNo(rs.getString("TAXID_NO"));
                    row.setAddress(rs.getString("ADDRESS"));
                    row.setCustomerStatus(rs.getString("CUSTOMER_STATUS"));
                    row.setBusinessSegment(rs.getString("BUSINESS_SEGMENT"));
                    row.setRmCode(rs.getString("RM_CODE"));
                    row.setBranchCode(rs.getString("BRANCH_CODE"));
                    row.setMakerDate(rs.getString("MAKER_DATE")); // String preserved per spec
                    row.setRecordStat(rs.getString("RECORD_STAT"));
                    row.setAuthStat(rs.getString("AUTH_STAT"));
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Customer view: {}", customerView, e);
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED, "Failed to query CBS Customer View: " + e.getMessage());
        }
        return rows;
    }

    @Override
    public List<CbsFacilityViewRow> fetchFacilityViewRows() {
        // Preserving exact column names FACILTY_ID and SANCATION_AMOUNT
        String sql = "SELECT ACCOUNT_NUMBER, CUSTOMER_ID, CUSTOMER_TYPE, FACILTY_ID, BRANCH_CODE, " +
                "PRODUCT_CODE, BUSINESS_SEGMENT, SANCATION_AMOUNT, OUTSTANDING_BALANCE, MATURITY_DATE, " +
                "ACCOUNT_STATUS, VALUE_DATE, LOAN_STATUS, BOOK_DATE, AUTH_STAT FROM " + facilityView;

        List<CbsFacilityViewRow> rows = new ArrayList<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setQueryTimeout(Math.max(1, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 500);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CbsFacilityViewRow row = new CbsFacilityViewRow();
                    row.setAccountNumber(rs.getString("ACCOUNT_NUMBER"));
                    row.setCustomerId(rs.getString("CUSTOMER_ID"));
                    row.setCustomerType(rs.getString("CUSTOMER_TYPE"));
                    row.setFaciltyId(rs.getBigDecimal("FACILTY_ID"));
                    row.setBranchCode(rs.getString("BRANCH_CODE"));
                    row.setProductCode(rs.getString("PRODUCT_CODE"));
                    row.setBusinessSegment(rs.getString("BUSINESS_SEGMENT"));
                    row.setSancationAmount(rs.getBigDecimal("SANCATION_AMOUNT"));
                    row.setOutstandingBalance(rs.getBigDecimal("OUTSTANDING_BALANCE"));

                    java.sql.Date matDate = rs.getDate("MATURITY_DATE");
                    if (matDate != null) row.setMaturityDate(matDate.toLocalDate());

                    row.setAccountStatus(rs.getString("ACCOUNT_STATUS"));

                    java.sql.Date valDate = rs.getDate("VALUE_DATE");
                    if (valDate != null) row.setValueDate(valDate.toLocalDate());

                    row.setLoanStatus(rs.getString("LOAN_STATUS"));

                    java.sql.Date bookDate = rs.getDate("BOOK_DATE");
                    if (bookDate != null) row.setBookDate(bookDate.toLocalDate());

                    row.setAuthStat(rs.getString("AUTH_STAT"));
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Facility view: {}", facilityView, e);
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED, "Failed to query CBS Facility View: " + e.getMessage());
        }
        return rows;
    }

    @Override
    public List<CbsCollateralViewRow> fetchCollateralViewRows() {
        String sql = "SELECT COLLATERAL_CODE, COLLATERAL_TYPE, COLLATERAL_DESCRIPTION, COLLATERAL_VALUE, " +
                "VALUATION_DATE, RECORD_STAT, COLLATERAL_OWNER_CIF, COLLATERAL_CATEGORY, COLLATERAL_CURRENCY, " +
                "START_DATE, END_DATE, REVIEW_DATE, CHARGE_TYPE, SECURED, TANGIBLE, BRANCH_CODE, AUTH_STAT, " +
                "ACCOUNT_NUMBER, FACILITY_ID, LINKAGE_TYPE, LIMIT_AMOUNT, ALLOCATION_PERCENT, LINKED_AMOUNT, " +
                "CATEGORY_ID, STATUS, EFFECTIVE_DATE, UTIL_ORDER, MAKER_DATE, BORROWER_CIF, " +
                "OWNER_BORROWER_RELATIONSHIP, GUARANTEE_INDICATOR FROM " + collateralView;

        List<CbsCollateralViewRow> rows = new ArrayList<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setQueryTimeout(Math.max(1, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 500);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CbsCollateralViewRow row = new CbsCollateralViewRow();
                    row.setCollateralCode(rs.getString("COLLATERAL_CODE"));
                    row.setCollateralType(rs.getString("COLLATERAL_TYPE"));
                    row.setCollateralDescription(rs.getString("COLLATERAL_DESCRIPTION"));
                    row.setCollateralValue(rs.getBigDecimal("COLLATERAL_VALUE"));

                    java.sql.Date valDate = rs.getDate("VALUATION_DATE");
                    if (valDate != null) row.setValuationDate(valDate.toLocalDate());

                    row.setRecordStat(rs.getString("RECORD_STAT"));
                    row.setCollateralOwnerCif(rs.getString("COLLATERAL_OWNER_CIF"));
                    row.setCollateralCategory(rs.getBigDecimal("COLLATERAL_CATEGORY"));
                    row.setCollateralCurrency(rs.getString("COLLATERAL_CURRENCY"));

                    java.sql.Date startDate = rs.getDate("START_DATE");
                    if (startDate != null) row.setStartDate(startDate.toLocalDate());

                    java.sql.Date endDate = rs.getDate("END_DATE");
                    if (endDate != null) row.setEndDate(endDate.toLocalDate());

                    java.sql.Date reviewDate = rs.getDate("REVIEW_DATE");
                    if (reviewDate != null) row.setReviewDate(reviewDate.toLocalDate());

                    row.setChargeType(rs.getString("CHARGE_TYPE"));
                    row.setSecured(rs.getString("SECURED"));
                    row.setTangible(rs.getString("TANGIBLE"));
                    row.setBranchCode(rs.getString("BRANCH_CODE"));
                    row.setAuthStat(rs.getString("AUTH_STAT"));

                    // Embedded linkage fields
                    row.setAccountNumber(rs.getString("ACCOUNT_NUMBER"));
                    row.setFacilityId(rs.getBigDecimal("FACILITY_ID"));
                    row.setLinkageType(rs.getString("LINKAGE_TYPE"));
                    row.setLimitAmount(rs.getBigDecimal("LIMIT_AMOUNT"));
                    row.setAllocationPercent(rs.getBigDecimal("ALLOCATION_PERCENT"));
                    row.setLinkedAmount(rs.getBigDecimal("LINKED_AMOUNT"));
                    row.setCategoryId(rs.getBigDecimal("CATEGORY_ID"));
                    row.setStatus(rs.getString("STATUS"));

                    java.sql.Date effDate = rs.getDate("EFFECTIVE_DATE");
                    if (effDate != null) row.setEffectiveDate(effDate.toLocalDate());

                    row.setUtilOrder(rs.getBigDecimal("UTIL_ORDER"));

                    java.sql.Date makerDate = rs.getDate("MAKER_DATE");
                    if (makerDate != null) row.setMakerDate(makerDate.toLocalDate());

                    row.setBorrowerCif(rs.getString("BORROWER_CIF"));
                    row.setOwnerBorrowerRelationship(rs.getString("OWNER_BORROWER_RELATIONSHIP"));
                    row.setGuaranteeIndicator(rs.getString("GUARANTEE_INDICATOR"));

                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Collateral view: {}", collateralView, e);
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED, "Failed to query CBS Collateral View: " + e.getMessage());
        }
        return rows;
    }

    // =========================================================================
    // Legacy CbsAdapter Contract Support
    // Maps 3-view rows onto legacy Cbs models if called
    // =========================================================================

    @Override
    public List<CbsCustomer> fetchCustomers() {
        List<CbsCustomerViewRow> rows = fetchCustomerViewRows();
        List<CbsCustomer> list = new ArrayList<>();
        for (CbsCustomerViewRow r : rows) {
            CbsCustomer c = new CbsCustomer();
            c.setId(r.getCustomerNo());
            c.setCif(r.getCustomerNo());
            c.setFullName(r.getCustomerName1());
            c.setCustomerType(r.getCustomerType());
            c.setNationalId(r.getPNationalId());
            c.setBusinessRegNo(r.getPassportNo());
            c.setPhone(r.getMobileNumber() != null ? r.getMobileNumber() : "");
            c.setEmail(r.getEmail());
            c.setAddress(r.getAddress());
            c.setTaxIdNo(r.getTaxidNo());
            c.setBusinessSegment(r.getBusinessSegment() != null ? r.getBusinessSegment() : "");
            c.setBranch(r.getBranchCode() != null ? r.getBranchCode() : "");
            c.setCustomerStatus(r.getCustomerStatus());
            list.add(c);
        }
        return list;
    }

    @Override
    public Optional<CbsCustomer> fetchCustomerByCif(String cif) {
        if (cif == null) return Optional.empty();
        return fetchCustomers().stream()
                .filter(c -> cif.equalsIgnoreCase(c.getCif()))
                .findFirst();
    }

    @Override
    public List<CbsFacility> fetchFacilities() {
        List<CbsFacilityViewRow> rows = fetchFacilityViewRows();
        List<CbsFacility> list = new ArrayList<>();
        for (CbsFacilityViewRow r : rows) {
            CbsFacility f = new CbsFacility();
            f.setId(r.getAccountNumber());
            f.setLoanRefNo(r.getAccountNumber());
            f.setLineCode(r.getFaciltyId() != null ? r.getFaciltyId().toPlainString() : r.getAccountNumber());
            f.setCustomerCif(r.getCustomerId());
            f.setFacilityType(r.getProductCode() != null ? r.getProductCode() : "Term Loan");
            f.setBranch(r.getBranchCode() != null ? r.getBranchCode() : "");
            f.setBusinessSegment(r.getBusinessSegment() != null ? r.getBusinessSegment() : "");
            f.setApprovedLimit(r.getSancationAmount() != null ? r.getSancationAmount().doubleValue() : 0.0);
            f.setOutstandingAmount(r.getOutstandingBalance() != null ? r.getOutstandingBalance().doubleValue() : 0.0);
            f.setAvailableAmount(0.0);
            if (r.getMaturityDate() != null) f.setLineExpiryDate(r.getMaturityDate().toString());
            list.add(f);
        }
        return list;
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        if (customerCif == null) return List.of();
        return fetchFacilities().stream()
                .filter(f -> customerCif.equalsIgnoreCase(f.getCustomerCif()))
                .toList();
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference) {
        if (loanReference == null) return Optional.empty();
        return fetchFacilities().stream()
                .filter(f -> loanReference.equalsIgnoreCase(f.getLoanRefNo()))
                .findFirst();
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLineCode(String lineCode) {
        if (lineCode == null) return Optional.empty();
        return fetchFacilities().stream()
                .filter(f -> lineCode.equalsIgnoreCase(f.getLineCode()))
                .findFirst();
    }

    @Override
    public List<CbsCollateral> fetchCollaterals() {
        List<CbsCollateralViewRow> rows = fetchCollateralViewRows();
        Map<String, CbsCollateral> colMap = new LinkedHashMap<>();
        for (CbsCollateralViewRow r : rows) {
            if (r.getCollateralCode() == null || r.getCollateralCode().isBlank()) continue;
            String code = r.getCollateralCode().trim();
            if (!colMap.containsKey(code)) {
                CbsCollateral c = new CbsCollateral();
                c.setId(code);
                c.setCollateralCode(code);
                c.setCollateralType(r.getCollateralType());
                c.setDescription(r.getCollateralDescription());
                c.setCollateralValue(r.getCollateralValue() != null ? r.getCollateralValue().doubleValue() : 0.0);
                c.setCustomerCif(r.getCollateralOwnerCif());
                c.setCurrency(r.getCollateralCurrency());
                c.setBranch(r.getBranchCode());
                c.setTangible("Y".equalsIgnoreCase(r.getTangible()));
                c.setLinkedAccountNo(r.getAccountNumber());
                colMap.put(code, c);
            }
        }
        return new ArrayList<>(colMap.values());
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        if (customerCif == null) return List.of();
        return fetchCollaterals().stream()
                .filter(c -> customerCif.equalsIgnoreCase(c.getCustomerCif()))
                .toList();
    }

    @Override
    public Optional<CbsCollateral> fetchCollateralByCode(String collateralCode) {
        if (collateralCode == null) return Optional.empty();
        return fetchCollaterals().stream()
                .filter(c -> collateralCode.equalsIgnoreCase(c.getCollateralCode()))
                .findFirst();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        if (accountNumber == null) return List.of();
        return fetchAllAccountCollateralLinks().stream()
                .filter(l -> accountNumber.equalsIgnoreCase(l.getAccountNumber()))
                .toList();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks() {
        List<CbsCollateralViewRow> rows = fetchCollateralViewRows();
        List<CbsAccCollLinkDtls> links = new ArrayList<>();
        for (CbsCollateralViewRow r : rows) {
            if (r.getAccountNumber() != null && !r.getAccountNumber().isBlank()) {
                CbsAccCollLinkDtls link = new CbsAccCollLinkDtls();
                link.setId("link-" + UUID.randomUUID().toString().substring(0, 8));
                link.setAccountNumber(r.getAccountNumber().trim());
                link.setLinkedReferenceNo(r.getCollateralCode());
                link.setBranchCode(r.getBranchCode());
                link.setLinkageType(r.getLinkageType());
                link.setLinkedAmount(r.getLinkedAmount() != null ? r.getLinkedAmount().doubleValue() : 0.0);
                link.setLimitAmount(r.getLimitAmount() != null ? r.getLimitAmount().doubleValue() : 0.0);
                links.add(link);
            }
        }
        return links;
    }
}
