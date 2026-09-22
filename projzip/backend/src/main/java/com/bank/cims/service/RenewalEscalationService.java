package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional
public class RenewalEscalationService {
    @Autowired private InsurancePolicyRepository policyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EscalationRuleRepository escalationRuleRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private CimsService cimsService;
    @Autowired private ConfigurationService configurationService;

    public Map<String,Object> run() {
        int evaluated=0, escalated=0;
        LocalDate today=LocalDate.now();
        List<InsurancePolicy> policies=policyRepository.findAll();
        for(InsurancePolicy p:policies){
            if(!isOpenRenewal(p))continue;
            try{
                LocalDate expiry=LocalDate.parse(p.getExpiryDate().substring(0,10));
                long days=ChronoUnit.DAYS.between(today,expiry);
                evaluated++;
                EscalationStage stage=stageFor(days);
                if(stage==null||alreadySentToday(p.getId(),stage.code))continue;
                List<User> recipients=userRepository.findByRoleIgnoreCaseAndActiveTrue(stage.role);
                if(recipients.isEmpty()) continue;
                String body="Policy "+p.getPolicyNumber()+" requires renewal escalation. Expiry: "+p.getExpiryDate()+". "+(days>=0?days+" days before expiry.":Math.abs(days)+" days overdue.");
                for(User u:recipients){
                    String recipient=u.getEmail()!=null&&!u.getEmail().isBlank()?u.getEmail():u.getPhone();
                    if(recipient==null||recipient.isBlank())continue;
                    String channel=u.getEmail()!=null&&!u.getEmail().isBlank()?"Email":"SMS";
                    cimsService.sendNotification(channel,"RENEWAL_ESCALATION_"+stage.code,recipient,u.getFullName(),"CIMS Renewal Escalation: "+p.getPolicyNumber(),body,"Insurance Policy",p.getId());
                    cimsService.logAudit("SYSTEM","SYSADMIN","RENEWAL_ESCALATION_SENT","InsurancePolicy",p.getId(),"Stage","",stage.code,"Escalated renewal to "+stage.role+" for "+u.getUsername());
                    escalated++;
                }
            } catch(Exception e){
                cimsService.logAudit("SYSTEM","SYSADMIN","RENEWAL_ESCALATION_ERROR","InsurancePolicy",p.getId(),"Error","",e.getMessage(),"Escalation evaluation failed");
            }
        }
        return Map.of("success",true,"evaluatedCount",evaluated,"escalatedCount",escalated);
    }

    private boolean isOpenRenewal(InsurancePolicy p){
        return p.getExpiryDate()!=null && ("Active".equalsIgnoreCase(p.getStatus())||"Expiring".equalsIgnoreCase(p.getStatus()));
    }

    private EscalationStage stageFor(long days){
        int first=configurationService.getEscalationFirstDaysBeforeExpiry();
        int second=configurationService.getEscalationSecondDaysBeforeExpiry();
        int overdueStart=configurationService.getEscalationOverdueStartDays();
        int overdueInterval=configurationService.getEscalationOverdueIntervalDays();
        if(days==first)return new EscalationStage("FIRST","SRM");
        if(days==second)return new EscalationStage("SECOND","BRMGR");
        if(days<=-overdueStart && (Math.abs(days)-overdueStart)%overdueInterval==0)return new EscalationStage("OVERDUE","DISTDIR");
        // If the administrator has explicitly configured escalation rows, allow them to add custom exact thresholds.
        for(EscalationRule r:escalationRuleRepository.findAll()){
            int configured=r.getDaysBeforeExpiry();
            if(configured>0 && days==configured && r.getEscalationRole()!=null&&!r.getEscalationRole().isBlank())return new EscalationStage("CUSTOM_"+configured,r.getEscalationRole());
        }
        return null;
    }

    private boolean alreadySentToday(String policyId,String stage){
        String today=LocalDate.now().toString();
        return auditLogRepository.findByActionTypeAndEntityId("RENEWAL_ESCALATION_SENT",policyId).stream().anyMatch(a->a.getTimestamp()!=null&&a.getTimestamp().startsWith(today)&&a.getNewValue()!=null&&a.getNewValue().contains(stage));
    }

    private record EscalationStage(String code,String role) {}
}
