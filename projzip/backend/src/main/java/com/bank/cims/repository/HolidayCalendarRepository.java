package com.bank.cims.repository;

import com.bank.cims.model.HolidayCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface HolidayCalendarRepository extends JpaRepository<HolidayCalendar, String> {
    Optional<HolidayCalendar> findByHolidayDate(LocalDate date);
}
