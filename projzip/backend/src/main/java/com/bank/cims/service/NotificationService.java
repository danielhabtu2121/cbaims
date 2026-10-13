package com.bank.cims.service;

import com.bank.cims.dto.NotificationDispatchResult;
import com.bank.cims.model.Notification;
import com.bank.cims.model.SystemParameter;
import com.bank.cims.repository.NotificationRepository;
import com.bank.cims.repository.SystemParameterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationTemplateService notificationTemplateService;

    @Autowired
    private OutlookIntegrationService outlookIntegrationService;

    @Autowired
    private SmsIntegrationService smsIntegrationService;

    @Autowired
    private SystemParameterRepository systemParameterRepository;

    @Transactional
    public Notification sendNotification(
            String channel,
            String templateCode,
            String recipient,
            String recipientName,
            String defaultSubject,
            String defaultBody,
            String entityType,
            String entityId,
            Map<String, Object> context) {

        String effectiveChannel = (channel != null && !channel.isBlank()) ? channel : "Email";
        String effectiveTemplateCode = (templateCode != null && !templateCode.isBlank()) ? templateCode : "GENERAL_ALERT";
        String effectiveRecipient = (recipient != null && !recipient.isBlank()) ? recipient : "alerts@cims-bank.et";
        String effectiveRecipientName = (recipientName != null && !recipientName.isBlank()) ? recipientName : "CIMS Officer";

        Map<String, Object> ctx = context != null ? new HashMap<>(context) : new HashMap<>();
        ctx.putIfAbsent("Customer Name", effectiveRecipientName);
        ctx.putIfAbsent("Maker ID", effectiveRecipientName);
        ctx.putIfAbsent("Entity ID", entityId != null ? entityId : "");

        Map<String, String> rendered = notificationTemplateService != null
                ? notificationTemplateService.render(effectiveTemplateCode, effectiveChannel, defaultSubject, defaultBody, ctx)
                : Map.of("subject", defaultSubject != null ? defaultSubject : "CIMS Alert", "body", defaultBody != null ? defaultBody : "");

        String subject = rendered.getOrDefault("subject", defaultSubject != null ? defaultSubject : "CIMS Alert");
        String messageBody = rendered.getOrDefault("body", defaultBody != null ? defaultBody : "");

        Notification n = new Notification();
        n.setId("notif-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        n.setChannel(effectiveChannel);
        n.setTemplateCode(effectiveTemplateCode);
        n.setRecipient(effectiveRecipient);
        n.setRecipientName(effectiveRecipientName);
        n.setSubject(subject);
        n.setMessageBody(messageBody);
        n.setEntityType(entityType);
        n.setEntityId(entityId);
        n.setReadStatus("UNREAD");
        n.setRetryCount(0);

        NotificationDispatchResult dispatchResult;
        if ("SMS".equalsIgnoreCase(effectiveChannel)) {
            dispatchResult = smsIntegrationService.sendSms(effectiveRecipient, messageBody, entityType, entityId);
        } else {
            // Email / Outlook
            dispatchResult = outlookIntegrationService.sendOutlookEmail(effectiveRecipient, effectiveRecipientName, subject, messageBody, entityType, entityId);
        }

        n.setChannelProvider(dispatchResult.getProvider());
        n.setDeliveryReference(dispatchResult.getDeliveryReference());
        n.setStatus(dispatchResult.getStatus());
        n.setErrorMessage(dispatchResult.getErrorMessage());
        n.setSentAt(dispatchResult.getTimestamp());

        Notification saved = notificationRepository.save(n);
        log.info("Saved notification [{}] - Channel: {} Provider: {} Status: {} Ref: {}",
                saved.getId(), saved.getChannel(), saved.getChannelProvider(), saved.getStatus(), saved.getDeliveryReference());
        return saved;
    }

    public Notification sendNotification(String channel, String templateCode, String recipient, String recipientName, String subject, String messageBody, String entityType, String entityId) {
        return sendNotification(channel, templateCode, recipient, recipientName, subject, messageBody, entityType, entityId, Collections.emptyMap());
    }

    @Transactional
    public Notification retryNotification(String notificationId, String operatorId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found: " + notificationId));

        n.setRetryCount(n.getRetryCount() + 1);

        NotificationDispatchResult dispatchResult;
        if ("SMS".equalsIgnoreCase(n.getChannel())) {
            dispatchResult = smsIntegrationService.sendSms(n.getRecipient(), n.getMessageBody(), n.getEntityType(), n.getEntityId());
        } else {
            dispatchResult = outlookIntegrationService.sendOutlookEmail(n.getRecipient(), n.getRecipientName(), n.getSubject(), n.getMessageBody(), n.getEntityType(), n.getEntityId());
        }

        n.setChannelProvider(dispatchResult.getProvider());
        n.setDeliveryReference(dispatchResult.getDeliveryReference());
        n.setStatus(dispatchResult.getStatus());
        n.setErrorMessage(dispatchResult.getErrorMessage());
        n.setSentAt(LocalDateTime.now().toString());

        log.info("Retried notification [{}] by operator {} - New status: {}", n.getId(), operatorId, n.getStatus());
        return notificationRepository.save(n);
    }

    @Transactional
    public Notification markAsRead(String notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found: " + notificationId));
        n.setReadStatus("READ");
        n.setReadAt(LocalDateTime.now().toString());
        return notificationRepository.save(n);
    }

    @Transactional
    public int markAllAsRead(String recipient) {
        List<Notification> list = (recipient != null && !recipient.isBlank())
                ? notificationRepository.findByRecipientOrderBySentAtDesc(recipient)
                : notificationRepository.findAll();

        int updated = 0;
        String now = LocalDateTime.now().toString();
        for (Notification n : list) {
            if (!"READ".equalsIgnoreCase(n.getReadStatus())) {
                n.setReadStatus("READ");
                n.setReadAt(now);
                notificationRepository.save(n);
                updated++;
            }
        }
        return updated;
    }

    public long getUnreadCount(String recipient) {
        if (recipient != null && !recipient.isBlank()) {
            return notificationRepository.findByRecipientOrderBySentAtDesc(recipient).stream()
                    .filter(n -> !"READ".equalsIgnoreCase(n.getReadStatus()))
                    .count();
        }
        return notificationRepository.countByReadStatus("UNREAD");
    }

    public List<Notification> getNotifications(String channel, String status, String recipient, String query, Integer limit) {
        List<Notification> all = (recipient != null && !recipient.isBlank())
                ? notificationRepository.findByRecipientOrderBySentAtDesc(recipient)
                : notificationRepository.findTop500ByOrderBySentAtDesc();

        return all.stream()
                .filter(n -> channel == null || "ALL".equalsIgnoreCase(channel) || channel.equalsIgnoreCase(n.getChannel()))
                .filter(n -> status == null || "ALL".equalsIgnoreCase(status) || status.equalsIgnoreCase(n.getStatus()))
                .filter(n -> {
                    if (query == null || query.isBlank()) return true;
                    String q = query.toLowerCase(Locale.ROOT);
                    return (n.getSubject() != null && n.getSubject().toLowerCase(Locale.ROOT).contains(q)) ||
                            (n.getMessageBody() != null && n.getMessageBody().toLowerCase(Locale.ROOT).contains(q)) ||
                            (n.getRecipient() != null && n.getRecipient().toLowerCase(Locale.ROOT).contains(q)) ||
                            (n.getRecipientName() != null && n.getRecipientName().toLowerCase(Locale.ROOT).contains(q)) ||
                            (n.getEntityId() != null && n.getEntityId().toLowerCase(Locale.ROOT).contains(q));
                })
                .limit(limit != null && limit > 0 ? limit : 200)
                .toList();
    }

    public Map<String, Object> getNotificationStats() {
        List<Notification> all = notificationRepository.findAll();
        long total = all.size();
        long sent = all.stream().filter(n -> "Sent".equalsIgnoreCase(n.getStatus())).count();
        long failed = all.stream().filter(n -> "Failed".equalsIgnoreCase(n.getStatus())).count();
        long email = all.stream().filter(n -> "Email".equalsIgnoreCase(n.getChannel()) || "Outlook".equalsIgnoreCase(n.getChannel())).count();
        long sms = all.stream().filter(n -> "SMS".equalsIgnoreCase(n.getChannel())).count();
        long unread = all.stream().filter(n -> !"READ".equalsIgnoreCase(n.getReadStatus())).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", total);
        stats.put("sent", sent);
        stats.put("failed", failed);
        stats.put("pending", total - (sent + failed));
        stats.put("emailCount", email);
        stats.put("smsCount", sms);
        stats.put("unreadCount", unread);
        stats.put("outlookStatus", outlookIntegrationService.isEnabled() ? "READY" : "DISABLED");
        stats.put("smsStatus", smsIntegrationService.isEnabled() ? "READY" : "DISABLED");
        return stats;
    }

    public Map<String, Object> getIntegrationsStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("outlook", outlookIntegrationService.testConnection());
        status.put("sms", smsIntegrationService.testConnection());
        status.put("timestamp", LocalDateTime.now().toString());
        return status;
    }

    public Map<String, String> getIntegrationConfig() {
        Map<String, String> config = new LinkedHashMap<>();
        List<String> keys = List.of(
                "notification_outlook_enabled",
                "notification_outlook_provider",
                "notification_outlook_tenant_id",
                "notification_outlook_client_id",
                "notification_outlook_sender_email",
                "notification_outlook_smtp_host",
                "notification_outlook_smtp_port",
                "notification_outlook_smtp_starttls",
                "notification_sms_enabled",
                "notification_sms_provider",
                "notification_sms_gateway_url",
                "notification_sms_sender_id",
                "notification_sms_max_concat_parts"
        );

        for (String k : keys) {
            systemParameterRepository.findById(k).ifPresent(p -> config.put(k, p.getParamValue()));
        }
        return config;
    }

    @Transactional
    public Map<String, String> saveIntegrationConfig(Map<String, String> updates, String updatedBy) {
        if (updates != null) {
            for (Map.Entry<String, String> entry : updates.entrySet()) {
                String key = entry.getKey();
                String val = entry.getValue();
                if (key != null && key.startsWith("notification_") && val != null) {
                    SystemParameter param = systemParameterRepository.findById(key)
                            .orElse(new SystemParameter(key, val, "Notification Integration Parameter", "string"));
                    param.setParamValue(val);
                    systemParameterRepository.save(param);
                }
            }
        }
        return getIntegrationConfig();
    }
}
