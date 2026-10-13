package com.bank.cims.controller;

import com.bank.cims.dto.NotificationDispatchResult;
import com.bank.cims.model.Notification;
import com.bank.cims.service.NotificationService;
import com.bank.cims.service.OutlookIntegrationService;
import com.bank.cims.service.SmsIntegrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String recipient,
            @RequestParam(required = false) String query,
            @RequestParam(required = false, defaultValue = "100") Integer limit) {
        return ResponseEntity.ok(notificationService.getNotifications(channel, status, recipient, query, limit));
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
            @RequestParam(required = false, defaultValue = "SYSADMIN") String operatorId) {
        return ResponseEntity.ok(notificationService.retryNotification(id, operatorId));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Notification> markRead(@PathVariable String id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<Map<String, Object>> markAllRead(@RequestParam(required = false) String recipient) {
        int count = notificationService.markAllAsRead(recipient);
        return ResponseEntity.ok(Map.of("success", true, "markedCount", count));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> getUnreadCount(@RequestParam(required = false) String recipient) {
        long count = notificationService.getUnreadCount(recipient);
        return ResponseEntity.ok(Map.of("unreadCount", count));
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
            @RequestParam(required = false, defaultValue = "SYSADMIN") String updatedBy) {
        return ResponseEntity.ok(notificationService.saveIntegrationConfig(config, updatedBy));
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
