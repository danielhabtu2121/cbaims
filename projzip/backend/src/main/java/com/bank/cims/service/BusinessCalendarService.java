package com.bank.cims.service;

import com.bank.cims.model.HolidayCalendar;
import com.bank.cims.repository.HolidayCalendarRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Transactional
public class BusinessCalendarService {

    @Autowired
    private HolidayCalendarRepository holidayCalendarRepository;

    @Autowired
    @Lazy
    private CimsService cimsService;

    private final Set<LocalDate> holidayCache = ConcurrentHashMap.newKeySet();

    @PostConstruct
    public void init() {
        refreshCache();
    }

    public synchronized void refreshCache() {
        holidayCache.clear();
        List<HolidayCalendar> holidays = holidayCalendarRepository.findAll();
        for (HolidayCalendar h : holidays) {
            if (h.getHolidayDate() != null) {
                holidayCache.add(h.getHolidayDate());
            }
        }
    }

    public boolean isWeekend(LocalDate date) {
        if (date == null) return false;
        DayOfWeek dow = date.getDayOfWeek();
        return dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
    }

    public boolean isHoliday(LocalDate date) {
        if (date == null) return false;
        return holidayCache.contains(date);
    }

    public boolean isWorkingDay(LocalDate date) {
        if (date == null) return false;
        return !isWeekend(date) && !isHoliday(date);
    }

    public LocalDate nextWorkingDay(LocalDate date) {
        if (date == null) return LocalDate.now();
        LocalDate next = date.plusDays(1);
        while (!isWorkingDay(next)) {
            next = next.plusDays(1);
        }
        return next;
    }

    public LocalDate previousWorkingDay(LocalDate date) {
        if (date == null) return LocalDate.now();
        LocalDate prev = date.minusDays(1);
        while (!isWorkingDay(prev)) {
            prev = prev.minusDays(1);
        }
        return prev;
    }

    public LocalDate addWorkingDays(LocalDate startDate, int workingDays) {
        if (startDate == null) return LocalDate.now();
        if (workingDays <= 0) return startDate;

        LocalDate current = startDate;
        int added = 0;
        while (added < workingDays) {
            current = current.plusDays(1);
            if (isWorkingDay(current)) {
                added++;
            }
        }
        return current;
    }

    public LocalDate subtractWorkingDays(LocalDate startDate, int workingDays) {
        if (startDate == null) return LocalDate.now();
        if (workingDays <= 0) return startDate;

        LocalDate current = startDate;
        int subtracted = 0;
        while (subtracted < workingDays) {
            current = current.minusDays(1);
            if (isWorkingDay(current)) {
                subtracted++;
            }
        }
        return current;
    }

    public int calculateWorkingDaysBetween(LocalDate start, LocalDate end) {
        if (start == null || end == null || start.isAfter(end)) return 0;
        int count = 0;
        LocalDate current = start;
        while (!current.isAfter(end)) {
            if (isWorkingDay(current)) count++;
            current = current.plusDays(1);
        }
        return count;
    }

    /** Number of working days strictly after start and up to and including end. */
    public int workingDaysUntil(LocalDate start, LocalDate end) {
        if (start == null || end == null || !start.isBefore(end)) return 0;
        return calculateWorkingDaysBetween(start.plusDays(1), end);
    }

    public List<HolidayCalendar> getAllHolidays() {
        return holidayCalendarRepository.findAll();
    }

    public HolidayCalendar saveHoliday(HolidayCalendar holiday, String userId) {
        if (holiday.getHolidayDate() == null) {
            throw new IllegalArgumentException("Holiday date is mandatory.");
        }
        if (holiday.getDescription() == null || holiday.getDescription().isBlank()) {
            throw new IllegalArgumentException("Holiday description is mandatory.");
        }

        if (holiday.getId() == null || holiday.getId().isBlank()) {
            holiday.setId("hol-" + holiday.getHolidayDate().toString());
        }

        Optional<HolidayCalendar> existing = holidayCalendarRepository.findByHolidayDate(holiday.getHolidayDate());
        if (existing.isPresent() && !existing.get().getId().equals(holiday.getId())) {
            throw new IllegalArgumentException("A bank holiday already exists for date " + holiday.getHolidayDate() + " (" + existing.get().getDescription() + ")");
        }

        HolidayCalendar saved = holidayCalendarRepository.save(holiday);
        holidayCache.add(saved.getHolidayDate());

        cimsService.logAudit(
            userId != null ? userId : "SYSADMIN",
            "SYSADMIN",
            "SAVE_HOLIDAY",
            "HolidayCalendar",
            saved.getId(),
            "HolidayDate",
            "None",
            saved.getHolidayDate() + " (" + saved.getDescription() + ")",
            "Configured bank holiday: " + saved.getDescription() + " on " + saved.getHolidayDate()
        );

        return saved;
    }

    public void deleteHoliday(String holidayId, String userId) {
        Optional<HolidayCalendar> holOpt = holidayCalendarRepository.findById(holidayId);
        if (holOpt.isPresent()) {
            HolidayCalendar h = holOpt.get();
            holidayCalendarRepository.deleteById(holidayId);
            holidayCache.remove(h.getHolidayDate());

            cimsService.logAudit(
                userId != null ? userId : "SYSADMIN",
                "SYSADMIN",
                "DELETE_HOLIDAY",
                "HolidayCalendar",
                holidayId,
                "HolidayDate",
                h.getHolidayDate() != null ? h.getHolidayDate().toString() : "None",
                "Deleted",
                "Deleted bank holiday: " + h.getDescription() + " on " + h.getHolidayDate()
            );
        }
    }
}
