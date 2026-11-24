package com.bank.cims.config;

import com.bank.cims.model.User;
import com.bank.cims.repository.UserRepository;
import com.bank.cims.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class SecurityAuthenticationInterceptor implements HandlerInterceptor {

    @Autowired private UserRepository userRepository;
    @Autowired private TokenService tokenService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();

        // 1. Only intercept API routes
        if (!uri.startsWith("/api/")) {
            return true;
        }

        // 2. Allow CORS preflight OPTIONS requests
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }

        // 3. SEC-01.A: Allow only specifically whitelisted public authentication operations & health probes
        if (isPublicEndpoint(uri)) {
            return true;
        }

        // 4. SEC-01.B: Authoritative identity from cryptographically verified token ONLY
        // Caller-supplied parameters or headers (X-User-Id, userId, adminUserId) are NEVER trusted as proof of identity
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || authHeader.isBlank()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required. Please log in to access CIMS resources.");
            return false;
        }

        TokenService.TokenClaims claims = tokenService.validateAndExtract(authHeader);
        if (claims == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired session token. Please re-authenticate.");
            return false;
        }

        String userId = claims.userId != null && !claims.userId.isBlank() ? claims.userId : claims.username;

        // 5. Verify user existence, active status, and account lockout in database
        User user = findUser(userId);
        if (user == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "User account not recognized. Please sign in with valid bank credentials.");
            return false;
        }

        if (!user.isActive()) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "User account is deactivated. Access denied.");
            return false;
        }

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now())) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "User account is temporarily locked due to failed login attempts. Access denied.");
            return false;
        }

        // 6. Administration endpoints are restricted to configured system administrators.
        // Frontend routing hides/disables the Admin page for everyone else; this is the
        // authoritative backend guard for direct API calls.
        if (uri.startsWith("/api/admin/") && !isAdminRole(user.getRole())) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Access denied: administrative configuration is restricted to system administrators.");
            return false;
        }

        // 7. Backend-enforced read-only guarantee for audit / governance inspection roles.
        // Approval authority itself is validated per task by WorkflowAuthorizationService
        // against the Admin-configured Approval Hierarchy - there is no hardcoded role list here.
        String method = request.getMethod().toUpperCase();
        boolean mutating = "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method);
        if (mutating && isReadOnlyRole(user.getRole()) && !isSelfServiceEndpoint(uri)) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Read-only account: role '" + user.getRole() + "' cannot modify records. Audit access is strictly read-only.");
            return false;
        }

        // Bind verified identity into request and Spring Security Context
        request.setAttribute("authenticatedUser", user);
        request.setAttribute("authenticatedUserId", user.getUsername());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        user.getUsername(), null, List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + user.getRole()))
                )
        );
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    private boolean isPublicEndpoint(String uri) {
        return uri.equals("/api/auth/login")
                || uri.equals("/api/auth/forgot-password")
                || uri.equals("/api/auth/reset-password")
                || uri.equals("/api/auth/policy");
    }

    private boolean isAdminRole(String role) {
        if (role == null || role.isBlank()) return false;
        String r = role.trim().toUpperCase(Locale.ROOT);
        return r.contains("SYSADMIN") || r.equals("ADMIN") || r.endsWith("_ADMIN");
    }

    private boolean isReadOnlyRole(String role) {
        if (role == null) return true;
        String r = role.trim().toUpperCase();
        return r.equals("AUDITOR") || r.equals("AUDIT") || r.equals("RDONLY")
                || r.startsWith("TEST_AUDIT") || r.equals("TEST_RISK_VIEW")
                || r.equals("TEST_COMPLIANCE_VIEW") || r.equals("TEST_SYSADMIN");
    }

    private boolean isSelfServiceEndpoint(String uri) {
        return uri.equals("/api/auth/logout")
                || uri.equals("/api/auth/change-password")
                || uri.equals("/api/auth/session/refresh")
                || uri.equals("/api/auth/session/validate")
                || uri.startsWith("/api/notifications/") && uri.endsWith("/read");
    }

    private User findUser(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return userRepository.findById(trimmed)
                .or(() -> userRepository.findByUsername(trimmed))
                .or(() -> userRepository.findByUsernameIgnoreCase(trimmed))
                .orElse(null);
    }

    private void writeError(HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"success\":false,\"error\":\"" + message.replace("\"", "\\\"") + "\"}");
    }
}
