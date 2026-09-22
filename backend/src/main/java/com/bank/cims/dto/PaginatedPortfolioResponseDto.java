package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;

public class PaginatedPortfolioResponseDto {
    private List<DashboardPortfolioRowDto> content = new ArrayList<>();
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean isFirst;
    private boolean isLast;

    public PaginatedPortfolioResponseDto() {}

    public PaginatedPortfolioResponseDto(List<DashboardPortfolioRowDto> content, int page, int size, long totalElements, int totalPages) {
        this.content = content != null ? content : new ArrayList<>();
        this.page = page;
        this.size = size;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.isFirst = page == 0;
        this.isLast = page >= totalPages - 1;
    }

    public List<DashboardPortfolioRowDto> getContent() { return content; }
    public void setContent(List<DashboardPortfolioRowDto> content) { this.content = content; }

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getTotalElements() { return totalElements; }
    public void setTotalElements(long totalElements) { this.totalElements = totalElements; }

    public int getTotalPages() { return totalPages; }
    public void setTotalPages(int totalPages) { this.totalPages = totalPages; }

    public boolean isFirst() { return isFirst; }
    public void setFirst(boolean first) { isFirst = first; }

    public boolean isLast() { return isLast; }
    public void setLast(boolean last) { isLast = last; }
}
