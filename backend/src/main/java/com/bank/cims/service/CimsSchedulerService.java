package com.bank.cims.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class CimsSchedulerService {
    @Autowired private ConfigurationService configurationService;
    @Autowired private CimsService cimsService;
    @Autowired private RenewalEscalationService renewalEscalationService;

    private final AtomicLong lastReminderRun = new AtomicLong(0);
    private final AtomicLong lastExceptionRun = new AtomicLong(0);
    private final AtomicLong lastCbsRun = new AtomicLong(0);

    /**
     * Runs frequently but uses Admin-configured intervals to decide whether work is due.
     * This means configuration changes take effect without changing application code or restart.
     */
    @Scheduled(fixedDelay = 60_000L, initialDelay = 30_000L)
    public void scheduledProcessing() {
        long now=Instant.now().toEpochMilli();
        if(configurationService.isReminderSchedulerEnabled()){
            long interval=configurationService.getReminderSchedulerIntervalMinutes()*60_000L;
            if(now-lastReminderRun.get()>=interval){
                try{ cimsService.runPolicyExpiryReminders(); renewalEscalationService.run(); lastReminderRun.set(now); }
                catch(Exception e){ cimsService.logAudit("SYSTEM","SYSADMIN","SCHEDULER_REMINDER_ERROR","Scheduler","REMINDERS","Error","",e.getMessage(),"Scheduled reminder/escalation run failed"); }
            }
        }
        if(configurationService.isExceptionScanEnabled()){
            long interval=configurationService.getExceptionScanIntervalMinutes()*60_000L;
            if(now-lastExceptionRun.get()>=interval){
                try{ cimsService.scanAndGenerateExceptions(); lastExceptionRun.set(now); }
                catch(Exception e){ cimsService.logAudit("SYSTEM","SYSADMIN","SCHEDULER_EXCEPTION_ERROR","Scheduler","EXCEPTIONS","Error","",e.getMessage(),"Scheduled exception scan failed"); }
            }
        }
        if("Scheduled".equalsIgnoreCase(configurationService.getCbsSyncMode())){
            long interval=configurationService.getCbsSyncIntervalMinutes()*60_000L;
            if(now-lastCbsRun.get()>=interval){
                try{ cimsService.syncAllPendingCbs("SYSTEM"); lastCbsRun.set(now); }
                catch(Exception e){ cimsService.logAudit("SYSTEM","SYSADMIN","SCHEDULER_CBS_SYNC_ERROR","Scheduler","CBS","Error","",e.getMessage(),"Scheduled CBS simulator synchronization failed"); }
            }
        }
    }
}
