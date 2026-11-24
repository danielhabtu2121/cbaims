package com.bank.cims.controller;

import com.bank.cims.model.User;
import com.bank.cims.model.UserSession;
import com.bank.cims.service.AuthService;
import com.bank.cims.service.ConfigurationService;
import com.bank.cims.service.SessionManagementService;
import com.bank.cims.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired private AuthService authService;
    @Autowired private TokenService tokenService;
    @Autowired private SessionManagementService sessionManagementService;
    @Autowired private ConfigurationService configurationService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> credentials,
            HttpServletRequest request) {
        String identifier = credentials.get("identifier");
        if (identifier == null || identifier.isBlank()) identifier = credentials.get("username");
        if (identifier == null || identifier.isBlank()) identifier = credentials.get("email");
        String password = credentials.get("password");
        String clientIp = resolveClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        try {
            Map<String, Object> result = authService.authenticate(identifier, password, clientIp, userAgent);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Authentication service error: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        String clientIp = resolveClientIp(request);
        User authUser = (User) request.getAttribute("authenticatedUser");
        String actor = authUser != null ? authUser.getUsername() : null;

        authService.logout(authHeader, actor, clientIp);
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully. Active session revoked."));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody Map<String, String> payload,
            HttpServletRequest request) {
        String identifier = payload.get("identifier");
        if (identifier == null || identifier.isBlank()) identifier = payload.get("username");
        if (identifier == null || identifier.isBlank()) identifier = payload.get("email");
        String clientIp = resolveClientIp(request);

        try {
            Map<String, Object> result = authService.forgotPassword(identifier, clientIp);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody Map<String, String> payload,
            HttpServletRequest request) {
        String token = payload.get("token");
        String newPassword = payload.get("newPassword");
        String clientIp = resolveClientIp(request);

        try {
            Map<String, Object> result = authService.resetPassword(token, newPassword, clientIp);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @RequestBody Map<String, String> payload,
            HttpServletRequest request) {
        // SEC-07: Resolve authenticated user from principal/request attribute ONLY (preventing userId manipulation)
        User authUser = (User) request.getAttribute("authenticatedUser");
        if (authUser == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Authentication required to change password."));
        }

        String currentPassword = payload.get("currentPassword");
        String newPassword = payload.get("newPassword");
        String clientIp = resolveClientIp(request);

        try {
            Map<String, Object> result = authService.changePassword(authUser.getUsername(), currentPassword, newPassword, clientIp);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/session/refresh")
    public ResponseEntity<Map<String, Object>> refreshSession(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        // SEC-02: Server-enforced session extension ("Stay Logged In")
        User authUser = (User) request.getAttribute("authenticatedUser");
        TokenService.TokenClaims claims = tokenService.validateAndExtract(authHeader);
        if (claims == null || claims.sessionId == null || authUser == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Valid active session required for renewal."));
        }

        try {
            UserSession refreshed = sessionManagementService.refreshSession(claims.sessionId, authUser.getUsername());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Session refreshed successfully.",
                    "expiresAt", refreshed.getExpiresAt().toString(),
                    "sessionTimeoutMinutes", refreshed.getIdleTimeoutMinutes()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/session/validate")
    public ResponseEntity<Map<String, Object>> validateSession(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        User authUser = (User) request.getAttribute("authenticatedUser");
        TokenService.TokenClaims claims = tokenService.validateAndExtract(authHeader);
        if (claims == null || authUser == null) {
            return ResponseEntity.status(401).body(Map.of("valid", false, "message", "Session is expired or revoked."));
        }
        return ResponseEntity.ok(Map.of(
                "valid", true,
                "active", authUser.isActive(),
                "username", authUser.getUsername(),
                "role", authUser.getRole(),
                "user", authService.safeUser(authUser)
        ));
    }

    @GetMapping("/policy")
    public ResponseEntity<Map<String, Object>> getPolicy() {
        return ResponseEntity.ok(authService.getPasswordPolicy());
    }

    /**
     * SEC-16: Trusted reverse proxy IP resolution. Only honors X-Forwarded-For if request comes from trusted proxy.
     */
    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String remoteAddr = request.getRemoteAddr();

        String trustedConfig = configurationService != null
                ? configurationService.getString("trusted_proxies", "127.0.0.1,::1,localhost,0:0:0:0:0:0:0:1")
                : "127.0.0.1,::1,localhost,0:0:0:0:0:0:0:1";

        List<String> trusted = Arrays.stream(trustedConfig.split(",")).map(String::trim).toList();
        boolean isTrusted = trusted.contains(remoteAddr) || "127.0.0.1".equals(remoteAddr) || "0:0:0:0:0:0:0:1".equals(remoteAddr);

        if (isTrusted) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank() && !"unknown".equalsIgnoreCase(forwarded)) {
                return forwarded.split(",")[0].trim();
            }
        }
        return remoteAddr != null ? remoteAddr : "127.0.0.1";
    }
}
