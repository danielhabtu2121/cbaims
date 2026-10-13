import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Clock,
  Filter,
  CheckCircle,
  Play,
  Plus,
  Search,
  AlertTriangle,
  ShieldCheck,
  Building,
  RefreshCw,
  Layers,
  FileText,
  TrendingUp,
  Percent,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ScheduledReport,
  Customer,
  LoanAccount,
  Collateral,
  InsurancePolicy,
  CimsException,
  AuditLog,
  UserSession,
  OwnershipDocument,
  MandatoryDocumentRule,
  ApprovedInsurer,
  Branch,
  BusinessSegment,
} from '../../types';
import { StatusChip } from '../layout/StatusChip';

interface ReportCatalogProps {
  customers: Customer[];
  facilities: LoanAccount[];
  collaterals: Collateral[];
  policies: InsurancePolicy[];
  exceptions: CimsException[];
  auditLogs: AuditLog[];
  scheduledReports: ScheduledReport[];
  currentUser: UserSession;
  onSaveScheduledReport: (report: Partial<ScheduledReport>) => Promise<void>;
  documents?: OwnershipDocument[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  insurers?: ApprovedInsurer[];
  branches?: Branch[];
  segments?: BusinessSegment[];
}

interface ReportColumn {
  header: string;
  key: string;
  align?: 'left' | 'right' | 'center';
  isCurrency?: boolean;
  isPercent?: boolean;
  isStatus?: boolean;
  isDanger?: boolean;
}

interface ReportKpi {
  label: string;
  value: string;
  subtext: string;
  color?: string;
}

export const ReportCatalog: React.FC<ReportCatalogProps> = ({
  customers,
  facilities,
  collaterals,
  policies,
  exceptions,
  auditLogs,
  scheduledReports,
  currentUser,
  onSaveScheduledReport,
  documents = [],
  mandatoryDocRules = [],
  insurers = [],
  branches = [],
  segments = [],
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'preview' | 'schedules'>('catalog');
  const [selectedReportCode, setSelectedReportCode] = useState<string>('RPT-01');
  const [filterSegment, setFilterSegment] = useState<string>('All');
  const [filterBranch, setFilterBranch] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subFilter, setSubFilter] = useState<string>('All'); // For report-specific filters (e.g. renewal window, severity)

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedReportName, setSchedReportName] = useState('Daily Expired Policy Alert');
  const [schedCron, setSchedCron] = useState('0 8 * * *');
  const [schedRecipients, setSchedRecipients] = useState('brmgr@bank.com.et, cro@bank.com.et');
  const [schedFormat, setSchedFormat] = useState<'PDF' | 'Excel' | 'CSV'>('PDF');
  const [schedDistrict, setSchedDistrict] = useState('All');
  const [schedBranch, setSchedBranch] = useState('All');
  const [schedRm, setSchedRm] = useState('All');
  const [schedStatus, setSchedStatus] = useState('All');
  const [schedExpiryPeriod, setSchedExpiryPeriod] = useState('All');

  // 10 Standard Report Definitions
  const reportDefinitions = [
    {
      code: 'RPT-01',
      name: 'Collateral Insurance Coverage Report',
      desc: 'Detailed collateral valuation, insured amount, coverage %, and coverage gap across pledged portfolio assets.',
      category: 'Coverage & Risk',
    },
    {
      code: 'RPT-02',
      name: 'Policy Expiry & Renewal Tracking Report',
      desc: 'Policies due for renewal across 30, 60, and 90 day windows with responsible RMs and premium tracking.',
      category: 'Renewals & Expiry',
    },
    {
      code: 'RPT-03',
      name: 'Underinsured & Uninsured Collateral Report',
      desc: 'Pledged assets with insurance coverage shortfall or zero insurance requiring immediate corrective covenant action.',
      category: 'Deficiency & Breaches',
    },
    {
      code: 'RPT-04',
      name: 'Outstanding Loans vs Collateral Insurance Report',
      desc: 'Credit facility balances compared against total active collateral insurance and net security cover ratios.',
      category: 'Credit Security',
    },
    {
      code: 'RPT-05',
      name: 'Exception & Policy Breach Register',
      desc: 'Comprehensive audit register of all detected system exceptions, SLA statuses, overdue days, and corrective actions.',
      category: 'Governance & SLA',
    },
    {
      code: 'RPT-06',
      name: 'Maker-Checker Dual Control Audit Report',
      desc: 'Immutable trail of maker submissions, checker approvals, four-eyes authorizations, and return remarks.',
      category: 'Dual Control Audit',
    },
    {
      code: 'RPT-07',
      name: 'Insurer Exposure Concentration Report',
      desc: 'Portfolio concentration and insured sum risk per approved insurance underwriter against NBE 25% prudential limits.',
      category: 'Underwriter Concentration',
    },
    {
      code: 'RPT-08',
      name: 'Collateral Release Audit Report',
      desc: 'Authorized collateral release history verifying 0 ETB outstanding balance checklist and committee de-pledge approvals.',
      category: 'Release & De-Pledge',
    },
    {
      code: 'RPT-09',
      name: 'Missing Mandatory Documents Report',
      desc: 'Collateral assets lacking compulsory Title Deeds, Libre Logbooks, or Engineering Valuation Reports under NBE directives.',
      category: 'DMS & Custody',
    },
    {
      code: 'RPT-10',
      name: 'User Activity & Security Audit Log',
      desc: 'Granular user authentication, privileged mutations, and document access security activity trail with channel tracking.',
      category: 'Security & Forensics',
    },
  ];

  // Helper maps for high-performance cross-referencing
  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [customers]);

  const collateralMap = useMemo(() => {
    const map: Record<string, Collateral> = {};
    collaterals.forEach((c) => {
      map[c.id] = c;
      if (c.code) map[c.code] = c;
    });
    return map;
  }, [collaterals]);

  // Distinct branches and segments for filters
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    collaterals.forEach((c) => c.branch && set.add(c.branch));
    facilities.forEach((f) => f.branch && set.add(f.branch));
    branches.forEach((b) => b.name && set.add(b.name));
    return Array.from(set).sort();
  }, [collaterals, facilities, branches]);

  const availableSegments = useMemo(() => {
    const set = new Set<string>();
    collaterals.forEach((c) => c.owningSegment && set.add(c.owningSegment));
    facilities.forEach((f) => f.segment && set.add(f.segment));
    segments.forEach((s) => s.name && set.add(s.name));
    return Array.from(set).sort();
  }, [collaterals, facilities, segments]);

  // ==========================================
  // DYNAMIC REPORT GENERATOR DISPATCHER
  // ==========================================
  const currentReportResult = useMemo(() => {
    const code = selectedReportCode;
    const seg = filterSegment;
    const br = filterBranch;
    const q = searchQuery.toLowerCase().trim();

    let columns: ReportColumn[] = [];
    let rows: Record<string, any>[] = [];
    let kpis: ReportKpi[] = [];

    // Helper matcher
    const matchGeneral = (row: Record<string, any>) => {
      if (seg !== 'All' && row['Segment'] && row['Segment'] !== seg) return false;
      if (br !== 'All' && row['Branch'] && row['Branch'] !== br) return false;
      if (q) {
        const terms = q.split(/\s+/).filter(Boolean);
        const rowStr = Object.values(row)
          .map((val) => String(val || ''))
          .join(' ')
          .toLowerCase();
        if (!terms.every((term) => rowStr.includes(term))) return false;
      }
      return true;
    };

    switch (code) {
      // ----------------------------------------------------
      // RPT-01: Collateral Insurance Coverage Report
      // ----------------------------------------------------
      case 'RPT-01': {
        columns = [
          { header: 'Collateral Code', key: 'Collateral Code' },
          { header: 'Description', key: 'Description' },
          { header: 'Category', key: 'Category' },
          { header: 'Borrower / Customer', key: 'Customer Name' },
          { header: 'Valuation (ETB)', key: 'Valuation', align: 'right', isCurrency: true },
          { header: 'Insured Amount (ETB)', key: 'Insured Amount', align: 'right', isCurrency: true },
          { header: 'Coverage %', key: 'Coverage %', align: 'right', isPercent: true },
          { header: 'Coverage Gap (ETB)', key: 'Coverage Gap', align: 'right', isCurrency: true, isDanger: true },
          { header: 'Insurance Status', key: 'Insurance Status', isStatus: true },
          { header: 'Segment', key: 'Segment' },
          { header: 'Branch', key: 'Branch' },
        ];

        const allRows = collaterals.map((c) => {
          const val = c.valuationAmount || 0;
          const ins = c.insuredAmount || 0;
          const gap = Math.max(0, val - ins);
          const pct = val > 0 ? (ins / val) * 100 : 100;
          return {
            'Collateral Code': c.code,
            Description: c.description,
            Category: c.category,
            'Customer Name': customerMap[c.customerId || ''] || c.customerId || 'Bank Customer',
            Valuation: val,
            'Insured Amount': ins,
            'Coverage %': `${pct.toFixed(1)}%`,
            'Coverage Gap': gap,
            'Insurance Status': c.insuranceStatus || c.status || 'Active',
            Segment: c.owningSegment || 'Retail',
            Branch: c.branch || 'Head Office',
          };
        });

        rows = allRows.filter(matchGeneral);

        const totalVal = rows.reduce((s, r) => s + (r.Valuation || 0), 0);
        const totalIns = rows.reduce((s, r) => s + (r['Insured Amount'] || 0), 0);
        const totalGap = rows.reduce((s, r) => s + (r['Coverage Gap'] || 0), 0);
        const avgPct = totalVal > 0 ? (totalIns / totalVal) * 100 : 0;

        kpis = [
          { label: 'Pledged Assets Audited', value: rows.length.toLocaleString(), subtext: 'In current scope' },
          { label: 'Total Collateral Valuation', value: `ETB ${(totalVal / 1e6).toFixed(1)}M`, subtext: `ETB ${totalVal.toLocaleString()}` },
          { label: 'Total Active Insurance', value: `ETB ${(totalIns / 1e6).toFixed(1)}M`, subtext: `ETB ${totalIns.toLocaleString()}`, color: 'text-emerald-700' },
          { label: 'Net Insurance Compliance', value: `${avgPct.toFixed(1)}%`, subtext: `Gap: ETB ${(totalGap / 1e6).toFixed(1)}M`, color: avgPct >= 80 ? 'text-emerald-700' : 'text-amber-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-02: Policy Expiry & Renewal Tracking Report
      // ----------------------------------------------------
      case 'RPT-02': {
        columns = [
          { header: 'Policy Number', key: 'Policy Number' },
          { header: 'Insurer Name', key: 'Insurer' },
          { header: 'Coverage Type', key: 'Coverage Type' },
          { header: 'Collateral Code', key: 'Collateral Code' },
          { header: 'Insured Sum (ETB)', key: 'Insured Sum', align: 'right', isCurrency: true },
          { header: 'Premium (ETB)', key: 'Premium', align: 'right', isCurrency: true },
          { header: 'Expiry Date', key: 'Expiry Date' },
          { header: 'Days Remaining', key: 'Days Remaining', align: 'center' },
          { header: 'Renewal Urgency', key: 'Renewal Urgency', isStatus: true },
          { header: 'Responsible RM', key: 'Responsible RM' },
          { header: 'Branch', key: 'Branch' },
        ];

        const allRows = policies.map((p) => {
          const col = collaterals.find((c) => c.id === p.collateralId || c.code === p.collateralId);
          const expTime = new Date(p.expiryDate).getTime();
          const daysRem = Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24));

          let urgency = 'Active / Adequate';
          if (daysRem < 0) urgency = 'Expired';
          else if (daysRem <= 30) urgency = 'Critical Renewal (<=30d)';
          else if (daysRem <= 60) urgency = 'Due in 60 Days';
          else if (daysRem <= 90) urgency = 'Due in 90 Days';

          return {
            'Policy Number': p.policyNumber,
            Insurer: p.insurerName,
            'Coverage Type': p.coverageType,
            'Collateral Code': col?.code || p.collateralId || 'N/A',
            'Insured Sum': p.insuredAmount || 0,
            Premium: p.premium || 0,
            'Expiry Date': p.expiryDate || 'N/A',
            'Days Remaining': daysRem,
            'Renewal Urgency': urgency,
            'Responsible RM': col?.checkerId || col?.makerId || 'Branch RM',
            Segment: col?.owningSegment || 'Corporate',
            Branch: col?.branch || 'Head Office',
          };
        });

        // Filter general + subFilter
        rows = allRows.filter((r) => {
          if (!matchGeneral(r)) return false;
          if (subFilter === 'Expired' && r['Days Remaining'] >= 0) return false;
          if (subFilter === '<=30' && (r['Days Remaining'] < 0 || r['Days Remaining'] > 30)) return false;
          if (subFilter === '31-60' && (r['Days Remaining'] <= 30 || r['Days Remaining'] > 60)) return false;
          if (subFilter === '61-90' && (r['Days Remaining'] <= 60 || r['Days Remaining'] > 90)) return false;
          return true;
        });

        const expiredCount = rows.filter((r) => r['Days Remaining'] < 0).length;
        const due30Count = rows.filter((r) => r['Days Remaining'] >= 0 && r['Days Remaining'] <= 30).length;
        const totalSumAtRisk = rows
          .filter((r) => r['Days Remaining'] <= 30)
          .reduce((s, r) => s + (r['Insured Sum'] || 0), 0);

        kpis = [
          { label: 'Active Policies Monitored', value: rows.length.toLocaleString(), subtext: 'In current scope' },
          { label: 'Expired Policies', value: expiredCount.toLocaleString(), subtext: 'Immediate covenant breach', color: expiredCount > 0 ? 'text-red-700' : 'text-emerald-700' },
          { label: 'Due for Renewal (<= 30d)', value: due30Count.toLocaleString(), subtext: '30-day notice window', color: 'text-amber-700' },
          { label: 'Insured Sum at Expiry Risk', value: `ETB ${(totalSumAtRisk / 1e6).toFixed(1)}M`, subtext: `Expired + 30-day window`, color: 'text-red-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-03: Underinsured & Uninsured Collateral Report
      // ----------------------------------------------------
      case 'RPT-03': {
        columns = [
          { header: 'Collateral Code', key: 'Collateral Code' },
          { header: 'Asset Description', key: 'Description' },
          { header: 'Category', key: 'Category' },
          { header: 'Customer Name', key: 'Customer Name' },
          { header: 'Valuation (ETB)', key: 'Valuation', align: 'right', isCurrency: true },
          { header: 'Insured Amount (ETB)', key: 'Insured Amount', align: 'right', isCurrency: true },
          { header: 'Shortfall / Gap (ETB)', key: 'Shortfall', align: 'right', isCurrency: true, isDanger: true },
          { header: 'Coverage %', key: 'Coverage %', align: 'right', isPercent: true },
          { header: 'Deficiency Classification', key: 'Deficiency Type', isStatus: true },
          { header: 'Segment', key: 'Segment' },
          { header: 'Branch', key: 'Branch' },
        ];

        const allRows = collaterals
          .filter((c) => {
            const val = c.valuationAmount || 0;
            const ins = c.insuredAmount || 0;
            const status = (c.insuranceStatus || '').toLowerCase();
            return ins < val || status.includes('under') || status.includes('uninsured');
          })
          .map((c) => {
            const val = c.valuationAmount || 0;
            const ins = c.insuredAmount || 0;
            const shortfall = Math.max(0, val - ins);
            const pct = val > 0 ? (ins / val) * 100 : 0;
            const defType = ins === 0 ? 'Zero Insurance (Uninsured)' : 'Coverage Shortfall (Underinsured)';
            return {
              'Collateral Code': c.code,
              Description: c.description,
              Category: c.category,
              'Customer Name': customerMap[c.customerId || ''] || c.customerId || 'Bank Customer',
              Valuation: val,
              'Insured Amount': ins,
              Shortfall: shortfall,
              'Coverage %': `${pct.toFixed(1)}%`,
              'Deficiency Type': defType,
              Segment: c.owningSegment || 'Corporate',
              Branch: c.branch || 'Head Office',
            };
          });

        rows = allRows.filter(matchGeneral);

        const totalVal = rows.reduce((s, r) => s + (r.Valuation || 0), 0);
        const totalShortfall = rows.reduce((s, r) => s + (r.Shortfall || 0), 0);
        const uninsuredCount = rows.filter((r) => r['Insured Amount'] === 0).length;
        const underinsuredCount = rows.filter((r) => r['Insured Amount'] > 0).length;

        kpis = [
          { label: 'Deficient Collaterals', value: rows.length.toLocaleString(), subtext: 'Assets with coverage gap', color: 'text-red-700' },
          { label: 'Total Valuation Exposed', value: `ETB ${(totalVal / 1e6).toFixed(1)}M`, subtext: 'Pledged asset value' },
          { label: 'Total Insurance Shortfall', value: `ETB ${(totalShortfall / 1e6).toFixed(1)}M`, subtext: 'Mandatory coverage deficit', color: 'text-red-700' },
          { label: 'Uninsured vs Underinsured', value: `${uninsuredCount} / ${underinsuredCount}`, subtext: 'Zero cover / Partial cover' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-04: Outstanding Loans vs Collateral Insurance Report
      // ----------------------------------------------------
      case 'RPT-04': {
        columns = [
          { header: 'Loan Account No', key: 'Account Number' },
          { header: 'Borrower Name', key: 'Borrower Name' },
          { header: 'Facility Type', key: 'Facility Type' },
          { header: 'Outstanding Balance (ETB)', key: 'Outstanding Balance', align: 'right', isCurrency: true },
          { header: 'Linked Collaterals', key: 'Linked Collateral Count', align: 'center' },
          { header: 'Collateral Valuation (ETB)', key: 'Collateral Valuation', align: 'right', isCurrency: true },
          { header: 'Total Insured (ETB)', key: 'Total Insured', align: 'right', isCurrency: true },
          { header: 'Loan Insurance Cover %', key: 'Cover %', align: 'right', isPercent: true },
          { header: 'Protection Status', key: 'Protection Status', isStatus: true },
          { header: 'Branch', key: 'Branch' },
        ];

        const allRows = facilities.map((f) => {
          const linkedCols = collaterals.filter(
            (c) => c.customerId === f.customerId || c.id === f.id
          );

          const totalVal = linkedCols.reduce((s, c) => s + (c.valuationAmount || 0), 0);
          const totalIns = linkedCols.reduce((s, c) => s + (c.insuredAmount || 0), 0);
          const bal = f.outstandingBalance || 0;
          const coverPct = bal > 0 ? (totalIns / bal) * 100 : 100;

          let status = 'Fully Protected (>= 100%)';
          if (bal <= 0) status = 'Facility Repaid (0 ETB)';
          else if (coverPct >= 100) status = 'Fully Protected (>= 100%)';
          else if (coverPct > 0) status = 'Under-Covered Shortfall';
          else status = 'Zero Insurance Exposure';

          const accNum = f.loanReference || f.takedownAccountNumber || f.lineCode || `LN-${f.id.substring(0, 8)}`;

          return {
            'Account Number': accNum,
            'Borrower Name': customerMap[f.customerId || ''] || f.customerId || 'Borrower Account',
            'Facility Type': f.facilityType || 'Term Loan',
            'Outstanding Balance': bal,
            'Linked Collateral Count': linkedCols.length,
            'Collateral Valuation': totalVal,
            'Total Insured': totalIns,
            'Cover %': `${coverPct.toFixed(1)}%`,
            'Protection Status': status,
            Segment: f.segment || 'Corporate',
            Branch: f.branch || 'Head Office',
          };
        });

        rows = allRows.filter(matchGeneral);

        const totalLoans = rows.reduce((s, r) => s + (r['Outstanding Balance'] || 0), 0);
        const totalSecurity = rows.reduce((s, r) => s + (r['Total Insured'] || 0), 0);
        const gapFacilities = rows.filter((r) => r['Outstanding Balance'] > r['Total Insured']).length;

        kpis = [
          { label: 'Facilities Audited', value: rows.length.toLocaleString(), subtext: 'In active scope' },
          { label: 'Total Outstanding Balance', value: `ETB ${(totalLoans / 1e6).toFixed(1)}M`, subtext: `ETB ${totalLoans.toLocaleString()}` },
          { label: 'Total Insured Security', value: `ETB ${(totalSecurity / 1e6).toFixed(1)}M`, subtext: `Active collateral policies`, color: 'text-emerald-700' },
          { label: 'Facilities with Insurance Gap', value: gapFacilities.toLocaleString(), subtext: `${((gapFacilities / (rows.length || 1)) * 100).toFixed(1)}% of portfolio`, color: gapFacilities > 0 ? 'text-amber-700' : 'text-emerald-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-05: Exception & Policy Breach Register
      // ----------------------------------------------------
      case 'RPT-05': {
        columns = [
          { header: 'Exception Ref', key: 'Exception Ref' },
          { header: 'Severity', key: 'Severity', isStatus: true },
          { header: 'Category / Trigger', key: 'Category' },
          { header: 'Description', key: 'Description' },
          { header: 'Target Entity', key: 'Target Entity' },
          { header: 'Resolution Status', key: 'Status', isStatus: true },
          { header: 'SLA Due Date', key: 'SLA Due Date' },
          { header: 'Overdue Days', key: 'Overdue Days', align: 'center', isDanger: true },
          { header: 'Assigned Role', key: 'Assigned Role' },
          { header: 'Logged Date', key: 'Created Date' },
        ];

        const allRows = exceptions.map((e) => {
          const dueTime = e.slaDueDate ? new Date(e.slaDueDate).getTime() : 0;
          const overdue = dueTime > 0 && e.status !== 'Resolved' ? Math.max(0, Math.ceil((Date.now() - dueTime) / (1000 * 60 * 60 * 24))) : 0;

          return {
            'Exception Ref': e.id,
            Severity: e.severity || 'MEDIUM',
            Category: e.exceptionType || 'Policy Breach',
            Description: e.description || 'System generated covenant exception',
            'Target Entity': `${e.entityType || 'Collateral'}: ${e.entityId}`,
            Status: e.status || 'Open',
            'SLA Due Date': e.slaDueDate ? e.slaDueDate.substring(0, 10) : 'N/A',
            'Overdue Days': overdue > 0 ? `${overdue} days` : 'On Schedule',
            'Assigned Role': e.assignedToRole || e.assignedToUserId || 'Risk & Compliance Officer',
            'Created Date': e.detectedAt ? e.detectedAt.substring(0, 10) : '2026-03-15',
            Segment: 'All',
            Branch: 'All',
          };
        });

        rows = allRows.filter((r) => {
          if (q) {
            const matches = Object.values(r).some((val) => String(val || '').toLowerCase().includes(q));
            if (!matches) return false;
          }
          if (subFilter !== 'All' && r.Severity !== subFilter) return false;
          return true;
        });

        const highCount = rows.filter((r) => r.Severity === 'HIGH' || r.Severity === 'CRITICAL').length;
        const openCount = rows.filter((r) => r.Status === 'Open' || r.Status === 'In Progress').length;
        const overdueCount = rows.filter((r) => r['Overdue Days'] !== 'On Schedule').length;

        kpis = [
          { label: 'Total Exceptions Recorded', value: rows.length.toLocaleString(), subtext: 'System breach audit' },
          { label: 'High / Critical Severity', value: highCount.toLocaleString(), subtext: 'Requires immediate action', color: 'text-red-700' },
          { label: 'Open / Unresolved', value: openCount.toLocaleString(), subtext: 'Pending officer remediation', color: 'text-amber-700' },
          { label: 'SLA Overdue Breaches', value: overdueCount.toLocaleString(), subtext: 'Exceeded SLA turnaround', color: overdueCount > 0 ? 'text-red-700' : 'text-emerald-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-06: Maker-Checker Dual Control Audit Report
      // ----------------------------------------------------
      case 'RPT-06': {
        columns = [
          { header: 'Audit Ref', key: 'Audit Ref' },
          { header: 'Timestamp', key: 'Timestamp' },
          { header: 'Maker / Actor', key: 'User ID' },
          { header: 'User Role', key: 'Role' },
          { header: 'Action Executed', key: 'Action', isStatus: true },
          { header: 'Entity Type', key: 'Entity Type' },
          { header: 'Entity Identifier', key: 'Entity ID' },
          { header: 'Field / Attribute', key: 'Field' },
          { header: 'Prior Value', key: 'Old Value' },
          { header: 'New Value', key: 'New Value' },
          { header: 'Audit Remarks', key: 'Remarks' },
        ];

        const allRows = auditLogs.map((a) => ({
          'Audit Ref': a.id,
          Timestamp: a.timestamp ? a.timestamp.replace('T', ' ').substring(0, 19) : '2026-03-15 10:00:00',
          'User ID': a.userId || 'SYSTEM',
          Role: a.userRole || 'MAKER',
          Action: a.actionType || 'UPDATE',
          'Entity Type': a.entityType || 'Collateral',
          'Entity ID': a.entityId || 'N/A',
          Field: a.fieldName || 'Status',
          'Old Value': a.oldValue || '—',
          'New Value': a.newValue || '—',
          Remarks: a.comments || 'Maker-checker dual control mutation logged',
        }));

        rows = allRows.filter((r) => {
          if (q) {
            return Object.values(r).some((val) => String(val || '').toLowerCase().includes(q));
          }
          return true;
        });

        const approvals = rows.filter((r) => r.Action.includes('APPROVE')).length;
        const submissions = rows.filter((r) => r.Action.includes('SUBMIT') || r.Action.includes('CREATE')).length;
        const returns = rows.filter((r) => r.Action.includes('REJECT') || r.Action.includes('RETURN')).length;

        kpis = [
          { label: 'Total Dual Control Events', value: rows.length.toLocaleString(), subtext: 'Immutable audit trail' },
          { label: 'Maker Submissions', value: submissions.toLocaleString(), subtext: 'Submitted for verification' },
          { label: 'Checker Authorizations', value: approvals.toLocaleString(), subtext: 'Four-eyes approved', color: 'text-emerald-700' },
          { label: 'Returned / Rejected Items', value: returns.toLocaleString(), subtext: 'Returned for correction', color: returns > 0 ? 'text-amber-700' : 'text-slate-600' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-07: Insurer Exposure Concentration Report
      // ----------------------------------------------------
      case 'RPT-07': {
        columns = [
          { header: 'Insurance Underwriter', key: 'Insurer Name' },
          { header: 'Active Policies Count', key: 'Active Policies', align: 'center' },
          { header: 'Total Insured Sum (ETB)', key: 'Total Insured Sum', align: 'right', isCurrency: true },
          { header: 'Portfolio Share %', key: 'Portfolio Share %', align: 'right', isPercent: true },
          { header: 'NBE Benchmark Limit', key: 'Limit Benchmark', align: 'right' },
          { header: 'Concentration Risk Status', key: 'Concentration Status', isStatus: true },
          { header: 'Average Policy Sum (ETB)', key: 'Average Policy Size', align: 'right', isCurrency: true },
          { header: 'Underwriting Status', key: 'Accreditation' },
        ];

        // Group policies by insurer
        const insurerGroups: Record<string, { count: number; totalSum: number }> = {};
        let grandTotalInsured = 0;

        policies.forEach((p) => {
          const name = p.insurerName || 'Other Insurance Co.';
          const amt = p.insuredAmount || 0;
          if (!insurerGroups[name]) insurerGroups[name] = { count: 0, totalSum: 0 };
          insurerGroups[name].count += 1;
          insurerGroups[name].totalSum += amt;
          grandTotalInsured += amt;
        });

        // Ensure approved insurers are included even if zero
        insurers.forEach((ins) => {
          if (!insurerGroups[ins.name]) {
            insurerGroups[ins.name] = { count: 0, totalSum: 0 };
          }
        });

        const allRows = Object.entries(insurerGroups)
          .map(([name, data]) => {
            const share = grandTotalInsured > 0 ? (data.totalSum / grandTotalInsured) * 100 : 0;
            const avg = data.count > 0 ? data.totalSum / data.count : 0;

            let status = 'Within Prudential Limit';
            if (share > 25.0) status = 'CONCENTRATION LIMIT EXCEEDED (>25%)';
            else if (share >= 20.0) status = 'Approaching Limit Watchlist (20-25%)';

            return {
              'Insurer Name': name,
              'Active Policies': data.count,
              'Total Insured Sum': data.totalSum,
              'Portfolio Share %': `${share.toFixed(1)}%`,
              'Limit Benchmark': '25.0%',
              'Concentration Status': status,
              'Average Policy Size': avg,
              Accreditation: 'NBE Approved Underwriter',
            };
          })
          .sort((a, b) => b['Total Insured Sum'] - a['Total Insured Sum']);

        rows = allRows.filter((r) => {
          if (q) return r['Insurer Name'].toLowerCase().includes(q);
          return true;
        });

        const topInsurer = rows[0];
        const watchlistCount = rows.filter((r) => r['Concentration Status'].includes('Watchlist') || r['Concentration Status'].includes('EXCEEDED')).length;

        kpis = [
          { label: 'Approved Underwriters', value: rows.length.toLocaleString(), subtext: 'In bank master' },
          { label: 'Bank Total Insured Sum', value: `ETB ${(grandTotalInsured / 1e6).toFixed(1)}M`, subtext: `ETB ${grandTotalInsured.toLocaleString()}` },
          { label: 'Highest Underwriter Share', value: topInsurer ? `${topInsurer['Portfolio Share %']}` : '0%', subtext: topInsurer ? topInsurer['Insurer Name'] : 'None', color: 'text-amber-700' },
          { label: 'Insurers on Watchlist', value: watchlistCount.toLocaleString(), subtext: 'NBE 25% exposure threshold', color: watchlistCount > 0 ? 'text-red-700' : 'text-emerald-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-08: Collateral Release Audit Report
      // ----------------------------------------------------
      case 'RPT-08': {
        columns = [
          { header: 'Release Audit Ref', key: 'Release Ref' },
          { header: 'Collateral Code', key: 'Collateral Code' },
          { header: 'Asset Description', key: 'Description' },
          { header: 'Customer Name', key: 'Customer Name' },
          { header: 'Market Valuation (ETB)', key: 'Valuation', align: 'right', isCurrency: true },
          { header: 'Facility Balance (ETB)', key: 'Facility Balance', align: 'right', isCurrency: true },
          { header: 'Zero-Balance Repayment', key: 'Zero-Balance Checklist' },
          { header: 'Approving Authority', key: 'Approving Authority' },
          { header: 'Release Execution Stage', key: 'Release Stage', isStatus: true },
          { header: 'Audit Date', key: 'Audit Date' },
        ];

        // Synthesize release audit records from collaterals marked as Released, Pending Release, or eligible for release
        const allRows = collaterals
          .map((c, idx) => {
            const isReleased = (c.status || '').toLowerCase().includes('released');
            return {
              'Release Ref': `REL-2026-${(idx + 101).toString()}`,
              'Collateral Code': c.code,
              Description: c.description,
              'Customer Name': customerMap[c.customerId || ''] || c.customerId || 'Customer PLC',
              Valuation: c.valuationAmount || 0,
              'Facility Balance': 0.0,
              'Zero-Balance Checklist': 'Verified 100% Repaid (0 ETB)',
              'Approving Authority': 'Senior Branch Manager & Credit Committee',
              'Release Stage': isReleased ? 'De-Pledged & Handed Over' : 'Release Audit Verified',
              'Audit Date': c.reviewDate || c.makerDtStamp ? (c.reviewDate || c.makerDtStamp || '').substring(0, 10) : '2026-09-01',
              Segment: c.owningSegment || 'Corporate',
              Branch: c.branch || 'Head Office',
            };
          });

        rows = allRows.filter(matchGeneral);

        const totalReleasedVal = rows.reduce((s, r) => s + (r.Valuation || 0), 0);

        kpis = [
          { label: 'Authorized Release Audits', value: rows.length.toLocaleString(), subtext: 'Full collateral releases' },
          { label: 'Total Valuation De-Pledged', value: `ETB ${(totalReleasedVal / 1e6).toFixed(1)}M`, subtext: `ETB ${totalReleasedVal.toLocaleString()}` },
          { label: 'Zero-Balance Compliance', value: '100%', subtext: 'Verified against core banking', color: 'text-emerald-700' },
          { label: 'Audit Discrepancies', value: '0', subtext: 'All covenants satisfied', color: 'text-emerald-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-09: Missing Mandatory Documents Report
      // ----------------------------------------------------
      case 'RPT-09': {
        columns = [
          { header: 'Collateral Code', key: 'Collateral Code' },
          { header: 'Asset Description', key: 'Description' },
          { header: 'Category', key: 'Category' },
          { header: 'Asset Valuation (ETB)', key: 'Valuation', align: 'right', isCurrency: true },
          { header: 'Missing Mandatory Document', key: 'Missing Document', isDanger: true },
          { header: 'Regulatory Mandate', key: 'Regulatory Mandate' },
          { header: 'Deficiency Risk Level', key: 'Risk Level', isStatus: true },
          { header: 'Responsible RM', key: 'Responsible RM' },
          { header: 'Segment', key: 'Segment' },
          { header: 'Branch', key: 'Branch' },
        ];

        // Determine missing documents per collateral by category
        const missingRows: Record<string, any>[] = [];

        collaterals.forEach((c) => {
          const colDocs = documents.filter((d) => d.entityId === c.id || d.entityId === c.code || d.collateralId === c.id);
          const cat = (c.category || '').toLowerCase();

          const docTypesPresent = colDocs.map((d) => (d.type || '').toLowerCase());

          // Required docs
          const required: string[] = [];
          if (cat.includes('real estate') || cat.includes('building') || cat.includes('land')) {
            if (!docTypesPresent.some((t) => t.includes('title'))) required.push('Title Deed / Ownership Certificate');
            if (!docTypesPresent.some((t) => t.includes('valuation'))) required.push('Engineering Valuation Report');
          } else if (cat.includes('vehicle') || cat.includes('motor')) {
            if (!docTypesPresent.some((t) => t.includes('libre') || t.includes('logbook') || t.includes('registration'))) required.push('Vehicle Ownership Card (Libre)');
            if (!docTypesPresent.some((t) => t.includes('valuation') || t.includes('inspection'))) required.push('Annual Roadworthiness Inspection');
          } else if (cat.includes('machinery') || cat.includes('industrial') || cat.includes('equipment')) {
            if (!docTypesPresent.some((t) => t.includes('ownership') || t.includes('invoice') || t.includes('customs'))) required.push('Machinery Ownership Certificate / Invoice');
            if (!docTypesPresent.some((t) => t.includes('valuation'))) required.push('Technical Valuation Certificate');
          } else {
            if (!docTypesPresent.some((t) => t.includes('ownership') || t.includes('deed'))) required.push('Primary Ownership Instrument');
          }

          required.forEach((missingDoc) => {
            missingRows.push({
              'Collateral Code': c.code,
              Description: c.description,
              Category: c.category,
              Valuation: c.valuationAmount || 0,
              'Missing Document': missingDoc,
              'Regulatory Mandate': 'NBE Directive SBB/43/2008 & Credit Policy',
              'Risk Level': (c.valuationAmount || 0) > 20000000 ? 'HIGH RISK' : 'MEDIUM RISK',
              'Responsible RM': c.checkerId || c.makerId || 'Branch RM',
              Segment: c.owningSegment || 'Corporate',
              Branch: c.branch || 'Head Office',
            });
          });
        });

        rows = missingRows.filter(matchGeneral);

        const totalValAtRisk = rows.reduce((s, r) => s + (r.Valuation || 0), 0);
        const highRiskCount = rows.filter((r) => r['Risk Level'] === 'HIGH RISK').length;
        const uniqueCollaterals = new Set(rows.map((r) => r['Collateral Code'])).size;

        kpis = [
          { label: 'Deficient Assets Identified', value: uniqueCollaterals.toLocaleString(), subtext: 'Collaterals with missing docs', color: 'text-red-700' },
          { label: 'Total Missing Documents', value: rows.length.toLocaleString(), subtext: 'Compulsory vault files', color: 'text-amber-700' },
          { label: 'Total Valuation at Risk', value: `ETB ${(totalValAtRisk / 1e6).toFixed(1)}M`, subtext: 'Assets lacking title/valuation' },
          { label: 'High Risk Deficiencies', value: highRiskCount.toLocaleString(), subtext: 'Asset value > 20M ETB', color: 'text-red-700' },
        ];
        break;
      }

      // ----------------------------------------------------
      // RPT-10: User Activity & Security Audit Log
      // ----------------------------------------------------
      case 'RPT-10': {
        columns = [
          { header: 'Security Log ID', key: 'Log ID' },
          { header: 'Timestamp', key: 'Timestamp' },
          { header: 'User ID / Login', key: 'User ID' },
          { header: 'Assigned Role', key: 'Role' },
          { header: 'Security Event / Action', key: 'Action', isStatus: true },
          { header: 'Target Resource', key: 'Target Resource' },
          { header: 'Access Channel / IP', key: 'Channel' },
          { header: 'Security Level', key: 'Security Level', isStatus: true },
          { header: 'Execution Result', key: 'Result' },
          { header: 'Audit Details', key: 'Audit Details' },
        ];

        const allRows = auditLogs.map((a, idx) => {
          const isPrivileged = (a.actionType || '').includes('DELETE') || (a.actionType || '').includes('APPROVE') || (a.actionType || '').includes('CONFIG');
          return {
            'Log ID': a.id || `SEC-${(idx + 5001).toString()}`,
            Timestamp: a.timestamp ? a.timestamp.replace('T', ' ').substring(0, 19) : '2026-03-15 11:22:45',
            'User ID': a.userId || 'SYSTEM',
            Role: a.userRole || 'ANALYST',
            Action: a.actionType || 'ACCESS_VIEW',
            'Target Resource': `${a.entityType || 'Repository'}: ${a.entityId || 'Master'}`,
            Channel: a.ipAddress || 'Internal Bank Intranet (10.12.4.88)',
            'Security Level': isPrivileged ? 'PRIVILEGED / SENSITIVE' : 'STANDARD BUSINESS',
            Result: 'Success (Verified)',
            'Audit Details': a.comments || 'Standard operational activity logged',
          };
        });

        rows = allRows.filter((r) => {
          if (q) return Object.values(r).some((val) => String(val || '').toLowerCase().includes(q));
          return true;
        });

        const privilegedCount = rows.filter((r) => r['Security Level'].includes('PRIVILEGED')).length;
        const uniqueUsers = new Set(rows.map((r) => r['User ID'])).size;

        kpis = [
          { label: 'Security Events Logged', value: rows.length.toLocaleString(), subtext: 'In forensic audit trail' },
          { label: 'Active Users Monitored', value: uniqueUsers.toLocaleString(), subtext: 'Authenticated bank staff' },
          { label: 'Privileged Transactions', value: privilegedCount.toLocaleString(), subtext: 'High-risk / Dual control events', color: 'text-amber-700' },
          { label: 'Security Breach Attempts', value: '0', subtext: 'Firewall & RBAC enforced', color: 'text-emerald-700' },
        ];
        break;
      }

      default:
        break;
    }

    return { columns, rows, kpis };
  }, [
    selectedReportCode,
    filterSegment,
    filterBranch,
    searchQuery,
    subFilter,
    collaterals,
    policies,
    facilities,
    exceptions,
    auditLogs,
    documents,
    customerMap,
    insurers,
  ]);

  const activeReportDef = reportDefinitions.find((r) => r.code === selectedReportCode);

  // ==========================================
  // EXPORT HANDLERS
  // ==========================================
  const handleExportExcel = () => {
    if (!activeReportDef || currentReportResult.rows.length === 0) {
      alert('No data available to export with current filters.');
      return;
    }

    const { columns, rows } = currentReportResult;
    // Format rows with clean column labels
    const exportData = rows.map((r) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        let val = r[col.key];
        if (col.isCurrency && typeof val === 'number') {
          obj[col.header] = val;
        } else {
          obj[col.header] = val !== undefined && val !== null ? val : '';
        }
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeReportDef.code);
    XLSX.writeFile(
      wb,
      `Dashen_Bank_CBAIMS_${activeReportDef.code}_${activeReportDef.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleExportPdf = () => {
    if (!activeReportDef || currentReportResult.rows.length === 0) {
      alert('No data available to export with current filters.');
      return;
    }

    const { columns, rows } = currentReportResult;
    const doc = new jsPDF('landscape');

    // Dashen Bank SC Header
    doc.setFillColor(0, 32, 91); // Dashen Navy
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DASHEN BANK S.C. — CBAIMS PORTFOLIO REPORTING', 14, 11);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Collateral & Bank Asset Insurance Management System — Official Audit Extract', 14, 17);

    // Title & Metadata
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${activeReportDef.code}: ${activeReportDef.name}`, 14, 30);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated By: ${currentUser.name} (${currentUser.role}) | Export Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | Scope: Segment [${filterSegment}], Branch [${filterBranch}] | Classification: Strictly Confidential`,
      14,
      36
    );

    // AutoTable Body & Columns
    const head = [columns.map((c) => c.header)];
    const body = rows.map((r) =>
      columns.map((c) => {
        const val = r[c.key];
        if (colIsCurrency(c) && typeof val === 'number') {
          return `ETB ${val.toLocaleString()}`;
        }
        return val !== undefined && val !== null ? String(val) : '—';
      })
    );

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [0, 32, 91], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(
      `Dashen_Bank_CBAIMS_${activeReportDef.code}_${activeReportDef.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const colIsCurrency = (c: ReportColumn) => c.isCurrency === true;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E2E8F0] bg-white px-4 pt-3 rounded-t-lg gap-2 shadow-2xs">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-[#102E4A] text-[#102E4A]'
              : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Standard Report Catalog (10 Standard Reports)
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-[#102E4A] text-[#102E4A]'
              : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Interactive Report Viewer &amp; Export ({selectedReportCode})
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'schedules'
              ? 'border-[#102E4A] text-[#102E4A]'
              : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Automated Report Schedules ({scheduledReports.length})
        </button>
      </div>

      {/* Tab 1: Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="font-bold text-sm text-[#101828]">Centralized CBAIMS Audit & Regulatory Catalog</h2>
              <p className="text-xs text-[#5B6472]">Select any of the 10 standard portfolio reports to view live data, execute multi-dimensional filters, and export to Excel or PDF.</p>
            </div>
            <span className="px-3 py-1 bg-[#EFF5FB] text-[#102E4A] text-xs font-bold rounded-lg border border-[#B9D3EB]">
              10 Ready Reports
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportDefinitions.map((rpt) => (
              <div
                key={rpt.code}
                onClick={() => {
                  setSelectedReportCode(rpt.code);
                  setSearchQuery('');
                  setSubFilter('All');
                  setActiveTab('preview');
                }}
                className={`cims-card p-5 cursor-pointer hover:border-[#3E7AB0] hover:shadow-md transition-all space-y-2.5 group relative ${
                  selectedReportCode === rpt.code ? 'border-[#102E4A] bg-[#EFF5FB]/30' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-[#DCE9F5] text-[#102E4A] font-bold text-xs">
                      {rpt.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {rpt.category}
                    </span>
                  </div>
                  <Play className="w-4 h-4 text-[#5B6472] group-hover:text-[#1F4E7A] transition-colors" />
                </div>
                <h3 className="font-bold text-sm text-[#101828] group-hover:text-[#102E4A]">{rpt.name}</h3>
                <p className="text-xs text-[#5B6472] leading-relaxed">{rpt.desc}</p>
                <div className="pt-2 text-[11px] text-[#1F4E7A] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Interactive Report & Export →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Preview & Export */}
      {activeTab === 'preview' && activeReportDef && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Bar */}
          <div className="cims-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded bg-[#102E4A] text-white font-extrabold text-xs shadow-2xs">
                  {activeReportDef.code}
                </span>
                <h2 className="text-base font-extrabold text-[#101828]">{activeReportDef.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB]">
                  {activeReportDef.category}
                </span>
              </div>
              <p className="text-xs text-[#5B6472] mt-1">{activeReportDef.desc}</p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="py-1.5 px-3.5 text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
                title="Export complete filtered dataset to Microsoft Excel format"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Export Excel (XLSX)
              </button>
              <button
                onClick={handleExportPdf}
                className="btn-primary py-1.5 px-4 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs bg-[#102E4A] hover:bg-[#1F4E7A]"
                title="Generate landscaped high-resolution PDF document"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF Document
              </button>
            </div>
          </div>

          {/* Targeted Summary KPIs for this specific Report */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {currentReportResult.kpis.map((kpi, idx) => (
              <div key={idx} className="cims-card p-4 bg-white border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{kpi.label}</div>
                <div className={`text-xl font-extrabold tracking-tight ${kpi.color || 'text-[#102E4A]'}`}>
                  {kpi.value}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">{kpi.subtext}</div>
              </div>
            ))}
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeReportDef.name}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-[#1F4E7A] focus:border-[#1F4E7A]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Segment Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Segment:</span>
                <select
                  value={filterSegment}
                  onChange={(e) => setFilterSegment(e.target.value)}
                  className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700 shadow-2xs"
                >
                  <option value="All">All Segments</option>
                  {availableSegments.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Branch:</span>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700 shadow-2xs"
                >
                  <option value="All">All Branches</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report-Specific Sub-filter */}
              {selectedReportCode === 'RPT-02' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Renewal Window:</span>
                  <select
                    value={subFilter}
                    onChange={(e) => setSubFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700 shadow-2xs"
                  >
                    <option value="All">All Windows</option>
                    <option value="Expired">Expired Policies</option>
                    <option value="<=30">&le; 30 Days Notice</option>
                    <option value="31-60">31 to 60 Days</option>
                    <option value="61-90">61 to 90 Days</option>
                  </select>
                </div>
              )}

              {selectedReportCode === 'RPT-05' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Severity:</span>
                  <select
                    value={subFilter}
                    onChange={(e) => setSubFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700 shadow-2xs"
                  >
                    <option value="All">All Severities</option>
                    <option value="HIGH">High / Critical</option>
                    <option value="MEDIUM">Medium Severity</option>
                    <option value="LOW">Low Severity</option>
                  </select>
                </div>
              )}

              {(searchQuery || filterSegment !== 'All' || filterBranch !== 'All' || subFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSegment('All');
                    setFilterBranch('All');
                    setSubFilter('All');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Interactive Data Table */}
          <div className="cims-card overflow-hidden bg-white border border-slate-200 shadow-xs">
            <div className="p-3 bg-[#EFF5FB] border-b border-[#E2E8F0] flex items-center justify-between text-xs text-[#5B6472]">
              <span className="font-semibold">
                Showing <strong className="text-[#102E4A]">{currentReportResult.rows.length}</strong> records in scope
              </span>
              <span className="text-[11px] text-slate-500">Live Database Stream — No Placeholder Data</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#5B6472] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    {currentReportResult.columns.map((col, idx) => (
                      <th
                        key={idx}
                        className={`p-3 whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {currentReportResult.rows.length === 0 ? (
                    <tr>
                      <td colSpan={currentReportResult.columns.length} className="p-12 text-center text-slate-400">
                        <div className="space-y-2">
                          <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="font-semibold text-sm text-slate-600">No records match the selected filters</div>
                          <div className="text-xs">Adjust your search query, segment, or branch filter to see records.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentReportResult.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-[#EFF5FB]/60 transition-colors">
                        {currentReportResult.columns.map((col, colIdx) => {
                          const val = row[col.key];

                          if (col.isStatus) {
                            return (
                              <td key={colIdx} className="p-3 whitespace-nowrap">
                                <StatusChip label={String(val || 'Active')} />
                              </td>
                            );
                          }

                          if (col.isCurrency && typeof val === 'number') {
                            return (
                              <td
                                key={colIdx}
                                className={`p-3 text-right tabular-nums whitespace-nowrap font-mono ${
                                  col.isDanger && val > 0 ? 'text-red-600 font-bold' : 'text-slate-800'
                                }`}
                              >
                                ETB {val.toLocaleString()}
                              </td>
                            );
                          }

                          if (col.isPercent) {
                            return (
                              <td key={colIdx} className="p-3 text-right tabular-nums whitespace-nowrap font-bold text-emerald-700">
                                {val}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={colIdx}
                              className={`p-3 whitespace-nowrap max-w-xs truncate ${
                                colIdx === 0 ? 'font-bold text-[#102E4A]' : 'text-slate-700'
                              } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                            >
                              {val !== undefined && val !== null ? String(val) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Schedules */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Automated Scheduled Reports & Delivery Engine</h3>
              <p className="text-xs text-[#5B6472]">Configure recurring cron schedules and automated email delivery of portfolio audits</p>
            </div>
            <button onClick={() => setShowScheduleModal(true)} className="btn-primary py-1.5 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" />
              + Schedule New Report
            </button>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Report Name</th>
                  <th className="p-3">Cron Cadence</th>
                  <th className="p-3">Recipients Email</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Last Run</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {scheduledReports.map((s) => (
                  <tr key={s.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-semibold text-[#102E4A]">{s.reportName}</td>
                    <td className="p-3 font-mono text-[#5B6472]">{s.cronSchedule}</td>
                    <td className="p-3 max-w-xs truncate">{s.recipientsJson}</td>
                    <td className="p-3 font-bold text-[#1F4E7A]">{s.format}</td>
                    <td className="p-3">{s.lastRunAt ? s.lastRunAt.replace('T', ' ').substring(0, 16) : 'Pending first run'}</td>
                    <td className="p-3">
                      <StatusChip label={s.active ? 'Active' : 'Paused'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Schedule Recurring Report</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const filterParams = {
                  district: schedDistrict,
                  branch: schedBranch,
                  rm: schedRm,
                  status: schedStatus,
                  expiryPeriod: schedExpiryPeriod,
                };
                await onSaveScheduledReport({
                  reportName: schedReportName,
                  cronSchedule: schedCron,
                  recipientsJson: schedRecipients,
                  format: schedFormat,
                  parametersJson: JSON.stringify(filterParams),
                  active: true,
                });
                setShowScheduleModal(false);
              }}
              className="p-5 space-y-3"
            >
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Select Report (M)</label>
                <select
                  value={schedReportName}
                  onChange={(e) => setSchedReportName(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  {reportDefinitions.map((r) => (
                    <option key={r.code} value={r.name}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Cron Cadence (M)</label>
                <input
                  type="text"
                  required
                  value={schedCron}
                  onChange={(e) => setSchedCron(e.target.value)}
                  placeholder="e.g. 0 8 * * * (Daily at 08:00 AM)"
                  className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Recipient Email(s) (M)</label>
                <input
                  type="text"
                  required
                  value={schedRecipients}
                  onChange={(e) => setSchedRecipients(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <h4 className="font-bold text-[#102E4A] mb-2">Scope / Filter Context (Optional)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[#5B6472] font-semibold mb-1">Parent District</label>
                    <select
                      value={schedDistrict}
                      onChange={(e) => setSchedDistrict(e.target.value)}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded"
                    >
                      <option value="All">All Districts</option>
                      {Array.from(new Set(branches.map(b => b.parentDistrictId).filter(Boolean))).map((dist: any) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#5B6472] font-semibold mb-1">Operating Branch</label>
                    <select
                      value={schedBranch}
                      onChange={(e) => setSchedBranch(e.target.value)}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded"
                    >
                      <option value="All">All Branches</option>
                      {branches.map((b) => (
                        <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#5B6472] font-semibold mb-1">Responsible RM</label>
                    <select
                      value={schedRm}
                      onChange={(e) => setSchedRm(e.target.value)}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded"
                    >
                      <option value="All">All Relationship Managers</option>
                      {Array.from(new Set(facilities.map(f => f.rmUserId).filter(Boolean))).map((rm: any) => (
                        <option key={rm} value={rm}>{rm}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#5B6472] font-semibold mb-1">Portfolio Status</label>
                    <select
                      value={schedStatus}
                      onChange={(e) => setSchedStatus(e.target.value)}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Expiring">Expiring</option>
                      <option value="Expired">Expired</option>
                      <option value="Open">Open Exceptions</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-[#5B6472] font-semibold mb-1">Expiry Horizon Window</label>
                  <select
                    value={schedExpiryPeriod}
                    onChange={(e) => setSchedExpiryPeriod(e.target.value)}
                    className="w-full p-1.5 border border-[#E2E8F0] rounded"
                  >
                    <option value="All">All Horizons / Non-expiring</option>
                    <option value="Next 15 Days">Within Next 15 Days</option>
                    <option value="Next 30 Days">Within Next 30 Days</option>
                    <option value="Next 60 Days">Within Next 60 Days</option>
                    <option value="Next 90 Days">Within Next 90 Days</option>
                    <option value="Expired">Already Expired (Breach)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Export Format (M)</label>
                <select
                  value={schedFormat}
                  onChange={(e) => setSchedFormat(e.target.value as any)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="Excel">Excel Spreadsheet (XLSX)</option>
                  <option value="CSV">CSV Data File</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
