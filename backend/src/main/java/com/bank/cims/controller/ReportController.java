package com.bank.cims.controller;

import com.bank.cims.model.ScheduledReport;
import com.bank.cims.model.User;
import com.bank.cims.repository.ScheduledReportRepository;
import com.bank.cims.service.AuthorizationScopeService;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.ReportExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired private ReportExecutionService reportExecutionService;
    @Autowired private ScheduledReportRepository scheduledReportRepository;
    @Autowired private CimsService cimsService;
    @Autowired private AuthorizationScopeService authorizationScopeService;

    private User currentActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()) {
            throw new AccessDeniedException("An authenticated user is required to access reports.");
        }
        return actor;
    }

    /**
     * RPT-07 / RPT-T22: Audit interactive report execution and export.
     */
    @PostMapping("/reports/audit-export")
    public ResponseEntity<Map<String, Object>> auditReportExport(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        User actor = currentActor();
        String actorUsername = actor.getUsername();
        String role = actor.getRole() != null ? actor.getRole() : "OFFICER";

        String reportCode = String.valueOf(payload.getOrDefault("reportCode", "UNKNOWN"));
        String reportName = String.valueOf(payload.getOrDefault("reportName", "General Report"));
        String format = String.valueOf(payload.getOrDefault("format", "PDF"));
        String filterSegment = String.valueOf(payload.getOrDefault("filterSegment", "All"));
        String filterBranch = String.valueOf(payload.getOrDefault("filterBranch", "All"));
        String count = String.valueOf(payload.getOrDefault("recordCount", "0"));

        cimsService.logAudit(actorUsername, role, "REPORT_EXPORT", "ReportCatalog", reportCode, "ExportFormat",
                filterSegment + "|" + filterBranch, format,
                "User exported " + reportName + " (" + reportCode + ") in " + format + " format [" + count + " records, Scope: " + filterBranch + "/" + filterSegment + "]");

        return ResponseEntity.ok(Map.of("success", true, "message", "Report export successfully audited."));
    }

    /**
     * RPT-02 / RPT-T04: Retrieve server-side report dataset with authoritative organizational scoping.
     */
    @GetMapping("/reports/data")
    public ResponseEntity<List<Map<String, Object>>> getReportData(
            @RequestParam String reportType,
            @RequestParam(required = false, defaultValue = "All") String segment,
            @RequestParam(required = false, defaultValue = "All") String branch,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        currentActor();
        AuthorizationScopeService.Scope scope = authorizationScopeService.currentScope();

        String effectiveSegment = segment;
        String effectiveBranch = branch;

        if (!scope.isBankWide()) {
            if (segment != null && !segment.isBlank() && !"All".equalsIgnoreCase(segment)
                    && !scope.segmentAllowed(segment)) {
                throw new AccessDeniedException("Requested segment is outside your assigned scope.");
            }
            if (branch != null && !branch.isBlank() && !"All".equalsIgnoreCase(branch)
                    && !scope.branchAllowed(branch)) {
                throw new AccessDeniedException("Requested branch is outside your assigned scope.");
            }
            if (("All".equalsIgnoreCase(segment) || segment == null || segment.isBlank())
                    && scope.getSegment() != null && !scope.getSegment().isBlank()) {
                effectiveSegment = scope.getSegment();
            }
            if (("All".equalsIgnoreCase(branch) || branch == null || branch.isBlank())
                    && scope.getBranch() != null && !scope.getBranch().isBlank()) {
                effectiveBranch = scope.getBranch();
            }
        }

        List<Map<String, Object>> data = reportExecutionService.generateReportData(reportType, effectiveSegment, effectiveBranch);
        return ResponseEntity.ok(data);
    }

    /**
     * RPT-06 / RPT-T19: On-demand execution of a scheduled report producing a real DMS file artifact.
     */
    @PostMapping("/admin/scheduled-reports/{id}/run")
    public ResponseEntity<?> runScheduledReportManually(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        String actor = currentActor().getUsername();
        ScheduledReport report = scheduledReportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Scheduled report not found: " + id));

        ReportExecutionService.ReportExecutionResult result = reportExecutionService.executeScheduledReport(report, actor);
        return ResponseEntity.ok(result);
    }
}
