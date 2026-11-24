import { formatEtbNumber } from '../../utils/format.ts';
import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  Eye,
  CheckCircle,
  ArrowUpRight,
  UserCheck,
  Paperclip,
  AlertCircle,
  AlertTriangle,
  Clock,
  Hourglass,
  ExternalLink,
  MessageSquare,
  History,
  FileText,
  Filter,
  RefreshCw,
  X,
  Calendar,
  Building,
  User as UserIcon,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import {
  CimsException,
  UserSession,
  OwnershipDocument,
  CimsExceptionInvestigationNote,
  CimsExceptionEscalationHistory,
  CimsExceptionAssignmentHistory,
  ExceptionSummaryDto,
  ScanResultDto,
  Collateral,
  LoanAccount,
  InsurancePolicy,
  Customer,
  MandatoryDocumentRule,
  ApprovedInsurer,
} from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';
import { canApproveAction, isReadOnlyUser } from '../../auth/session';

const TYPE_CORRECTIVE_ACTIONS: Record<string, string[]> = {
  'Expired Policy': [
    'Renew Policy with Approved Insurer',
    'Register Replacement Insurance Policy',
    'Substitute Insurance Policy',
    'Correct Policy Expiry / Tenor Information',
    'Authorized Exception / Management Override',
  ],
  'Underinsured Collateral': [
    'Increase Insured Coverage Amount',
    'Amend Existing Policy Sum Insured',
    'Register Additional Co-Insurance / Top-up Policy',
    'Replace with Adequate Policy',
    'Correct Collateral Valuation / Exposure Data',
    'Authorized Exception / Management Override',
  ],
  'Missing Insurance': [
    'Register & Attach New Valid Policy',
    'Complete & Submit Pending Policy Draft',
    'Replace Invalid Insurance Arrangement',
    'Correct Collateral Categorization / Exemption',
    'Authorized Exception / Management Override',
  ],
  'Missing Mandatory Document': [
    'Upload Missing Mandatory Document',
    'Associate Existing Document from Repository',
    'Replace Rejected Document',
    'Correct Document Taxonomy Association',
    'Authorized Exception / Management Override',
  ],
  'Unapproved Insurer': [
    'Replace Insurer with Approved Insurer',
    'Re-issue Policy with Bank-Approved Underwriter',
    'Correct Insurer Name / Typo',
    'Authorized Exception / Management Override',
  ],
  'Renewal Delay': [
    'Complete Overdue Renewal Process',
    'Upload Executed Renewal Policy & Receipt',
    'Register Replacement Underwriting',
    'Authorized Exception / Management Override',
  ],
  'Policy Inconsistency': [
    'Correct Policy Data',
    'Correct Facility-Collateral Relationship',
    'Amend Policy Insured Amount / Tenor',
    'Correct Collateral Data',
    'Authorized Exception / Management Override',
  ],
  'Duplicate Insurance Policy': [
    'Deactivate Duplicate Record',
    'Merge Duplicate Policy Records',
    'Correct Policy Number Reference',
    'Authorized Exception / Management Override',
  ],
  'Insurer Concentration Breach': [
    'Diversify Insurer Placement',
    'Reassign New Underwriting to Alternate Insurers',
    'Authorized Exception / Management Override',
  ],
  'Document Nearing Expiry': [
    'Upload Renewed / Extended Document',
    'Update Verified Expiry Date',
    'Authorized Exception / Management Override',
  ],
};

interface ExceptionManagerProps {
  exceptions: CimsException[];
  currentUser: UserSession;
  collaterals?: Collateral[];
  facilities?: LoanAccount[];
  policies?: InsurancePolicy[];
  customers?: Customer[];
  documents?: OwnershipDocument[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  insurers?: ApprovedInsurer[];
  users?: UserSession[];
  initialExceptionId?: string | null;
  onResolveException: (id: string, correctiveAction: string, resolutionNotes: string, evidenceDoc?: string) => Promise<void>;
  onEscalateException: (id: string, escalationRole: string, reason?: string) => Promise<void>;
  onScanNow: () => Promise<void>;
  onNavigate?: (page: string, params?: any) => void;
  onRefreshData?: () => Promise<void>;
}

export const ExceptionManager: React.FC<ExceptionManagerProps> = ({
  exceptions,
  currentUser,
  collaterals = [],
  facilities = [],
  policies = [],
  customers = [],
  documents = [],
  mandatoryDocRules = [],
  insurers = [],
  users = [],
  initialExceptionId,
  onResolveException,
  onEscalateException,
  onScanNow,
  onNavigate,
  onRefreshData,
}) => {
  const [selectedExc, setSelectedExc] = useState<CimsException | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  // Filters state
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSlaStatus, setFilterSlaStatus] = useState<string>('ALL');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Drawer action state
  const [correctiveAction, setCorrectiveAction] = useState('Renew Policy');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [evidenceDocument, setEvidenceDocument] = useState('');
  const [escalationRole, setEscalationRole] = useState('DISTDIR');
  const [escalationReason, setEscalationReason] = useState('');
  const [newInvestigationNote, setNewInvestigationNote] = useState('');
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Assignment state
  const [assignedUser, setAssignedUser] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');

  // History state for selected exception
  const [investigationNotes, setInvestigationNotes] = useState<CimsExceptionInvestigationNote[]>([]);
  const [escalationHistory, setEscalationHistory] = useState<CimsExceptionEscalationHistory[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<CimsExceptionAssignmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Loading & Feedback states
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [escalatingLoading, setEscalatingLoading] = useState(false);
  const [addingNoteLoading, setAddingNoteLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Scan Result Modal state
  const [scanResult, setScanResult] = useState<ScanResultDto | null>(null);
  const [showScanResultModal, setShowScanResultModal] = useState(false);

  // Summary Metrics
  const [summaryData, setSummaryData] = useState<ExceptionSummaryDto | null>(null);

  // Entity Lookups for Live Context
  const matchedCollateral = useMemo(() => {
    if (!selectedExc) return null;
    const targetId = selectedExc.collateralId || selectedExc.entityId;
    return collaterals.find((c) => c.id === targetId || c.code === targetId) || null;
  }, [selectedExc, collaterals]);

  const matchedPolicy = useMemo(() => {
    if (!selectedExc) return null;
    const targetId = selectedExc.policyId || selectedExc.entityId;
    return policies.find((p) => p.id === targetId || p.policyNumber === targetId) || null;
  }, [selectedExc, policies]);

  const matchedCustomer = useMemo(() => {
    if (!selectedExc) return null;
    const targetId = selectedExc.customerId || selectedExc.customerCif;
    return customers.find((c) => c.id === targetId || c.cif === targetId) || null;
  }, [selectedExc, customers]);

  const matchedFacility = useMemo(() => {
    if (!selectedExc) return null;
    const targetId = selectedExc.facilityId || selectedExc.loanReference;
    return facilities.find((f) => f.id === targetId || f.loanReference === targetId) || null;
  }, [selectedExc, facilities]);

  // Override authority comes from the backend permission matrix and Admin-configured approval authority.
  const canGrantOverride = useMemo(() => canApproveAction(currentUser), [currentUser]);

  // Load summary metrics from backend
  const refreshSummary = async () => {
    try {
      const s = await cimsApi.getExceptionSummary();
      setSummaryData(s);
    } catch {
      // Fallback: calculate locally
    }
  };

  useEffect(() => {
    refreshSummary();
  }, [exceptions]);

  // Initial exception selection
  useEffect(() => {
    if (initialExceptionId && exceptions.length > 0) {
      const found = exceptions.find((e) => e.id === initialExceptionId);
      if (found) {
        openExceptionDetail(found);
      }
    }
  }, [initialExceptionId, exceptions]);

  // Fetch full history when an exception is selected
  const loadExceptionHistory = async (excId: string) => {
    setHistoryLoading(true);
    try {
      const hist = await cimsApi.getExceptionHistory(excId);
      setInvestigationNotes(hist.investigationNotes || []);
      setEscalationHistory(hist.escalationHistory || []);
      setAssignmentHistory(hist.assignmentHistory || []);
    } catch (e: any) {
      console.warn('Failed to load exception history:', e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openExceptionDetail = (exc: CimsException) => {
    setSelectedExc(exc);
    const defaultAction = TYPE_CORRECTIVE_ACTIONS[exc.exceptionType]?.[0] || 'Renew Policy';
    setCorrectiveAction(exc.correctiveAction || defaultAction);
    setResolutionNotes(exc.resolutionNotes || '');
    setEvidenceDocument(exc.evidenceDocument || '');
    setIsOverride(false);
    setOverrideReason('');
    setAssignedUser(exc.assignedToUserId || exc.assignedToUser || '');
    setAssignedRole(exc.assignedToRole || '');
    setAssignmentReason('');
    setEscalationReason('');
    setNewInvestigationNote('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowDetailDrawer(true);
    loadExceptionHistory(exc.id);
  };



  // Filtered exception data for work queue
  const filteredExceptions = useMemo(() => {
    return exceptions.filter((e) => {
      if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
      if (filterSeverity !== 'ALL' && e.severity !== filterSeverity) return false;
      if (filterType !== 'ALL' && e.exceptionType !== filterType) return false;
      if (filterSlaStatus !== 'ALL' && e.slaStatus !== filterSlaStatus) return false;
      if (filterRole !== 'ALL' && e.assignedToRole !== filterRole) return false;
      return true;
    });
  }, [exceptions, filterStatus, filterSeverity, filterType, filterSlaStatus, filterRole]);

  // Handlers
  const handleScan = async () => {
    setScanning(true);
    setErrorMessage(null);
    try {
      const res = await cimsApi.triggerPortfolioScan();
      setScanResult(res);
      setShowScanResultModal(true);
      await refreshSummary();
      if (onRefreshData) await onRefreshData();
      else await onScanNow();
    } catch (e: any) {
      setErrorMessage(`Scan failed: ${e?.message || e}`);
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedExc) return;
    if (!resolutionNotes.trim()) {
      setErrorMessage('Investigation and resolution notes are mandatory before an exception can be resolved.');
      return;
    }
    if (!correctiveAction.trim()) {
      setErrorMessage('Corrective action selection is mandatory.');
      return;
    }
    if (isOverride && !overrideReason.trim()) {
      setErrorMessage('Sanction memo reference is mandatory when recording an Authorized Management Override.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      await cimsApi.resolveException(
        selectedExc.id,
        correctiveAction.trim(),
        resolutionNotes.trim(),
        evidenceDocument.trim() || undefined,
        currentUser.userId || currentUser.username,
        isOverride,
        overrideReason.trim()
      );
      setSuccessMessage(`Exception ${selectedExc.id} resolved successfully.`);
      if (onRefreshData) await onRefreshData();
      await refreshSummary();
      await loadExceptionHistory(selectedExc.id);
      setSelectedExc({
        ...selectedExc,
        status: 'Resolved',
        correctiveAction,
        resolutionNotes: isOverride ? `[AUTHORIZED OVERRIDE: ${overrideReason.trim()}] ${resolutionNotes}` : resolutionNotes,
        evidenceDocument: evidenceDocument || undefined,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser.name || currentUser.username,
      });
    } catch (e: any) {
      setErrorMessage(`Resolution failed: ${e?.message || e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedExc) return;
    setEscalatingLoading(true);
    setErrorMessage(null);
    try {
      await cimsApi.escalateException(
        selectedExc.id,
        escalationRole,
        escalationReason.trim() || `Operational escalation to ${escalationRole}`,
        undefined,
        currentUser.userId || currentUser.username
      );
      setSuccessMessage(`Exception ${selectedExc.id} escalated to ${escalationRole}.`);
      setEscalationReason('');
      if (onRefreshData) await onRefreshData();
      await refreshSummary();
      await loadExceptionHistory(selectedExc.id);
      setSelectedExc({
        ...selectedExc,
        status: 'Escalated',
        assignedToRole: escalationRole,
        escalationLevel: (selectedExc.escalationLevel || 0) + 1,
      });
    } catch (e: any) {
      setErrorMessage(`Escalation failed: ${e?.message || e}`);
    } finally {
      setEscalatingLoading(false);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedExc) return;
    if (!assignedUser && !assignedRole) {
      setErrorMessage('Please select a responsible user or role.');
      return;
    }
    setAssigningLoading(true);
    setErrorMessage(null);
    try {
      await cimsApi.assignException(
        selectedExc.id,
        {
          assignedUserId: assignedUser || undefined,
          assignedRole: assignedRole || selectedExc.assignedToRole,
          reason: assignmentReason.trim() || `Reassigned by ${currentUser.name || currentUser.username}`,
        },
        currentUser.userId || currentUser.username
      );
      setSuccessMessage(`Exception assigned to ${assignedUser || assignedRole} successfully.`);
      setAssignmentReason('');
      if (onRefreshData) await onRefreshData();
      await refreshSummary();
      await loadExceptionHistory(selectedExc.id);
      setSelectedExc({
        ...selectedExc,
        assignedToUser: assignedUser,
        assignedToUserId: assignedUser,
        assignedToRole: assignedRole || selectedExc.assignedToRole,
        status: selectedExc.status === 'Open' ? 'In Progress' : selectedExc.status,
      });
    } catch (e: any) {
      setErrorMessage(`Assignment failed: ${e?.message || e}`);
    } finally {
      setAssigningLoading(false);
    }
  };

  const handleAddInvestigationNote = async () => {
    if (!selectedExc || !newInvestigationNote.trim()) return;
    setAddingNoteLoading(true);
    setErrorMessage(null);
    try {
      await cimsApi.addExceptionInvestigationNote(
        selectedExc.id,
        newInvestigationNote.trim(),
        currentUser.userId || currentUser.username
      );
      setNewInvestigationNote('');
      setSuccessMessage('Investigation note added successfully.');
      await loadExceptionHistory(selectedExc.id);
      if (selectedExc.status === 'Open') {
        setSelectedExc({ ...selectedExc, status: 'In Progress' });
      }
    } catch (e: any) {
      setErrorMessage(`Failed to add note: ${e?.message || e}`);
    } finally {
      setAddingNoteLoading(false);
    }
  };



  // Read-only status is authoritative from the backend user scope.
  const isReadOnly = isReadOnlyUser(currentUser);

  // Table Columns
  const exceptionColumns: ColumnDef<CimsException>[] = [
    {
      header: 'Severity',
      accessorKey: 'severity',
      cell: (r) => <StatusChip label={r.severity} />,
      sortable: true,
    },
    {
      header: 'SLA State',
      accessorKey: 'slaStatus',
      cell: (r) => {
        const sla = r.slaStatus || 'Unconfigured';
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
        if (sla === 'Overdue') {
          badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
        } else if (sla === 'Due Soon') {
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
        } else if (sla === 'Within SLA') {
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] border ${badgeColor}`}>
              {sla === 'Overdue' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
              {sla === 'Due Soon' && <Clock className="w-3 h-3 text-amber-600" />}
              {sla}
              {r.daysOverdue && r.daysOverdue > 0 ? ` (${r.daysOverdue}d)` : ''}
            </span>
            {r.slaDueDate && (
              <span className="text-[10px] text-[#5B6472]">Due: {r.slaDueDate.substring(0, 10)}</span>
            )}
          </div>
        );
      },
      sortable: true,
    },
    {
      header: 'Exception Type',
      accessorKey: 'exceptionType',
      cell: (r) => <span className="font-semibold text-xs text-[#00205B]">{r.exceptionType}</span>,
      sortable: true,
    },
    {
      header: 'Context / Entity',
      accessorKey: 'entityId',
      cell: (r) => (
        <div className="text-xs">
          <div className="font-mono font-medium text-[#00205B]">{r.entityId}</div>
          <div className="text-[10.5px] text-[#5B6472]">{r.entityType}</div>
          {r.customerCif && (
            <div className="text-[10px] text-slate-500">CIF: {r.customerCif}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Branch / Segment',
      accessorKey: 'branch',
      cell: (r) => (
        <div className="text-xs">
          <div className="text-[#101828] font-medium">{r.branch || 'Head Office'}</div>
          <div className="text-[10.5px] text-[#5B6472]">{r.businessSegment || r.district || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: (r) => (
        <span className="text-xs text-[#101828] line-clamp-2 max-w-xs" title={r.description}>
          {r.description}
        </span>
      ),
    },
    {
      header: 'Assigned Owner',
      accessorKey: 'assignedToRole',
      cell: (r) => (
        <div className="text-xs">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-[#EAF2F9] text-[#00205B]">
            {r.assignedToRole || 'RO'}
          </span>
          <div className="text-[10.5px] text-[#101828] font-medium mt-0.5">
            {r.assignedToUser || r.assignedToUserId || <span className="text-amber-600 italic">Unassigned</span>}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Detected Date',
      accessorKey: 'detectedAt',
      cell: (r) => <span className="text-xs text-[#5B6472]">{r.detectedAt?.substring(0, 10)}</span>,
      sortable: true,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => <StatusChip label={r.status} />,
      sortable: true,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openExceptionDetail(r);
          }}
          className="btn-ghost py-1 px-2.5 text-xs text-[#00205B] hover:bg-[#EAF2F9] font-semibold flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Investigate
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 1. OPERATIONAL WORK QUEUE FILTER BAR (Requirement §26) */}
      <div className="cims-card p-4 bg-white border-[#E2E8F0] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00205B]" />
            <span className="font-bold text-xs text-[#00205B] uppercase tracking-wider">Work Queue Filters</span>
            {(filterStatus !== 'ALL' || filterSeverity !== 'ALL' || filterType !== 'ALL' || filterSlaStatus !== 'ALL' || filterRole !== 'ALL') && (
              <button
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterSeverity('ALL');
                  setFilterType('ALL');
                  setFilterSlaStatus('ALL');
                  setFilterRole('ALL');
                }}
                className="text-[11px] text-[#00205B] hover:underline font-semibold ml-2"
              >
                Reset All Filters
              </button>
            )}
          </div>
          <div className="text-xs text-[#5B6472]">
            Showing <strong>{filteredExceptions.length}</strong> of <strong>{exceptions.length}</strong> exceptions in authorized portfolio scope
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#101828] mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Pending Exception Approval">Pending Exception Approval</option>
              <option value="In Progress">In Progress</option>
              <option value="Escalated">Escalated</option>
              <option value="Returned">Returned</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#101828] mb-1">Severity</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#101828] mb-1">Exception Category (BRD)</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
            >
              <option value="ALL">All Exception Categories</option>
              <option value="Expired Policy">Expired Policy</option>
              <option value="Underinsured Collateral">Underinsured Collateral</option>
              <option value="Missing Insurance">Missing Insurance (Uninsured Collateral)</option>
              <option value="Missing Mandatory Document">Missing Mandatory Document</option>
              <option value="Document Nearing Expiry">Document Nearing Expiry</option>
              <option value="Duplicate Insurance Policy">Duplicate Insurance Policy</option>
              <option value="Insurer Concentration Breach">Insurer Concentration Breach</option>
              <option value="Unapproved Insurer">Unapproved Insurer</option>
              <option value="Renewal Delay">Renewal Delay (Overdue Renewal)</option>
              <option value="Policy Inconsistency">Policy Inconsistency</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#101828] mb-1">SLA Status</label>
            <select
              value={filterSlaStatus}
              onChange={(e) => setFilterSlaStatus(e.target.value)}
              className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
            >
              <option value="ALL">All SLA States</option>
              <option value="Overdue">Overdue (Breached)</option>
              <option value="Due Soon">Due Soon (&lt; 48 Hours)</option>
              <option value="Within SLA">Within SLA</option>
              <option value="Unconfigured">Unconfigured</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#101828] mb-1">Assigned Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
            >
              <option value="ALL">All Roles</option>
              <option value="RO">RO (Relationship Officer)</option>
              <option value="CRO">CRO (Credit Relationship Officer)</option>
              <option value="BRO">BRO (Branch Relationship Officer)</option>
              <option value="SRM">SRM (Senior Relationship Manager)</option>
              <option value="BRMGR">BRMGR (Branch Manager)</option>
              <option value="COLLDOCOFF">COLLDOCOFF (Collateral Document Officer)</option>
              <option value="MGRCOLLDOC">MGRCOLLDOC (Manager Collateral Docs)</option>
              <option value="COMPLIANCE">COMPLIANCE (Compliance Dept)</option>
              <option value="RISK">RISK (Risk Management)</option>
              <option value="DISTDIR">DISTDIR (District Business Manager)</option>
              <option value="HODEPT">HODEPT (Head Office Dept)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. EXCEPTION WORK QUEUE DATA GRID */}
      <DataGrid
        title="Exception Management Work Queue"
        subtitle="Operational triage, investigation, controlled reassignment, SLA monitoring, and resolution"
        data={filteredExceptions}
        columns={exceptionColumns}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => openExceptionDetail(e)}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refreshSummary}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
              title="Refresh Queue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 font-bold"
            >
              <RotateCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning Portfolio...' : 'Trigger Automated Scan Now'}
            </button>
          </div>
        }
      />

      {/* 4. MEANINGFUL SCAN RESULT MODAL (Requirement §40) */}
      {showScanResultModal && scanResult && (
        <div className="fixed inset-0 bg-[#00205B]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden border border-[#B9D5F0]">
            <div className="p-4 bg-[#00205B] text-white flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Portfolio Exception Scan Complete
              </div>
              <button
                onClick={() => setShowScanResultModal(false)}
                className="text-white hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 bg-blue-50 border border-blue-100 rounded">
                  <div className="text-[10px] text-[#5B6472] uppercase font-bold">Policies Scanned</div>
                  <div className="text-xl font-bold text-[#00205B]">{scanResult.policiesEvaluated}</div>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-100 rounded">
                  <div className="text-[10px] text-[#5B6472] uppercase font-bold">Collaterals Scanned</div>
                  <div className="text-xl font-bold text-[#00205B]">{scanResult.collateralsEvaluated}</div>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-100 rounded">
                  <div className="text-[10px] text-[#5B6472] uppercase font-bold">Documents Scanned</div>
                  <div className="text-xl font-bold text-[#00205B]">{scanResult.documentsEvaluated}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5B6472]">New Exceptions Detected & Created:</span>
                  <strong className="text-rose-700 font-bold">{scanResult.exceptionsCreated}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B6472]">Existing Active Exceptions Evaluated:</span>
                  <strong className="text-amber-700 font-bold">{scanResult.exceptionsUpdated}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B6472]">Exceptions Automatically Resolved (Corrected):</span>
                  <strong className="text-emerald-700 font-bold">{scanResult.exceptionsAutoResolved}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B6472]">Scan Started At:</span>
                  <span className="text-slate-600 font-mono text-[11px]">{scanResult.scanStartedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B6472]">Scan Completed At:</span>
                  <span className="text-slate-600 font-mono text-[11px]">{scanResult.scanCompletedAt || 'Now'}</span>
                </div>
              </div>

              {scanResult.errorMessages && scanResult.errorMessages.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-1">
                  <div className="font-bold">Errors Encountered ({scanResult.errorsEncountered}):</div>
                  <ul className="list-disc pl-4 text-[11px]">
                    {scanResult.errorMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowScanResultModal(false)}
                  className="btn-primary py-1.5 px-4 text-xs font-bold"
                >
                  Close & View Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 9-SECTION EXCEPTION INVESTIGATION DRAWER (Requirement §46) */}
      {showDetailDrawer && selectedExc && (
        <div className="fixed inset-0 bg-[#00205B]/60 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-4 bg-[#00205B] text-white flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight">{selectedExc.exceptionType}</h2>
                  <StatusChip label={selectedExc.severity} />
                  <StatusChip label={selectedExc.status} />
                </div>
                <div className="text-xs text-blue-200 flex flex-wrap gap-x-3 gap-y-1">
                  <span>ID: <strong className="font-mono text-white">{selectedExc.id}</strong></span>
                  <span>Detected: {selectedExc.detectedAt?.substring(0, 16) || 'N/A'}</span>
                  <span>Escalation Level: <strong>Level {selectedExc.escalationLevel || 0}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailDrawer(false)}
                className="text-white hover:text-gray-300 p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification messages */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex justify-between items-center">
                <span>{errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-700">✕</button>
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex justify-between items-center">
                <span>{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-700">✕</button>
              </div>
            )}

            {/* Drawer Body - 9 Distinct Operational Sections */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">

              {/* SECTION 1: EXCEPTION SUMMARY */}
              <div className="cims-card p-4 bg-[#EFF5FB] border-[#DCE9F5] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span>Section 1: Exception Summary</span>
                  <span className="font-mono text-[10px] text-[#5B6472]">Source: {selectedExc.detectionSource || 'AUTOMATED_SCANNER'}</span>
                </div>
                <div className="text-[#101828] text-xs leading-relaxed font-medium">
                  {selectedExc.description}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#DCE9F5] text-[11px]">
                  <div>
                    <span className="text-[#5B6472] block">Entity Type</span>
                    <strong className="text-[#00205B]">{selectedExc.entityType}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Severity Level</span>
                    <strong className="text-[#00205B]">{selectedExc.severity}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Days Open</span>
                    <strong className="text-[#00205B]">{selectedExc.daysOpen || 0} days</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Current Status</span>
                    <strong className="text-[#00205B]">{selectedExc.status}</strong>
                  </div>
                </div>
              </div>

              {/* SECTION 1B: WHY THIS EXCEPTION EXISTS (DIAGNOSTIC ANALYSIS - Requirement §18 & §46) */}
              <div className="cims-card p-4 border-[#B9D5F0] bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-[#00205B]" />
                    Section 1B: Why This Exception Exists (Live System Diagnosis)
                  </span>
                  <span className="text-[10px] text-[#5B6472] font-semibold">Rule: {selectedExc.exceptionType}</span>
                </div>

                {/* Type-Specific Diagnostic Content */}
                {selectedExc.exceptionType === 'Underinsured Collateral' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium">
                      Collateral <strong className="text-[#00205B]">{matchedCollateral?.code || selectedExc.collateralId}</strong> requires insurance coverage of{' '}
                      <strong>ETB {formatEtbNumber((matchedCollateral?.valuationAmount || 0))}</strong> based on central adequacy policy. Currently recognized active insurance coverage is{' '}
                      <strong>ETB {formatEtbNumber((matchedCollateral?.insuredAmount || 0))}</strong> (<strong>{(matchedCollateral?.netInsuranceCoveragePct || 0).toFixed(1)}%</strong> of valuation), resulting in an active insurance shortfall of{' '}
                      <strong className="text-red-700 font-bold">ETB {formatEtbNumber(Math.max(0, (matchedCollateral?.valuationAmount || 0) - (matchedCollateral?.insuredAmount || 0)))}</strong>.
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px]">
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Valuation Amount</span>
                        <strong className="text-[#00205B]">ETB {formatEtbNumber((matchedCollateral?.valuationAmount || 0))}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Haircut / NSV</span>
                        <strong className="text-[#00205B]">{matchedCollateral?.haircut || 0}% / ETB {formatEtbNumber((matchedCollateral?.nsv || 0))}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Sum Insured</span>
                        <strong className="text-emerald-800">ETB {formatEtbNumber((matchedCollateral?.insuredAmount || 0))}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Coverage Deficit Gap</span>
                        <strong className="text-red-700 font-bold">ETB {formatEtbNumber(Math.max(0, (matchedCollateral?.valuationAmount || 0) - (matchedCollateral?.insuredAmount || 0)))}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Expired Policy' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded text-rose-900 leading-relaxed font-medium">
                      Insurance Policy <strong className="text-[#00205B]">{matchedPolicy?.policyNumber || selectedExc.policyId}</strong> expired on{' '}
                      <strong>{matchedPolicy?.expiryDate?.substring(0, 10) || 'N/A'}</strong> and is currently{' '}
                      <strong className="text-rose-700 font-bold">{selectedExc.daysOverdue || 0} days overdue</strong>. No valid active renewal endorsement or replacement policy has been registered.
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px]">
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Insurer</span>
                        <strong className="text-[#00205B]">{matchedPolicy?.insurerName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Coverage Type</span>
                        <strong className="text-[#00205B]">{matchedPolicy?.coverageType || 'Comprehensive'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Insured Amount</span>
                        <strong className="text-[#00205B]">ETB {formatEtbNumber((matchedPolicy?.insuredAmount || 0))}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Expiry Date</span>
                        <strong className="text-rose-700 font-bold">{matchedPolicy?.expiryDate?.substring(0, 10) || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Missing Insurance' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-red-50/80 border border-red-200 rounded text-red-900 leading-relaxed font-medium">
                      Collateral <strong className="text-[#00205B]">{matchedCollateral?.code || selectedExc.collateralId}</strong> ({matchedCollateral?.category}) has a mandatory insurance requirement under central credit policy, but has no valid active insurance policy registered.
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px]">
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Mandatory Rule</span>
                        <strong className="text-[#00205B]">Tangible Security Policy</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Collateral Category</span>
                        <strong className="text-[#00205B]">{matchedCollateral?.category || 'Tangible Asset'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">Active Policy Status</span>
                        <strong className="text-red-700 font-bold">0 Policies (Uninsured)</strong>
                      </div>
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Missing Mandatory Document' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium">
                      Collateral <strong className="text-[#00205B]">{matchedCollateral?.code || selectedExc.collateralId}</strong> requires mandatory verified ownership/legal documentation per credit policy.
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1 text-[11px]">
                      <div className="font-bold text-[#00205B]">Attached Repository Documents for this Collateral:</div>
                      {documents.filter(d => d.collateralId === selectedExc.collateralId || d.entityId === selectedExc.collateralId).length === 0 ? (
                        <div className="text-slate-500 italic text-[10px]">No documents attached to this collateral record in DMS.</div>
                      ) : (
                        <div className="space-y-1">
                          {documents.filter(d => d.collateralId === selectedExc.collateralId || d.entityId === selectedExc.collateralId).map(doc => (
                            <div key={doc.id} className="flex justify-between items-center text-[10px] p-1 bg-white border border-slate-200 rounded">
                              <span className="font-semibold">{doc.name} ({doc.type})</span>
                              <span className="text-[#5B6472] font-mono">Status: {doc.verificationStatus || doc.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Unapproved Insurer' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium">
                      Policy <strong className="text-[#00205B]">{matchedPolicy?.policyNumber || selectedExc.policyId}</strong> was placed with underwriter{' '}
                      <strong className="text-rose-700 font-bold">{matchedPolicy?.insurerName || 'Unapproved Carrier'}</strong>, which is not an active approved insurer in the bank master register. Replacement or formal sanction waiver is required.
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Renewal Delay' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded text-purple-900 leading-relaxed font-medium">
                      Renewal Delay Breach: Policy <strong className="text-[#00205B]">{matchedPolicy?.policyNumber || selectedExc.policyId}</strong> expired on{' '}
                      <strong>{matchedPolicy?.expiryDate?.substring(0, 10)}</strong> and is now{' '}
                      <strong className="text-purple-950 font-bold">{selectedExc.daysOverdue || 0} days past expiry</strong>, exceeding the bank renewal grace window without a registered renewal or replacement policy.
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Policy Inconsistency' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded text-blue-900 leading-relaxed font-medium">
                      Data Inconsistency Detected: {selectedExc.description}
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1">
                      <div className="font-bold text-[#00205B]">Inconsistency Diagnosis Breakdown:</div>
                      <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold text-[#5B6472] border-b pb-1">
                        <div>Field</div>
                        <div>Current Value</div>
                        <div>Expected Benchmark</div>
                        <div>Validation Status</div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px] pt-1">
                        <div className="font-mono">Policy Data</div>
                        <div className="text-rose-700 font-bold">{matchedPolicy?.policyNumber || selectedExc.policyId}</div>
                        <div>Aligned with Taxonomy</div>
                        <div className="text-rose-700 font-bold">Inconsistent</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Duplicate Insurance Policy' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium">
                      Duplicate Policy Alert: Active policy number <strong className="text-[#00205B] font-mono">{selectedExc.entityId}</strong> is registered multiple times across collateral assets in the policy register.
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Insurer Concentration Breach' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-900 leading-relaxed font-medium">
                      Insurer Concentration Breach: Insurer <strong className="text-[#00205B]">{selectedExc.entityId}</strong> exceeds the regulatory single-insurer exposure limit cap across the bank portfolio.
                    </div>
                  </div>
                )}

                {selectedExc.exceptionType === 'Document Nearing Expiry' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium">
                      {selectedExc.description}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: AFFECTED BUSINESS CONTEXT & NAVIGATION (Requirement §25 & §41) */}
              <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                <div className="text-[11px] font-bold uppercase text-[#00205B] tracking-wider flex items-center justify-between">
                  <span>Section 2: Affected Business Context</span>
                  <span className="text-[10px] text-[#5B6472] font-normal">Click links to navigate to authoritative CIMS records</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {selectedExc.customerCif && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-[#5B6472]">Customer CIF</div>
                        <div className="font-mono font-bold text-[#00205B]">{selectedExc.customerCif}</div>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('customers', { customerId: selectedExc.customerId, cif: selectedExc.customerCif })}
                          className="btn-ghost p-1 text-[#00205B] hover:bg-white text-[11px] flex items-center gap-1"
                          title="Open Customer 360"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {selectedExc.collateralId && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-[#5B6472]">Collateral ID</div>
                        <div className="font-mono font-bold text-[#00205B]">{selectedExc.collateralId}</div>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('collateral', { collateralId: selectedExc.collateralId })}
                          className="btn-ghost p-1 text-[#00205B] hover:bg-white text-[11px] flex items-center gap-1"
                          title="Open Collateral Record"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {selectedExc.policyId && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-[#5B6472]">Insurance Policy</div>
                        <div className="font-mono font-bold text-[#00205B]">{selectedExc.policyId}</div>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('insurance', { policyId: selectedExc.policyId })}
                          className="btn-ghost p-1 text-[#00205B] hover:bg-white text-[11px] flex items-center gap-1"
                          title="Open Policy Record"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {selectedExc.loanReference && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-[#5B6472]">Facility / Loan Ref</div>
                        <div className="font-mono font-bold text-[#00205B]">{selectedExc.loanReference}</div>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('facilities', { facilityId: selectedExc.facilityId, loanReference: selectedExc.loanReference })}
                          className="btn-ghost p-1 text-[#00205B] hover:bg-white text-[11px] flex items-center gap-1"
                          title="Open Facility Record"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 text-[#5B6472]">
                  <div>Branch: <strong className="text-[#00205B]">{selectedExc.branch || 'Head Office'}</strong></div>
                  <div>District: <strong className="text-[#00205B]">{selectedExc.district || 'Central District'}</strong></div>
                  <div>Segment: <strong className="text-[#00205B]">{selectedExc.businessSegment || 'Corporate Banking'}</strong></div>
                </div>
              </div>

              {/* SECTION 3: OWNERSHIP & CONTROLLED REASSIGNMENT (Requirements §8, §9, §12) */}
              <div className="cims-card p-4 border-[#B9D5F0] bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#00205B]" />
                    Section 3: Ownership & Controlled Assignment
                  </span>
                  <span className="font-mono text-[10px] text-[#5B6472]">
                    Assigned: {selectedExc.assignedAt?.substring(0, 16) || 'At Detection'} by {selectedExc.assignedBy || 'SYSTEM'}
                  </span>
                </div>

                <div className="p-2.5 bg-white border border-[#DCE9F5] rounded grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#5B6472] block text-[10px]">Current Assigned Role</span>
                    <strong className="text-[#00205B]">{selectedExc.assignedToRole || 'RO'}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block text-[10px]">Current Assigned User</span>
                    <strong className="text-[#101828]">
                      {selectedExc.assignedToUser || selectedExc.assignedToUserId || <span className="text-amber-600 italic">Unassigned (Role Pool)</span>}
                    </strong>
                  </div>
                </div>

                {selectedExc.status !== 'Resolved' && !isReadOnly && (
                  <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                    <div className="text-[11px] font-bold text-[#101828]">Reassign Responsible Owner</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#5B6472] mb-0.5">Select User</label>
                        <select
                          value={assignedUser}
                          onChange={(e) => setAssignedUser(e.target.value)}
                          className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                        >
                          <option value="">-- Choose User --</option>
                          {users.map((u) => (
                            <option key={u.userId || u.username} value={u.username}>
                              {u.name} ({u.username} - {u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#5B6472] mb-0.5">Select Role</label>
                        <select
                          value={assignedRole}
                          onChange={(e) => setAssignedRole(e.target.value)}
                          className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                        >
                          <option value="">-- Keep Role ({selectedExc.assignedToRole}) --</option>
                          <option value="RO">RO (Relationship Officer)</option>
                          <option value="CRO">CRO (Credit Relationship Officer)</option>
                          <option value="BRO">BRO (Branch Relationship Officer)</option>
                          <option value="SRM">SRM (Senior Relationship Manager)</option>
                          <option value="BRMGR">BRMGR (Branch Manager)</option>
                          <option value="COLLDOCOFF">COLLDOCOFF (Collateral Document Officer)</option>
                          <option value="MGRCOLLDOC">MGRCOLLDOC (Manager Collateral Docs)</option>
                          <option value="COMPLIANCE">COMPLIANCE (Compliance Officer)</option>
                          <option value="RISK">RISK (Risk Management Officer)</option>
                          <option value="DISTDIR">DISTDIR (District Business Manager)</option>
                          <option value="HODEPT">HODEPT (Head Office Dept)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Mandatory reassignment justification / reason..."
                        value={assignmentReason}
                        onChange={(e) => setAssignmentReason(e.target.value)}
                        className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={assigningLoading || (!assignedUser && !assignedRole)}
                        onClick={handleAssignUser}
                        className="btn-secondary py-1 px-3 text-xs flex items-center gap-1 font-bold text-[#00205B]"
                      >
                        {assigningLoading ? 'Reassigning...' : 'Save Reassignment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: SLA MONITORING & HIERARCHICAL ESCALATION (Requirements §15, §16, §17) */}
              <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Hourglass className="w-4 h-4 text-[#00205B]" />
                    Section 4: SLA & Escalation Hierarchy
                  </span>
                  <span className="font-bold text-[11px]">
                    Status: <span className={selectedExc.slaStatus === 'Overdue' ? 'text-rose-600 font-bold' : 'text-[#00205B]'}>{selectedExc.slaStatus || 'Within SLA'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div>
                    <span className="text-[#5B6472] text-[10px] block">SLA Target Due Date</span>
                    <strong className="font-mono text-[#00205B]">{selectedExc.slaDueDate?.substring(0, 10) || 'Unconfigured'}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] text-[10px] block">Days Overdue</span>
                    <strong className={selectedExc.daysOverdue && selectedExc.daysOverdue > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                      {selectedExc.daysOverdue ? `${selectedExc.daysOverdue} days` : '0 days (On Track)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] text-[10px] block">Escalation Level</span>
                    <strong className="text-purple-800 font-bold">Level {selectedExc.escalationLevel || 0}</strong>
                  </div>
                  <div>
                    <span className="text-[#5B6472] text-[10px] block">Next Escalation Due</span>
                    <span className="text-slate-700 font-mono text-[11px]">{selectedExc.nextEscalationDue?.substring(0, 10) || 'None Scheduled'}</span>
                  </div>
                </div>

                {selectedExc.status !== 'Resolved' && !isReadOnly && (
                  <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                    <div className="text-[11px] font-bold text-[#101828]">Escalate to Management Hierarchy</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#5B6472] mb-0.5">Target Escalation Role</label>
                        <select
                          value={escalationRole}
                          onChange={(e) => setEscalationRole(e.target.value)}
                          className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                        >
                          <option value="BRMGR">Branch Manager (BRMGR)</option>
                          <option value="DISTDIR">District Director / Business Manager (DISTDIR)</option>
                          <option value="HODEPT">Head Office Department (HODEPT)</option>
                          <option value="COMPLIANCE">Compliance Department (COMPLIANCE)</option>
                          <option value="RISK">Risk Management (RISK)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#5B6472] mb-0.5">Escalation Justification</label>
                        <input
                          type="text"
                          placeholder="Reason for escalation..."
                          value={escalationReason}
                          onChange={(e) => setEscalationReason(e.target.value)}
                          className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleEscalate}
                        disabled={escalatingLoading}
                        className="btn-secondary py-1 px-3 text-xs flex items-center gap-1 font-bold text-purple-900 border-purple-200 hover:bg-purple-50"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {escalatingLoading ? 'Escalating...' : 'Escalate to Hierarchy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: INVESTIGATION HISTORY (Requirements §7 & §20 - MULTI-RECORD) */}
              <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#00205B]" />
                    Section 5: Investigation History ({investigationNotes.length} Notes)
                  </span>
                  {historyLoading && <span className="text-[10px] text-[#5B6472]">Refreshing notes...</span>}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {investigationNotes.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded text-[#5B6472] text-[11px] italic text-center">
                      No investigation notes recorded yet. Add initial investigation observations below.
                    </div>
                  ) : (
                    investigationNotes.map((note) => (
                      <div key={note.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-[#00205B]">{note.authorName} ({note.authorId})</span>
                          <span className="text-[#5B6472] font-mono text-[10px]">{note.createdAt?.substring(0, 16)}</span>
                        </div>
                        <div className="text-[#101828] text-xs leading-relaxed">{note.noteText}</div>
                      </div>
                    ))
                  )}
                </div>

                {selectedExc.status !== 'Resolved' && !isReadOnly && (
                  <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                    <label className="block text-[11px] font-bold text-[#101828]">
                      Append Investigation Note
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Add investigation updates, inspection findings, borrower contact logs..."
                      value={newInvestigationNote}
                      onChange={(e) => setNewInvestigationNote(e.target.value)}
                      className="w-full p-2 border border-[#E2E8F0] rounded text-xs focus:ring-1 focus:ring-[#D48806] focus:border-[#D48806]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={addingNoteLoading || !newInvestigationNote.trim()}
                        onClick={handleAddInvestigationNote}
                        className="btn-secondary py-1 px-3 text-xs font-semibold text-[#00205B]"
                      >
                        {addingNoteLoading ? 'Saving...' : 'Add Note to History'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 6: CORRECTIVE ACTION SELECTION (Requirement §20 & §21 & §30) */}
              {selectedExc.status !== 'Resolved' && !isReadOnly ? (
                <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                  <div className="text-[11px] font-bold uppercase text-[#00205B] tracking-wider flex items-center justify-between">
                    <span>Section 6: Type-Specific Corrective Action Selection <span className="text-red-600">*</span></span>
                    <span className="text-[10px] text-[#5B6472] font-normal">Filtered by exception category</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#101828] mb-1">
                      Business Corrective Measure Taken
                    </label>
                    <select
                      value={correctiveAction}
                      onChange={(e) => {
                        const act = e.target.value;
                        setCorrectiveAction(act);
                        if (act.includes('Override') || act.includes('Waiver')) {
                          setIsOverride(true);
                        }
                      }}
                      className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white font-medium"
                    >
                      {(TYPE_CORRECTIVE_ACTIONS[selectedExc.exceptionType] || [
                        'Renew Policy with Approved Insurer',
                        'Increase Insured Coverage Amount',
                        'Upload Missing Mandatory Document',
                        'Switch to Approved Insurer',
                        'Rectify Policy Inconsistency',
                        'Authorized Exception / Management Override',
                      ]).map((act) => (
                        <option key={act} value={act}>
                          {act}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AUTHORIZED OVERRIDE / MANAGEMENT DISPENSATION (Requirement §32) */}
                  {canGrantOverride && (
                    <div className="p-3 bg-amber-50/80 border border-amber-300 rounded space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="cb-override"
                          checked={isOverride}
                          onChange={(e) => setIsOverride(e.target.checked)}
                          className="rounded border-amber-400 text-amber-700 focus:ring-amber-500 h-4 w-4"
                        />
                        <label htmlFor="cb-override" className="text-xs font-bold text-amber-900 cursor-pointer">
                          Record as Authorized Management Override / Waiver (Checker Dispensation)
                        </label>
                      </div>
                      {isOverride && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-bold text-amber-900">
                            Sanction Memo / Board Waiver Reference <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Credit Committee Sanction Memo CC-2026-0914 / Board Waiver 42..."
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            className="w-full p-2 border border-amber-300 rounded text-xs bg-white focus:ring-1 focus:ring-amber-600 font-medium"
                          />
                          <p className="text-[10px] text-amber-800">
                            Approving Checker: <strong>{currentUser.name} ({currentUser.role})</strong> will be permanently recorded in audit history.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* SECTION 7: SUPPORTING EVIDENCE (Requirement §20) */}
              {selectedExc.status !== 'Resolved' && !isReadOnly ? (
                <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                    <Paperclip className="w-4 h-4 text-[#00205B]" />
                    Section 7: Supporting Evidence Document
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10.5px] text-[#5B6472] mb-0.5">Select from Repository</label>
                      <select
                        value={evidenceDocument}
                        onChange={(e) => setEvidenceDocument(e.target.value)}
                        className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white"
                      >
                        <option value="">-- Associate Document from Repository (Optional) --</option>
                        {documents.map((d) => (
                          <option key={d.id} value={`${d.type}: ${d.name} (${d.id})`}>
                            {d.name} — {d.type} (Entity: {d.entityId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#5B6472] mb-0.5">Or Enter External Reference / Memo ID</label>
                      <input
                        type="text"
                        placeholder="e.g. POL-RNW-2026-0982 / MEMO-APPROV-54..."
                        value={evidenceDocument}
                        onChange={(e) => setEvidenceDocument(e.target.value)}
                        className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* SECTION 8: ACTIVITY / AUDIT & ESCALATION HISTORY (Requirements §18 & §31) */}
              <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#00205B]" />
                    Section 8: Escalation & Assignment Audit Trail
                  </span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto text-xs pr-1">
                  {escalationHistory.length === 0 && assignmentHistory.length === 0 ? (
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-[#5B6472] text-[11px] italic text-center">
                      No previous escalation or manual reassignment events logged.
                    </div>
                  ) : (
                    <>
                      {escalationHistory.map((esc) => (
                        <div key={esc.id} className="p-2 bg-purple-50/70 border border-purple-200 rounded text-xs space-y-0.5">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="font-bold text-purple-900">
                              Escalated to Level {esc.escalationLevel} [{esc.newRole}]
                            </span>
                            <span className="text-[#5B6472] font-mono text-[10px]">{esc.escalatedAt?.substring(0, 16)}</span>
                          </div>
                          <div className="text-purple-800 text-[11px]">
                            By: <strong>{esc.escalatedBy}</strong> | Reason: {esc.reason || 'SLA Escalation'}
                          </div>
                        </div>
                      ))}

                      {assignmentHistory.map((asg) => (
                        <div key={asg.id} className="p-2 bg-blue-50/70 border border-blue-200 rounded text-xs space-y-0.5">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="font-bold text-blue-900">
                              Assigned to {asg.newRole} ({asg.newUserId || 'Unassigned'})
                            </span>
                            <span className="text-[#5B6472] font-mono text-[10px]">{asg.assignedAt?.substring(0, 16)}</span>
                          </div>
                          <div className="text-blue-800 text-[11px]">
                            By: <strong>{asg.assignedBy}</strong> | Reason: {asg.reason || 'Operational routing'}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* SECTION 9: RESOLUTION CONTROLS & FINAL AUDIT RECORD (Requirements §20, §47, §48) */}
              <div className="cims-card p-4 border-[#E2E8F0] space-y-3">
                <div className="text-[11px] font-bold uppercase text-[#00205B] tracking-wider">
                  Section 9: Resolution Status & Closure Notes
                </div>

                {selectedExc.status !== 'Resolved' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#101828]">
                      Mandatory Resolution Notes <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Mandatory summary of investigations, verification of policy/document corrective actions, and justification for closure..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full p-2.5 border border-[#E2E8F0] rounded text-xs focus:ring-1 focus:ring-[#D48806] focus:border-[#D48806]"
                    />
                    {!resolutionNotes.trim() && (
                      <p className="text-[10px] text-amber-700 font-semibold">
                        ⚠️ Resolution notes are mandatory. Generic or empty notes are rejected server-side.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded space-y-1.5 text-emerald-950 text-xs">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Exception Fully Resolved & Verified
                    </div>
                    <div><span className="text-[#5B6472]">Corrective Action:</span> <strong>{selectedExc.correctiveAction}</strong></div>
                    <div><span className="text-[#5B6472]">Resolution Notes:</span> <span>{selectedExc.resolutionNotes}</span></div>
                    {selectedExc.evidenceDocument && (
                      <div><span className="text-[#5B6472]">Evidence Reference:</span> <strong className="font-mono">{selectedExc.evidenceDocument}</strong></div>
                    )}
                    <div className="text-[10px] text-emerald-700 pt-1 border-t border-emerald-200">
                      Resolved on: {selectedExc.resolvedAt?.substring(0, 19)} by {selectedExc.resolvedBy}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#EFF5FB] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowDetailDrawer(false)}
                className="btn-secondary py-1.5 px-4 text-xs font-semibold"
              >
                Close Drawer
              </button>

              {selectedExc.status !== 'Resolved' && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={actionLoading || !resolutionNotes.trim()}
                  className="btn-primary py-2 px-5 text-xs bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 font-bold flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading ? 'Verifying & Resolving...' : 'Mark Exception Resolved'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
