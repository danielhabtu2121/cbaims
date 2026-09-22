package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Authoritative runtime source for CIMS business configuration.
 * Values are persisted in cims_system_parameters and refreshed immediately after save.
 */
@Service
@Transactional
public class ConfigurationService {
    @Autowired private SystemParameterRepository systemParameterRepository;
    @Autowired private ReminderScheduleRepository reminderScheduleRepository;
    @Autowired private NotificationTemplateRepository notificationTemplateRepository;
    @Autowired private HolidayCalendarRepository holidayCalendarRepository;
    @Autowired private ApprovalHierarchyConfigRepository approvalHierarchyConfigRepository;
    @Autowired private ApprovedInsurerRepository approvedInsurerRepository;
    @Autowired private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired @Lazy private CimsService cimsService;

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    private static final Map<String,String> DEFAULTS = Map.ofEntries(
        Map.entry("session_timeout_minutes","15"),
        Map.entry("password_min_length","8"),
        Map.entry("password_require_special","true"),
        Map.entry("max_login_failed_attempts","5"),
        Map.entry("cbs_sync_mode","Manual"),
        Map.entry("cbs_sync_interval_minutes","60"),
        Map.entry("dms_integration_mode","Local_Object_Store"),
        Map.entry("default_currency","ETB"),
        Map.entry("min_coverage_adequacy_pct","100"),
        Map.entry("max_insurer_concentration_pct","30"),
        Map.entry("policy_expiry_grace_period_days","15"),
        Map.entry("minimum_policy_validity_days","365"),
        Map.entry("dual_control_strict_mode","true"),
        Map.entry("approved_insurer_required","true"),
        Map.entry("mandatory_document_rules_enabled","true"),
        Map.entry("document_expiry_warning_days","30"),
        Map.entry("policy_expiring_status_days","30"),
        Map.entry("reminder_scheduler_enabled","true"),
        Map.entry("reminder_scheduler_interval_minutes","60"),
        Map.entry("reminder_continuation_interval_working_days","2"),
        Map.entry("max_reminder_notifications_per_recipient_per_day","2"),
        Map.entry("customer_notification_frequency_days","5"),
        Map.entry("customer_notification_start_days","30"),
        Map.entry("escalation_first_days_before_expiry","10"),
        Map.entry("escalation_second_days_before_expiry","5"),
        Map.entry("escalation_overdue_start_days","10"),
        Map.entry("escalation_overdue_interval_days","15"),
        Map.entry("exception_scan_enabled","true"),
        Map.entry("exception_scan_interval_minutes","60")
    );

    @PostConstruct
    public void init() { ensureDefaults(); refreshCache(); }

    public synchronized void ensureDefaults() {
        for (var e : DEFAULTS.entrySet()) {
            if (systemParameterRepository.findById(e.getKey()).isEmpty()) {
                systemParameterRepository.save(new SystemParameter(e.getKey(), e.getValue(), defaultDescription(e.getKey())));
            }
        }
    }

    public synchronized void refreshCache() {
        cache.clear();
        for (SystemParameter p : systemParameterRepository.findAll()) {
            if (p.getParamKey()!=null && p.getParamValue()!=null) cache.put(normalize(p.getParamKey()), p.getParamValue().trim());
        }
    }

    private String normalize(String key) { return key == null ? "" : key.trim().toLowerCase(Locale.ROOT); }

    public String getString(String key,String def){ String v=cache.get(normalize(key)); return v==null?def:v; }
    public int getInt(String key,int def){ try{return Integer.parseInt(getString(key,null));}catch(Exception e){return def;} }
    public long getLong(String key,long def){ try{return Long.parseLong(getString(key,null));}catch(Exception e){return def;} }
    public double getDouble(String key,double def){ try{return Double.parseDouble(getString(key,null));}catch(Exception e){return def;} }
    public BigDecimal getDecimal(String key,BigDecimal def){ try{return new BigDecimal(getString(key,null));}catch(Exception e){return def;} }
    public boolean getBoolean(String key,boolean def){ String v=getString(key,null); if(v==null)return def; if(Set.of("true","1","yes","y").contains(v.toLowerCase()))return true; if(Set.of("false","0","no","n").contains(v.toLowerCase()))return false; return def; }

    public double getMinimumCoverageAdequacyPct(){return getDouble("min_coverage_adequacy_pct",100);}
    public double getMaxInsurerConcentrationPct(){return getDouble("max_insurer_concentration_pct",30);}
    public int getPolicyExpiryGracePeriodDays(){return Math.max(0,getInt("policy_expiry_grace_period_days",15));}
    public int getMinimumPolicyValidityDays(){return Math.max(1,getInt("minimum_policy_validity_days",365));}
    public boolean isDualControlStrictEnabled(){return getBoolean("dual_control_strict_mode",true);}
    public boolean isApprovedInsurerRequired(){return getBoolean("approved_insurer_required",true);}
    public boolean areMandatoryDocumentRulesEnabled(){return getBoolean("mandatory_document_rules_enabled",true);}
    public int getDocumentExpiryWarningDays(){return Math.max(1,getInt("document_expiry_warning_days",30));}
    public int getPolicyExpiringStatusDays(){return Math.max(1,getInt("policy_expiring_status_days",30));}
    public String getDefaultCurrency(){return getString("default_currency","ETB");}
    public int getSessionTimeoutMinutes(){return Math.max(1,getInt("session_timeout_minutes",15));}
    public int getMaxLoginFailedAttempts(){return Math.max(1,getInt("max_login_failed_attempts",5));}
    public String getCbsSyncMode(){return getString("cbs_sync_mode","Manual");}
    public int getCbsSyncIntervalMinutes(){return Math.max(1,getInt("cbs_sync_interval_minutes",60));}
    public String getDmsIntegrationMode(){return getString("dms_integration_mode","Local_Object_Store");}
    public boolean isReminderSchedulerEnabled(){return getBoolean("reminder_scheduler_enabled",true);}
    public int getReminderSchedulerIntervalMinutes(){return Math.max(1,getInt("reminder_scheduler_interval_minutes",60));}
    public int getReminderContinuationIntervalWorkingDays(){return Math.max(1,getInt("reminder_continuation_interval_working_days",2));}
    public int getMaxReminderNotificationsPerRecipientPerDay(){return Math.max(1,getInt("max_reminder_notifications_per_recipient_per_day",2));}
    public int getCustomerNotificationFrequencyDays(){return Math.max(1,getInt("customer_notification_frequency_days",5));}
    public int getCustomerNotificationStartDays(){return Math.max(1,getInt("customer_notification_start_days",30));}
    public int getEscalationFirstDaysBeforeExpiry(){return Math.max(1,getInt("escalation_first_days_before_expiry",10));}
    public int getEscalationSecondDaysBeforeExpiry(){return Math.max(1,getInt("escalation_second_days_before_expiry",5));}
    public int getEscalationOverdueStartDays(){return Math.max(1,getInt("escalation_overdue_start_days",10));}
    public int getEscalationOverdueIntervalDays(){return Math.max(1,getInt("escalation_overdue_interval_days",15));}
    public boolean isExceptionScanEnabled(){return getBoolean("exception_scan_enabled",true);}
    public int getExceptionScanIntervalMinutes(){return Math.max(1,getInt("exception_scan_interval_minutes",60));}

    public List<SystemParameter> getAllParameters(){ List<SystemParameter> r=systemParameterRepository.findAll(); r.sort(Comparator.comparing(SystemParameter::getParamKey,String.CASE_INSENSITIVE_ORDER)); return r; }

    public synchronized SystemParameter saveParameter(SystemParameter incoming,String userId){
        if(incoming==null||incoming.getParamKey()==null||incoming.getParamKey().isBlank()) throw new IllegalArgumentException("Parameter key is mandatory.");
        if(incoming.getParamValue()==null||incoming.getParamValue().isBlank()) throw new IllegalArgumentException("Parameter value is mandatory.");
        String key=normalize(incoming.getParamKey()), value=incoming.getParamValue().trim();
        validate(key,value);
        Optional<SystemParameter> oldOpt=systemParameterRepository.findById(key);
        String old=oldOpt.map(SystemParameter::getParamValue).orElse(null);
        SystemParameter target=oldOpt.orElseGet(SystemParameter::new);
        target.setParamKey(key); target.setParamValue(value);
        target.setDescription(incoming.getDescription()!=null&&!incoming.getDescription().isBlank()?incoming.getDescription().trim():defaultDescription(key));
        SystemParameter saved=systemParameterRepository.save(target);
        cache.put(key,value);
        cimsService.logAudit(userId==null?"SYSADMIN":userId,"SYSADMIN","UPDATE_SYSTEM_PARAMETER","SystemParameter",key,"ParamValue",old==null?"<not configured>":old,value,"Runtime configuration changed; cache refreshed immediately.");
        return saved;
    }

    public void validate(String key,String value){
        switch(key){
            case "min_coverage_adequacy_pct","max_insurer_concentration_pct" -> { double v=parseDouble(key,value); if(v<=0||v>100)throw new IllegalArgumentException(key+" must be greater than 0 and no more than 100."); }
            case "policy_expiry_grace_period_days","minimum_policy_validity_days","session_timeout_minutes","password_min_length","max_login_failed_attempts","cbs_sync_interval_minutes","reminder_scheduler_interval_minutes","reminder_continuation_interval_working_days","max_reminder_notifications_per_recipient_per_day","customer_notification_frequency_days","customer_notification_start_days","escalation_first_days_before_expiry","escalation_second_days_before_expiry","escalation_overdue_start_days","escalation_overdue_interval_days","document_expiry_warning_days","policy_expiring_status_days","exception_scan_interval_minutes" -> { if(parseInt(key,value)<=0)throw new IllegalArgumentException(key+" must be greater than zero."); }
            case "password_require_special","dual_control_strict_mode","approved_insurer_required","mandatory_document_rules_enabled","reminder_scheduler_enabled","exception_scan_enabled" -> { if(!value.matches("(?i)(true|false|1|0|yes|no|y|n)"))throw new IllegalArgumentException(key+" must be boolean."); }
            case "cbs_sync_mode" -> { if(!value.equalsIgnoreCase("Manual")&&!value.equalsIgnoreCase("Scheduled"))throw new IllegalArgumentException("CBS sync mode must be Manual or Scheduled."); }
            case "default_currency" -> { if(!value.matches("[A-Za-z]{3}"))throw new IllegalArgumentException("Default currency must be a three-letter code."); }
            default -> { if(value.length()>4000)throw new IllegalArgumentException("Parameter value is too long."); }
        }
    }
    private int parseInt(String k,String v){try{return Integer.parseInt(v);}catch(Exception e){throw new IllegalArgumentException(k+" must be a whole number.");}}
    private double parseDouble(String k,String v){try{return Double.parseDouble(v);}catch(Exception e){throw new IllegalArgumentException(k+" must be numeric.");}}

    private String defaultDescription(String k){
        return switch(k){
            case "min_coverage_adequacy_pct"->"Minimum insurance coverage adequacy threshold.";
            case "max_insurer_concentration_pct"->"Maximum permitted insurer concentration.";
            case "policy_expiry_grace_period_days"->"Grace period after policy expiry.";
            case "minimum_policy_validity_days"->"Minimum policy validity for normal/general lending.";
            case "dual_control_strict_mode"->"Enforce maker/checker segregation of duties.";
            case "approved_insurer_required"->"Block policy activation for insurers outside the approved list.";
            case "mandatory_document_rules_enabled"->"Enforce configured mandatory ownership documents.";
            case "document_expiry_warning_days"->"Warn on ownership documents approaching expiry.";
            case "policy_expiring_status_days"->"Days before expiry when policy status becomes Expiring.";
            case "reminder_scheduler_enabled"->"Enable automatic policy expiry reminder processing.";
            case "reminder_scheduler_interval_minutes"->"Minimum interval between automatic reminder runs.";
            case "reminder_continuation_interval_working_days"->"Working-day cadence after the third reminder.";
            case "max_reminder_notifications_per_recipient_per_day"->"Maximum reminder notifications to one recipient per day.";
            case "customer_notification_frequency_days"->"Customer reminder frequency after the initial reminder window.";
            case "customer_notification_start_days"->"Customer reminders begin this many days before expiry.";
            case "escalation_first_days_before_expiry"->"First renewal escalation threshold.";
            case "escalation_second_days_before_expiry"->"Second renewal escalation threshold.";
            case "escalation_overdue_start_days"->"Days overdue before district/area escalation begins.";
            case "escalation_overdue_interval_days"->"Repeat overdue escalation interval.";
            default->"CIMS system configuration parameter.";
        };
    }

    public Map<String,Object> getEffectiveConfiguration(){
        Map<String,Object> r=new LinkedHashMap<>();
        r.put("minCoverageAdequacyPct",getMinimumCoverageAdequacyPct());
        r.put("maxInsurerConcentrationPct",getMaxInsurerConcentrationPct());
        r.put("policyExpiryGracePeriodDays",getPolicyExpiryGracePeriodDays());
        r.put("minimumPolicyValidityDays",getMinimumPolicyValidityDays());
        r.put("dualControlStrictMode",isDualControlStrictEnabled());
        r.put("approvedInsurerRequired",isApprovedInsurerRequired());
        r.put("mandatoryDocumentRulesEnabled",areMandatoryDocumentRulesEnabled());
        r.put("documentExpiryWarningDays",getDocumentExpiryWarningDays());
        r.put("policyExpiringStatusDays",getPolicyExpiringStatusDays());
        r.put("defaultCurrency",getDefaultCurrency());
        r.put("reminderSchedulerEnabled",isReminderSchedulerEnabled());
        r.put("reminderSchedulerIntervalMinutes",getReminderSchedulerIntervalMinutes());
        r.put("reminderContinuationIntervalWorkingDays",getReminderContinuationIntervalWorkingDays());
        r.put("maxReminderNotificationsPerRecipientPerDay",getMaxReminderNotificationsPerRecipientPerDay());
        r.put("customerNotificationFrequencyDays",getCustomerNotificationFrequencyDays());
        r.put("customerNotificationStartDays",getCustomerNotificationStartDays());
        r.put("escalationFirstDaysBeforeExpiry",getEscalationFirstDaysBeforeExpiry());
        r.put("escalationSecondDaysBeforeExpiry",getEscalationSecondDaysBeforeExpiry());
        r.put("escalationOverdueStartDays",getEscalationOverdueStartDays());
        r.put("escalationOverdueIntervalDays",getEscalationOverdueIntervalDays());
        r.put("exceptionScanEnabled",isExceptionScanEnabled());
        r.put("exceptionScanIntervalMinutes",getExceptionScanIntervalMinutes());
        r.put("cachedParameterCount",cache.size());
        return r;
    }

    public Map<String,String> getConfigurationUsageMap(){
        Map<String,String> m=new LinkedHashMap<>();
        m.put("min_coverage_adequacy_pct","Collateral coverage calculation, underinsurance exceptions, dashboard and policy validation");
        m.put("max_insurer_concentration_pct","Portfolio insurer concentration exception scan");
        m.put("minimum_policy_validity_days","Policy activation validation for normal/general lending");
        m.put("policy_expiry_grace_period_days","Expired policy severity and exception description");
        m.put("document_expiry_warning_days","Ownership document expiry monitoring");
        m.put("reminder_continuation_interval_working_days","Expiry reminder cadence after 20 working days");
        m.put("max_reminder_notifications_per_recipient_per_day","Reminder throttling");
        m.put("customer_notification_frequency_days","Customer expiry notification cadence");
        m.put("escalation_first_days_before_expiry","First renewal escalation");
        m.put("escalation_second_days_before_expiry","Second renewal escalation");
        m.put("escalation_overdue_start_days","Overdue escalation start");
        m.put("escalation_overdue_interval_days","Repeated overdue escalation");
        m.put("dual_control_strict_mode","Maker-checker approval enforcement");
        m.put("approved_insurer_required","Approved insurer validation");
        m.put("mandatory_document_rules_enabled","Collateral/policy activation document validation");
        m.put("default_currency","Runtime default currency for CBS-derived and native monetary records");
        m.put("cbs_sync_mode","CBS simulator synchronization scheduler");
        m.put("cbs_sync_interval_minutes","CBS simulator synchronization frequency");
        return m;
    }

    public Map<String,Object> checkConfigurationHealth(){
        List<String> healthy=new ArrayList<>(), warnings=new ArrayList<>();
        for(String k:DEFAULTS.keySet()){
            if(cache.containsKey(k)) healthy.add(k+" = "+cache.get(k)); else warnings.add("Missing parameter: "+k);
            if(cache.containsKey(k)){try{validate(k,cache.get(k));}catch(Exception e){warnings.add(e.getMessage());}}
        }
        if(reminderScheduleRepository.count()==0) warnings.add("No reminder schedule is configured."); else healthy.add("Reminder schedules configured: "+reminderScheduleRepository.count());
        if(notificationTemplateRepository.count()==0) warnings.add("No notification templates are configured."); else healthy.add("Notification templates configured: "+notificationTemplateRepository.count());
        if(holidayCalendarRepository.count()==0) warnings.add("Holiday calendar is empty; only weekends will be excluded."); else healthy.add("Holiday calendar configured: "+holidayCalendarRepository.count());
        if(approvalHierarchyConfigRepository.count()==0) warnings.add("No approval hierarchy configuration exists."); else healthy.add("Approval hierarchies configured: "+approvalHierarchyConfigRepository.count());
        if(approvedInsurerRepository.count()==0 && isApprovedInsurerRequired()) warnings.add("Approved insurer list is empty while approved_insurer_required=true.");
        if(mandatoryDocumentRuleRepository.count()==0 && areMandatoryDocumentRulesEnabled()) warnings.add("Mandatory document enforcement is enabled but no document rules exist.");
        if(rolePermissionRepository.count()==0) warnings.add("Role permission matrix is empty.");
        Map<String,Object> h=new LinkedHashMap<>(); h.put("status",warnings.isEmpty()?"HEALTHY":"WARNING"); h.put("healthyCount",healthy.size()); h.put("warningCount",warnings.size()); h.put("healthyChecks",healthy); h.put("warnings",warnings); h.put("effectiveConfiguration",getEffectiveConfiguration()); h.put("usageMap",getConfigurationUsageMap()); return h;
    }
}
