package com.bank.cims.repository;

import com.bank.cims.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByRecipientOrderBySentAtDesc(String recipient);
    List<Notification> findAllByOrderBySentAtDesc();
    List<Notification> findTop500ByOrderBySentAtDesc();
}
