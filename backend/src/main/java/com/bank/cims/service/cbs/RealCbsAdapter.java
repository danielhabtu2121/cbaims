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
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Production Oracle Three-View CBS Source Adapter (OracleThreeViewCbsAdapter).
 * Connects directly to CBS Oracle database via JDBC:
 * Target Host: 10.41.30.114:1521 / Service: FCUBUAT / Schema: FCUBSLIVE
 * Permitted Source Egress: CBAIMS Deployment Server 172.22.10.55
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

    @Value("${cims.cbs.mode:SIMULATOR}")
    private String mode;

    @Value("${cims.cbs.oracle.jdbc-url:jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT}")
    private String jdbcUrl;

    @Value("${cims.cbs.oracle.username:CBAIMSUSER}")
    private String username;

    @Value("${cims.cbs.oracle.password:}")
    private String password;

    @Value("${cims.cbs.oracle.schema:FCUBSLIVE}")
    private String schema;

    @Value("${cims.cbs.oracle.customer-view:FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER}")
    private String customerView;

    @Value("${cims.cbs.oracle.facility-view:FCUBSLIVE.STVWCBS_CBAIMS_FACILITY}")
    private String facilityView;

    @Value("${cims.cbs.oracle.collateral-view:FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL}")
    private String collateralView;

    @Value("${cims.cbs.oracle.connect-timeout-ms:10000}")
    private int connectTimeoutMs;

    @Value("${cims.cbs.oracle.read-timeout-ms:300000}")
    private int readTimeoutMs;

    @Value("${cims.cbs.oracle.maximum-pool-size:10}")
    private int maxPoolSize;

    @Value("${cims.cbs.oracle.minimum-idle:2}")
    private int minIdle;

    @Value("${cims.cbs.oracle.fetch-size:2000}")
    private int fetchSize;

    @Value("${cims.cbs.oracle.customer-filter:}")
    private String customerFilter;

    private HikariDataSource dataSource;
    private final Object poolLock = new Object();

    // Short-lived cache to avoid querying the large collateral view twice during batch sync
    private volatile List<CbsCollateralViewRow> cachedCollateralRows;
    private volatile long cachedCollateralRowsTime = 0;

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
                config.setMaximumPoolSize(maxPoolSize > 0 ? maxPoolSize : 10);
                config.setMinimumIdle(minIdle >= 0 ? minIdle : 2);
                config.setConnectionTimeout(60000);
                config.setValidationTimeout(5000);
                config.setIdleTimeout(30000);
                config.setMaxLifetime(60000);
                config.setReadOnly(true);
                // Security: Prevent auto-commit and ensure strict read-only
                config.setAutoCommit(false);
                config.setConnectionTestQuery("SELECT 1 FROM DUAL");

                // Critical firewall and packet integrity settings to prevent ORA-12592 (TNS:bad packet):
                // Disable Out-Of-Band (TCP URG) data which stateful firewalls drop or strip
                System.setProperty("oracle.net.disableOob", "true");
                config.addDataSourceProperty("oracle.net.disableOob", "true");
                config.addDataSourceProperty("oracle.net.keepAlive", "true");
                config.addDataSourceProperty("oracle.net.sdu", "32767");
                config.addDataSourceProperty("oracle.jdbc.ReadTimeout", String.valueOf(readTimeoutMs > 0 ? readTimeoutMs : 300000));
                config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", String.valueOf(connectTimeoutMs > 0 ? connectTimeoutMs : 10000));

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

    public synchronized void updateConfig(String newJdbcUrl, String newUsername, String newPassword, String newSchema,
                                         String newCustomerView, String newFacilityView, String newCollateralView) {
        if (newJdbcUrl != null && !newJdbcUrl.isBlank() && !newJdbcUrl.contains("****")) {
            this.jdbcUrl = newJdbcUrl.trim();
        }
        if (newUsername != null && !newUsername.isBlank()) this.username = newUsername.trim();
        if (newPassword != null && !newPassword.isBlank() && !newPassword.trim().matches("^[*•]+$")) {
            this.password = newPassword.trim();
        }
        if (newSchema != null && !newSchema.isBlank()) this.schema = newSchema.trim();
        if (newCustomerView != null && !newCustomerView.isBlank()) this.customerView = newCustomerView.trim();
        if (newFacilityView != null && !newFacilityView.isBlank()) this.facilityView = newFacilityView.trim();
        if (newCollateralView != null && !newCollateralView.isBlank()) this.collateralView = newCollateralView.trim();
        closePool();
        log.info("Updated Oracle CBS configuration: url={}, user={}, schema={}", redactJdbcUrl(this.jdbcUrl), this.username, this.schema);
    }

    public Map<String, Object> getConfigSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("jdbcUrl", jdbcUrl != null ? redactJdbcUrl(jdbcUrl) : "");
        summary.put("rawJdbcUrl", jdbcUrl != null ? jdbcUrl : "");
        summary.put("username", username != null ? username : "");
        summary.put("hasPassword", password != null && !password.isBlank());
        summary.put("schema", schema != null ? schema : "");
        summary.put("customerView", customerView != null ? customerView : "");
        summary.put("facilityView", facilityView != null ? facilityView : "");
        summary.put("collateralView", collateralView != null ? collateralView : "");
        summary.put("isConfigured", isConfigured());
        return summary;
    }

    public CbsConnectionStatus testAdhocConnection(String testUrl, String testUser, String testPass) {
        String url = (testUrl != null && !testUrl.isBlank()) ? testUrl.trim() : this.jdbcUrl;
        String user = (testUser != null && !testUser.isBlank()) ? testUser.trim() : this.username;
        String pass = (testPass != null && !testPass.isBlank()) ? testPass.trim() : this.password;

        if (url == null || url.isBlank() || user == null || user.isBlank() || pass == null || pass.isBlank()) {
            return new CbsConnectionStatus(
                    "REAL",
                    "NOT_CONFIGURED",
                    "Oracle JDBC URL, username, or password is not provided."
            );
        }

        try {
            Class.forName("oracle.jdbc.OracleDriver");
            System.setProperty("oracle.net.disableOob", "true");
            DriverManager.setLoginTimeout(Math.max(1, connectTimeoutMs / 1000));
            Properties props = new Properties();
            props.put("user", user);
            props.put("password", pass);
            props.put("oracle.net.disableOob", "true");
            props.put("oracle.net.keepAlive", "true");
            props.put("oracle.net.sdu", "32767");
            try (Connection conn = DriverManager.getConnection(url, props);
                 Statement stmt = conn.createStatement()) {
                stmt.setQueryTimeout(Math.max(1, connectTimeoutMs / 1000));
                try (ResultSet rs = stmt.executeQuery("SELECT 1 FROM DUAL")) {
                    if (rs.next()) {
                        return new CbsConnectionStatus(
                                "REAL",
                                "AVAILABLE",
                                "Connected successfully to " + redactJdbcUrl(url) + " as " + user
                        );
                    }
                }
            }
        } catch (SQLException e) {
            return classifySqlException(e);
        } catch (ClassNotFoundException e) {
            return new CbsConnectionStatus("REAL", "ERROR", "Oracle JDBC driver class not found: " + e.getMessage());
        } catch (Exception e) {
            return new CbsConnectionStatus("REAL", "ERROR", "Connection failed: " + e.getMessage());
        }
        return new CbsConnectionStatus("REAL", "QUERY_FAILED", "Unexpected response from Oracle DUAL test");
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
        } else if (errorCode == 12592 || msg.contains("ORA-12592") || msg.toLowerCase().contains("bad packet")) {
            return new CbsConnectionStatus("REAL", "NETWORK_PROTOCOL_ERROR",
                    "Oracle TNS packet corrupted (ORA-12592: TNS:bad packet). Corporate firewall dropped Out-Of-Band (URG) packets or split TNS frame. Ensure oracle.net.disableOob=true and fetchSize <= 100.");
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

    public CbsSyncException classifyQueryException(String viewName, SQLException e) {
        int errorCode = e.getErrorCode();
        String msg = e.getMessage() != null ? e.getMessage() : "";
        String msgLower = msg.toLowerCase();

        boolean isTimeout = e instanceof java.sql.SQLRecoverableException
                || e.getCause() instanceof java.net.SocketTimeoutException
                || msgLower.contains("socket read timed out")
                || msgLower.contains("read timed out")
                || msgLower.contains("query timed out")
                || msgLower.contains("statement cancelled")
                || msgLower.contains("ora-01013")
                || errorCode == 1013;

        if (isTimeout) {
            log.error("Oracle CBS query timed out on view {} after configured read timeout ({}ms): {}", viewName, readTimeoutMs, msg);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_TIMEOUT,
                    "CBS Oracle view query timed out reading from " + viewName + " after configured read timeout (" + readTimeoutMs + "ms).",
                    viewName,
                    e
            );
        }

        if (msgLower.contains("connection is not available") || msgLower.contains("request timed out")) {
            log.error("Oracle CBS connection pool busy or timed out on view {}: {}", viewName, msg);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_TIMEOUT,
                    "CBS Oracle connection pool timed out waiting for connection on view " + viewName + ": " + msg,
                    viewName,
                    e
            );
        }

        if (errorCode == 1017) {
            log.error("Oracle CBS authentication failed for user on view {}", viewName);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_AUTHENTICATION_ERROR,
                    "CBS Oracle authentication failed for user on view " + viewName,
                    viewName,
                    e
            );
        }

        if (errorCode == 942) {
            log.error("Oracle CBS view {} does not exist or access denied", viewName);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SCHEMA_MISMATCH,
                    "CBS Oracle view does not exist or access denied: " + viewName,
                    viewName,
                    e
            );
        }

        if (errorCode == 12592 || msgLower.contains("ora-12592") || msgLower.contains("bad packet")) {
            log.error("Oracle CBS network protocol packet corruption (ORA-12592) on view {}", viewName);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED,
                    "CBS Oracle TNS bad packet (ORA-12592) on view " + viewName + ". Stateful firewall dropped out-of-band data.",
                    viewName,
                    e
            );
        }

        if (msgLower.contains("the network adapter could not establish the connection")
                || msgLower.contains("connection refused")
                || errorCode == 12541
                || errorCode == 12514) {
            log.error("Oracle CBS database unreachable for view {}: {}", viewName, msg);
            return new CbsSyncException(
                    CbsSyncException.ErrorCode.SOURCE_NOT_AVAILABLE,
                    "CBS Oracle database is unreachable at " + redactJdbcUrl(jdbcUrl) + " for view " + viewName,
                    viewName,
                    e
            );
        }

        log.error("Oracle CBS query failed on view {}: {}", viewName, msg);
        return new CbsSyncException(
                CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED,
                "Failed to query CBS view " + viewName + ": " + msg,
                viewName,
                e
        );
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
    // 3-View Row Mappers
    // =========================================================================

    private CbsCustomerViewRow mapCustomerRow(ResultSet rs) throws SQLException {
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
        return row;
    }

    private CbsFacilityViewRow mapFacilityRow(ResultSet rs) throws SQLException {
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
        return row;
    }

    private CbsCollateralViewRow mapCollateralRow(ResultSet rs) throws SQLException {
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
        return row;
    }

    private CbsCustomer mapToCbsCustomer(CbsCustomerViewRow r) {
        CbsCustomer c = new CbsCustomer();
        c.setId(r.getCustomerNo());
        c.setCif(r.getCustomerNo());
        String name = r.getCustomerName1();
        if (name == null || name.isBlank()) {
            name = (r.getCustomerNo() != null && !r.getCustomerNo().isBlank())
                    ? "CBS Customer " + r.getCustomerNo().trim()
                    : "Unnamed Customer";
        }
        c.setFullName(name.trim());
        c.setCustomerType(r.getCustomerType() != null && !r.getCustomerType().isBlank() ? r.getCustomerType() : "Individual");
        c.setNationalId(r.getPNationalId());
        c.setBusinessRegNo(r.getPassportNo());
        c.setPhone(r.getMobileNumber() != null ? r.getMobileNumber() : "");
        c.setEmail(r.getEmail());
        c.setAddress(r.getAddress());
        c.setTaxIdNo(r.getTaxidNo());
        c.setBusinessSegment(r.getBusinessSegment() != null && !r.getBusinessSegment().isBlank() ? r.getBusinessSegment().trim() : "General");
        c.setBranch(r.getBranchCode() != null ? r.getBranchCode() : "");
        c.setCustomerStatus(r.getCustomerStatus() != null && !r.getCustomerStatus().isBlank() ? r.getCustomerStatus() : "Active");
        return c;
    }

    private CbsFacility mapToCbsFacility(CbsFacilityViewRow r) {
        CbsFacility f = new CbsFacility();
        String loanRef = (r.getAccountNumber() != null && !r.getAccountNumber().isBlank())
                ? r.getAccountNumber().trim()
                : (r.getFaciltyId() != null ? "FAC-" + r.getFaciltyId().toPlainString() : null);
        if (loanRef == null && r.getCustomerId() != null && !r.getCustomerId().isBlank()) {
            String prod = r.getProductCode() != null && !r.getProductCode().isBlank() ? r.getProductCode().trim() : "LN";
            String br = r.getBranchCode() != null && !r.getBranchCode().isBlank() ? r.getBranchCode().trim() : "000";
            loanRef = "LINE-" + br + "-" + r.getCustomerId().trim() + "-" + prod;
        }
        f.setId(loanRef);
        f.setLoanRefNo(loanRef);
        f.setLineCode(r.getFaciltyId() != null ? r.getFaciltyId().toPlainString() : loanRef);
        f.setCustomerCif(r.getCustomerId());
        f.setFacilityType(r.getProductCode() != null ? r.getProductCode() : "Term Loan");
        f.setBranch(r.getBranchCode() != null ? r.getBranchCode() : "");
        f.setBusinessSegment(r.getBusinessSegment() != null ? r.getBusinessSegment() : "");
        f.setApprovedLimit(r.getSancationAmount() != null ? r.getSancationAmount().doubleValue() : 0.0);
        f.setOutstandingAmount(r.getOutstandingBalance() != null ? r.getOutstandingBalance().doubleValue() : 0.0);
        f.setAvailableAmount(0.0);
        if (r.getMaturityDate() != null) f.setLineExpiryDate(r.getMaturityDate().toString());
        return f;
    }

    private CbsCollateral mapToCbsCollateral(CbsCollateralViewRow r) {
        CbsCollateral c = new CbsCollateral();
        String code = r.getCollateralCode() != null ? r.getCollateralCode().trim() : "";
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
        return c;
    }

    // =========================================================================
    // 3-View Streaming & Batch Queries
    // =========================================================================

    @Override
    public void streamCustomerViewRows(java.util.function.Consumer<CbsCustomerViewRow> consumer, int maxRows) {
        log.info("Querying CBS Customer view: {} (timeout: {}ms, fetchSize: {})", customerView, readTimeoutMs, fetchSize);
        long startMs = System.currentTimeMillis();
        String filterClause = "";
        if (customerFilter != null && !customerFilter.isBlank()) {
            if (!"NONE".equalsIgnoreCase(customerFilter.trim())) {
                filterClause = " " + customerFilter.trim();
            }
        } else {
            // Intelligent domain scoping: Only query customers associated with credit facilities and collaterals
            // This prevents scanning 10.9 million retail/deposit accounts with zero collateral.
            filterClause = " WHERE CUSTOMER_NO IN (" +
                    "SELECT CUSTOMER_ID FROM " + facilityView + " WHERE CUSTOMER_ID IS NOT NULL " +
                    "UNION " +
                    "SELECT COLLATERAL_OWNER_CIF FROM " + collateralView + " WHERE COLLATERAL_OWNER_CIF IS NOT NULL " +
                    "UNION " +
                    "SELECT BORROWER_CIF FROM " + collateralView + " WHERE BORROWER_CIF IS NOT NULL)";
        }
        String sql = "SELECT CUSTOMER_NO, CUSTOMER_NAME1, CUSTOMER_TYPE, P_NATIONAL_ID, PASSPORT_NO, " +
                "MOBILE_NUMBER, E_MAIL, TAXID_NO, ADDRESS, CUSTOMER_STATUS, BUSINESS_SEGMENT, RM_CODE, " +
                "BRANCH_CODE, MAKER_DATE, RECORD_STAT, AUTH_STAT FROM " + customerView + filterClause;

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(30, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 500);

            try (ResultSet rs = ps.executeQuery()) {
                int count = 0;
                while (rs.next()) {
                    consumer.accept(mapCustomerRow(rs));
                    count++;
                    if (count % 1000 == 0) {
                        log.info("Loaded {} rows from {}...", count, customerView);
                    }
                    if (maxRows > 0 && count >= maxRows) break;
                }
                log.info("Completed query on {} in {}ms (total rows: {})", customerView, (System.currentTimeMillis() - startMs), count);
            }
        } catch (SQLException e) {
            log.error("Failed to stream CBS Customer view: {} after {}ms", customerView, (System.currentTimeMillis() - startMs), e);
            throw classifyQueryException(customerView, e);
        }
    }

    @Override
    public List<CbsCustomerViewRow> fetchCustomerViewRows() {
        List<CbsCustomerViewRow> rows = new ArrayList<>();
        streamCustomerViewRows(rows::add, -1);
        return rows;
    }

    @Override
    public List<CbsCustomerViewRow> fetchCustomerViewRowsByCifs(Collection<String> cifs) {
        if (cifs == null || cifs.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> cifList = cifs.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(String::trim)
                .distinct()
                .toList();

        if (cifList.isEmpty()) {
            return Collections.emptyList();
        }

        log.info("Querying {} targeted CBS customer view rows across Oracle customer view: {}...", cifList.size(), customerView);
        long startMs = System.currentTimeMillis();
        int batchSize = 999;
        List<List<String>> chunks = new ArrayList<>();
        for (int i = 0; i < cifList.size(); i += batchSize) {
            int end = Math.min(i + batchSize, cifList.size());
            chunks.add(cifList.subList(i, end));
        }

        int workers = Math.min(4, Math.max(1, (maxPoolSize > 0 ? maxPoolSize : 10) - 2));
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<CbsCustomerViewRow> results = new ArrayList<>();
        try {
            List<Future<List<CbsCustomerViewRow>>> futures = new ArrayList<>(chunks.size());
            for (List<String> chunk : chunks) {
                futures.add(executor.submit(() -> fetchCustomerViewRowChunk(chunk)));
            }
            for (Future<List<CbsCustomerViewRow>> f : futures) {
                results.addAll(f.get());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_TIMEOUT, "Interrupted while fetching customer view rows", customerView, e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof CbsSyncException cbsEx) {
                throw cbsEx;
            }
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED, "Failed fetching customer view rows: " + cause.getMessage(), customerView, cause);
        } finally {
            executor.shutdown();
        }

        log.info("Successfully retrieved {} targeted CBS customer view rows in {}ms", results.size(), (System.currentTimeMillis() - startMs));
        return results;
    }

    private List<CbsCustomerViewRow> fetchCustomerViewRowChunk(List<String> chunk) {
        if (chunk.isEmpty()) return Collections.emptyList();
        String inPlaceholders = String.join(",", Collections.nCopies(chunk.size(), "?"));
        String sql = "SELECT CUSTOMER_NO, CUSTOMER_NAME1, CUSTOMER_TYPE, P_NATIONAL_ID, PASSPORT_NO, " +
                "MOBILE_NUMBER, E_MAIL, TAXID_NO, ADDRESS, CUSTOMER_STATUS, BUSINESS_SEGMENT, RM_CODE, " +
                "BRANCH_CODE, MAKER_DATE, RECORD_STAT, AUTH_STAT FROM " + customerView +
                " WHERE CUSTOMER_NO IN (" + inPlaceholders + ")";

        List<CbsCustomerViewRow> chunkResults = new ArrayList<>(chunk.size());
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(30, readTimeoutMs / 1000));
            ps.setFetchSize(chunk.size());

            for (int i = 0; i < chunk.size(); i++) {
                ps.setString(i + 1, chunk.get(i));
            }

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    chunkResults.add(mapCustomerRow(rs));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS customer view row chunk (size: {}) from view: {}", chunk.size(), customerView, e);
            throw classifyQueryException(customerView, e);
        }
        return chunkResults;
    }

    @Override
    public void streamFacilityViewRows(java.util.function.Consumer<CbsFacilityViewRow> consumer, int maxRows) {
        log.info("Querying CBS Facility view: {} (timeout: {}ms, fetchSize: {})", facilityView, readTimeoutMs, fetchSize);
        long startMs = System.currentTimeMillis();
        String sql = "SELECT ACCOUNT_NUMBER, CUSTOMER_ID, CUSTOMER_TYPE, FACILTY_ID, BRANCH_CODE, " +
                "PRODUCT_CODE, BUSINESS_SEGMENT, SANCATION_AMOUNT, OUTSTANDING_BALANCE, MATURITY_DATE, " +
                "ACCOUNT_STATUS, VALUE_DATE, LOAN_STATUS, BOOK_DATE, AUTH_STAT FROM " + facilityView;

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(30, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 2000);

            try (ResultSet rs = ps.executeQuery()) {
                int count = 0;
                while (rs.next()) {
                    consumer.accept(mapFacilityRow(rs));
                    count++;
                    if (count % 25000 == 0) {
                        log.info("Loaded {} rows from {}...", count, facilityView);
                    }
                    if (maxRows > 0 && count >= maxRows) break;
                }
                log.info("Completed query on {} in {}ms (total rows: {})", facilityView, (System.currentTimeMillis() - startMs), count);
            }
        } catch (SQLException e) {
            log.error("Failed to stream CBS Facility view: {} after {}ms", facilityView, (System.currentTimeMillis() - startMs), e);
            throw classifyQueryException(facilityView, e);
        }
    }

    @Override
    public List<CbsFacilityViewRow> fetchFacilityViewRows() {
        List<CbsFacilityViewRow> rows = new ArrayList<>();
        streamFacilityViewRows(rows::add, -1);
        return rows;
    }

    @Override
    public void streamCollateralViewRows(java.util.function.Consumer<CbsCollateralViewRow> consumer, int maxRows) {
        log.info("Querying CBS Collateral view: {} (timeout: {}ms, fetchSize: {})", collateralView, readTimeoutMs, fetchSize);
        long startMs = System.currentTimeMillis();
        String sql = "SELECT COLLATERAL_CODE, COLLATERAL_TYPE, COLLATERAL_DESCRIPTION, COLLATERAL_VALUE, " +
                "VALUATION_DATE, RECORD_STAT, COLLATERAL_OWNER_CIF, COLLATERAL_CATEGORY, COLLATERAL_CURRENCY, " +
                "START_DATE, END_DATE, REVIEW_DATE, CHARGE_TYPE, SECURED, TANGIBLE, BRANCH_CODE, AUTH_STAT, " +
                "ACCOUNT_NUMBER, FACILITY_ID, LINKAGE_TYPE, LIMIT_AMOUNT, ALLOCATION_PERCENT, LINKED_AMOUNT, " +
                "CATEGORY_ID, STATUS, EFFECTIVE_DATE, UTIL_ORDER, MAKER_DATE, BORROWER_CIF, " +
                "OWNER_BORROWER_RELATIONSHIP, GUARANTEE_INDICATOR FROM " + collateralView;

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(30, readTimeoutMs / 1000));
            ps.setFetchSize(fetchSize > 0 ? fetchSize : 2000);

            try (ResultSet rs = ps.executeQuery()) {
                int count = 0;
                while (rs.next()) {
                    consumer.accept(mapCollateralRow(rs));
                    count++;
                    if (count % 50000 == 0) {
                        log.info("Loaded {} rows from {}...", count, collateralView);
                    }
                    if (maxRows > 0 && count >= maxRows) break;
                }
                log.info("Completed query on {} in {}ms (total rows: {})", collateralView, (System.currentTimeMillis() - startMs), count);
            }
        } catch (SQLException e) {
            log.error("Failed to stream CBS Collateral view: {} after {}ms", collateralView, (System.currentTimeMillis() - startMs), e);
            throw classifyQueryException(collateralView, e);
        }
    }

    @Override
    public List<CbsCollateralViewRow> fetchCollateralViewRows() {
        long now = System.currentTimeMillis();
        if (cachedCollateralRows != null && (now - cachedCollateralRowsTime) < 900000) {
            return cachedCollateralRows;
        }
        List<CbsCollateralViewRow> rows = new ArrayList<>();
        streamCollateralViewRows(rows::add, -1);
        this.cachedCollateralRows = rows;
        this.cachedCollateralRowsTime = now;
        return rows;
    }

    // =========================================================================
    // Legacy & Optimized Domain Operations
    // =========================================================================

    @Override
    public List<CbsCustomer> fetchCustomers() {
        List<CbsCustomerViewRow> rows = fetchCustomerViewRows();
        List<CbsCustomer> list = new ArrayList<>(rows.size());
        for (CbsCustomerViewRow r : rows) {
            list.add(mapToCbsCustomer(r));
        }
        return list;
    }

    @Override
    public List<CbsCustomer> fetchCustomersByCifs(Collection<String> cifs) {
        if (cifs == null || cifs.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> cifList = cifs.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(String::trim)
                .distinct()
                .toList();

        if (cifList.isEmpty()) {
            return Collections.emptyList();
        }

        log.info("Querying {} targeted CBS customer CIFs across Oracle customer view: {}...", cifList.size(), customerView);
        long startMs = System.currentTimeMillis();
        int batchSize = 999; // Oracle IN list limit is 1000
        List<List<String>> chunks = new ArrayList<>();
        for (int i = 0; i < cifList.size(); i += batchSize) {
            int end = Math.min(i + batchSize, cifList.size());
            chunks.add(cifList.subList(i, end));
        }

        int workers = Math.min(4, Math.max(1, (maxPoolSize > 0 ? maxPoolSize : 10) - 2));
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<CbsCustomer> results = new ArrayList<>();
        try {
            List<Future<List<CbsCustomer>>> futures = new ArrayList<>(chunks.size());
            for (List<String> chunk : chunks) {
                futures.add(executor.submit(() -> fetchCustomerChunk(chunk)));
            }
            for (Future<List<CbsCustomer>> f : futures) {
                results.addAll(f.get());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_TIMEOUT, "Interrupted while fetching customers", customerView, e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof CbsSyncException cbsEx) {
                throw cbsEx;
            }
            throw new CbsSyncException(CbsSyncException.ErrorCode.SOURCE_QUERY_FAILED, "Failed fetching customers: " + cause.getMessage(), customerView, cause);
        } finally {
            executor.shutdown();
        }

        log.info("Successfully retrieved {} targeted CBS customers in {}ms", results.size(), (System.currentTimeMillis() - startMs));
        return results;
    }

    private List<CbsCustomer> fetchCustomerChunk(List<String> chunk) {
        if (chunk.isEmpty()) return Collections.emptyList();
        String inPlaceholders = String.join(",", Collections.nCopies(chunk.size(), "?"));
        String sql = "SELECT CUSTOMER_NO, CUSTOMER_NAME1, CUSTOMER_TYPE, P_NATIONAL_ID, PASSPORT_NO, " +
                "MOBILE_NUMBER, E_MAIL, TAXID_NO, ADDRESS, CUSTOMER_STATUS, BUSINESS_SEGMENT, RM_CODE, " +
                "BRANCH_CODE, MAKER_DATE, RECORD_STAT, AUTH_STAT FROM " + customerView +
                " WHERE CUSTOMER_NO IN (" + inPlaceholders + ")";

        List<CbsCustomer> chunkResults = new ArrayList<>(chunk.size());
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(30, readTimeoutMs / 1000));
            ps.setFetchSize(chunk.size());

            for (int i = 0; i < chunk.size(); i++) {
                ps.setString(i + 1, chunk.get(i));
            }

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    chunkResults.add(mapToCbsCustomer(mapCustomerRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS customer chunk (size: {}) from view: {}", chunk.size(), customerView, e);
            throw classifyQueryException(customerView, e);
        }
        return chunkResults;
    }

    @Override
    public Optional<CbsCustomer> fetchCustomerByCif(String cif) {
        if (cif == null || cif.isBlank()) return Optional.empty();
        String sql = "SELECT CUSTOMER_NO, CUSTOMER_NAME1, CUSTOMER_TYPE, P_NATIONAL_ID, PASSPORT_NO, " +
                "MOBILE_NUMBER, E_MAIL, TAXID_NO, ADDRESS, CUSTOMER_STATUS, BUSINESS_SEGMENT, RM_CODE, " +
                "BRANCH_CODE, MAKER_DATE, RECORD_STAT, AUTH_STAT FROM " + customerView +
                " WHERE UPPER(TRIM(CUSTOMER_NO)) = UPPER(TRIM(?))";

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(10, connectTimeoutMs / 1000));
            ps.setString(1, cif.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapToCbsCustomer(mapCustomerRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Customer by CIF {} on view {}: {}", cif, customerView, e.getMessage());
            throw classifyQueryException(customerView, e);
        }
        return Optional.empty();
    }

    @Override
    public List<CbsFacility> fetchFacilities() {
        List<CbsFacilityViewRow> rows = fetchFacilityViewRows();
        List<CbsFacility> list = new ArrayList<>(rows.size());
        for (CbsFacilityViewRow r : rows) {
            list.add(mapToCbsFacility(r));
        }
        return list;
    }

    @Override
    public List<CbsFacility> fetchFacilitiesByCustomerCif(String customerCif) {
        if (customerCif == null || customerCif.isBlank()) return List.of();
        String sql = "SELECT ACCOUNT_NUMBER, CUSTOMER_ID, CUSTOMER_TYPE, FACILTY_ID, BRANCH_CODE, " +
                "PRODUCT_CODE, BUSINESS_SEGMENT, SANCATION_AMOUNT, OUTSTANDING_BALANCE, MATURITY_DATE, " +
                "ACCOUNT_STATUS, VALUE_DATE, LOAN_STATUS, BOOK_DATE, AUTH_STAT FROM " + facilityView +
                " WHERE UPPER(TRIM(CUSTOMER_ID)) = UPPER(TRIM(?))";

        List<CbsFacility> list = new ArrayList<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(15, connectTimeoutMs / 1000));
            ps.setString(1, customerCif.trim());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapToCbsFacility(mapFacilityRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Facilities by customer CIF on view {}: {}", facilityView, e.getMessage());
            throw classifyQueryException(facilityView, e);
        }
        return list;
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLoanReference(String loanReference) {
        if (loanReference == null || loanReference.isBlank()) return Optional.empty();
        String sql = "SELECT ACCOUNT_NUMBER, CUSTOMER_ID, CUSTOMER_TYPE, FACILTY_ID, BRANCH_CODE, " +
                "PRODUCT_CODE, BUSINESS_SEGMENT, SANCATION_AMOUNT, OUTSTANDING_BALANCE, MATURITY_DATE, " +
                "ACCOUNT_STATUS, VALUE_DATE, LOAN_STATUS, BOOK_DATE, AUTH_STAT FROM " + facilityView +
                " WHERE UPPER(TRIM(ACCOUNT_NUMBER)) = UPPER(TRIM(?))";

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(10, connectTimeoutMs / 1000));
            ps.setString(1, loanReference.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapToCbsFacility(mapFacilityRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Facility by loan reference on view {}: {}", facilityView, e.getMessage());
            throw classifyQueryException(facilityView, e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<CbsFacility> fetchFacilityByLineCode(String lineCode) {
        if (lineCode == null || lineCode.isBlank()) return Optional.empty();
        String sql = "SELECT ACCOUNT_NUMBER, CUSTOMER_ID, CUSTOMER_TYPE, FACILTY_ID, BRANCH_CODE, " +
                "PRODUCT_CODE, BUSINESS_SEGMENT, SANCATION_AMOUNT, OUTSTANDING_BALANCE, MATURITY_DATE, " +
                "ACCOUNT_STATUS, VALUE_DATE, LOAN_STATUS, BOOK_DATE, AUTH_STAT FROM " + facilityView +
                " WHERE UPPER(TRIM(ACCOUNT_NUMBER)) = UPPER(TRIM(?))";

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(10, connectTimeoutMs / 1000));
            ps.setString(1, lineCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapToCbsFacility(mapFacilityRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Facility by line code on view {}: {}", facilityView, e.getMessage());
            throw classifyQueryException(facilityView, e);
        }
        return Optional.empty();
    }

    @Override
    public List<CbsCollateral> fetchCollaterals() {
        List<CbsCollateralViewRow> rows = fetchCollateralViewRows();
        Map<String, CbsCollateral> colMap = new LinkedHashMap<>();
        for (CbsCollateralViewRow r : rows) {
            if (r.getCollateralCode() == null || r.getCollateralCode().isBlank()) continue;
            String code = r.getCollateralCode().trim();
            if (!colMap.containsKey(code)) {
                colMap.put(code, mapToCbsCollateral(r));
            }
        }
        return new ArrayList<>(colMap.values());
    }

    @Override
    public List<CbsCollateral> fetchCollateralsByCustomerCif(String customerCif) {
        if (customerCif == null || customerCif.isBlank()) return List.of();
        String sql = "SELECT COLLATERAL_CODE, COLLATERAL_TYPE, COLLATERAL_DESCRIPTION, COLLATERAL_VALUE, " +
                "VALUATION_DATE, RECORD_STAT, COLLATERAL_OWNER_CIF, COLLATERAL_CATEGORY, COLLATERAL_CURRENCY, " +
                "START_DATE, END_DATE, REVIEW_DATE, CHARGE_TYPE, SECURED, TANGIBLE, BRANCH_CODE, AUTH_STAT, " +
                "ACCOUNT_NUMBER, FACILITY_ID, LINKAGE_TYPE, LIMIT_AMOUNT, ALLOCATION_PERCENT, LINKED_AMOUNT, " +
                "CATEGORY_ID, STATUS, EFFECTIVE_DATE, UTIL_ORDER, MAKER_DATE, BORROWER_CIF, " +
                "OWNER_BORROWER_RELATIONSHIP, GUARANTEE_INDICATOR FROM " + collateralView +
                " WHERE UPPER(TRIM(COLLATERAL_OWNER_CIF)) = UPPER(TRIM(?)) OR UPPER(TRIM(BORROWER_CIF)) = UPPER(TRIM(?))";

        Map<String, CbsCollateral> colMap = new LinkedHashMap<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(15, connectTimeoutMs / 1000));
            ps.setString(1, customerCif.trim());
            ps.setString(2, customerCif.trim());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CbsCollateralViewRow r = mapCollateralRow(rs);
                    if (r.getCollateralCode() != null && !colMap.containsKey(r.getCollateralCode().trim())) {
                        colMap.put(r.getCollateralCode().trim(), mapToCbsCollateral(r));
                    }
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Collaterals by customer CIF on view {}: {}", collateralView, e.getMessage());
            throw classifyQueryException(collateralView, e);
        }
        return new ArrayList<>(colMap.values());
    }

    @Override
    public Optional<CbsCollateral> fetchCollateralByCode(String collateralCode) {
        if (collateralCode == null || collateralCode.isBlank()) return Optional.empty();
        String sql = "SELECT COLLATERAL_CODE, COLLATERAL_TYPE, COLLATERAL_DESCRIPTION, COLLATERAL_VALUE, " +
                "VALUATION_DATE, RECORD_STAT, COLLATERAL_OWNER_CIF, COLLATERAL_CATEGORY, COLLATERAL_CURRENCY, " +
                "START_DATE, END_DATE, REVIEW_DATE, CHARGE_TYPE, SECURED, TANGIBLE, BRANCH_CODE, AUTH_STAT, " +
                "ACCOUNT_NUMBER, FACILITY_ID, LINKAGE_TYPE, LIMIT_AMOUNT, ALLOCATION_PERCENT, LINKED_AMOUNT, " +
                "CATEGORY_ID, STATUS, EFFECTIVE_DATE, UTIL_ORDER, MAKER_DATE, BORROWER_CIF, " +
                "OWNER_BORROWER_RELATIONSHIP, GUARANTEE_INDICATOR FROM " + collateralView +
                " WHERE UPPER(TRIM(COLLATERAL_CODE)) = UPPER(TRIM(?))";

        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(10, connectTimeoutMs / 1000));
            ps.setString(1, collateralCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapToCbsCollateral(mapCollateralRow(rs)));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Collateral by code on view {}: {}", collateralCode, e.getMessage());
            throw classifyQueryException(collateralView, e);
        }
        return Optional.empty();
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAccountCollateralLinks(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) return List.of();
        String sql = "SELECT COLLATERAL_CODE, BRANCH_CODE, ACCOUNT_NUMBER, LINKAGE_TYPE, " +
                "LIMIT_AMOUNT, LINKED_AMOUNT FROM " + collateralView +
                " WHERE UPPER(TRIM(ACCOUNT_NUMBER)) = UPPER(TRIM(?))";

        List<CbsAccCollLinkDtls> links = new ArrayList<>();
        try (Connection conn = getReadOnlyConnection();
             PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            ps.setQueryTimeout(Math.max(15, connectTimeoutMs / 1000));
            ps.setString(1, accountNumber.trim());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CbsAccCollLinkDtls link = new CbsAccCollLinkDtls();
                    link.setId("link-" + UUID.randomUUID().toString().substring(0, 8));
                    link.setAccountNumber(accountNumber.trim());
                    link.setLinkedReferenceNo(rs.getString("COLLATERAL_CODE"));
                    link.setBranchCode(rs.getString("BRANCH_CODE"));
                    link.setLinkageType(rs.getString("LINKAGE_TYPE"));
                    BigDecimal linkedAmt = rs.getBigDecimal("LINKED_AMOUNT");
                    link.setLinkedAmount(linkedAmt != null ? linkedAmt.doubleValue() : 0.0);
                    BigDecimal limitAmt = rs.getBigDecimal("LIMIT_AMOUNT");
                    link.setLimitAmount(limitAmt != null ? limitAmt.doubleValue() : 0.0);
                    links.add(link);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to query CBS Account-Collateral Links by account on view {}: {}", collateralView, e.getMessage());
            throw classifyQueryException(collateralView, e);
        }
        return links;
    }

    @Override
    public List<CbsAccCollLinkDtls> fetchAllAccountCollateralLinks() {
        List<CbsCollateralViewRow> rows = fetchCollateralViewRows();
        Map<String, CbsAccCollLinkDtls> uniqueLinks = new LinkedHashMap<>();
        for (CbsCollateralViewRow r : rows) {
            if (r.getAccountNumber() != null && !r.getAccountNumber().isBlank()
                    && r.getCollateralCode() != null && !r.getCollateralCode().isBlank()) {
                String accNum = r.getAccountNumber().trim();
                String colCode = r.getCollateralCode().trim();
                String dedupeKey = (colCode + ":" + accNum).toUpperCase();

                double linkedAmt = r.getLinkedAmount() != null && r.getLinkedAmount().doubleValue() > 0
                        ? r.getLinkedAmount().doubleValue()
                        : (r.getLimitAmount() != null && r.getLimitAmount().doubleValue() > 0
                                ? r.getLimitAmount().doubleValue()
                                : (r.getCollateralValue() != null ? r.getCollateralValue().doubleValue() : 0.0));
                double limitAmt = r.getLimitAmount() != null && r.getLimitAmount().doubleValue() > 0
                        ? r.getLimitAmount().doubleValue()
                        : linkedAmt;

                CbsAccCollLinkDtls existing = uniqueLinks.get(dedupeKey);
                if (existing != null) {
                    if (linkedAmt > existing.getLinkedAmount()) {
                        existing.setLinkedAmount(linkedAmt);
                    }
                    if (limitAmt > existing.getLimitAmount()) {
                        existing.setLimitAmount(limitAmt);
                    }
                } else {
                    CbsAccCollLinkDtls link = new CbsAccCollLinkDtls();
                    link.setId("link-" + UUID.nameUUIDFromBytes(dedupeKey.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
                    link.setAccountNumber(accNum);
                    link.setLinkedReferenceNo(colCode);
                    link.setBranchCode(r.getBranchCode());
                    link.setLinkageType(r.getLinkageType());
                    link.setLinkedAmount(linkedAmt);
                    link.setLimitAmount(limitAmt);
                    uniqueLinks.put(dedupeKey, link);
                }
            }
        }
        return new ArrayList<>(uniqueLinks.values());
    }
}
