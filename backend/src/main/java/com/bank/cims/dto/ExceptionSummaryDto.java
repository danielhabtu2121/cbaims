package com.bank.cims.dto;

public class ExceptionSummaryDto {
    private long totalOpen;
    private long critical;
    private long high;
    private long medium;
    private long low;
    private long dueSoon;
    private long overdue;
    private long escalated;
    private long resolvedToday;
    private long unassigned;
    private long total;

    public ExceptionSummaryDto() {}

    public long getTotalOpen() { return totalOpen; }
    public void setTotalOpen(long totalOpen) { this.totalOpen = totalOpen; }
    public long getCritical() { return critical; }
    public void setCritical(long critical) { this.critical = critical; }
    public long getHigh() { return high; }
    public void setHigh(long high) { this.high = high; }
    public long getMedium() { return medium; }
    public void setMedium(long medium) { this.medium = medium; }
    public long getLow() { return low; }
    public void setLow(long low) { this.low = low; }
    public long getDueSoon() { return dueSoon; }
    public void setDueSoon(long dueSoon) { this.dueSoon = dueSoon; }
    public long getOverdue() { return overdue; }
    public void setOverdue(long overdue) { this.overdue = overdue; }
    public long getEscalated() { return escalated; }
    public void setEscalated(long escalated) { this.escalated = escalated; }
    public long getResolvedToday() { return resolvedToday; }
    public void setResolvedToday(long resolvedToday) { this.resolvedToday = resolvedToday; }
    public long getUnassigned() { return unassigned; }
    public void setUnassigned(long unassigned) { this.unassigned = unassigned; }
    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }
}
