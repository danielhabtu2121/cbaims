package com.bank.cims.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class KpiExplanationDto {
    private String kpiKey;
    private String kpiTitle;
    private String kpiValue;
    private String formula;
    private String definition;
    private String scope;
    private String asOfDate;
    private List<Map<String, Object>> subUnitContributions = new ArrayList<>();
    private List<Map<String, Object>> topRiskContributors = new ArrayList<>();
    private List<String> recommendedActions = new ArrayList<>();

    public KpiExplanationDto() {}

    public String getKpiKey() { return kpiKey; }
    public void setKpiKey(String kpiKey) { this.kpiKey = kpiKey; }

    public String getKpiTitle() { return kpiTitle; }
    public void setKpiTitle(String kpiTitle) { this.kpiTitle = kpiTitle; }

    public String getKpiValue() { return kpiValue; }
    public void setKpiValue(String kpiValue) { this.kpiValue = kpiValue; }

    public String getFormula() { return formula; }
    public void setFormula(String formula) { this.formula = formula; }

    public String getDefinition() { return definition; }
    public void setDefinition(String definition) { this.definition = definition; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public String getAsOfDate() { return asOfDate; }
    public void setAsOfDate(String asOfDate) { this.asOfDate = asOfDate; }

    public List<Map<String, Object>> getSubUnitContributions() { return subUnitContributions; }
    public void setSubUnitContributions(List<Map<String, Object>> subUnitContributions) { this.subUnitContributions = subUnitContributions; }

    public List<Map<String, Object>> getTopRiskContributors() { return topRiskContributors; }
    public void setTopRiskContributors(List<Map<String, Object>> topRiskContributors) { this.topRiskContributors = topRiskContributors; }

    public List<String> getRecommendedActions() { return recommendedActions; }
    public void setRecommendedActions(List<String> recommendedActions) { this.recommendedActions = recommendedActions; }
}
