package com.bank.cims.service;

import com.bank.cims.model.NotificationTemplate;
import com.bank.cims.model.ReminderSchedule;
import com.bank.cims.repository.NotificationTemplateRepository;
import com.bank.cims.repository.ReminderScheduleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.util.*;

@Service
@Transactional
public class ReminderConfigurationService {
    @Autowired private ReminderScheduleRepository repository;
    @Autowired private NotificationTemplateRepository templateRepository;
    @Autowired @Lazy private CimsService cimsService;

    @PostConstruct
    public void ensureStandardSchedule() {
        // Standard bank policy reminder schedule:
        // 1) 30 working days before expiry
        ensure("rem-30w", "30 Working Days Pre-Expiry Notice", 30, "Working Day", "Before Expiry", "One-time", 1, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\",\"BRMGR\"]");
        // 2) 25 working days before expiry
        ensure("rem-25w", "25 Working Days Pre-Expiry Notice", 25, "Working Day", "Before Expiry", "One-time", 1, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]");
        // 3) 20 working days before expiry
        ensure("rem-20w", "20 Working Days Pre-Expiry Notice", 20, "Working Day", "Before Expiry", "One-time", 1, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]");
        // 4) 10 calendar days before expiry
        ensure("rem-10c", "10 Calendar Days Final Pre-Expiry Alert", 10, "Calendar Day", "Before Expiry", "One-time", 1, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\",\"BRMGR\"]");
        // 5) 5 calendar days after expiry
        ensure("rem-5c-post", "5 Calendar Days Grace Period Notice", 5, "Calendar Day", "After Expiry", "One-time", 1, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\",\"BRMGR\"]");
        // 6) Overdue > 10 days: repeat every 15 days
        ensure("rem-15c-repeat", "Overdue Recurring Follow-up", 10, "Calendar Day", "After Expiry", "Repeat Every 15 Days", 15, "DAYS", "Both", "[\"Email\",\"SMS\"]", "[\"CRO\",\"BRO\",\"SRM\",\"BRM\",\"BRMGR\",\"DISTDIR\"]");
    }

    private void ensure(String id, String name, int offset, String dayType, String triggerBasis, String recurrence, int interval, String unit, String audience, String channels, String roles) {
        if (repository.findById(id).isEmpty()) {
            ReminderSchedule r = new ReminderSchedule();
            r.setId(id);
            r.setName(name);
            r.setOffsetDays(offset);
            r.setDaysBeforeExpiry(offset);
            r.setDayType(dayType);
            r.setTriggerBasis(triggerBasis);
            r.setRecurrence(recurrence);
            r.setRecurrenceInterval(interval);
            r.setRecurrenceUnit(unit);
            r.setAudience(audience);
            r.setContinueUntil("Renewed");
            r.setChannelsJson(channels);
            r.setRecipientRolesJson(roles);
            r.setActive(true);
            repository.save(r);
            ensureAudienceTemplates(r);
        }
    }

    public List<ReminderSchedule> getAll() {
        return repository.findAllByOrderByDaysBeforeExpiryDesc();
    }

    public ReminderSchedule save(ReminderSchedule incoming, String userId) {
        if (incoming == null) {
            throw new IllegalArgumentException("Reminder schedule payload is required.");
        }
        int offset = incoming.getOffsetDays() > 0 ? incoming.getOffsetDays() : incoming.getDaysBeforeExpiry();
        if (offset <= 0 || offset > 3650) {
            throw new IllegalArgumentException("Reminder offset days must be between 1 and 3650.");
        }
        incoming.setOffsetDays(offset);
        incoming.setDaysBeforeExpiry(offset);

        validateChannels(incoming.getChannelsJson());
        validateRoles(incoming.getRecipientRolesJson());

        if (incoming.getDayType() == null || incoming.getDayType().isBlank()) {
            incoming.setDayType("Working Day");
        }
        if (incoming.getTriggerBasis() == null || incoming.getTriggerBasis().isBlank()) {
            incoming.setTriggerBasis("Before Expiry");
        }

        // Validate recurrence interval (must be positive) and unit
        String unit = incoming.getRecurrenceUnit() != null ? incoming.getRecurrenceUnit().toUpperCase(Locale.ROOT) : "DAYS";
        int interval = incoming.getRecurrenceInterval() > 0 ? incoming.getRecurrenceInterval() : 1;
        incoming.setRecurrenceInterval(interval);
        incoming.setRecurrenceUnit(unit);

        if ("MINUTES".equalsIgnoreCase(unit)) {
            if (interval <= 0) {
                throw new IllegalArgumentException("Testing recurrence interval in minutes must be a positive integer.");
            }
            incoming.setRecurrence("Every " + interval + " Minutes (For testing purposes)");
        } else if ("DAYS".equalsIgnoreCase(unit) || "WORKING_DAYS".equalsIgnoreCase(unit) || "CALENDAR_DAYS".equalsIgnoreCase(unit)) {
            if (interval <= 0) {
                throw new IllegalArgumentException("Recurrence interval in days must be a positive integer.");
            }
            if (interval == 1 && (incoming.getRecurrence() == null || "One-time".equalsIgnoreCase(incoming.getRecurrence()))) {
                incoming.setRecurrence("One-time");
            } else {
                incoming.setRecurrence("Every " + interval + " " + incoming.getDayType() + "s");
            }
        } else {
            if (incoming.getRecurrence() == null || incoming.getRecurrence().isBlank()) {
                incoming.setRecurrence("One-time");
            }
        }

        if (incoming.getAudience() == null || incoming.getAudience().isBlank()) {
            incoming.setAudience("Both");
        }

        // Reminder Name is mandatory and must be unique: it is how a schedule is
        // identified in the listing and when linking message templates.
        if (incoming.getName() == null || incoming.getName().trim().isBlank()) {
            throw new IllegalArgumentException("Reminder name is mandatory.");
        }
        incoming.setName(incoming.getName().trim());

        String id = incoming.getId();
        Optional<ReminderSchedule> existing = (id == null || id.isBlank()) ? Optional.empty() : repository.findById(id);

        boolean duplicateName = repository.findAll().stream()
                .anyMatch(r -> r.getName() != null
                        && r.getName().trim().equalsIgnoreCase(incoming.getName())
                        && (id == null || id.isBlank() || !r.getId().equals(id)));
        if (duplicateName) {
            throw new IllegalArgumentException("A reminder schedule named '" + incoming.getName() + "' already exists. Reminder names must be unique.");
        }

        // Check for duplicate with identical trigger basis, offset days, and day type
        Optional<ReminderSchedule> duplicate = repository.findAll().stream()
                .filter(r -> r.getOffsetDays() == offset &&
                        Objects.equals(r.getTriggerBasis(), incoming.getTriggerBasis()) &&
                        Objects.equals(r.getDayType(), incoming.getDayType()) &&
                        Objects.equals(r.getRecurrence(), incoming.getRecurrence()))
                .findFirst();

        if (duplicate.isPresent() && (id == null || !duplicate.get().getId().equals(id))) {
            throw new IllegalArgumentException("A reminder schedule with the same trigger basis ("
                    + incoming.getTriggerBasis() + "), offset (" + offset + " " + incoming.getDayType()
                    + ") and recurrence already exists.");
        }

        if (id == null || id.isBlank()) {
            incoming.setId("rem-" + (incoming.getTriggerBasis().toLowerCase().contains("after") ? "post-" : "")
                    + offset + ("Working Day".equalsIgnoreCase(incoming.getDayType()) ? "w" : "c")
                    + (incoming.getRecurrence().toLowerCase().contains("repeat") ? "-rep" : "")
                    + ("MINUTES".equalsIgnoreCase(unit) ? "-test-min" : ""));
        }

        // Validate that all required audience-specific templates are configured before activating
        if (incoming.isActive()) {
            validateRequiredAudienceTemplates(incoming);
        }

        String old = existing.map(this::state).orElse("<not configured>");
        ReminderSchedule saved = repository.save(incoming);
        cimsService.logAudit(
                userId == null ? "SYSADMIN" : userId,
                "SYSADMIN",
                "SAVE_REMINDER_SCHEDULE",
                "ReminderSchedule",
                saved.getId(),
                "Configuration",
                old,
                state(saved),
                "Reminder schedule updated; runtime scheduler will use it immediately."
        );
        return saved;
    }

    /**
     * Validates that all audiences configured on this schedule have corresponding audience templates.
     * If templates are missing for a new schedule, starter templates are automatically provisioned.
     */
    public void validateRequiredAudienceTemplates(ReminderSchedule schedule) {
        if (schedule == null || schedule.getId() == null) return;
        List<NotificationTemplate> existingTemplates = templateRepository.findByScheduleId(schedule.getId());
        Set<String> audiencesNeeded = parseAudiences(schedule.getAudience());

        for (String aud : audiencesNeeded) {
            boolean hasAudTemplate = existingTemplates.stream()
                    .anyMatch(t -> t.isActive() && aud.equalsIgnoreCase(t.getAudience()));
            if (!hasAudTemplate) {
                // Auto-provision initial starter template so activation succeeds and templates remain linked
                createStarterTemplateForAudience(schedule, aud);
            }
        }
    }

    public Set<String> parseAudiences(String audienceStr) {
        Set<String> set = new LinkedHashSet<>();
        if (audienceStr == null || audienceStr.isBlank()) {
            set.add("Staff");
            return set;
        }
        String lower = audienceStr.toLowerCase(Locale.ROOT);
        if (lower.contains("both") || (lower.contains("staff") && lower.contains("customer"))) {
            set.add("Staff");
            set.add("Customer");
        } else if (lower.contains("customer")) {
            set.add("Customer");
        } else if (lower.contains("insurer") || lower.contains("insurance")) {
            set.add("Insurer");
        } else {
            set.add("Staff");
        }
        if (lower.contains("insurer") || lower.contains("insurance")) {
            set.add("Insurer");
        }
        return set;
    }

    public void ensureAudienceTemplates(ReminderSchedule schedule) {
        Set<String> auds = parseAudiences(schedule.getAudience());
        for (String a : auds) {
            createStarterTemplateForAudience(schedule, a);
        }
    }

    private void createStarterTemplateForAudience(ReminderSchedule schedule, String audience) {
        String id = "tmpl-" + schedule.getId() + "-" + audience.toLowerCase();
        if (templateRepository.findById(id).isPresent()) return;

        boolean isAfter = schedule.getTriggerBasis() != null && schedule.getTriggerBasis().toLowerCase().contains("after");
        String subject;
        String body;

        if ("Staff".equalsIgnoreCase(audience)) {
            subject = "Staff Alert: Insurance Expiry " + (isAfter ? "Overdue" : "Due") + " - {Policy Number}";
            body = "Dear {Staff Name},\n\nPolicy {Policy Number} for collateral {Collateral ID} (Customer: {Customer Name}) " +
                    (isAfter ? "expired on {Expiry Date} and is currently overdue." : "is expiring on {Expiry Date}.") +
                    "\nPlease review and initiate required renewal actions.\n\nBranch: {Branch Name}";
        } else if ("Customer".equalsIgnoreCase(audience)) {
            subject = "Dashen Bank Notice: Insurance Policy Renewal - {Policy Number}";
            body = "Dear {Customer Name},\n\nYour insurance policy {Policy Number} securing your loan at Dashen Bank " +
                    (isAfter ? "expired on {Expiry Date}." : "expires on {Expiry Date}.") +
                    "\nPlease submit your renewal policy certificate to avoid loan irregularity.";
        } else {
            subject = "Underwriter Notice: Insurance Expiry Reminder - {Policy Number}";
            body = "Dear Partner Underwriter {Insurer Name},\n\nPlease be advised that policy {Policy Number} for collateral {Collateral ID} " +
                    (isAfter ? "expired on {Expiry Date}." : "will expire on {Expiry Date}.") +
                    "\nPlease coordinate renewal with Dashen Bank.";
        }

        NotificationTemplate t = new NotificationTemplate(
                id,
                schedule.getName() + " (" + audience + ")",
                "Email",
                schedule.getOffsetDays(),
                schedule.getId(),
                audience,
                subject,
                body,
                true
        );
        templateRepository.save(t);
    }

    private void validateChannels(String json) {
        List<String> a = parse(json);
        if (a.isEmpty()) throw new IllegalArgumentException("At least one notification channel is required.");
        for (String x : a) {
            if (!x.equalsIgnoreCase("Email") && !x.equalsIgnoreCase("SMS")) {
                throw new IllegalArgumentException("Unsupported reminder channel: " + x);
            }
        }
    }

    private void validateRoles(String json) {
        if (parse(json).isEmpty()) throw new IllegalArgumentException("At least one recipient role is required.");
    }

    private List<String> parse(String json) {
        if (json == null) return List.of();
        String n = json.trim();
        if (n.startsWith("[") && n.endsWith("]")) n = n.substring(1, n.length() - 1);
        if (n.isBlank()) return List.of();
        List<String> r = new ArrayList<>();
        for (String s : n.split(",")) {
            String v = s.trim().replaceAll("^\"|\"$", "");
            if (!v.isBlank()) r.add(v);
        }
        return r;
    }

    private String state(ReminderSchedule s) {
        return "name=" + s.getName() + ", offset=" + s.getOffsetDays() + ", basis=" + s.getTriggerBasis() + ", dayType=" + s.getDayType()
                + ", recurrence=" + s.getRecurrence() + ", interval=" + s.getRecurrenceInterval() + ", unit=" + s.getRecurrenceUnit()
                + ", channels=" + s.getChannelsJson() + ", active=" + s.isActive();
    }
}
