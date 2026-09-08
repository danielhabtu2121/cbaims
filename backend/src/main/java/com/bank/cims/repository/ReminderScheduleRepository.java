package com.bank.cims.repository;

import com.bank.cims.model.ReminderSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReminderScheduleRepository extends JpaRepository<ReminderSchedule, String> {
    List<ReminderSchedule> findAllByOrderByDaysBeforeExpiryDesc();
}
