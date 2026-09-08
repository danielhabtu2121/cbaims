package com.bank.cims.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "cims_holiday_calendars")
public class HolidayCalendar {
    @Id
    private String id;

    @Column(name = "holiday_date", nullable = false, unique = true)
    private LocalDate holidayDate;

    @Column(nullable = false)
    private String description;

    public HolidayCalendar() {}

    public HolidayCalendar(String id, LocalDate holidayDate, String description) {
        this.id = id;
        this.holidayDate = holidayDate;
        this.description = description;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public LocalDate getHolidayDate() { return holidayDate; }
    public void setHolidayDate(LocalDate holidayDate) { this.holidayDate = holidayDate; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
