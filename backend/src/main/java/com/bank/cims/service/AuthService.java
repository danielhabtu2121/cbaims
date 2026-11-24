package com.bank.cims.service;

import com.bank.cims.model.PasswordHistory;
import com.bank.cims.model.RolePermission;
import com.bank.cims.model.User;
import com.bank.cims.model.UserSession;
import com.bank.cims.repository.BranchRepository;
import com.bank.cims.repository.PasswordHistoryRepository;
import com.bank.cims.repository.RolePermissionRepository;
import com.bank.cims.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private TokenService tokenService;
    @Autowired private CimsService cimsService;
    @Autowired private ConfigurationService configurationService;
    @Autowired private SessionManagementService sessionManagementService;
    @Autowired private PasswordHistoryRepository passwordHistoryRepository;
    @Autowired private AuthorizationScopeService authorizationScopeService;
    @Autowired private BranchRepository branchRepository;
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @PostConstruct
    @Transactional
    public void upgradeLegacyPlaintextPasswords() {
        try {
            List<User> all = userRepository.findAll();
            int upgraded = 0;
            for (User u : all) {
                String pwd = u.getPassword();
                if (pwd != null && !pwd.isBlank() && !pwd.startsWith("$2a$") && !pwd.startsWith("$2b$") && !pwd.startsWith("$2y$")) {
                    u.setPassword(passwordEncoder.encode(pwd));
                    userRepository.save(u);
                    upgraded++;
                }
            }
            if (upgraded > 0) {
                log.info("Secure Authentication: Upgraded {} legacy plaintext password(s) to BCrypt hashes.", upgraded);
            }
        } catch (Exception e) {
            log.warn("Password upgrade scan skipped during initialization: {}", e.getMessage());
        }
    }

    @Transactional(noRollbackFor = {IllegalArgumentException.class, IllegalStateException.class})
    public Map<String, Object> authenticate(String identifier, String suppliedPassword, String clientIp, String userAgent) {
        if (identifier == null || identifier.isBlank() || suppliedPassword == null || suppliedPassword.isBlank()) {
            throw new IllegalArgumentException("Username/email and password are required.");
        }

        String cleanIdentifier = identifier.trim();
        Optional<User> opt = userRepository.findByUsernameIgnoreCase(cleanIdentifier);
        if (opt.isEmpty()) {
            opt = userRepository.findByEmailIgnoreCase(cleanIdentifier);
        }

        // Security requirement: constant-time failure and generic error message to avoid username enumeration
        if (opt.isEmpty()) {
            passwordEncoder.matches("dummy", "$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi");
            cimsService.logAudit("ANONYMOUS", "UNKNOWN", "USER_LOGIN_FAILED", "User", "N/A", "Identifier", maskIdentifier(cleanIdentifier), "Failed", "Failed login: account not found (" + clientIp + ")");
            throw new IllegalArgumentException("Invalid username/email or password.");
        }

        User user = opt.get();

        if (!user.isActive()) {
            cimsService.logAudit(user.getId(), user.getRole(), "USER_LOGIN_FAILED", "User", user.getId(), "Status", "Inactive", "Blocked", "Login blocked: user account is deactivated (" + clientIp + ")");
            throw new IllegalStateException("Account is inactive. Please contact the System Administrator.");
        }

        // Account Lockout check (SEC-09)
        LocalDateTime now = LocalDateTime.now();
        if (user.getLockedUntil() != null) {
            if (user.getLockedUntil().isAfter(now)) {
                long minutesRemaining = ChronoUnit.MINUTES.between(now, user.getLockedUntil()) + 1;
                cimsService.logAudit(user.getId(), user.getRole(), "USER_LOGIN_FAILED", "User", user.getId(), "Lockout", "Locked", "Blocked", "Login blocked: account locked for " + minutesRemaining + " more minute(s) (" + clientIp + ")");
                throw new IllegalStateException("Account is temporarily locked due to multiple failed login attempts. Please try again after " + minutesRemaining + " minute(s) or contact the System Administrator.");
            } else {
                user.setLockedUntil(null);
                user.setFailedAttempts(0);
            }
        }

        boolean passwordMatch = false;
        String currentHash = user.getPassword();

        if (currentHash != null && (currentHash.startsWith("$2a$") || currentHash.startsWith("$2b$") || currentHash.startsWith("$2y$"))) {
            passwordMatch = passwordEncoder.matches(suppliedPassword, currentHash);
        } else if (currentHash != null && currentHash.equals(suppliedPassword)) {
            user.setPassword(passwordEncoder.encode(suppliedPassword));
            passwordMatch = true;
        }

        if (!passwordMatch) {
            int currentAttempts = (user.getFailedAttempts() != null ? user.getFailedAttempts() : 0) + 1;
            user.setFailedAttempts(currentAttempts);

            int maxAttempts = configurationService.getInt("max_login_failed_attempts", 5);
            int lockoutMinutes = configurationService.getInt("account_lockout_duration_minutes", 15);

            if (currentAttempts >= maxAttempts) {
                user.setLockedUntil(now.plusMinutes(lockoutMinutes));
                userRepository.save(user);
                cimsService.logAudit(user.getId(), user.getRole(), "ACCOUNT_LOCKED", "User", user.getId(), "Status", "Active", "Locked", "Account locked for " + lockoutMinutes + " minutes after " + currentAttempts + " failed login attempts (" + clientIp + ")");
                throw new IllegalStateException("Account has been locked due to " + currentAttempts + " consecutive failed login attempts. Please try again after " + lockoutMinutes + " minutes or contact your Administrator.");
            } else {
                userRepository.save(user);
                int remainingAttempts = maxAttempts - currentAttempts;
                cimsService.logAudit(user.getId(), user.getRole(), "USER_LOGIN_FAILED", "User", user.getId(), "Attempts", String.valueOf(currentAttempts - 1), String.valueOf(currentAttempts), "Failed login attempt (" + currentAttempts + "/" + maxAttempts + ") (" + clientIp + ")");
                throw new IllegalArgumentException("Invalid username/email or password. " + remainingAttempts + " attempt(s) remaining before account lockout.");
            }
        }

        // Authentication Success: reset failed attempts & record last login
        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);

        // SEC-05: Password expiry tracking
        int expiryDays = configurationService.getInt("password_expiry_days", 90);
        LocalDateTime changedAt = user.getPasswordChangedAt() != null ? user.getPasswordChangedAt() : user.getLastLoginAt();
        if (changedAt != null && expiryDays > 0) {
            long daysSinceChange = ChronoUnit.DAYS.between(changedAt, now);
            if (daysSinceChange >= expiryDays) {
                user.setPasswordExpired(true);
            } else {
                user.setPasswordExpiryDate(changedAt.plusDays(expiryDays));
            }
        }
        userRepository.save(user);

        // SEC-02: Establish persistent server-enforced session
        int timeoutMinutes = configurationService.getInt("session_timeout_minutes", 15);
        UserSession serverSession = sessionManagementService.createSession(user, clientIp, userAgent, timeoutMinutes);

        // SEC-01 & SEC-10: Token includes sessionId and signs using secure key
        String token = tokenService.generateToken(user.getId(), user.getUsername(), user.getRole(), serverSession.getId());

        cimsService.logAudit(user.getId(), user.getRole(), "USER_LOGIN", "User", user.getId(), "Session", "LoggedOut", "LoggedIn", "Successful user authentication (" + clientIp + ")");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("token", token);
        response.put("sessionId", serverSession.getId());
        response.put("user", safeUser(user));
        response.put("sessionTimeoutMinutes", timeoutMinutes);
        response.put("passwordExpired", user.isPasswordExpired());
        if (user.isPasswordExpired()) {
            response.put("passwordWarning", "Your password has expired per bank policy. Please change your password.");
        }
        return response;
    }

    @Transactional
    public Map<String, Object> forgotPassword(String identifier, String clientIp) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Username or corporate email is required.");
        }
        String cleanIdentifier = identifier.trim();
        Optional<User> opt = userRepository.findByUsernameIgnoreCase(cleanIdentifier);
        if (opt.isEmpty()) {
            opt = userRepository.findByEmailIgnoreCase(cleanIdentifier);
        }

        if (opt.isPresent()) {
            User user = opt.get();
            int validityMinutes = configurationService.getInt("password_reset_token_validity_minutes", 15);

            // SEC-08: Cryptographically secure random token, store only SHA-256 hash in database
            byte[] randomBytes = new byte[32];
            new SecureRandom().nextBytes(randomBytes);
            String rawToken = HexFormat.of().formatHex(randomBytes);
            String hashedToken = hashToken(rawToken);

            user.setResetToken(hashedToken);
            user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(validityMinutes));
            userRepository.save(user);

            cimsService.logAudit(user.getId(), user.getRole(), "PASSWORD_RESET_REQUESTED", "User", user.getId(),
                    "ResetToken", "***", "HashedTokenStored", "Password reset requested (" + clientIp + ")");

            // In local/test mode, log delivery simulation for testing without exposing token in response
            log.info("Reset Token generated for user {} (expires in {} mins): {}", user.getUsername(), validityMinutes, rawToken);
        }

        // SEC-08: Banking standard: ALWAYS return generic response to avoid disclosing account existence
        // simulationResetToken is NEVER returned in the API response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "If an account matches that username or corporate email, password recovery instructions have been dispatched.");
        return response;
    }

    @Transactional
    public Map<String, Object> resetPassword(String rawToken, String newPassword, String clientIp) {
        if (rawToken == null || rawToken.isBlank() || newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("Reset token and new password are required.");
        }

        // SEC-08: Hash incoming token and match against stored hash
        String hashedToken = hashToken(rawToken.trim());
        Optional<User> opt = userRepository.findByResetToken(hashedToken);
        if (opt.isEmpty()) {
            throw new IllegalArgumentException("Invalid or expired password reset token.");
        }

        User user = opt.get();
        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Password reset token has expired. Please request a new one.");
        }

        // SEC-04: Enforce complexity
        validatePasswordPolicy(newPassword);

        // SEC-06: Enforce password history
        validatePasswordHistory(user, newPassword);

        // Save old password into password history
        passwordHistoryRepository.save(new PasswordHistory(UUID.randomUUID().toString(), user.getId(), user.getPassword()));

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        user.setPasswordChangedAt(LocalDateTime.now());
        user.setPasswordExpired(false);
        userRepository.save(user);

        // SEC-03: Invalidate all active user sessions upon reset
        sessionManagementService.revokeAllUserSessions(user.getId(), "PASSWORD_RESET");

        cimsService.logAudit(user.getId(), user.getRole(), "PASSWORD_RESET_COMPLETED", "User", user.getId(),
                "Password", "***", "***", "Password successfully reset via token (" + clientIp + ")");

        return Map.of("success", true, "message", "Password has been reset successfully. You may now log in with your new password.");
    }

    @Transactional
    public Map<String, Object> changePassword(String authenticatedUserId, String currentPassword, String newPassword, String clientIp) {
        if (authenticatedUserId == null || authenticatedUserId.isBlank()) {
            throw new IllegalArgumentException("Authenticated user identity is required.");
        }
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required.");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required.");
        }

        User user = userRepository.findById(authenticatedUserId.trim())
                .or(() -> userRepository.findByUsername(authenticatedUserId.trim()))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authenticatedUserId));

        // SEC-07: STRICTLY VERIFY CURRENT PASSWORD (cannot be bypassed)
        boolean matches = passwordEncoder.matches(currentPassword, user.getPassword());
        if (!matches) {
            throw new IllegalArgumentException("Current password does not match.");
        }

        // SEC-04: Complexity validation
        validatePasswordPolicy(newPassword);

        // SEC-06: History validation
        validatePasswordHistory(user, newPassword);

        // Record old password into history
        passwordHistoryRepository.save(new PasswordHistory(UUID.randomUUID().toString(), user.getId(), user.getPassword()));

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(LocalDateTime.now());
        user.setPasswordExpired(false);
        userRepository.save(user);

        // SEC-03: Invalidate all active sessions for this user upon password change
        sessionManagementService.revokeAllUserSessions(user.getId(), "PASSWORD_CHANGED");

        cimsService.logAudit(user.getId(), user.getRole(), "CHANGE_PASSWORD", "User", user.getId(),
                "Password", "***", "***", "Password changed successfully (" + clientIp + ")");
        return Map.of("success", true, "message", "Password updated successfully. Other active sessions have been terminated.");
    }

    public void logout(String token, String userId, String clientIp) {
        if (token != null) {
            tokenService.invalidateToken(token);
        }
        String actor = (userId != null && !userId.isBlank()) ? userId : "CURRENT_USER";
        cimsService.logAudit(actor, "USER", "USER_LOGOUT", "User", actor, "Session", "LoggedIn", "LoggedOut", "User logged out (" + clientIp + ")");
    }

    public void validatePasswordHistory(User user, String newPassword) {
        int historyCount = configurationService.getInt("password_history_count", 5);
        if (historyCount <= 0) return;

        // Check against current password
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("New password cannot be the same as your current password.");
        }

        // Check against previous N historical passwords
        List<PasswordHistory> history = passwordHistoryRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        int checkLimit = Math.min(historyCount, history.size());
        for (int i = 0; i < checkLimit; i++) {
            PasswordHistory ph = history.get(i);
            if (passwordEncoder.matches(newPassword, ph.getPasswordHash())) {
                throw new IllegalArgumentException("New password cannot be the same as any of your previous " + historyCount + " passwords.");
            }
        }
    }

    public void validatePasswordPolicy(String password) {
        int minLength = configurationService.getInt("password_min_length", 8);
        boolean requireSpecial = configurationService.getBoolean("password_require_special", true);
        boolean requireUpper = configurationService.getBoolean("password_require_uppercase", true);
        boolean requireDigit = configurationService.getBoolean("password_require_digit", true);

        List<String> violations = new ArrayList<>();
        if (password.length() < minLength) {
            violations.add("must be at least " + minLength + " characters long");
        }
        if (requireSpecial && !password.matches(".*[^A-Za-z0-9].*")) {
            violations.add("must contain at least one special character (!@#$%^&*...)");
        }
        if (requireUpper && !password.matches(".*[A-Z].*")) {
            violations.add("must contain at least one uppercase letter (A-Z)");
        }
        if (requireDigit && !password.matches(".*[0-9].*")) {
            violations.add("must contain at least one numerical digit (0-9)");
        }

        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Password does not meet bank security policy requirements: " + String.join(", ", violations) + ".");
        }
    }

    public Map<String, Object> getPasswordPolicy() {
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("minLength", configurationService.getInt("password_min_length", 8));
        policy.put("requireSpecial", configurationService.getBoolean("password_require_special", true));
        policy.put("requireUppercase", configurationService.getBoolean("password_require_uppercase", true));
        policy.put("requireDigit", configurationService.getBoolean("password_require_digit", true));
        policy.put("maxFailedAttempts", configurationService.getInt("max_login_failed_attempts", 5));
        policy.put("lockoutDurationMinutes", configurationService.getInt("account_lockout_duration_minutes", 15));
        policy.put("sessionTimeoutMinutes", configurationService.getInt("session_timeout_minutes", 15));
        policy.put("passwordExpiryDays", configurationService.getInt("password_expiry_days", 90));
        policy.put("passwordHistoryCount", configurationService.getInt("password_history_count", 5));
        return policy;
    }

    public static String hashToken(String rawToken) {
        if (rawToken == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 hashing error: " + e.getMessage());
        }
    }

    public Map<String, Object> safeUser(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("userId", u.getId());
        m.put("username", u.getUsername());
        m.put("fullName", u.getFullName());
        m.put("name", u.getFullName());
        m.put("email", u.getEmail());
        m.put("phone", u.getPhone());
        m.put("role", u.getRole());
        m.put("roleName", roleDisplayName(u.getRole()));
        m.put("branch", u.getBranch());
        m.put("segment", u.getSegment());
        m.put("district", u.getDistrict());
        m.put("active", u.isActive());
        m.put("passwordExpired", u.isPasswordExpired());
        m.put("passwordExpiryDate", u.getPasswordExpiryDate() != null ? u.getPasswordExpiryDate().toString() : null);
        m.put("segmentIds", parseSegmentIds(u.getSegmentIds()));
        String branchCode = null;
        try {
            if (u.getBranch() != null && !u.getBranch().isBlank()) {
                branchCode = branchRepository.findFirstByNameIgnoreCase(u.getBranch())
                        .or(() -> branchRepository.findFirstByCodeIgnoreCase(u.getBranch()))
                        .map(b -> b.getCode())
                        .orElse(null);
            }
        } catch (Exception ignored) { }
        m.put("branchCode", branchCode);
        m.put("isAdmin", u.getRole() != null && (u.getRole().toUpperCase(Locale.ROOT).contains("SYSADMIN") || u.getRole().equalsIgnoreCase("ADMIN") || u.getRole().toUpperCase(Locale.ROOT).endsWith("_ADMIN")));

        // Authoritative scope resolved from persisted assignment, not from the client.
        AuthorizationScopeService.Scope scope = authorizationScopeService.resolve(u);
        m.put("allowedSegments", new ArrayList<>(scope.getAllowedSegments()));
        m.put("allowedBranches", new ArrayList<>(scope.getAllowedBranches()));
        m.put("allowedDistricts", new ArrayList<>(scope.getAllowedDistricts()));
        m.put("bankWide", scope.isBankWide());
        m.put("readOnly", scope.isReadOnly());
        m.put("scopeRestricted", scope.isRestricted());

        try {
            List<RolePermission> perms = rolePermissionRepository.findByRoleCodeIgnoreCase(u.getRole());
            m.put("permissions", perms.stream().filter(RolePermission::isActive).toList());
        } catch (Exception ignored) {
            m.put("permissions", List.of());
        }
        return m;
    }

    private List<String> parseSegmentIds(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return objectMapper.readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception ignored) {
            String cleaned = raw.replace("[", "").replace("]", "").replace("\"", "");
            return Arrays.stream(cleaned.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
        }
    }

    private String roleDisplayName(String role) {
        if (role == null) return "Bank User";
        return switch (role.toUpperCase(Locale.ROOT)) {
            case "SYSADMIN" -> "System Administrator";
            case "EXEC" -> "Executive Director / VP";
            case "SRMGMT" -> "Senior Management";
            case "HODEPT" -> "Head Office Department Head";
            case "DISTDIR" -> "District Director";
            case "BRMGR" -> "Branch Manager";
            case "BRO" -> "Branch Relationship Officer";
            case "CRO" -> "Corporate Relationship Officer";
            case "SRM" -> "Senior Relationship Manager";
            case "BRM" -> "Branch Relationship Manager";
            case "RO" -> "Relationship Officer";
            case "CRM" -> "Customer Relationship Manager";
            case "MGRCOLLDOC" -> "Manager Collateral & Documentation";
            case "COLLDOCOFF" -> "Collateral & Documentation Officer";
            case "RISK" -> "Risk Management Officer";
            case "COMPLIANCE" -> "Compliance Officer";
            case "AUDITOR", "AUDIT" -> "Internal Auditor";
            case "RDONLY" -> "Read Only Inspector";
            default -> role;
        };
    }

    private String maskIdentifier(String id) {
        if (id == null || id.length() <= 3) return "***";
        return id.substring(0, 2) + "***" + id.substring(id.length() - 1);
    }
}
