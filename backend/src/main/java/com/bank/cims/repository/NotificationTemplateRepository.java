package com.bank.cims.repository;

import com.bank.cims.model.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, String> {
    List<NotificationTemplate> findByType(String type);
    List<NotificationTemplate> findByScheduleId(String scheduleId);
    List<NotificationTemplate> findByScheduleIdAndAudienceIgnoreCase(String scheduleId, String audience);
    List<NotificationTemplate> findByScheduleIdAndAudienceIgnoreCaseAndChannelIgnoreCase(String scheduleId, String audience, String channel);
}
