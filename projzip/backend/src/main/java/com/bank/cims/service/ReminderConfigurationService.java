package com.bank.cims.service;

import com.bank.cims.model.ReminderSchedule;
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
    @Autowired @Lazy private CimsService cimsService;

    @PostConstruct
    public void ensureStandardSchedule(){
        ensure(30,"[\"Email\",\"SMS\"]","[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]");
        ensure(25,"[\"Email\",\"SMS\"]","[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]");
        ensure(20,"[\"Email\",\"SMS\"]","[\"CRO\",\"BRO\",\"SRM\",\"BRM\"]");
    }
    private void ensure(int days,String channels,String roles){
        if(repository.findAll().stream().noneMatch(r->r.getDaysBeforeExpiry()==days)){
            ReminderSchedule r=new ReminderSchedule(); r.setId("rem-"+days); r.setDaysBeforeExpiry(days); r.setChannelsJson(channels); r.setRecipientRolesJson(roles); r.setActive(true); repository.save(r);
        }
    }

    public List<ReminderSchedule> getAll(){return repository.findAllByOrderByDaysBeforeExpiryDesc();}

    public ReminderSchedule save(ReminderSchedule incoming,String userId){
        if(incoming==null)throw new IllegalArgumentException("Reminder schedule payload is required.");
        if(incoming.getDaysBeforeExpiry()<=0||incoming.getDaysBeforeExpiry()>3650)throw new IllegalArgumentException("Reminder days before expiry must be between 1 and 3650.");
        validateChannels(incoming.getChannelsJson()); validateRoles(incoming.getRecipientRolesJson());
        String id=incoming.getId(); Optional<ReminderSchedule> existing=id==null||id.isBlank()?Optional.empty():repository.findById(id);
        Optional<ReminderSchedule> duplicate=repository.findAll().stream().filter(r->r.getDaysBeforeExpiry()==incoming.getDaysBeforeExpiry()).findFirst();
        if(duplicate.isPresent()&&(id==null||!duplicate.get().getId().equals(id)))throw new IllegalArgumentException("A reminder schedule for "+incoming.getDaysBeforeExpiry()+" days already exists.");
        if(id==null||id.isBlank())incoming.setId("rem-"+incoming.getDaysBeforeExpiry());
        String old=existing.map(this::state).orElse("<not configured>");
        ReminderSchedule saved=repository.save(incoming);
        cimsService.logAudit(userId==null?"SYSADMIN":userId,"SYSADMIN","SAVE_REMINDER_SCHEDULE","ReminderSchedule",saved.getId(),"Configuration",old,state(saved),"Reminder configuration updated; runtime engine will use it immediately.");
        return saved;
    }
    private void validateChannels(String json){List<String> a=parse(json); if(a.isEmpty())throw new IllegalArgumentException("At least one notification channel is required."); for(String x:a)if(!x.equalsIgnoreCase("Email")&&!x.equalsIgnoreCase("SMS"))throw new IllegalArgumentException("Unsupported reminder channel: "+x);}
    private void validateRoles(String json){if(parse(json).isEmpty())throw new IllegalArgumentException("At least one recipient role is required.");}
    private List<String> parse(String json){if(json==null)return List.of();String n=json.trim();if(n.startsWith("[")&&n.endsWith("]"))n=n.substring(1,n.length()-1);if(n.isBlank())return List.of();List<String> r=new ArrayList<>();for(String s:n.split(",")){String v=s.trim().replaceAll("^\"|\"$","");if(!v.isBlank())r.add(v);}return r;}
    private String state(ReminderSchedule s){return "days="+s.getDaysBeforeExpiry()+", channels="+s.getChannelsJson()+", recipients="+s.getRecipientRolesJson()+", active="+s.isActive();}
}
