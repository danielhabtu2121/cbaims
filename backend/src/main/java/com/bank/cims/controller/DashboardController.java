package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.model.DashboardSnapshot;
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
            @RequestParam(required = false, defaultValue = "BANK") String scopeLevel,
            @RequestParam(required = false, defaultValue = "ALL") String scopeId) {
        return ResponseEntity.ok(dashboardService.getHistoricalSnapshots(scopeLevel, scopeId, userId));
    }

    @GetMapping("/snapshots")
    public ResponseEntity<Map<String, Object>> getSnapshots(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false, defaultValue = "BANK") String scopeLevel,
            @RequestParam(required = false, defaultValue = "ALL") String scopeId) {
        return ResponseEntity.ok(dashboardService.getHistoricalSnapshots(scopeLevel, scopeId, userId));
    }

    @PostMapping("/snapshots/capture")
    public ResponseEntity<DashboardSnapshot> captureSnapshot(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false, defaultValue = "BANK") String scopeLevel,
            @RequestParam(required = false, defaultValue = "ALL") String scopeId) {
        return ResponseEntity.ok(dashboardService.captureSnapshot(scopeLevel, scopeId, userId));
    }

    @GetMapping("/kpi-explanation")
    public ResponseEntity<KpiExplanationDto> getKpiExplanation(
            @RequestParam(required = false) String kpiKey,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        return ResponseEntity.ok(dashboardService.getKpiExplanatoryBreakdown(kpiKey, userId, segment, district, branch));
    }

    @GetMapping("/shared-collaterals")
    public ResponseEntity<List<Map<String, Object>>> getSharedCollaterals(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        return ResponseEntity.ok(dashboardService.getSharedCollaterals(userId, segment, district, branch));
    }

    @GetMapping("/requires-attention")
    public ResponseEntity<List<Map<String, Object>>> getRequiresAttention(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch) {
        return ResponseEntity.ok(dashboardService.getRequiresAttention(userId, segment, district, branch));
    }

    @GetMapping("/portfolio/paginated")
    public ResponseEntity<PaginatedPortfolioResponseDto> getPaginatedPortfolio(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String expiry,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false, defaultValue = "customerName") String sortField,
            @RequestParam(required = false, defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(dashboardService.getPaginatedPortfolio(
                userId, segment, district, branch, category, status, expiry, search, page, size, sortField, sortDir));
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

    // =========================================================================
    // PROGRESSIVE HIERARCHICAL DRILL-DOWN ENDPOINTS
    // =========================================================================

    @GetMapping("/hierarchy/bank")
    public ResponseEntity<Map<String, Object>> getHierarchyBank(
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(dashboardService.getHierarchyBank(userId));
    }

    @GetMapping("/hierarchy/segment")
    public ResponseEntity<Map<String, Object>> getHierarchySegment(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String segment) {
        return ResponseEntity.ok(dashboardService.getHierarchySegment(userId, segment));
    }

    @GetMapping("/hierarchy/district")
    public ResponseEntity<Map<String, Object>> getHierarchyDistrict(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String segment) {
        return ResponseEntity.ok(dashboardService.getHierarchyDistrict(userId, district, segment));
    }

    @GetMapping("/hierarchy/area")
    public ResponseEntity<Map<String, Object>> getHierarchyArea(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String segment) {
        return ResponseEntity.ok(dashboardService.getHierarchyArea(userId, area, district, segment));
    }

    @GetMapping("/hierarchy/branch")
    public ResponseEntity<Map<String, Object>> getHierarchyBranch(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String segment) {
        return ResponseEntity.ok(dashboardService.getHierarchyBranch(userId, branch, segment));
    }

    @GetMapping("/hierarchy/customer/{cif}")
    public ResponseEntity<Map<String, Object>> getHierarchyCustomer(
            @PathVariable String cif,
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(dashboardService.getHierarchyCustomer(userId, cif));
    }

    @GetMapping("/hierarchy/facility/{facilityId}")
    public ResponseEntity<Map<String, Object>> getHierarchyFacility(
            @PathVariable String facilityId,
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(dashboardService.getHierarchyFacility(userId, facilityId));
    }

    @GetMapping("/hierarchy/collateral/{collateralId}")
    public ResponseEntity<Map<String, Object>> getHierarchyCollateral(
            @PathVariable String collateralId,
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(dashboardService.getHierarchyCollateral(userId, collateralId));
    }

    @GetMapping("/hierarchy/policy/{policyId}")
    public ResponseEntity<Map<String, Object>> getHierarchyPolicy(
            @PathVariable String policyId,
            @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(dashboardService.getHierarchyPolicy(userId, policyId));
    }
}
