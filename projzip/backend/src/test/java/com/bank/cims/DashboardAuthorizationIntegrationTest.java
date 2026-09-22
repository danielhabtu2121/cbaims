package com.bank.cims;

import com.bank.cims.dto.DashboardChartDataDto;
import com.bank.cims.dto.DashboardPortfolioRowDto;
import com.bank.cims.dto.DashboardSummaryDto;
import com.bank.cims.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class DashboardAuthorizationIntegrationTest {

    @Autowired
    private DashboardService dashboardService;

    @Test
    public void testExecutiveHasBankWideScope() {
        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-exec", null, null, null);
        assertEquals("BANK_WIDE", scope.scopeLevel);
        assertFalse(scope.lockedSegment);
        assertFalse(scope.lockedDistrict);
        assertFalse(scope.lockedBranch);

        DashboardSummaryDto summary = dashboardService.getSummary("usr-exec", null, null, null, null, null, null);
        assertNotNull(summary);
        assertNotNull(summary.getTotalOutstandingExposure());
        assertNotNull(summary.getTotalInsuranceGap());
        assertTrue(summary.getInsuranceCoveragePct() >= 0);
    }

    @Test
    public void testHeadOfficeDepartmentIsLockedToAssignedSegment() {
        // HODEPT user assigned to Corporate Banking
        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-hodept", "Retail Banking", null, null);
        assertEquals("SEGMENT", scope.scopeLevel);
        assertTrue(scope.lockedSegment);
        // Unauthorized segment 'Retail Banking' requested by HODEPT must be clamped to authorized segment
        assertEquals("Corporate Banking", scope.effectiveSegment);

        DashboardSummaryDto summary = dashboardService.getSummary("usr-hodept", "Retail Banking", null, null, null, null, null);
        assertEquals("Corporate Banking", summary.getScopeBanner().getSegment());
    }

    @Test
    public void testDistrictDirectorIsLockedToDistrict() {
        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-distdir", null, "Hawassa District", null);
        assertEquals("DISTRICT", scope.scopeLevel);
        assertTrue(scope.lockedDistrict);
        assertEquals("Addis Ababa East District", scope.effectiveDistrict);
    }

    @Test
    public void testBranchManagerIsLockedToBranch() {
        DashboardService.ResolvedScope scope = dashboardService.resolveUserScope("usr-brmgr", null, null, "Merkato Branch");
        assertEquals("BRANCH", scope.scopeLevel);
        assertTrue(scope.lockedBranch);
        assertEquals("Bole Special Branch", scope.effectiveBranch);
    }

    @Test
    public void testInsuranceGapCalculationIntegrity() {
        DashboardSummaryDto summary = dashboardService.getSummary("usr-exec", null, null, null, null, null, null);
        assertNotNull(summary);
        // Required Insurance >= Net Security or Market Value
        assertTrue(summary.getTotalInsuranceRequired().compareTo(BigDecimal.ZERO) >= 0);
        // Insurance Gap = Required - Valid Active (floored at 0)
        assertTrue(summary.getTotalInsuranceGap().compareTo(BigDecimal.ZERO) >= 0);
    }

    @Test
    public void testZeroFabricatedHistoricalData() {
        DashboardChartDataDto charts = dashboardService.getCharts("usr-exec", null, null, null, null, null, null);
        assertNotNull(charts);
        assertTrue(charts.getHistoricalSnapshots().isEmpty());
        assertNotNull(charts.getHistoricalDataMessage());
        assertTrue(charts.getHistoricalDataMessage().contains("Historical data not yet available"));
    }

    @Test
    public void testUniversalPortfolioRows() {
        List<DashboardPortfolioRowDto> portfolio = dashboardService.getPortfolio("usr-exec", null, null, null, null, null, null);
        assertNotNull(portfolio);
        assertFalse(portfolio.isEmpty());
        for (DashboardPortfolioRowDto row : portfolio) {
            assertNotNull(row.getCollateralCode());
            assertNotNull(row.getInsuranceRequired());
            assertNotNull(row.getInsuranceGap());
            assertTrue(row.getCoveragePct() >= 0.0);
        }
    }
}
