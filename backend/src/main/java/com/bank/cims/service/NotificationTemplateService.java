package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Transactional
public class NotificationTemplateService {
    private static final Logger log = LoggerFactory.getLogger(NotificationTemplateService.class);

    @Autowired private NotificationTemplateRepository repository;
    @Autowired private InsurancePolicyRepository insurancePolicyRepository;
    @Autowired private CollateralRepository collateralRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private LoanAccountRepository loanAccountRepository;
    @Autowired private LoanCollateralLinkRepository loanCollateralLinkRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BusinessCalendarService businessCalendarService;
    @Autowired private ReminderScheduleRepository reminderScheduleRepository;
    @Autowired @Lazy private CimsService cimsService;

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{([^}]+)}");

    // Standard canonical placeholder names
    public static final Set<String> SUPPORTED_TOKENS = Set.of(
            "customername",
            "policynumber",
            "collateralid",
            "collateralcode",
            "expirydate",
            "effectivedate",
            "insurername",
            "loanaccountnumber",
            "facilitynumber",
            "branchname",
            "branch",
            "currentdate",
            "reportdate",
            "daysremaining",
            "daysoverdue",
            "amount",
            "insuredamount",
            "premium",
            "coveragetype",
            "makerid",
            "checkerid",
            "actiontype",
            "remarks",
            "comments",
            "rmname",
            "rmphone",
            "rmemail",
            "rmcontact",
            "rejectionreason",
            "entityid",
            "entitytype",
            "districtname",
            "areaoffice",
            "overduecount",
            "totalexposure",
            "escalationstage",
            "totalpolicies",
            "policydetails",
            "staffname",
            "summary",
            "expiringcount"
    );

    public String canonicalKey(String placeholder) {
        if (placeholder == null) return "";
        return placeholder.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_\\-]+", "");
    }

    public void validateTemplatePlaceholders(String text) {
        if (text == null || text.isBlank()) return;
        Matcher m = PLACEHOLDER_PATTERN.matcher(text);
        while (m.find()) {
            String token = m.group(1).trim();
            String key = canonicalKey(token);
            if (!SUPPORTED_TOKENS.contains(key)) {
                throw new IllegalArgumentException("Unsupported template variable {" + token + "}. " +
                        "Supported placeholders include: {Customer Name}, {Policy Number}, {Collateral ID}, {Expiry Date}, " +
                        "{Insurer Name}, {Loan Account Number}, {Facility Number}, {Branch Name}, {Current Date}, " +
                        "{Days Remaining}, {Days Overdue}, {Insured Amount}.");
            }
        }
    }

    /**
     * Resolves context parameters dynamically from authoritative database records.
     */
    public Map<String, Object> resolveEntityContext(String entityType, String entityId, Map<String, Object> baseContext) {
        Map<String, Object> resolved = new HashMap<>();
        if (baseContext != null) {
            resolved.putAll(baseContext);
        }

        LocalDate today = LocalDate.now();
        resolved.putIfAbsent("Current Date", today.toString());
        resolved.putIfAbsent("Report Date", today.toString());

        if (entityId == null || entityId.isBlank()) {
            return resolved;
        }

        String normType = entityType != null ? entityType.replaceAll("\\s+", "").toLowerCase(Locale.ROOT) : "";
        if ("portfolio".equals(normType) || "portfolio".equalsIgnoreCase(entityId)) {
            resolvePortfolioContext(entityId, resolved, today);
        } else if ("insurancepolicy".equals(normType) || "policy".equals(normType)) {
            if ("portfolio".equalsIgnoreCase(entityId)) {
                resolvePortfolioContext(entityId, resolved, today);
            } else {
                resolveInsurancePolicyContext(entityId, resolved, today);
            }
        } else if ("collateral".equals(normType)) {
            resolveCollateralContext(entityId, resolved, today);
        } else if ("customer".equals(normType)) {
            resolveCustomerContext(entityId, resolved);
        }

        return resolved;
    }

    private void resolveInsurancePolicyContext(String policyRef, Map<String, Object> ctx, LocalDate today) {
        InsurancePolicy policy = insurancePolicyRepository.findById(policyRef)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyRef))
                .or(() -> insurancePolicyRepository.findByPolicyNumberIgnoreCase(policyRef))
                .orElse(null);

        if (policy == null) {
            log.warn("Cannot resolve InsurancePolicy entity from ref: {}", policyRef);
            return;
        }

        ctx.putIfAbsent("Policy Number", policy.getPolicyNumber());
        ctx.putIfAbsent("Expiry Date", policy.getExpiryDate() != null ? policy.getExpiryDate() : "");
        ctx.putIfAbsent("Effective Date", policy.getEffectiveDate() != null ? policy.getEffectiveDate() : "");
        ctx.putIfAbsent("Insurer Name", policy.getInsurerName() != null ? policy.getInsurerName() : "Approved Underwriter");
        ctx.putIfAbsent("Insured Amount", String.format(Locale.US, "%,.2f", policy.getInsuredAmount()));
        ctx.putIfAbsent("Amount", String.format(Locale.US, "%,.2f", policy.getInsuredAmount()));
        ctx.putIfAbsent("Premium", String.format(Locale.US, "%,.2f", policy.getPremium()));
        ctx.putIfAbsent("Coverage Type", policy.getCoverageType() != null ? policy.getCoverageType() : "Comprehensive");

        // Calculate days remaining or days overdue
        if (policy.getExpiryDate() != null && policy.getExpiryDate().length() >= 10) {
            try {
                LocalDate expiry = LocalDate.parse(policy.getExpiryDate().substring(0, 10));
                if (expiry.isBefore(today)) {
                    long overdue = ChronoUnit.DAYS.between(expiry, today);
                    ctx.putIfAbsent("Days Overdue", overdue);
                    ctx.putIfAbsent("Days Remaining", 0);
                } else {
                    int workingRemaining = businessCalendarService != null
                            ? businessCalendarService.workingDaysUntil(today, expiry)
                            : (int) ChronoUnit.DAYS.between(today, expiry);
                    ctx.putIfAbsent("Days Remaining", workingRemaining);
                    ctx.putIfAbsent("Days Overdue", 0);
                }
            } catch (Exception e) {
                log.warn("Could not parse policy expiry date {}: {}", policy.getExpiryDate(), e.getMessage());
            }
        }

        // Resolve collateral
        Collateral collateral = null;
        if (policy.getCollateralId() != null && !policy.getCollateralId().isBlank()) {
            collateral = collateralRepository.findById(policy.getCollateralId())
                    .or(() -> collateralRepository.findByCode(policy.getCollateralId()))
                    .orElse(null);
            if (collateral != null) {
                ctx.putIfAbsent("Collateral ID", collateral.getCode() != null ? collateral.getCode() : collateral.getId());
                ctx.putIfAbsent("Collateral Code", collateral.getCode() != null ? collateral.getCode() : collateral.getId());
                resolveBranch(collateral.getBranch(), ctx);
            } else {
                ctx.putIfAbsent("Collateral ID", policy.getCollateralId());
            }
        }

        // Resolve customer
        String customerId = policy.getCustomerId();
        if ((customerId == null || customerId.isBlank()) && collateral != null) {
            customerId = collateral.getCustomerId();
        }
        if (customerId != null && !customerId.isBlank()) {
            resolveCustomer(customerId, ctx);
        }

        // Resolve loan account and facility number
        if (policy.getLoanAccountId() != null && !policy.getLoanAccountId().isBlank()) {
            resolveLoanAccount(policy.getLoanAccountId(), ctx);
        } else if (collateral != null) {
            List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
            if (links != null && !links.isEmpty()) {
                resolveLoanAccount(links.get(0).getLoanAccountId(), ctx);
            }
        }
        ctx.putIfAbsent("Loan Account Number", "Unlinked");
        ctx.putIfAbsent("Facility Number", "Unlinked");

        // Guarantee Relationship Manager and Branch placeholders are always populated
        String branchHint = collateral != null ? collateral.getBranch() : null;
        resolveRelationshipManager(null, branchHint, ctx);
        if (branchHint != null && !branchHint.isBlank()) {
            resolveBranch(branchHint, ctx);
        }
    }

    private void resolvePortfolioContext(String entityId, Map<String, Object> ctx, LocalDate today) {
        ctx.putIfAbsent("Current Date", today.toString());
        ctx.putIfAbsent("Report Date", today.toString());
        ctx.putIfAbsent("report date", today.toString());
        ctx.putIfAbsent("District Name", String.valueOf(ctx.getOrDefault("district", ctx.getOrDefault("District", "All Districts"))));
        ctx.putIfAbsent("district name", String.valueOf(ctx.getOrDefault("district", ctx.getOrDefault("District", "All Districts"))));
        ctx.putIfAbsent("overdue count", String.valueOf(ctx.getOrDefault("overdueCount", "0")));
        ctx.putIfAbsent("total exposure", String.valueOf(ctx.getOrDefault("totalExposure", "0.00")));
        ctx.putIfAbsent("remarks", String.valueOf(ctx.getOrDefault("remarks", "Consolidated scheduled portfolio review.")));
        String staffName = String.valueOf(ctx.getOrDefault("Staff Name", ctx.getOrDefault("Customer Name", "CIMS Portfolio Manager")));
        ctx.putIfAbsent("Staff Name", staffName);
        ctx.putIfAbsent("staff name", staffName);
        String count = String.valueOf(ctx.getOrDefault("Total Policies", ctx.getOrDefault("Expiring Count", "0")));
        ctx.putIfAbsent("Total Policies", count);
        ctx.putIfAbsent("total policies", count);
        ctx.putIfAbsent("Expiring Count", count);
        ctx.putIfAbsent("expiring count", count);
        String details = String.valueOf(ctx.getOrDefault("Policy Details", ctx.getOrDefault("Summary", "No policies listed")));
        ctx.putIfAbsent("Policy Details", details);
        ctx.putIfAbsent("policy details", details);
        ctx.putIfAbsent("Summary", details);
        ctx.putIfAbsent("summary", details);
        String branch = String.valueOf(ctx.getOrDefault("Branch", "Head Office"));
        ctx.putIfAbsent("Branch", branch);
        ctx.putIfAbsent("branch", branch);
        ctx.putIfAbsent("Days Remaining", "Configured reminder stage");
        ctx.putIfAbsent("days remaining", "Configured reminder stage");
    }

    private void resolveCollateralContext(String collateralRef, Map<String, Object> ctx, LocalDate today) {
        Collateral col = collateralRepository.findById(collateralRef)
                .or(() -> collateralRepository.findByCode(collateralRef))
                .orElse(null);
        if (col == null) return;

        ctx.putIfAbsent("Collateral ID", col.getCode() != null ? col.getCode() : col.getId());
        ctx.putIfAbsent("Collateral Code", col.getCode() != null ? col.getCode() : col.getId());
        resolveBranch(col.getBranch(), ctx);
        if (col.getCustomerId() != null) {
            resolveCustomer(col.getCustomerId(), ctx);
        }

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        if (links != null && !links.isEmpty()) {
            resolveLoanAccount(links.get(0).getLoanAccountId(), ctx);
        }

        List<InsurancePolicy> policies = insurancePolicyRepository.findByCollateralId(col.getId());
        if (policies != null && !policies.isEmpty()) {
            InsurancePolicy activePolicy = policies.stream()
                    .filter(p -> "Active".equalsIgnoreCase(p.getStatus()) || "Expiring".equalsIgnoreCase(p.getStatus()))
                    .findFirst()
                    .orElse(policies.get(0));
            resolveInsurancePolicyContext(activePolicy.getId(), ctx, today);
        }
    }

    private void resolveCustomerContext(String customerRef, Map<String, Object> ctx) {
        resolveCustomer(customerRef, ctx);
    }

    private void resolveCustomer(String customerRef, Map<String, Object> ctx) {
        Customer c = customerRepository.findById(customerRef)
                .or(() -> customerRepository.findByCif(customerRef))
                .orElse(null);
        if (c != null) {
            ctx.putIfAbsent("Customer Name", c.getName());
            ctx.putIfAbsent("Customer Phone", c.getPhone() != null ? c.getPhone() : "");
            ctx.putIfAbsent("Customer Email", c.getEmail() != null ? c.getEmail() : "");
        }
    }

    private void resolveBranch(String branchCodeOrName, Map<String, Object> ctx) {
        if (branchCodeOrName == null || branchCodeOrName.isBlank()) return;
        Branch branch = branchRepository.findByCode(branchCodeOrName)
                .or(() -> branchRepository.findFirstByCodeIgnoreCase(branchCodeOrName))
                .or(() -> branchRepository.findFirstByNameIgnoreCase(branchCodeOrName))
                .orElse(null);
        if (branch != null) {
            ctx.putIfAbsent("Branch Name", branch.getName());
            ctx.putIfAbsent("Branch", branch.getName());
            ctx.putIfAbsent("branch", branch.getName());
        } else {
            ctx.putIfAbsent("Branch Name", branchCodeOrName);
            ctx.putIfAbsent("Branch", branchCodeOrName);
            ctx.putIfAbsent("branch", branchCodeOrName);
        }
    }

    private void resolveLoanAccount(String loanRef, Map<String, Object> ctx) {
        LoanAccount loan = loanAccountRepository.findById(loanRef)
                .or(() -> loanAccountRepository.findByLoanReference(loanRef))
                .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(loanRef))
                .orElse(null);
        if (loan != null) {
            String accNum = loan.getAccountNumber() != null ? loan.getAccountNumber() : loan.getLoanReference();
            ctx.putIfAbsent("Loan Account Number", accNum);
            String facility = loan.getFacilityType() != null ? loan.getFacilityType() : (loan.getLineCode() != null ? loan.getLineCode() : accNum);
            ctx.putIfAbsent("Facility Number", facility);
            if (loan.getRmUserId() != null && !loan.getRmUserId().isBlank()) {
                resolveRelationshipManager(loan.getRmUserId(), loan.getBranch(), ctx);
            }
        }
    }

    private void resolveRelationshipManager(String rmRef, String branchName, Map<String, Object> ctx) {
        User rmUser = null;
        if (rmRef != null && !rmRef.isBlank()) {
            rmUser = userRepository.findById(rmRef)
                    .or(() -> userRepository.findByUsername(rmRef))
                    .or(() -> userRepository.findAll().stream()
                            .filter(u -> rmRef.equalsIgnoreCase(u.getFullName()) || rmRef.equalsIgnoreCase(u.getUsername()))
                            .findFirst())
                    .orElse(null);
        }

        if (rmUser == null && branchName != null && !branchName.isBlank()) {
            rmUser = userRepository.findAll().stream()
                    .filter(u -> u.isActive() && branchName.equalsIgnoreCase(u.getBranch())
                            && ("BRO".equalsIgnoreCase(u.getRole()) || "BRM".equalsIgnoreCase(u.getRole()) || "SRM".equalsIgnoreCase(u.getRole())))
                    .findFirst()
                    .orElse(null);
        }

        if (rmUser != null) {
            String rmName = rmUser.getFullName();
            String rmPhone = rmUser.getPhone() != null && !rmUser.getPhone().isBlank() ? rmUser.getPhone() : "+251115180300";
            String rmEmail = rmUser.getEmail() != null && !rmUser.getEmail().isBlank() ? rmUser.getEmail() : "rm@dashenbanksc.com";
            ctx.putIfAbsent("RM Name", rmName);
            ctx.putIfAbsent("rm name", rmName);
            ctx.putIfAbsent("RM Phone", rmPhone);
            ctx.putIfAbsent("rm phone", rmPhone);
            ctx.putIfAbsent("RM Email", rmEmail);
            ctx.putIfAbsent("rm email", rmEmail);
            ctx.putIfAbsent("RM Contact", rmName + " (" + rmPhone + ")");
            ctx.putIfAbsent("rm contact", rmName + " (" + rmPhone + ")");
        } else {
            ctx.putIfAbsent("RM Name", "Relationship Management Desk");
            ctx.putIfAbsent("rm name", "Relationship Management Desk");
            ctx.putIfAbsent("RM Phone", "+251115180300");
            ctx.putIfAbsent("rm phone", "+251115180300");
            ctx.putIfAbsent("RM Email", "support@dashenbanksc.com");
            ctx.putIfAbsent("rm email", "support@dashenbanksc.com");
            ctx.putIfAbsent("RM Contact", "Relationship Management Desk (+251115180300)");
            ctx.putIfAbsent("rm contact", "Relationship Management Desk (+251115180300)");
        }
    }

    /**
     * Interpolates template text with values from the context.
     * Enforces that every placeholder must be resolved; unresolved placeholders throw an exception.
     */
    public String interpolate(String template, Map<String, Object> context) {
        if (template == null) return "";

        Map<String, String> normalizedContext = new HashMap<>();
        if (context != null) {
            for (Map.Entry<String, Object> e : context.entrySet()) {
                if (e.getKey() != null && e.getValue() != null) {
                    normalizedContext.put(canonicalKey(e.getKey()), String.valueOf(e.getValue()));
                }
            }
        }

        Matcher m = PLACEHOLDER_PATTERN.matcher(template);
        StringBuffer out = new StringBuffer();
        List<String> unresolved = new ArrayList<>();

        while (m.find()) {
            String token = m.group(1).trim();
            String key = canonicalKey(token);
            String replacement = normalizedContext.get(key);

            if (replacement == null || replacement.isBlank()) {
                unresolved.add("{" + token + "}");
            } else {
                m.appendReplacement(out, Matcher.quoteReplacement(replacement));
            }
        }
        m.appendTail(out);

        if (!unresolved.isEmpty()) {
            throw new IllegalStateException("Unresolved template placeholders detected: " + String.join(", ", unresolved)
                    + ". Ensure database records supply all required attributes before sending.");
        }

        return out.toString();
    }

    /**
     * Renders matching template dynamically with full entity attribute resolution.
     */
    public Map<String, String> render(
            String templateCode,
            String channel,
            String defaultSubject,
            String defaultBody,
            String entityType,
            String entityId,
            Map<String, Object> context) {

        Map<String, Object> fullContext = resolveEntityContext(entityType, entityId, context);

        String subject = defaultSubject != null ? defaultSubject : "CBAIMS Notification";
        String body = defaultBody != null ? defaultBody : "";

        NotificationTemplate match = findMatchingTemplate(templateCode, channel);
        if (match != null) {
            if (match.getSubject() != null && !match.getSubject().isBlank()) {
                subject = match.getSubject();
            }
            if (match.getBody() != null && !match.getBody().isBlank()) {
                body = match.getBody();
            }
        }

        validateTemplatePlaceholders(subject);
        validateTemplatePlaceholders(body);

        String renderedSubject = interpolate(subject, fullContext);
        String renderedBody = interpolate(body, fullContext);

        Map<String, String> result = new LinkedHashMap<>();
        result.put("subject", renderedSubject);
        result.put("body", renderedBody);
        return result;
    }

    public Map<String, String> render(String code, String channel, String defaultSubject, String defaultBody, Map<String, Object> context) {
        return render(code, channel, defaultSubject, defaultBody, null, null, context);
    }

    public NotificationTemplate findMatchingTemplate(String code, String channel) {
        List<NotificationTemplate> templates = repository.findAll();
        for (NotificationTemplate t : templates) {
            if (!t.isActive()) continue;
            if (channel != null && t.getType() != null && !t.getType().equalsIgnoreCase(channel)) continue;
            if (code != null && (code.equalsIgnoreCase(t.getId()) || code.equalsIgnoreCase(t.getName()))) return t;
            if (code != null && code.matches("(?i)PRE_EXPIRY_\\d+") &&
                    t.getTriggerDaysBefore() == Integer.parseInt(code.substring(code.lastIndexOf('_') + 1))) {
                return t;
            }
            if (code != null && code.equalsIgnoreCase("POST_EXPIRY_ESCALATION_10") &&
                    t.getName() != null && (t.getName().toLowerCase().contains("post") || t.getName().toLowerCase().contains("10"))) {
                return t;
            }
            if (code != null && (code.equalsIgnoreCase("POST_EXPIRY_ESCALATION_15_CONSOLIDATED") || code.equalsIgnoreCase("DISTRICT_CONSOLIDATED_OVERDUE_REPORT")) &&
                    t.getName() != null && t.getName().toLowerCase().contains("consolidated")) {
                return t;
            }
            if (code != null && code.matches("(?i)RENEWAL_ESCALATION_.*") &&
                    t.getName() != null && t.getName().toLowerCase().contains("escalation")) {
                return t;
            }
            if (code != null && (code.equalsIgnoreCase("CUSTOMER_POLICY_EXPIRY_REMINDER") || code.equalsIgnoreCase("CUSTOMER_EXPIRY_REMINDER")) &&
                    t.getName() != null && t.getName().toLowerCase().contains("customer")) {
                return t;
            }
            if (code != null && (code.equalsIgnoreCase("PORTFOLIO_EXPIRY_DIGEST") || code.equalsIgnoreCase("PORTFOLIO_EXPIRY_REMINDER") || code.toUpperCase().contains("PORTFOLIO")) &&
                    t.getName() != null && t.getName().toUpperCase().contains("PORTFOLIO")) {
                return t;
            }
            if (code != null && code.equalsIgnoreCase("POLICY_EXPIRY_REMINDER") &&
                    t.getName() != null && t.getName().toLowerCase().contains("reminder")) {
                return t;
            }
        }
        return null;
    }

    public List<NotificationTemplate> getAllTemplates() {
        return repository.findAll();
    }

    public NotificationTemplate saveTemplate(NotificationTemplate t, String userId) {
        if (t == null || t.getName() == null || t.getName().isBlank()) {
            throw new IllegalArgumentException("Template name is mandatory.");
        }
        if (t.getBody() == null || t.getBody().isBlank()) {
            throw new IllegalArgumentException("Template body is mandatory.");
        }
        if (userId != null && !userId.isBlank() && !"SYSADMIN".equalsIgnoreCase(userId)) {
            cimsService.assertUserPermission(userId, "Administration", "EDIT");
        }
        if (t.getType() == null || t.getType().isBlank()) {
            t.setType("Email");
        }
        if (!t.getType().equalsIgnoreCase("Email") && !t.getType().equalsIgnoreCase("SMS")) {
            throw new IllegalArgumentException("Template channel must be Email or SMS.");
        }
        if (t.getTriggerDaysBefore() < 0 || t.getTriggerDaysBefore() > 3650) {
            throw new IllegalArgumentException("Template trigger days must be between 0 and 3650.");
        }

        validateTemplatePlaceholders(t.getSubject());
        validateTemplatePlaceholders(t.getBody());

        if (t.getId() == null || t.getId().isBlank()) {
            t.setId("tmpl-" + System.currentTimeMillis());
        }

        Optional<NotificationTemplate> old = repository.findById(t.getId());
        boolean duplicate = repository.findAll().stream().anyMatch(x ->
                !x.getId().equals(t.getId()) &&
                x.getName() != null && x.getName().equalsIgnoreCase(t.getName()) &&
                x.getType() != null && x.getType().equalsIgnoreCase(t.getType()));

        if (duplicate) {
            throw new IllegalArgumentException("A template with the same name and channel already exists.");
        }

        // The linked Reminder Schedule is the single source of truth for audience.
        // Reject any template audience that the schedule does not notify, so the
        // backend cannot drift from the filtered admin UI.
        if (t.getScheduleId() != null && !t.getScheduleId().isBlank()) {
            ReminderSchedule schedule = reminderScheduleRepository.findById(t.getScheduleId())
                    .orElseThrow(() -> new IllegalArgumentException("Linked reminder schedule not found: " + t.getScheduleId()));
            Set<String> allowed = parseScheduleAudiences(schedule.getAudience());
            String requested = t.getAudience();
            if (requested == null || requested.isBlank()) {
                if (allowed.size() == 1) {
                    t.setAudience(allowed.iterator().next());
                } else {
                    throw new IllegalArgumentException("Audience is mandatory when the linked reminder schedule targets multiple audiences (" + String.join(", ", allowed) + ").");
                }
            } else {
                String canonical = allowed.stream()
                        .filter(a -> a.equalsIgnoreCase(requested.trim()))
                        .findFirst()
                        .orElse(null);
                if (canonical == null) {
                    throw new IllegalArgumentException("Audience '" + requested + "' is not enabled on reminder schedule '"
                            + schedule.getName() + "'. Allowed audiences: " + String.join(", ", allowed) + ".");
                }
                t.setAudience(canonical);
            }
        }

        NotificationTemplate saved = repository.save(t);
        cimsService.logAudit(
                userId == null ? "SYSADMIN" : userId,
                "SYSADMIN",
                "SAVE_NOTIFICATION_TEMPLATE",
                "NotificationTemplate",
                saved.getId(),
                "Configuration",
                old.map(this::state).orElse("<not configured>"),
                state(saved),
                "Notification template updated; database persistence active."
        );
        return saved;
    }

    /** Mirrors ReminderConfigurationService.parseAudiences for backend enforcement. */
    private Set<String> parseScheduleAudiences(String audienceStr) {
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

    private String state(NotificationTemplate t) {
        return "name=" + t.getName() + ", channel=" + t.getType() + ", trigger=" + t.getTriggerDaysBefore() + ", active=" + t.isActive();
    }
}
