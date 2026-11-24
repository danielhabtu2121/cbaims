package com.bank.cims.controller;

import com.bank.cims.dto.NotificationDispatchResult;
import com.bank.cims.model.Notification;
import com.bank.cims.model.User;
import com.bank.cims.repository.UserRepository;
import com.bank.cims.service.NotificationService;
import com.bank.cims.service.OutlookIntegrationService;
import com.bank.cims.service.SmsIntegrationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private OutlookIntegrationService outlookIntegrationService;

    @Autowired
    private SmsIntegrationService smsIntegrationService;

    @Autowired
    private UserRepository userRepository;

    @Autowired(required = false)
    private HttpServletRequest httpRequest;

    private User resolveAuthenticatedUser() {
        if (httpRequest != null) {
            User reqUser = (User) httpRequest.getAttribute("authenticatedUser");
            if (reqUser != null) return reqUser;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String principal = String.valueOf(auth.getPrincipal());
            return userRepository.findByUsername(principal)
                    .or(() -> userRepository.findById(principal))
                    .orElse(null);
        }
        return null;
    }

    private User requireAuthenticatedUser() {
        User user = resolveAuthenticatedUser();
        if (user == null || !user.isActive()
                || (user.getId() == null && (user.getUsername() == null || user.getUsername().isBlank()))) {
            throw new org.springframework.security.access.AccessDeniedException("An authenticated user is required for this action.");
        }
        return user;
    }

    private String actorReference(User user) {
        return user.getId() != null && !user.getId().isBlank() ? user.getId() : user.getUsername();
    }

    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String recipient,
            @RequestParam(required = false) String query,
            @RequestParam(required = false, defaultValue = "100") Integer limit) {
        User user = resolveAuthenticatedUser();
        // Allow sysadmin to search or inspect all if explicitly specified, otherwise strictly filter to user inbox
        if (user != null && ("SYSADMIN".equalsIgnoreCase(user.getRole()) || "ADMIN".equalsIgnoreCase(user.getRole())) && recipient != null) {
            return ResponseEntity.ok(notificationService.getNotifications(channel, status, recipient, query, limit));
        }
        return ResponseEntity.ok(notificationService.getNotificationsForUser(user, channel, status, recipient, query, limit));
    }

    @PostMapping("/send")
    public ResponseEntity<Notification> sendNotification(@RequestBody Map<String, Object> req) {
        String channel = (String) req.getOrDefault("channel", "Email");
        String templateCode = (String) req.getOrDefault("templateCode", "MANUAL_DISPATCH");
        String recipient = (String) req.get("recipient");
        String recipientName = (String) req.getOrDefault("recipientName", "Banking Officer");
        String subject = (String) req.getOrDefault("subject", "CIMS Notification");
        String body = (String) req.getOrDefault("messageBody", req.getOrDefault("body", "Notification content"));
        String entityType = (String) req.getOrDefault("entityType", "General");
        String entityId = (String) req.getOrDefault("entityId", "");
        @SuppressWarnings("unchecked")
        Map<String, Object> context = (Map<String, Object>) req.get("context");

        Notification n = notificationService.sendNotification(
                channel, templateCode, recipient, recipientName, subject, body, entityType, entityId, context);
        return ResponseEntity.ok(n);
    }

    @PostMapping("/{id}/resend")
    public ResponseEntity<Notification> resendNotification(
            @PathVariable String id,
            @RequestParam(required = false) String operatorId) {
        return ResponseEntity.ok(notificationService.retryNotification(id, actorReference(requireAuthenticatedUser())));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable String id) {
        User user = resolveAuthenticatedUser();
        try {
            return ResponseEntity.ok(notificationService.markAsRead(id, user));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable String id) {
        User user = resolveAuthenticatedUser();
        try {
            notificationService.deleteNotification(id, user);
            return ResponseEntity.ok(Map.of("success", true, "message", "Notification deleted"));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        }
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<Map<String, Object>> markAllRead(@RequestParam(required = false) String recipient) {
        User user = resolveAuthenticatedUser();
        int count = user != null ? notificationService.markAllAsReadForUser(user) : notificationService.markAllAsRead(recipient);
        return ResponseEntity.ok(Map.of("success", true, "markedCount", count));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> getUnreadCount(@RequestParam(required = false) String recipient) {
        User user = resolveAuthenticatedUser();
        long count = user != null ? notificationService.getUnreadCountForUser(user) : notificationService.getUnreadCount(recipient);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PostMapping("/test-email")
    public ResponseEntity<?> sendTestEmail(@RequestBody Map<String, String> req) {
        String adminId = actorReference(requireAuthenticatedUser());
        String targetUserId = req.get("userId");
        if (targetUserId == null || targetUserId.isBlank()) {
            targetUserId = req.get("recipientUserId");
        }
        if (targetUserId == null || targetUserId.isBlank()) {
            targetUserId = adminId;
        }
        String subject = req.get("subject");
        String body = req.get("body");
        try {
            Map<String, Object> result = notificationService.sendAdminTestEmail(adminId, targetUserId, subject, body);
            return ResponseEntity.ok(result);
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("success", false, "error", se.getMessage()));
        } catch (IllegalArgumentException iae) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", iae.getMessage()));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(notificationService.getNotificationStats());
    }

    @GetMapping("/integrations/status")
    public ResponseEntity<Map<String, Object>> getIntegrationsStatus() {
        return ResponseEntity.ok(notificationService.getIntegrationsStatus());
    }

    @GetMapping("/integrations/config")
    public ResponseEntity<Map<String, String>> getIntegrationsConfig() {
        return ResponseEntity.ok(notificationService.getIntegrationConfig());
    }

    @PostMapping("/integrations/config")
    public ResponseEntity<Map<String, String>> saveIntegrationsConfig(
            @RequestBody Map<String, String> config,
            @RequestParam(required = false) String updatedBy) {
        return ResponseEntity.ok(notificationService.saveIntegrationConfig(config, actorReference(requireAuthenticatedUser())));
    }

    @PostMapping("/integrations/outlook/test")
    public ResponseEntity<NotificationDispatchResult> testOutlook(@RequestBody Map<String, String> req) {
        String recipient = req.getOrDefault("recipient", "credit-ops@cims-bank.et");
        String subject = req.getOrDefault("subject", "CIMS Outlook Integration Verification Test");
        String body = req.getOrDefault("body", "This is an automated test dispatch verifying that CIMS Microsoft Outlook / Office 365 outbound integration is active and operating.");
        NotificationDispatchResult res = outlookIntegrationService.sendOutlookEmail(
                recipient, "Credit Operations Checker", subject, body, "SystemIntegration", "OUTLOOK-TEST");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/integrations/sms/test")
    public ResponseEntity<NotificationDispatchResult> testSms(@RequestBody Map<String, String> req) {
        String phone = req.getOrDefault("phone", "+251911000111");
        String message = req.getOrDefault("message", "CIMS SMS Gateway Alert: Verification ping successful. Integration is online.");
        NotificationDispatchResult res = smsIntegrationService.sendSms(
                phone, message, "SystemIntegration", "SMS-TEST");
        return ResponseEntity.ok(res);
    }
}
