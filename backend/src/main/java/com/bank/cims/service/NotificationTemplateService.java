package com.bank.cims.service;

import com.bank.cims.model.NotificationTemplate;
import com.bank.cims.repository.NotificationTemplateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Transactional
public class NotificationTemplateService {
    @Autowired private NotificationTemplateRepository repository;
    @Autowired @Lazy private CimsService cimsService;

    private static final Pattern PLACEHOLDER=Pattern.compile("\\{([^}]+)}");
    private static final Set<String> SUPPORTED=Set.of(
        "customer name","customername","policy number","policynumber","collateral id","collateralid","collateral code","collateralcode",
        "expiry date","expirydate","days remaining","daysremaining","insurer name","insurername","amount","insured amount","insuredamount",
        "maker id","makerid","checker id","checkerid","action type","actiontype","remarks","comments","branch","rm name","rmname","rm phone","rmphone",
        "loan account number","loanaccountnumber","entity id","entityid"
    );

    public void validateTemplatePlaceholders(String text){
        if(text==null)return;
        Matcher m=PLACEHOLDER.matcher(text);
        while(m.find()){
            String key=normalize(m.group(1));
            if(!SUPPORTED.contains(key))throw new IllegalArgumentException("Unsupported template variable {"+m.group(1)+"}. Configure only supported variables.");
        }
    }
    private String normalize(String s){return s==null?"":s.trim().toLowerCase(Locale.ROOT).replaceAll("[_-]+"," ");}

    public String interpolate(String template,Map<String,Object> context){
        if(template==null)return "";
        Map<String,String> normalized=new HashMap<>();
        if(context!=null)for(Map.Entry<String,Object> e:context.entrySet())normalized.put(normalize(e.getKey()),e.getValue()==null?"":String.valueOf(e.getValue()));
        Matcher m=PLACEHOLDER.matcher(template); StringBuffer out=new StringBuffer();
        while(m.find()){
            String value=normalized.getOrDefault(normalize(m.group(1)),m.group(0));
            m.appendReplacement(out,Matcher.quoteReplacement(value));
        }
        m.appendTail(out); return out.toString();
    }

    public Map<String,String> render(String code,String channel,String defaultSubject,String defaultBody,Map<String,Object> context){
        String subject=defaultSubject==null?"CIMS Notification":defaultSubject;
        String body=defaultBody==null?"":defaultBody;
        NotificationTemplate match=null;
        List<NotificationTemplate> templates=repository.findAll();
        for(NotificationTemplate t:templates){
            if(!t.isActive())continue;
            if(channel!=null&&t.getType()!=null&&!t.getType().equalsIgnoreCase(channel))continue;
            if(code!=null && (code.equalsIgnoreCase(t.getId())||code.equalsIgnoreCase(t.getName()))) {match=t;break;}
            if(code!=null && code.matches("(?i)PRE_EXPIRY_\\d+") && t.getTriggerDaysBefore()==Integer.parseInt(code.substring(code.lastIndexOf('_')+1))){match=t;break;}
            if(code!=null && code.matches("(?i)RENEWAL_ESCALATION_.*") && t.getName()!=null&&t.getName().toLowerCase().contains("escalation")){match=t;break;}
            if(code!=null && code.equalsIgnoreCase("CUSTOMER_POLICY_EXPIRY_REMINDER") && t.getName()!=null&&t.getName().toLowerCase().contains("customer")){match=t;break;}
        }
        if(match!=null){
            validateTemplatePlaceholders(match.getSubject()); validateTemplatePlaceholders(match.getBody());
            if(match.getSubject()!=null&&!match.getSubject().isBlank())subject=match.getSubject();
            if(match.getBody()!=null&&!match.getBody().isBlank())body=match.getBody();
        }
        return Map.of("subject",interpolate(subject,context),"body",interpolate(body,context));
    }

    public List<NotificationTemplate> getAllTemplates(){return repository.findAll();}

    public NotificationTemplate saveTemplate(NotificationTemplate t,String userId){
        if(t==null||t.getName()==null||t.getName().isBlank())throw new IllegalArgumentException("Template name is mandatory.");
        if(t.getBody()==null||t.getBody().isBlank())throw new IllegalArgumentException("Template body is mandatory.");
        if(t.getType()==null||t.getType().isBlank())t.setType("Email");
        if(!t.getType().equalsIgnoreCase("Email")&&!t.getType().equalsIgnoreCase("SMS"))throw new IllegalArgumentException("Template channel must be Email or SMS.");
        if(t.getTriggerDaysBefore()<0||t.getTriggerDaysBefore()>3650)throw new IllegalArgumentException("Template trigger days must be between 0 and 3650.");
        validateTemplatePlaceholders(t.getSubject()); validateTemplatePlaceholders(t.getBody());
        if(t.getId()==null||t.getId().isBlank())t.setId("tmpl-"+System.currentTimeMillis());
        Optional<NotificationTemplate> old=repository.findById(t.getId());
        boolean duplicate=repository.findAll().stream().anyMatch(x->!x.getId().equals(t.getId())&&x.getName()!=null&&x.getName().equalsIgnoreCase(t.getName())&&x.getType()!=null&&x.getType().equalsIgnoreCase(t.getType()));
        if(duplicate)throw new IllegalArgumentException("A template with the same name and channel already exists.");
        NotificationTemplate saved=repository.save(t);
        cimsService.logAudit(userId==null?"SYSADMIN":userId,"SYSADMIN","SAVE_NOTIFICATION_TEMPLATE","NotificationTemplate",saved.getId(),"Configuration",old.map(this::state).orElse("<not configured>"),state(saved),"Notification template updated.");
        return saved;
    }
    private String state(NotificationTemplate t){return "name="+t.getName()+", channel="+t.getType()+", trigger="+t.getTriggerDaysBefore()+", active="+t.isActive();}
}
