package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDto> getSummary(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String expiry) {
        return ResponseEntity.ok(dashboardService.getSummary(userId, segment, district, branch, category, status, expiry));
    }

    @GetMapping("/charts")
    public ResponseEntity<DashboardChartDataDto> getCharts(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String expiry) {
        return ResponseEntity.ok(dashboardService.getCharts(userId, segment, district, branch, category, status, expiry));
    }

    @GetMapping("/exposure")
    public ResponseEntity<List<Map<String, Object>>> getExposure(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getExposureVsProtection());
    }

    @GetMapping("/insurance")
    public ResponseEntity<List<Map<String, Object>>> getInsurance(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getComplianceDonut());
    }

    @GetMapping("/compliance")
    public ResponseEntity<Map<String, Object>> getCompliance(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardSummaryDto summary = dashboardService.getSummary(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(Map.of(
                "coveragePct", summary.getInsuranceCoveragePct(),
                "insuranceRequired", summary.getTotalInsuranceRequired(),
                "activeInsurance", summary.getTotalValidActiveInsurance(),
                "insuranceGap", summary.getTotalInsuranceGap(),
                "expiredCount", summary.getExpiredPoliciesCount(),
                "expiring30Count", summary.getPoliciesExpiringWithin30Days(),
                "openExceptions", summary.getOpenExceptionsCount(),
                "overrides", summary.getOverrideCount()
        ));
    }

    @GetMapping("/expiry")
    public ResponseEntity<List<Map<String, Object>>> getExpiry(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getExpiryPipeline());
    }

    @GetMapping("/segments")
    public ResponseEntity<List<Map<String, Object>>> getSegments(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getExposureVsProtection());
    }

    @GetMapping("/districts")
    public ResponseEntity<List<Map<String, Object>>> getDistricts(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getDistrictRanking());
    }

    @GetMapping("/branches")
    public ResponseEntity<List<Map<String, Object>>> getBranches(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getBranchRanking());
    }

    @GetMapping("/collateral-types")
    public ResponseEntity<List<Map<String, Object>>> getCollateralTypes(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getCollateralCategoryDistribution());
    }

    @GetMapping("/ownership")
    public ResponseEntity<List<Map<String, Object>>> getOwnership(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getOwnershipDistribution());
    }

    @GetMapping("/documents")
    public ResponseEntity<List<Map<String, Object>>> getDocuments(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getDocumentationHealth());
    }

    @GetMapping("/workflow")
    public ResponseEntity<List<Map<String, Object>>> getWorkflow(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardChartDataDto charts = dashboardService.getCharts(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(charts.getWorkflowFunnel());
    }

    @GetMapping("/exceptions")
    public ResponseEntity<Map<String, Object>> getExceptions(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        DashboardSummaryDto summary = dashboardService.getSummary(userId, segment, district, branch, null, null, null);
        return ResponseEntity.ok(Map.of(
                "openExceptions", summary.getOpenExceptionsCount(),
                "returnedTasks", summary.getReturnedTasksCount(),
                "pendingApprovals", summary.getPendingApprovalsCount()
        ));
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment) {
        return ResponseEntity.ok(Map.of(
                "snapshots", List.of(),
                "status", "NO_FABRICATED_DATA",
                "message", "Historical data not yet available. Daily snapshot aggregation is active."
        ));
    }

    @GetMapping("/portfolio")
    public ResponseEntity<List<DashboardPortfolioRowDto>> getPortfolio(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String expiry) {
        return ResponseEntity.ok(dashboardService.getPortfolio(userId, segment, district, branch, category, status, expiry));
    }

    @GetMapping("/work-queue")
    public ResponseEntity<List<DashboardWorkQueueItemDto>> getWorkQueue(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        return ResponseEntity.ok(dashboardService.getWorkQueue(userId, segment, district, branch));
    }

    @GetMapping("/export")
    public ResponseEntity<String> exportPortfolioCsv(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String expiry) {
        String csv = dashboardService.exportPortfolioCsv(userId, segment, district, branch, category, status, expiry);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"CDIMS_Portfolio_Export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
