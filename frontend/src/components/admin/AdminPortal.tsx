import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Building2,
  GitMerge,
  UserCheck,
  Clock,
  Bell,
  Mail,
  Send,
  FileText,
  Sliders,
  Shield,
  Plus,
  Edit,
  CheckCircle,
  Save,
  Trash2,
  Calendar,
  Search,
  Filter,
  Check,
  X,
  Lock,
  Unlock,
  FileCheck,
  AlertCircle,
  Info,
  Sparkles,
  Network,
  Layers,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  BusinessSegment,
  Branch,
  RolePermission,
  ApprovalHierarchyConfig,
  ReminderSchedule,
  ScheduledReport,
  ApprovedInsurer,
  CollateralTaxonomy,
  MandatoryDocumentRule,
  HolidayCalendar,
  SystemParameter,
  UserSession,
  NotificationTemplate,
  InsuranceCoverageRule,
  OrganizationalUnit,
  CbsBranchMapping,
  CbsSegmentMapping,
  PortfolioAssignment,
  UnassignedRecord,
  ImpactPreview,
} from '../../types';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';

interface AdminPortalProps {
  segments: BusinessSegment[];
  branches: Branch[];
  permissions: RolePermission[];
  approvalConfigs: ApprovalHierarchyConfig[];
  reminderSchedules: ReminderSchedule[];
  scheduledReports: ScheduledReport[];
  insurers: ApprovedInsurer[];
  taxonomies: CollateralTaxonomy[];
  mandatoryDocRules: MandatoryDocumentRule[];
  holidayCalendars: HolidayCalendar[];
  systemParameters: SystemParameter[];
  allUsers: any[];
  currentUser: UserSession;
  onSaveSegment: (seg: Partial<BusinessSegment>) => Promise<void>;
  onToggleSegmentStatus: (id: string, active: boolean) => Promise<void>;
  onSavePermissionsBatch: (perms: RolePermission[]) => Promise<void>;
  onSaveUser: (user: any) => Promise<void>;
  onToggleUserStatus: (userId: string, active: boolean) => Promise<void>;
  onSaveBranch: (branch: Partial<Branch>) => Promise<void>;
  onSaveApprovalConfig: (config: Partial<ApprovalHierarchyConfig>) => Promise<void>;
  onSaveReminderSchedule: (schedule: Partial<ReminderSchedule>) => Promise<void>;
  onSaveParameter: (param: Partial<SystemParameter>) => Promise<void>;
  onSaveInsurer: (insurer: Partial<ApprovedInsurer>) => Promise<void>;
  onSaveTaxonomy: (tax: Partial<CollateralTaxonomy>) => Promise<void>;
  onSaveMandatoryDocRule: (rule: Partial<MandatoryDocumentRule>) => Promise<void>;
  onDeleteMandatoryDocRule?: (id: string) => Promise<void>;
  onDeleteAllMandatoryDocRules?: () => Promise<void>;
  onSaveHoliday: (holiday: Partial<HolidayCalendar>) => Promise<void>;
  onDeleteHoliday?: (id: string) => Promise<void>;
}

const ALL_ROLES = [
  'EXEC', 'SYSADMIN', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR',
  'SRM', 'BRM', 'CRO', 'BRO', 'MGRCOLLDOC', 'COLLDOCOFF',
  'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  segments = [],
  branches = [],
  permissions = [],
  approvalConfigs = [],
  reminderSchedules = [],
  scheduledReports = [],
  insurers = [],
  taxonomies = [],
  mandatoryDocRules = [],
  holidayCalendars = [],
  systemParameters = [],
  allUsers = [],
  currentUser,
  onSaveSegment,
  onToggleSegmentStatus,
  onSavePermissionsBatch,
  onSaveUser,
  onToggleUserStatus,
  onSaveBranch,
  onSaveApprovalConfig,
  onSaveReminderSchedule,
  onSaveParameter,
  onSaveInsurer,
  onSaveTaxonomy,
  onSaveMandatoryDocRule,
  onDeleteMandatoryDocRule,
  onDeleteAllMandatoryDocRules,
  onSaveHoliday,
  onDeleteHoliday,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'runtime'
    | 'org-hierarchy'
    | 'segments'
    | 'users'
    | 'permissions'
    | 'branches'
    | 'cbs-mappings'
    | 'portfolio-matrix'
    | 'approval-configs'
    | 'reminders'
    | 'insurers'
    | 'taxonomy'
    | 'doc-rules'
    | 'parameters'
    | 'holidays'
    | 'templates'
    | 'coverage-rules'
  >('overview');

  // Organizational Hierarchy, CBS Mappings, Portfolio Matrix State
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([]);
  const [cbsBranchMappings, setCbsBranchMappings] = useState<CbsBranchMapping[]>([]);
  const [cbsSegmentMappings, setCbsSegmentMappings] = useState<CbsSegmentMapping[]>([]);
  const [portfolioAssignments, setPortfolioAssignments] = useState<PortfolioAssignment[]>([]);
  const [unassignedRecords, setUnassignedRecords] = useState<UnassignedRecord[]>([]);
  const [impactPreview, setImpactPreview] = useState<ImpactPreview | null>(null);
  const [loadingOrgData, setLoadingOrgData] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignForm, setReassignForm] = useState<{ entityType: string; entityId: string; newMakerId: string; newCheckerId: string; reason: string }>({
    entityType: 'CUSTOMER',
    entityId: '',
    newMakerId: '',
    newCheckerId: '',
    reason: '',
  });

  const loadOrgAndMappingData = async () => {
    setLoadingOrgData(true);
    try {
      const [ou, cbm, csm, pa, ur] = await Promise.all([
        cimsApi.getOrgUnits().catch(() => []),
        cimsApi.getCbsBranchMappings().catch(() => []),
        cimsApi.getCbsSegmentMappings().catch(() => []),
        cimsApi.getPortfolioAssignments().catch(() => []),
        cimsApi.getUnassignedRecords().catch(() => []),
      ]);
      setOrgUnits(ou || []);
      setCbsBranchMappings(cbm || []);
      setCbsSegmentMappings(csm || []);
      setPortfolioAssignments(pa || []);
      setUnassignedRecords(ur || []);
    } catch (err) {
      console.warn('Failed to load org and mapping data:', err);
    } finally {
      setLoadingOrgData(false);
    }
  };

  useEffect(() => {
    loadOrgAndMappingData();
  }, []);

  // Coverage Rules State (BR-18 Credit Policy)
  const [coverageRules, setCoverageRules] = useState<InsuranceCoverageRule[]>([]);
  const [loadingCoverageRules, setLoadingCoverageRules] = useState(false);
  const [showCoverageRuleModal, setShowCoverageRuleModal] = useState(false);
  const [editingCoverageRule, setEditingCoverageRule] = useState<Partial<InsuranceCoverageRule> | null>(null);
  const [coverageRuleSaving, setCoverageRuleSaving] = useState(false);

  const loadCoverageRules = async () => {
    setLoadingCoverageRules(true);
    try {
      const list = await cimsApi.getInsuranceCoverageRules();
      setCoverageRules(list || []);
    } catch (err) {
      console.warn('Failed to load coverage rules:', err);
    } finally {
      setLoadingCoverageRules(false);
    }
  };

  const handleSaveCoverageRule = async () => {
    if (!editingCoverageRule) return;
    setCoverageRuleSaving(true);
    setModalError(null);
    try {
      if (!editingCoverageRule.collateralType?.trim()) {
        setModalError('Collateral Type is mandatory.');
        setCoverageRuleSaving(false);
        return;
      }
      const covPct = editingCoverageRule.requiredCoveragePercentage ?? editingCoverageRule.requiredCoveragePct;
      if (covPct === undefined || covPct < 0 || covPct > 200) {
        setModalError('Required coverage percentage must be between 0% and 200%.');
        setCoverageRuleSaving(false);
        return;
      }
      const isNew = !editingCoverageRule.id;
      const ruleToSave = {
        ...editingCoverageRule,
        id: editingCoverageRule.id || editingCoverageRule.ruleCode || `cov-rule-${Date.now().toString().slice(-6)}`,
        businessSegment: editingCoverageRule.businessSegment || editingCoverageRule.customerSegment || 'ALL',
        requiredCoveragePercentage: covPct,
        requiredCoveragePct: covPct,
        status: isNew ? 'Pending Approval' : (editingCoverageRule.active !== false ? (editingCoverageRule.status || 'Active') : 'Inactive'),
        creditPolicyApproved: isNew ? false : (editingCoverageRule.creditPolicyApproved === true),
      };
      await cimsApi.saveInsuranceCoverageRule(ruleToSave);
      await loadCoverageRules();
      setShowCoverageRuleModal(false);
      setEditingCoverageRule(null);
      showToast('Credit Policy Insurance Coverage Rule saved successfully!');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save coverage rule');
    } finally {
      setCoverageRuleSaving(false);
    }
  };

  const handleToggleCoverageRule = async (ruleId: string) => {
    try {
      await cimsApi.toggleInsuranceCoverageRule(ruleId);
      await loadCoverageRules();
      showToast('Coverage rule active status updated.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle rule');
    }
  };

  // Health and Trigger state
  const [healthData, setHealthData] = useState<{ status: string; healthyCount: number; warningCount: number; warnings: string[]; healthyChecks: string[] } | null>(null);
  const [runningReminders, setRunningReminders] = useState(false);
  const [runtimeData, setRuntimeData] = useState<any>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState('2026-09-11');
  const [calendarResult, setCalendarResult] = useState<any>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templateDraft, setTemplateDraft] = useState<NotificationTemplate | null>(null);
  const [templatePreview, setTemplatePreview] = useState('');
  const [usageMap, setUsageMap] = useState<Record<string, string>>({});
  const [dependencyHealth, setDependencyHealth] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [runningEscalations, setRunningEscalations] = useState(false);
  const [scanningExceptions, setScanningExceptions] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [paramSearch, setParamSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const loadRuntimeData = React.useCallback(async () => {
    setRuntimeLoading(true);
    try {
      const [runtime, templateRows, usage, dependencies, districtRows] = await Promise.all([
        cimsApi.getAdminRuntimeConfiguration(),
        cimsApi.getNotificationTemplates(),
        cimsApi.getConfigurationUsage(),
        cimsApi.getDependencyHealth(),
        cimsApi.getDistricts().catch(() => []),
      ]);
      setRuntimeData(runtime);
      setTemplates(templateRows || []);
      setUsageMap(usage || {});
      setDependencyHealth(dependencies || null);
      if (districtRows && districtRows.length > 0) setDistricts(districtRows);
    } catch (error: any) {
      showToast(error?.message || 'Unable to load runtime configuration.');
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  const executeModalSave = async (saveFn: () => Promise<void>, successToast: string, closeModalFn: () => void) => {
    setModalError(null);
    setModalSaving(true);
    try {
      await saveFn();
      closeModalFn();
      showToast(successToast);
    } catch (err: any) {
      setModalError(err?.message || 'Operation failed. Please verify the submitted data.');
    } finally {
      setModalSaving(false);
    }
  };

  React.useEffect(() => {
    loadRuntimeData();
  }, [loadRuntimeData, systemParameters, reminderSchedules, holidayCalendars]);

  React.useEffect(() => {
    cimsApi.getAdminHealth().then(data => setHealthData(data)).catch(() => setHealthData(null));
  }, [systemParameters, reminderSchedules, holidayCalendars, templates.length]);

  const handleRunRemindersNow = async () => {
    setRunningReminders(true);
    try {
      const data = await cimsApi.runPolicyReminders(currentUser.userId || currentUser.username || 'SYSADMIN');
      showToast(data.message || `Dispatched ${data.dispatchedCount || 0} reminders successfully.`);
      await loadRuntimeData();
    } catch (e: any) {
      showToast(e?.message || 'Reminder execution failed.');
    } finally {
      setRunningReminders(false);
    }
  };

  const handleRunEscalations = async () => {
    setRunningEscalations(true);
    try {
      const data = await cimsApi.runRenewalEscalations(currentUser.userId || currentUser.username || 'SYSADMIN');
      showToast(`Renewal escalation completed: ${data.escalatedCount || 0} notification(s).`);
    } catch (e: any) { showToast(e?.message || 'Escalation run failed.'); }
    finally { setRunningEscalations(false); }
  };

  const handleScanExceptions = async () => {
    setScanningExceptions(true);
    try {
      await cimsApi.scanExceptionsNow(currentUser.userId || currentUser.username || 'SYSADMIN');
      showToast('Portfolio exception scan completed.');
    } catch (e: any) { showToast(e?.message || 'Exception scan failed.'); }
    finally { setScanningExceptions(false); }
  };

  // Success message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- Segments State ---
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Partial<BusinessSegment> | null>(null);

  // --- Users State ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [selectedEmailUser, setSelectedEmailUser] = useState<any | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<any | null>(null);
  const [emailError, setEmailError] = useState<string>('');

  // --- Branches State ---
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);

  // --- Approval Config State ---
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [editingApproval, setEditingApproval] = useState<Partial<ApprovalHierarchyConfig> | null>(null);

  // --- Reminder Schedule State ---
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Partial<ReminderSchedule> | null>(null);

  // --- Insurers State ---
  const [showInsurerModal, setShowInsurerModal] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<Partial<ApprovedInsurer> | null>(null);

  // --- Taxonomy State ---
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [editingTaxonomy, setEditingTaxonomy] = useState<Partial<CollateralTaxonomy> | null>(null);

  // --- Doc Rules State ---
  const [showDocRuleModal, setShowDocRuleModal] = useState(false);
  const [editingDocRule, setEditingDocRule] = useState<Partial<MandatoryDocumentRule> | null>(null);

  // --- System Parameters State ---
  const [showParamModal, setShowParamModal] = useState(false);
  const [editingParam, setEditingParam] = useState<Partial<SystemParameter> | null>(null);

  // --- Holidays State ---
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Partial<HolidayCalendar> | null>(null);

  // --- Permission Matrix Local Editable State ---
  const [localPermissions, setLocalPermissions] = useState<RolePermission[]>(permissions);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [permSearch, setPermSearch] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);

  const ALL_SCREENS = [
    'Dashboard', 'Customers', 'Facilities', 'Collateral', 'Insurance',
    'Approvals', 'Exceptions', 'Documents', 'Reports', 'Audit Trail',
    'Notifications', 'Administration', 'CBS Simulator'
  ];

  // Sync permissions if prop updates
  React.useEffect(() => {
    const fullMatrix: RolePermission[] = [];
    ALL_ROLES.forEach((role) => {
      ALL_SCREENS.forEach((screen) => {
        const found = permissions?.find(
          (p) => p.roleCode === role && p.screenName.toLowerCase() === screen.toLowerCase()
        );
        if (found) {
          fullMatrix.push(found);
        } else {
          fullMatrix.push({
            id: `perm-${role.toLowerCase()}-${screen.toLowerCase().replace(/\s+/g, '')}`,
            roleCode: role as any,
            screenName: screen,
            canView: role === 'SYSADMIN' || (screen !== 'Administration' && screen !== 'CBS Simulator'),
            canCreate: role === 'SYSADMIN' || ['CRO', 'BRO', 'SRM', 'BRM', 'MGRCOLLDOC', 'COLLDOCOFF'].includes(role),
            canEdit: role === 'SYSADMIN' || ['CRO', 'BRO', 'SRM', 'BRM', 'BRMGR', 'HODEPT', 'DISTDIR', 'MGRCOLLDOC', 'COLLDOCOFF'].includes(role),
            canApprove: ['BRMGR', 'EXEC', 'SRMGMT', 'HODEPT', 'DISTDIR', 'MGRCOLLDOC'].includes(role),
            canDelete: role === 'SYSADMIN' || ['BRMGR', 'MGRCOLLDOC'].includes(role),
          });
        }
      });
    });
    setLocalPermissions(fullMatrix);
  }, [permissions]);

  const handleTogglePerm = (id: string, field: 'canView' | 'canCreate' | 'canEdit' | 'canApprove' | 'canDelete') => {
    setLocalPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p))
    );
  };

  const handleSaveAllPermissions = async () => {
    setSavingPerms(true);
    try {
      await onSavePermissionsBatch(localPermissions);
      showToast('Role permissions matrix saved successfully!');
    } finally {
      setSavingPerms(false);
    }
  };

  const filteredPermissions = localPermissions.filter((p) => {
    if (selectedRoleFilter !== 'ALL' && p.roleCode !== selectedRoleFilter) return false;
    if (permSearch && !p.screenName.toLowerCase().includes(permSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#00205B] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00205B]" />
            System Administration & Governance
          </h1>
          <p className="text-xs text-[#5B6472] mt-0.5">
            Configure business segments, users, role permissions, branch hierarchies, approval workflows, and bank reference data
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-[#E2E8F0] bg-white px-4 pt-3 rounded-t-lg gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          ⚡ Control Center
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'runtime' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          Runtime Configuration
        </button>
        <button
          onClick={() => setActiveTab('org-hierarchy')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'org-hierarchy' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          🏛️ 14 Districts & Areas ({orgUnits.length})
        </button>
        <button
          onClick={() => setActiveTab('cbs-mappings')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'cbs-mappings' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          🔗 CBS Mappings ({cbsBranchMappings.length})
        </button>
        <button
          onClick={() => setActiveTab('portfolio-matrix')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'portfolio-matrix' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          📊 Portfolio Matrix ({portfolioAssignments.length})
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'segments' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          1. Business Segments ({segments.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          2. Users ({allUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'permissions' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          3. Role Permissions Matrix ({localPermissions.length})
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'branches' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          4. Branch Hierarchy ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab('approval-configs')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'approval-configs' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          5. Approval Workflows ({approvalConfigs.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'reminders' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          6. Reminder Schedules ({reminderSchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('insurers')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'insurers' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          7. Approved Insurers ({insurers.length})
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'taxonomy' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          8. Collateral Taxonomy ({taxonomies.length})
        </button>
        <button
          onClick={() => setActiveTab('doc-rules')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'doc-rules' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          9. Document Rules ({mandatoryDocRules.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'templates' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          Notification Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'parameters' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          10. System Parameters ({systemParameters.length})
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'holidays' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          11. Holiday Calendar ({holidayCalendars.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('coverage-rules');
            loadCoverageRules();
          }}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${activeTab === 'coverage-rules' ? 'border-[#00205B] text-[#00205B]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
            }`}
        >
          12. Insurance Coverage Rules (BR-18) ({coverageRules.length})
        </button>
      </div>

      {/* --- Tab 0: Overview / Governance Control Center --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={handleRunRemindersNow} disabled={runningReminders} className="px-3 py-2 rounded-lg bg-[#00205B] text-white text-xs font-bold disabled:opacity-50">{runningReminders ? 'Running reminders…' : 'Run reminders now'}</button>
            <button onClick={handleRunEscalations} disabled={runningEscalations} className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold disabled:opacity-50">{runningEscalations ? 'Escalating…' : 'Run renewal escalations'}</button>
            <button onClick={handleScanExceptions} disabled={scanningExceptions} className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold disabled:opacity-50">{scanningExceptions ? 'Scanning…' : 'Scan exceptions now'}</button>
          </div>
          {/* Health & Diagnostic Banner */}
          <div className={`p-5 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${healthData?.status === 'HEALTHY' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${healthData?.status === 'HEALTHY' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                  {healthData?.status || 'HEALTHY'}
                </span>
                <h3 className="text-base font-bold">Runtime Configuration Health & System Diagnostics</h3>
              </div>
              <p className="text-xs mt-1 opacity-90">
                {healthData?.healthyChecks?.join(' • ') || 'All critical parameters active and synchronized.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunRemindersNow}
                disabled={runningReminders}
                className="px-4 py-2 bg-[#00205B] hover:bg-[#173F63] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                {runningReminders ? 'Evaluating Schedules...' : '⚡ Trigger Expiry Reminders'}
              </button>
            </div>
          </div>

          {/* Core Configuration Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">System Parameters</span>
                  <Sliders className="w-4 h-4 text-[#00205B]" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{systemParameters.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Live runtime thresholds & rules</p>
              </div>
              <button onClick={() => setActiveTab('parameters')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Parameters →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Approved Insurers</span>
                  <Shield className="w-4 h-4 text-blue-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{insurers.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Underwriters & concentration caps</p>
              </div>
              <button onClick={() => setActiveTab('insurers')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Manage Insurers →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Approval Workflows</span>
                  <GitMerge className="w-4 h-4 text-purple-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{approvalConfigs.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Maker-Checker SLA hierarchies</p>
              </div>
              <button onClick={() => setActiveTab('approval-configs')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Workflows →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Reminder Schedules</span>
                  <Bell className="w-4 h-4 text-amber-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{reminderSchedules.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Working-day pre-expiry alerts</p>
              </div>
              <button onClick={() => setActiveTab('reminders')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Reminders →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Taxonomies & Haircuts</span>
                  <FileText className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{taxonomies.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Asset categories & valuation rules</p>
              </div>
              <button onClick={() => setActiveTab('taxonomy')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Taxonomy →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Holiday Calendar</span>
                  <Calendar className="w-4 h-4 text-rose-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{holidayCalendars.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Bank holidays & working days</p>
              </div>
              <button onClick={() => setActiveTab('holidays')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Holidays →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Mandatory Doc Rules</span>
                  <FileCheck className="w-4 h-4 text-indigo-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{mandatoryDocRules.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Required compliance documents</p>
              </div>
              <button onClick={() => setActiveTab('doc-rules')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Configure Rules →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Users & RBAC</span>
                  <Users className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-2xl font-black text-[#00205B] mt-2">{allUsers.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Bank personnel & matrix permissions</p>
              </div>
              <button onClick={() => setActiveTab('users')} className="mt-3 text-xs font-bold text-[#00205B] hover:underline text-left">
                Manage Users →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Runtime Configuration --- */}
      {activeTab === 'runtime' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white p-5 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#00205B]">Effective Runtime Configuration</h3>
              <p className="text-xs text-[#5B6472] mt-1">Active configuration values currently applied across the system.</p>
            </div>
            <button onClick={loadRuntimeData} disabled={runtimeLoading} className="btn-secondary text-xs">
              {runtimeLoading ? 'Refreshing…' : 'Refresh Runtime State'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              ['Coverage adequacy', `${runtimeData?.effectiveConfiguration?.minCoverageAdequacyPct ?? '—'}%`, 'Used by insurance/coverage validation'],
              ['Insurer concentration', `${runtimeData?.effectiveConfiguration?.maxInsurerConcentrationPct ?? '—'}%`, 'Used by portfolio concentration checks'],
              ['Expiry grace period', `${runtimeData?.effectiveConfiguration?.policyExpiryGracePeriodDays ?? '—'} days`, 'Runtime policy configuration'],
              ['Dual control', runtimeData?.effectiveConfiguration?.dualControlStrictMode ? 'ENABLED' : 'DISABLED', 'Maker-checker runtime mode'],
              ['Default currency', runtimeData?.effectiveConfiguration?.defaultCurrency ?? '—', 'Runtime default currency'],
              ['CBS sync', runtimeData?.effectiveConfiguration?.cbsSyncMode ?? '—', `${runtimeData?.effectiveConfiguration?.cbsSyncIntervalMinutes ?? '—'} minute interval`],
              ['Holidays', String(runtimeData?.holidayCount ?? holidayCalendars.length), 'Loaded into business calendar'],
              ['Templates', String(runtimeData?.templateCount ?? templates.length), 'Available notification templates'],
              ['Minimum policy validity', `${runtimeData?.effectiveConfiguration?.minimumPolicyValidityDays ?? '—'} days`, 'Activation validation'],
              ['Document warning', `${runtimeData?.effectiveConfiguration?.documentExpiryWarningDays ?? '—'} days`, 'Ownership document monitoring'],
              ['Reminder throttle', String(runtimeData?.effectiveConfiguration?.maxReminderNotificationsPerRecipientPerDay ?? '—'), 'Maximum reminder notifications per recipient/day'],
              ['Customer frequency', `${runtimeData?.effectiveConfiguration?.customerNotificationFrequencyDays ?? '—'} days`, 'Customer renewal notification cadence'],
              ['Escalation', `${runtimeData?.effectiveConfiguration?.escalationFirstDaysBeforeExpiry ?? '—'} / ${runtimeData?.effectiveConfiguration?.escalationSecondDaysBeforeExpiry ?? '—'} days`, 'First and second escalation thresholds'],
            ].map(([label, value, hint]) => (
              <div key={label} className="cims-card p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6472]">{label}</div>
                <div className="text-xl font-black text-[#00205B] mt-2">{value}</div>
                <div className="text-[11px] text-[#5B6472] mt-1">{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="cims-card p-5">
              <h4 className="font-bold text-sm text-[#00205B]">Business-Day Calculator</h4>
              <p className="text-xs text-[#5B6472] mt-1">Verify that Admin holiday configuration is being consumed by runtime calendar logic.</p>
              <div className="flex gap-2 mt-4">
                <input type="date" value={calendarDate} onChange={e => setCalendarDate(e.target.value)} className="input-field flex-1" />
                <button onClick={async () => { try { setCalendarResult(await cimsApi.checkBusinessDate(calendarDate)); } catch (e: any) { showToast(e.message); } }} className="btn-primary text-xs">Check Date</button>
              </div>
              {calendarResult && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded border"><b>Working day:</b> {calendarResult.workingDay ? 'Yes' : 'No'}</div>
                  <div className="p-3 bg-slate-50 rounded border"><b>Holiday:</b> {calendarResult.holiday ? 'Yes' : 'No'}</div>
                  <div className="p-3 bg-slate-50 rounded border"><b>Weekend:</b> {calendarResult.weekend ? 'Yes' : 'No'}</div>
                  <div className="p-3 bg-slate-50 rounded border"><b>Next:</b> {calendarResult.nextWorkingDay}</div>
                </div>
              )}
            </div>
            <div className="cims-card p-5">
              <h4 className="font-bold text-sm text-[#00205B]">Configuration Health</h4>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${runtimeData?.health?.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{runtimeData?.health?.status || 'CHECKING'}</span>
                <span className="text-xs text-[#5B6472]">{runtimeData?.health?.healthyCount ?? 0} healthy checks · {runtimeData?.health?.warningCount ?? 0} warnings</span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                {(runtimeData?.health?.warnings || []).map((w: string) => <div key={w} className="p-2 rounded bg-amber-50 text-amber-900 border border-amber-200">⚠ {w}</div>)}
                {(runtimeData?.health?.healthyChecks || []).map((h: string) => <div key={h} className="p-2 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">✓ {h}</div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab: Notification Templates --- */}

      {activeTab === 'runtime' && (
        <div className="mt-6 bg-white border border-[#E2E8F0] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-bold text-[#101828]">Runtime configuration consumers</h3><p className="text-xs text-[#5B6472]">Every administrator-controlled value should have a defined business consumer.</p></div>
            <span className="text-xs font-semibold text-[#5B6472]">Dependencies: {dependencyHealth ? 'Available' : 'Loading'}</span>
          </div>
          <div className="space-y-2">
            {Object.entries(usageMap).map(([key, consumer]) => (
              <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 border-b border-[#E2E8F0] last:border-0 py-3">
                <code className="text-xs font-bold text-[#173F63] md:w-64">{key}</code>
                <span className="text-xs text-[#5B6472]">{consumer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#00205B]">Notification Templates</h3>
              <p className="text-xs text-[#5B6472]">Templates are linked to Reminder Schedules and dispatched to Staff, Customers, and Insurers with full audience isolation.</p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setTemplatePreview('');
                const defaultSched = reminderSchedules.length > 0 ? reminderSchedules[0] : null;
                setTemplateDraft({
                  id: '',
                  name: defaultSched ? `${defaultSched.name || defaultSched.id} (Staff)` : '',
                  type: 'Email',
                  channel: 'Email',
                  eventType: defaultSched?.triggerBasis || 'Expiry Reminder',
                  triggerDaysBefore: defaultSched?.offsetDays || defaultSched?.daysBeforeExpiry || 30,
                  scheduleId: defaultSched?.id || '',
                  audience: 'Staff',
                  subject: 'Staff Alert: Insurance Expiry Due - {Policy Number}',
                  body: 'Dear {Staff Name},\n\nPolicy {Policy Number} for collateral {Collateral ID} (Customer: {Customer Name}) is expiring on {Expiry Date}.\nPlease review and initiate required renewal actions.\n\nBranch: {Branch Name}',
                  active: true
                });
              }}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> New Template
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Template Name</th>
                  <th className="p-3">Linked Reminder Schedule</th>
                  <th className="p-3">Audience</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Trigger Offset</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {templates.map(t => {
                  const linkedSched = reminderSchedules.find(s => s.id === t.scheduleId);
                  return (
                    <tr key={t.id} className="hover:bg-[#EFF5FB]">
                      <td className="p-3 font-semibold text-[#00205B]">{t.name}</td>
                      <td className="p-3">
                        {linkedSched ? (
                          <div className="font-medium text-[#101828]">
                            <span className="text-[#00205B] font-bold">{linkedSched.name || linkedSched.id}</span>
                            <div className="text-[10px] text-[#5B6472]">
                              T {linkedSched.triggerBasis?.includes('After') ? '+' : '-'} {linkedSched.offsetDays || linkedSched.daysBeforeExpiry} Days ({linkedSched.dayType || 'Working Day'})
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#5B6472] italic text-[11px]">Standalone / General</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                          (t.audience || '').toLowerCase() === 'customer'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : (t.audience || '').toLowerCase() === 'insurer'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}>
                          {t.audience || 'Staff'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{t.type || t.channel}</td>
                      <td className="p-3 tabular-nums font-semibold">{t.triggerDaysBefore || 0} working days</td>
                      <td className="p-3"><StatusChip label={t.active === false ? 'Inactive' : 'Active'} /></td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setTemplatePreview('');
                            setTemplateDraft(t);
                          }}
                          className="text-[#00205B] font-semibold hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {templateDraft && (() => {
            const currentSched = reminderSchedules.find(s => s.id === templateDraft.scheduleId);
            const currentAudience = templateDraft.audience || 'Staff';

            // Reminder Schedule is the single source of truth for audience. Only
            // expose template sections for audiences enabled on the linked schedule.
            const parseScheduleAudiences = (audience?: string): string[] => {
              const s = (audience || '').toLowerCase();
              const out: string[] = [];
              if (s.includes('both') || (s.includes('staff') && s.includes('customer'))) {
                out.push('Staff', 'Customer');
              } else if (s.includes('customer')) {
                out.push('Customer');
              } else if (s.includes('insurer') || s.includes('insurance')) {
                out.push('Insurer');
              } else {
                out.push('Staff');
              }
              if ((s.includes('insurer') || s.includes('insurance')) && !out.includes('Insurer')) {
                out.push('Insurer');
              }
              return out;
            };
            const allAudienceSections = [
              { key: 'Staff', label: 'Staff Notification Template', hint: 'Internal task, review action, portfolio digest' },
              { key: 'Customer', label: 'Customer Notification Template', hint: 'Formal renewal reminder letter/SMS' },
              { key: 'Insurer', label: 'Insurance Company Template', hint: 'Partner Underwriter notice' },
            ];
            const allowedAudiences = currentSched
              ? parseScheduleAudiences(currentSched.audience)
              : allAudienceSections.map(a => a.key);
            const audienceSections = allAudienceSections.filter(a =>
              allowedAudiences.some(x => x.toLowerCase() === a.key.toLowerCase())
            );

            // Distinct placeholder tokens tailored for each audience
            const audienceTokens: Record<string, string[]> = {
              Staff: [
                '{Staff Name}',
                '{Total Policies}',
                '{Policy Details}',
                '{Expiring Count}',
                '{Branch Name}',
                '{Current Date}',
                '{Days Remaining}',
                '{Summary}',
                '{Collateral ID}',
                '{Policy Number}',
                '{Customer Name}',
              ],
              Customer: [
                '{Customer Name}',
                '{Policy Number}',
                '{Collateral ID}',
                '{Expiry Date}',
                '{Insurer Name}',
                '{Branch Name}',
                '{RM Name}',
                '{RM Phone}',
                '{Days Remaining}',
                '{Days Overdue}',
                '{Loan Account Number}',
              ],
              Insurer: [
                '{Insurer Name}',
                '{Policy Number}',
                '{Collateral ID}',
                '{Customer Name}',
                '{Expiry Date}',
                '{Branch Name}',
                '{Current Date}',
              ],
            };

            const tokens = audienceTokens[currentAudience] || audienceTokens.Staff;

            return (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-[#00205B] text-base">
                        {templateDraft.id ? 'Edit' : 'Create'} Notification Template
                      </h3>
                      <p className="text-xs text-[#5B6472]">
                        Production templates are strictly linked to Reminder Schedules and dispatched by the automated notification engine.
                      </p>
                    </div>
                    <button onClick={() => { setTemplateDraft(null); setModalError(null); }}>
                      <X className="w-5 h-5 text-[#5B6472] hover:text-[#00205B]" />
                    </button>
                  </div>

                  {modalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      <span>{modalError}</span>
                    </div>
                  )}

                  {/* Requirement 7: Link Templates directly to Reminder Schedules via dropdown */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">
                        Linked Reminder Schedule *
                      </label>
                      <select
                        className="input-field w-full font-bold text-[#00205B]"
                        value={templateDraft.scheduleId || ''}
                        onChange={(e) => {
                          const schedId = e.target.value;
                          const sched = reminderSchedules.find(s => s.id === schedId);
                          if (sched) {
                            const nextAllowed = parseScheduleAudiences(sched.audience);
                            const curAud = templateDraft.audience || 'Staff';
                            if (!nextAllowed.some(a => a.toLowerCase() === curAud.toLowerCase())) {
                              const hasContent = Boolean((templateDraft.subject || '').trim() || (templateDraft.body || '').trim());
                              const ok = window.confirm(
                                `Reminder schedule "${sched.name || sched.id}" only targets ${nextAllowed.join(' and ')}. ` +
                                `The current ${curAud} template section will no longer be available.` +
                                (hasContent ? ' Its existing content will be preserved, not deleted.' : '') +
                                ` Continue and switch to the ${nextAllowed[0]} section?`
                              );
                              if (!ok) return;
                              const nextAud = nextAllowed[0];
                              // Prefer an existing template for the target audience so we
                              // never overwrite it with content from the hidden section.
                              const existingForAud = templates.find(t =>
                                t.scheduleId === sched.id &&
                                (t.audience || '').toLowerCase() === nextAud.toLowerCase()
                              );
                              if (existingForAud) {
                                setTemplateDraft({ ...existingForAud });
                                return;
                              }
                              setTemplateDraft({
                                ...templateDraft,
                                scheduleId: sched.id,
                                triggerDaysBefore: sched.offsetDays || sched.daysBeforeExpiry || 30,
                                eventType: sched.triggerBasis || 'Expiry Reminder',
                                audience: nextAud,
                                name: `${sched.name || sched.id} (${nextAud})`,
                              });
                              return;
                            }
                            setTemplateDraft({
                              ...templateDraft,
                              scheduleId: sched.id,
                              triggerDaysBefore: sched.offsetDays || sched.daysBeforeExpiry || 30,
                              eventType: sched.triggerBasis || 'Expiry Reminder',
                              name: `${sched.name || sched.id} (${currentAudience})`,
                            });
                          } else {
                            setTemplateDraft({
                              ...templateDraft,
                              scheduleId: '',
                            });
                          }
                        }}
                      >
                        <option value="">-- Standalone / General Template (Not linked to schedule) --</option>
                        {reminderSchedules.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.id} (T {s.triggerBasis?.includes('After') ? '+' : '-'} {s.offsetDays || s.daysBeforeExpiry} Days | Audience: {s.audience || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Summary Banner displaying inherited settings */}
                    {currentSched && (
                      <div className="p-3.5 bg-[#EFF5FB] border border-[#BBD3EB] rounded-lg text-xs space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#00205B] text-xs">
                            Inherited from Schedule: {currentSched.name || currentSched.id}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00205B] text-white">
                            {currentSched.active ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-[#173F63] pt-1">
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">Trigger Event</span>
                            <span className="font-bold">{currentSched.triggerBasis || 'Before Expiry'} ({currentSched.dayType || 'Working Day'})</span>
                          </div>
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">Offset Days</span>
                            <span className="font-bold">{currentSched.offsetDays || currentSched.daysBeforeExpiry} Days</span>
                          </div>
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">Recurrence</span>
                            <span className="font-bold">{currentSched.recurrence || 'One-time'}</span>
                          </div>
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">Configured Audience</span>
                            <span className="font-bold">{currentSched.audience || 'Both'}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#5B6472] italic">
                          ✓ Trigger timing ({currentSched.offsetDays || currentSched.daysBeforeExpiry} days) and event type are automatically synchronized from this schedule.
                        </p>
                      </div>
                    )}

                    {/* Separate Template Sections for Each Audience */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5B6472] mb-1.5">
                        Target Audience Template Section *
                      </label>
                      <div className="flex gap-2">
                        {audienceSections.map(({ key, label, hint }) => {
                          const isSelected = (templateDraft.audience || 'Staff').toLowerCase() === key.toLowerCase();
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                const newAud = key;
                                // Check if a template already exists for this schedule and audience
                                const existingForAud = templateDraft.scheduleId
                                  ? templates.find(t => t.scheduleId === templateDraft.scheduleId && (t.audience || '').toLowerCase() === newAud.toLowerCase())
                                  : null;

                                if (existingForAud) {
                                  setTemplateDraft(existingForAud);
                                } else {
                                  let newSub = '';
                                  let newBody = '';
                                  if (newAud === 'Staff') {
                                    newSub = 'Staff Alert: Insurance Expiry Due - {Policy Number}';
                                    newBody = 'Dear {Staff Name},\n\nPolicy {Policy Number} for collateral {Collateral ID} (Customer: {Customer Name}) is expiring on {Expiry Date}.\nPlease review and initiate required renewal actions.\n\nBranch: {Branch Name}';
                                  } else if (newAud === 'Customer') {
                                    newSub = 'Dashen Bank Notice: Insurance Policy Renewal - {Policy Number}';
                                    newBody = 'Dear {Customer Name},\n\nYour insurance policy {Policy Number} securing your loan at Dashen Bank expires on {Expiry Date}.\nPlease submit your renewal policy certificate to avoid loan irregularity.\n\nBranch: {Branch Name}';
                                  } else {
                                    newSub = 'Underwriter Notice: Insurance Expiry Reminder - {Policy Number}';
                                    newBody = 'Dear Partner Underwriter {Insurer Name},\n\nPlease be advised that policy {Policy Number} for collateral {Collateral ID} is expiring on {Expiry Date}.\nPlease coordinate renewal with Dashen Bank.\n\nBranch: {Branch Name}';
                                  }

                                  setTemplateDraft({
                                    ...templateDraft,
                                    id: templateDraft.id && templateDraft.audience === newAud ? templateDraft.id : '',
                                    audience: newAud,
                                    name: currentSched ? `${currentSched.name || currentSched.id} (${newAud})` : `${templateDraft.name} (${newAud})`,
                                    subject: newSub,
                                    body: newBody,
                                  });
                                }
                              }}
                              className={`flex-1 p-2.5 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'bg-[#00205B] text-white border-[#00205B] shadow-sm'
                                  : 'bg-white text-[#5B6472] border-[#E2E8F0] hover:bg-[#EFF5FB]'
                              }`}
                            >
                              <div className="font-bold text-xs">{label}</div>
                              <div className={`text-[10px] ${isSelected ? 'text-slate-200' : 'text-[#5B6472]'}`}>{hint}</div>
                            </button>
                          );
                        })}
                      </div>
                      {currentSched && allowedAudiences.length < allAudienceSections.length && (
                        <p className="mt-1.5 text-[10px] text-[#5B6472]">
                          Only the {allowedAudiences.join(' and ')} section(s) are shown because the linked reminder schedule targets {allowedAudiences.join(' and ')}. Existing template content for other audiences is preserved and is not deleted.
                        </p>
                      )}
                      {currentSched && !allowedAudiences.some(a => a.toLowerCase() === currentAudience.toLowerCase()) && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center justify-between gap-2">
                          <span>
                            The current <strong>{currentAudience}</strong> section is no longer enabled on this schedule. Existing content is preserved.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextAud = allowedAudiences[0];
                              setTemplateDraft({
                                ...templateDraft,
                                audience: nextAud,
                                name: `${currentSched.name || currentSched.id} (${nextAud})`,
                              });
                            }}
                            className="px-2 py-1 bg-amber-600 text-white rounded font-semibold shrink-0"
                          >
                            Switch to {allowedAudiences[0]}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Template Name *</label>
                      <input
                        className="input-field w-full font-semibold"
                        placeholder="e.g. 30 Working Days Notice (Staff)"
                        value={templateDraft.name}
                        onChange={e => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Channel *</label>
                      <select
                        className="input-field w-full font-semibold"
                        value={templateDraft.channel || templateDraft.type || 'Email'}
                        onChange={e => setTemplateDraft({ ...templateDraft, type: e.target.value, channel: e.target.value as any })}
                      >
                        <option value="Email">Email</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">
                        Subject Line {(templateDraft.channel || templateDraft.type) === 'Email' ? <span className="text-red-600">* (Mandatory for Email)</span> : <span className="text-slate-400 font-normal">(Optional for SMS)</span>}
                      </label>
                      <input
                        className="input-field w-full font-medium"
                        placeholder="e.g. Dashen Bank Alert: Policy Expiry Notice for {Policy Number}"
                        value={templateDraft.subject || ''}
                        onChange={e => setTemplateDraft({ ...templateDraft, subject: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold text-[#5B6472]">
                        Message Body * (Click placeholder token to insert for {currentAudience})
                      </label>
                      <span className="text-[10px] text-[#5B6472]">
                        Standardized merge tags for {currentAudience}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                      {tokens.map(ph => (
                        <button
                          key={ph}
                          type="button"
                          onClick={() => setTemplateDraft({ ...templateDraft, body: (templateDraft.body || '') + ph })}
                          className="px-2 py-0.5 text-[11px] font-mono bg-white border border-[#CBD5E1] rounded hover:border-[#00205B] hover:bg-[#EFF5FB] text-[#00205B] transition-colors"
                          title={`Insert ${ph}`}
                        >
                          + {ph}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input-field w-full font-mono text-xs"
                      rows={6}
                      placeholder="Enter template message body with placeholders..."
                      value={templateDraft.body}
                      onChange={e => setTemplateDraft({ ...templateDraft, body: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs flex items-center gap-2 cursor-pointer font-medium text-[#00205B]">
                      <input
                        type="checkbox"
                        checked={templateDraft.active !== false}
                        onChange={e => setTemplateDraft({ ...templateDraft, active: e.target.checked })}
                      />
                      Template Active (Participates in automated schedule dispatch)
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        setModalError(null);
                        try {
                          const r = await cimsApi.previewNotificationTemplate(templateDraft.body, {
                            'Customer Name': 'Selam Alemayehu',
                            CustomerName: 'Selam Alemayehu',
                            'Staff Name': 'Alemayehu Tadesse',
                            StaffName: 'Alemayehu Tadesse',
                            'Total Policies': '3',
                            'Expiring Count': '3',
                            'Policy Details': '• POL-001 | Collateral: COL-00045 | Expiry: 2026-12-15',
                            'Summary': '• POL-001 | Collateral: COL-00045 | Expiry: 2026-12-15',
                            'Policy Number': 'POL-2026-001',
                            PolicyNumber: 'POL-2026-001',
                            'Collateral ID': 'COL-00045',
                            CollateralID: 'COL-00045',
                            'Expiry Date': '2026-12-15',
                            ExpiryDate: '2026-12-15',
                            'Current Date': '2026-11-18',
                            CurrentDate: '2026-11-18',
                            'Insurer Name': 'Ethiopian Insurance Corporation',
                            InsurerName: 'Ethiopian Insurance Corporation',
                            'Loan Account Number': 'LN-2026-9901',
                            LoanAccountNumber: 'LN-2026-9901',
                            'Facility Number': 'FAC-2026-004',
                            FacilityNumber: 'FAC-2026-004',
                            'Branch Name': 'Main Corporate Branch',
                            Branch: 'Main Corporate Branch',
                            'Days Remaining': 30,
                            DaysRemaining: 30,
                            'Days Overdue': 0,
                            DaysOverdue: 0,
                            RMName: 'Alemayehu Tadesse',
                            RMPhone: '+251 91 123 4567',
                          });
                          setTemplatePreview(r.preview);
                        } catch (e: any) {
                          setModalError(e.message || 'Failed to generate preview with the given placeholders.');
                        }
                      }}
                      className="btn-secondary text-xs"
                    >
                      Preview Template
                    </button>
                  </div>

                  {templatePreview && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs whitespace-pre-wrap max-h-36 overflow-auto font-mono text-[#334155] animate-fadeIn">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Generated Output Preview</div>
                      {templatePreview}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                    <button onClick={() => { setTemplateDraft(null); setModalError(null); }} className="btn-secondary text-xs">
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!templateDraft.name || !templateDraft.name.trim()) {
                          setModalError('Template name is required.');
                          return;
                        }
                        const channel = templateDraft.channel || templateDraft.type || 'Email';
                        if (channel === 'Email' && (!templateDraft.subject || !templateDraft.subject.trim())) {
                          setModalError('Email subject is mandatory for Email channel templates.');
                          return;
                        }
                        if (!templateDraft.body || !templateDraft.body.trim()) {
                          setModalError('Template body is required.');
                          return;
                        }
                        if (currentSched) {
                          const allowed = parseScheduleAudiences(currentSched.audience);
                          const aud = templateDraft.audience || '';
                          if (!aud || !allowed.some(a => a.toLowerCase() === aud.toLowerCase())) {
                            setModalError(`Select one of the audiences enabled on reminder schedule "${currentSched.name || currentSched.id}": ${allowed.join(', ')}.`);
                            return;
                          }
                        }
                        executeModalSave(
                          async () => {
                            await cimsApi.saveNotificationTemplate(templateDraft, currentUser.userId);
                            setTemplatePreview('');
                            await loadRuntimeData();
                          },
                          'Notification template saved and linked to reminder schedule successfully!',
                          () => setTemplateDraft(null)
                        );
                      }}
                      disabled={modalSaving}
                      className="btn-primary text-xs"
                    >
                      {modalSaving ? 'Validating & Saving...' : 'Save Template'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- Tab: Organization Hierarchy & 14 Districts --- */}
      {activeTab === 'org-hierarchy' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Bank Organizational Hierarchy & 14 Canonical Districts</h3>
              <p className="text-xs text-[#5B6472]">Two-dimensional structure: Geographic (HO → District → Area Office → Area → Branch) & Business Hierarchy</p>
            </div>
            <button
              onClick={() => loadOrgAndMappingData()}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOrgData ? 'animate-spin' : ''}`} />
              Refresh Hierarchy
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-[11px] font-bold text-blue-700 uppercase">Geographic Districts</span>
              <div className="text-xl font-black text-blue-950 mt-1">14 Canonical</div>
              <p className="text-[10px] text-blue-600 mt-0.5">4 Addis Ababa + 10 Upcountry</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="text-[11px] font-bold text-purple-700 uppercase">Core Segments</span>
              <div className="text-xl font-black text-purple-950 mt-1">4 Segments</div>
              <p className="text-[10px] text-purple-600 mt-0.5">Corporate, Retail, MSME, IFB Overlay</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Corporate Units</span>
              <div className="text-xl font-black text-emerald-950 mt-1">5 Operating Units</div>
              <p className="text-[10px] text-emerald-600 mt-0.5">Center, Institutional, Trade, Imp/Exp, Agri</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Pilot Branches</span>
              <div className="text-xl font-black text-amber-950 mt-1">8 Mapped</div>
              <p className="text-[10px] text-amber-600 mt-0.5">Bole, Merkato, Arada, Kirkos, Upcountry</p>
            </div>
          </div>

          {/* Canonical 14 Districts Table */}
          <div className="cims-card overflow-x-auto">
            <div className="p-3 border-b border-[#E2E8F0] font-bold text-xs text-[#00205B] bg-slate-50 flex items-center justify-between">
              <span>Canonical 14 Districts & Area Structure</span>
              <span className="text-[11px] font-normal text-slate-500">IFB operates as segment overlay across all 14 districts</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">District Code</th>
                  <th className="p-3">District Name</th>
                  <th className="p-3">Region / Scope</th>
                  <th className="p-3">Unit Type</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {orgUnits.filter(u => u.unitType === 'DISTRICT').map((d) => (
                  <tr key={d.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-mono font-bold text-blue-900">{d.code}</td>
                    <td className="p-3 font-semibold text-[#00205B]">{d.name}</td>
                    <td className="p-3 text-[#5B6472]">{d.code.includes('AA') ? 'Addis Ababa' : 'Upcountry'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">DISTRICT</span></td>
                    <td className="p-3"><StatusChip label={d.active ? 'Active' : 'Inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab: CBS Branch & Segment Mappings --- */}
      {activeTab === 'cbs-mappings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">CBS Source Branch & Segment Mapping Engine</h3>
              <p className="text-xs text-[#5B6472]">Authoritative translation of FLEXCUBE live views into canonical CBAIMS entities</p>
            </div>
            <button
              onClick={() => loadOrgAndMappingData()}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOrgData ? 'animate-spin' : ''}`} />
              Refresh Mappings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CBS Branch Mappings */}
            <div className="cims-card overflow-x-auto">
              <div className="p-3 border-b border-[#E2E8F0] font-bold text-xs text-[#00205B] bg-slate-50 flex items-center justify-between">
                <span>CBS Branch Code Aliases ({cbsBranchMappings.length})</span>
                <span className="text-[10px] text-slate-500">Preserves Leading Zeroes</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                  <tr>
                    <th className="p-2.5">CBS Code</th>
                    <th className="p-2.5">Official Branch Name</th>
                    <th className="p-2.5">CBAIMS Branch ID</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {cbsBranchMappings.map((bm) => (
                    <tr key={bm.id} className="hover:bg-[#EFF5FB]">
                      <td className="p-2.5 font-mono font-bold text-blue-900">{bm.sourceBranchCode}</td>
                      <td className="p-2.5 font-semibold text-[#00205B]">{bm.officialName}</td>
                      <td className="p-2.5 font-mono text-slate-600">{bm.cbaimsBranchId}</td>
                      <td className="p-2.5"><StatusChip label={bm.status || (bm.active ? 'ACTIVE' : 'INACTIVE')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CBS Segment Mappings */}
            <div className="cims-card overflow-x-auto">
              <div className="p-3 border-b border-[#E2E8F0] font-bold text-xs text-[#00205B] bg-slate-50 flex items-center justify-between">
                <span>CBS Segment Mappings ({cbsSegmentMappings.length})</span>
                <span className="text-[10px] text-slate-500">Holds Unapproved Values</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                  <tr>
                    <th className="p-2.5">CBS Value</th>
                    <th className="p-2.5">Canonical Segment</th>
                    <th className="p-2.5">Mapping Status</th>
                    <th className="p-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {cbsSegmentMappings.map((sm) => (
                    <tr key={sm.id} className="hover:bg-[#EFF5FB]">
                      <td className="p-2.5 font-mono font-bold text-purple-900">{sm.sourceValue}</td>
                      <td className="p-2.5 font-semibold text-[#00205B]">{sm.canonicalSegment || '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sm.mappingStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {sm.mappingStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-500 max-w-[150px] truncate" title={sm.reason}>{sm.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab: Portfolio Matrix & Routing --- */}
      {activeTab === 'portfolio-matrix' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Portfolio Assignment Matrix & Unassigned Records Queue</h3>
              <p className="text-xs text-[#5B6472]">Maker-checker portfolio routing across segment directorates, operating branches, and officers</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setReassignForm({ entityType: 'CUSTOMER', entityId: '', newMakerId: '', newCheckerId: '', reason: '' });
                  setShowReassignModal(true);
                }}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Reassign Portfolio
              </button>
              <button
                onClick={() => loadOrgAndMappingData()}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrgData ? 'animate-spin' : ''}`} />
                Refresh Matrix
              </button>
            </div>
          </div>

          {/* Impact Analysis Simulator Card */}
          <div className="cims-card p-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border border-blue-200">
            <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-700" />
              Administrative Impact Simulator
            </h4>
            <p className="text-[11px] text-slate-600 mt-1">Preview operational consequences before committing branch relocations, segment reorganizations, or officer deactivations.</p>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <button
                onClick={async () => {
                  try {
                    const res = await cimsApi.getImpactPreview({ changeType: 'REASSIGN_BRANCH', targetId: 'brn-bole' });
                    setImpactPreview(res);
                  } catch (e: any) {
                    showToast(e.message || 'Simulation error');
                  }
                }}
                className="btn-ghost py-1 px-2.5 text-xs border border-blue-300 rounded bg-white hover:bg-blue-50 text-blue-900"
              >
                Simulate Bole Branch Relocation
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await cimsApi.getImpactPreview({ changeType: 'DEACTIVATE_USER', targetId: 'TEST_CORP_RO_BOLE' });
                    setImpactPreview(res);
                  } catch (e: any) {
                    showToast(e.message || 'Simulation error');
                  }
                }}
                className="btn-ghost py-1 px-2.5 text-xs border border-purple-300 rounded bg-white hover:bg-purple-50 text-purple-900"
              >
                Simulate Corporate RO Deactivation
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await cimsApi.getImpactPreview({ changeType: 'CBS_MAPPING_CHANGE', targetId: '0101' });
                    setImpactPreview(res);
                  } catch (e: any) {
                    showToast(e.message || 'Simulation error');
                  }
                }}
                className="btn-ghost py-1 px-2.5 text-xs border border-amber-300 rounded bg-white hover:bg-amber-50 text-amber-900"
              >
                Simulate CBS Code 0101 Re-map
              </button>
            </div>

            {impactPreview && (
              <div className="mt-3 p-3 bg-white rounded border border-blue-200 text-xs space-y-1.5">
                <div className="font-bold text-[#00205B]">{impactPreview.description}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mt-2">
                  <div>Affected Loans: <strong>{impactPreview.affectedFacilitiesCount}</strong></div>
                  <div>Affected Collaterals: <strong>{impactPreview.affectedCollateralsCount}</strong></div>
                  <div>Affected Portfolios: <strong>{impactPreview.affectedCustomersCount}</strong></div>
                  <div>Dual Approval Required: <strong className={impactPreview.requiresDualApproval ? 'text-amber-700' : 'text-emerald-700'}>{impactPreview.requiresDualApproval ? 'YES' : 'NO'}</strong></div>
                </div>
                {impactPreview.riskWarnings?.map((w, idx) => (
                  <div key={idx} className="text-amber-700 text-[11px] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned Records Queue */}
          {unassignedRecords.length > 0 && (
            <div className="cims-card overflow-x-auto border-amber-300 bg-amber-50/20">
              <div className="p-3 border-b border-amber-200 font-bold text-xs text-amber-950 bg-amber-100/40 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Unassigned / Mapping Review Queue ({unassignedRecords.length})
                </span>
                <span className="text-[11px] font-normal text-amber-800">Deterministic routing held pending supervisor resolution</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-100/50 border-b border-amber-200 text-amber-900 font-semibold">
                  <tr>
                    <th className="p-2.5">Entity Type</th>
                    <th className="p-2.5">Source Key</th>
                    <th className="p-2.5">Source Branch</th>
                    <th className="p-2.5">Source Segment</th>
                    <th className="p-2.5">Unassigned Reason</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {unassignedRecords.map((ur) => (
                    <tr key={ur.id} className="hover:bg-amber-100/40">
                      <td className="p-2.5 font-bold text-amber-900">{ur.entityType}</td>
                      <td className="p-2.5 font-mono">{ur.entityId}</td>
                      <td className="p-2.5 font-mono">{ur.sourceBranchCode || '—'}</td>
                      <td className="p-2.5 font-mono">{ur.sourceSegment || '—'}</td>
                      <td className="p-2.5 text-red-700 font-medium">{ur.reason}</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">{ur.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Active Portfolio Assignments Table */}
          <div className="cims-card overflow-x-auto">
            <div className="p-3 border-b border-[#E2E8F0] font-bold text-xs text-[#00205B] bg-slate-50 flex items-center justify-between">
              <span>Active Portfolio Assignments ({portfolioAssignments.length})</span>
              <span className="text-[10px] text-slate-500">Strict Segregation of Duties Enforced</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Entity ID</th>
                  <th className="p-2.5">Segment</th>
                  <th className="p-2.5">Branch</th>
                  <th className="p-2.5">Assigned Maker</th>
                  <th className="p-2.5">Assigned Checker</th>
                  <th className="p-2.5">Source</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {portfolioAssignments.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-center text-[#5B6472]">No active portfolio assignments found.</td></tr>
                ) : (
                  portfolioAssignments.map((pa) => (
                    <tr key={pa.id} className="hover:bg-[#EFF5FB]">
                      <td className="p-2.5 font-bold text-blue-900">{pa.entityType}</td>
                      <td className="p-2.5 font-mono font-semibold">{pa.entityId}</td>
                      <td className="p-2.5">{pa.segmentId || '—'}</td>
                      <td className="p-2.5">{pa.branchId || '—'}</td>
                      <td className="p-2.5 font-semibold text-emerald-800">{pa.makerUserId || 'UNASSIGNED'}</td>
                      <td className="p-2.5 font-semibold text-blue-800">{pa.checkerUserId || 'UNASSIGNED'}</td>
                      <td className="p-2.5 text-[10px] font-mono text-slate-500">{pa.assignmentSource}</td>
                      <td className="p-2.5"><StatusChip label={pa.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reassign Portfolio Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-[#00205B] flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-blue-700" />
                Administrative Portfolio Reassignment
              </h3>
              <button onClick={() => setShowReassignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Entity Type</label>
                <select
                  value={reassignForm.entityType}
                  onChange={(e) => setReassignForm({ ...reassignForm, entityType: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                >
                  <option value="CUSTOMER">Customer Master</option>
                  <option value="FACILITY">Credit Facility</option>
                  <option value="COLLATERAL">Collateral Master</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Entity ID / Account / CIF</label>
                <input
                  type="text"
                  value={reassignForm.entityId}
                  onChange={(e) => setReassignForm({ ...reassignForm, entityId: e.target.value })}
                  placeholder="e.g. 000001004 or ACC-CORP-001"
                  className="w-full border border-slate-300 rounded p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Maker User (RO / CRO)</label>
                <select
                  value={reassignForm.newMakerId}
                  onChange={(e) => setReassignForm({ ...reassignForm, newMakerId: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                >
                  <option value="">Select Maker...</option>
                  {allUsers.filter((u: any) => ['CRO', 'BRO', 'RO', 'COLLDOCOFF'].includes(u.role)).map((u: any) => (
                    <option key={u.id} value={u.username || u.id}>{u.fullName} ({u.username}) - {u.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Checker User (RM / BM)</label>
                <select
                  value={reassignForm.newCheckerId}
                  onChange={(e) => setReassignForm({ ...reassignForm, newCheckerId: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                >
                  <option value="">Select Checker...</option>
                  {allUsers.filter((u: any) => ['BRMGR', 'SRM', 'CRM', 'BRM', 'DISTDIR', 'HODEPT'].includes(u.role)).map((u: any) => (
                    <option key={u.id} value={u.username || u.id}>{u.fullName} ({u.username}) - {u.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reassignment Reason</label>
                <textarea
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  rows={2}
                  placeholder="Justification for administrative reassignment..."
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowReassignModal(false)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reassignForm.entityId || !reassignForm.newMakerId || !reassignForm.newCheckerId) {
                    showToast('Entity ID, Maker, and Checker are required.');
                    return;
                  }
                  try {
                    await cimsApi.reassignPortfolio(reassignForm);
                    showToast('Portfolio successfully reassigned!');
                    setShowReassignModal(false);
                    loadOrgAndMappingData();
                  } catch (e: any) {
                    showToast(e.message || 'Reassignment failed.');
                  }
                }}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 1: Business Segments --- */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Business Segment Portfolio Units</h3>
              <p className="text-xs text-[#5B6472]">Core business divisions governing collateral ownership & portfolio segregation</p>
            </div>
            <button
              onClick={() => {
                setEditingSegment({ name: '', description: '', riskProfile: 'Medium', active: true });
                setShowSegmentModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Business Segment
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Segment Name</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Risk Profile</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {segments.map((seg) => (
                  <tr key={seg.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-semibold text-[#00205B]">{seg.name}</td>
                    <td className="p-3 text-[#5B6472]">{seg.description}</td>
                    <td className="p-3"><StatusChip label={seg.riskProfile || 'Medium'} /></td>
                    <td className="p-3"><StatusChip label={seg.active ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingSegment(seg);
                          setShowSegmentModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          await onToggleSegmentStatus(seg.id, !seg.active);
                          showToast(`Segment status updated to ${!seg.active ? 'Active' : 'Inactive'}`);
                        }}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        {seg.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 2: Users --- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">User Accounts & Roles</h3>
              <p className="text-xs text-[#5B6472]">Manage staff accounts, role mappings, branch domiciliaries, and security locks</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5B6472]" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-xs bg-[#EFF5FB] border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3E7AB0] w-full text-[#101828]"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className="absolute right-2.5 top-2.5 text-[#5B6472] hover:text-[#101828]"
                    title="Clear user search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingUser({
                    username: '',
                    name: '',
                    fullName: '',
                    email: '',
                    role: 'CRO',
                    branch: 'Bole Special Branch',
                    segment: 'Corporate Banking',
                    active: true,
                  });
                  setShowUserModal(true);
                }}
                className="btn-primary py-1.5 px-3 text-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                + Create New User
              </button>
            </div>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Username</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Role Code</th>
                  <th className="p-3">Domicile Branch</th>
                  <th className="p-3">Primary Segment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {allUsers
                  .filter((u) => {
                    if (!userSearch.trim()) return true;
                    const terms = userSearch.toLowerCase().split(/\s+/).filter(Boolean);
                    const userText = [u.username, u.name, u.fullName, u.role, u.branch, u.segment, u.email]
                      .filter(Boolean)
                      .join(' ')
                      .toLowerCase();
                    return terms.every((t) => userText.includes(t));
                  })
                  .map((u) => (
                    <tr key={u.id || u.userId} className="hover:bg-[#EFF5FB]">
                      <td className="p-3 font-semibold text-[#00205B]">{u.username}</td>
                      <td className="p-3">{u.name || u.fullName}</td>
                      <td className="p-3 font-bold text-[#00205B]">{u.role}</td>
                      <td className="p-3">{u.branch}</td>
                      <td className="p-3">{u.segment}</td>
                      <td className="p-3"><StatusChip label={u.active !== false ? 'Active' : 'Locked'} /></td>
                      <td className="p-3 text-right space-x-3">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setShowUserModal(true);
                          }}
                          className="text-[#00205B] hover:underline font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEmailUser(u);
                            setEmailSubject(`CBAIMS Notification: Test Dispatch to ${u.name || u.fullName || u.username}`);
                            setEmailBody(`Dear ${u.name || u.fullName || u.username},\n\nThis is an administrative test notification dispatched from the CBAIMS Admin Console to verify your configured email channel connectivity.\n\nAccount: ${u.username}\nRole: ${u.role}\nBranch: ${u.branch}\nSegment: ${u.segment}\n\nThank you,\nCBAIMS System Administration`);
                            setEmailResult(null);
                            setEmailError('');
                            setShowSendEmailModal(true);
                          }}
                          className="text-blue-600 hover:underline font-semibold"
                          title={`Send test email to ${u.email || u.username}`}
                        >
                          Send Email
                        </button>
                        <button
                          onClick={async () => {
                            await onToggleUserStatus(u.id || u.userId, u.active === false);
                            showToast(`User account ${u.username} is now ${u.active === false ? 'Active' : 'Locked'}`);
                          }}
                          className="text-amber-700 hover:underline font-semibold"
                        >
                          {u.active !== false ? 'Lock' : 'Unlock'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 3: Permissions Matrix (Interactive Editable) --- */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Role × Screen Access Permission Matrix (§2.1)</h3>
              <p className="text-xs text-[#5B6472]">Granular permissions governing screen visibility, creation, editing, checker approval, and deletion</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-[#5B6472]">Filter Role:</label>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="input-field text-xs py-1 px-2 font-semibold text-[#00205B]"
                >
                  <option value="ALL">All Roles (16)</option>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveAllPermissions}
                disabled={savingPerms}
                className="btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {savingPerms ? 'Saving Matrix...' : 'Save Permissions Matrix'}
              </button>
            </div>
          </div>

          <div className="cims-card overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold sticky top-0 z-10">
                <tr>
                  <th className="p-3 bg-[#EFF5FB]">Role Code</th>
                  <th className="p-3 bg-[#EFF5FB]">Screen / Module</th>
                  <th className="p-3 text-center bg-[#EFF5FB]">View</th>
                  <th className="p-3 text-center bg-[#EFF5FB]">Create</th>
                  <th className="p-3 text-center bg-[#EFF5FB]">Edit</th>
                  <th className="p-3 text-center bg-[#EFF5FB] text-emerald-800">Approve (Checker)</th>
                  <th className="p-3 text-center bg-[#EFF5FB] text-red-800">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredPermissions.map((p) => (
                  <tr key={p.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-bold text-[#173F63]">{p.roleCode}</td>
                    <td className="p-3 font-semibold text-[#101828]">{p.screenName}</td>

                    {/* View Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canView}
                        onChange={() => handleTogglePerm(p.id, 'canView')}
                        className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
                      />
                    </td>

                    {/* Create Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canCreate}
                        onChange={() => handleTogglePerm(p.id, 'canCreate')}
                        className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
                      />
                    </td>

                    {/* Edit Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canEdit}
                        onChange={() => handleTogglePerm(p.id, 'canEdit')}
                        className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
                      />
                    </td>

                    {/* Approve Checkbox */}
                    <td className="p-3 text-center bg-emerald-50/50">
                      <input
                        type="checkbox"
                        checked={p.canApprove}
                        onChange={() => handleTogglePerm(p.id, 'canApprove')}
                        className="w-4 h-4 text-emerald-600 rounded border-[#E2E8F0] focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Delete Checkbox */}
                    <td className="p-3 text-center bg-red-50/50">
                      <input
                        type="checkbox"
                        checked={p.canDelete}
                        onChange={() => handleTogglePerm(p.id, 'canDelete')}
                        className="w-4 h-4 text-red-600 rounded border-[#E2E8F0] focus:ring-red-500 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 4: Branch Hierarchy --- */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Branch Network & District Hierarchy</h3>
              <p className="text-xs text-[#5B6472]">Head Office, District Directorates, and Operating Branches</p>
            </div>
            <button
              onClick={() => {
                setEditingBranch({ code: '', name: '', type: 'Branch', parentDistrictId: 'Head Office', active: true });
                setShowBranchModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Branch
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Branch Code</th>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Parent District</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-semibold text-[#00205B]">{b.code}</td>
                    <td className="p-3">{b.name}</td>
                    <td className="p-3 font-medium text-[#00205B]">{b.type}</td>
                    <td className="p-3">{b.parentDistrictId || 'Head Office'}</td>
                    <td className="p-3"><StatusChip label={b.active !== false ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setShowBranchModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          await onSaveBranch({ ...b, active: b.active === false });
                          showToast(`Branch ${b.code} updated.`);
                        }}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        {b.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 5: Approval Workflows --- */}
      {activeTab === 'approval-configs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Approval Hierarchy Mapping (§14.4)</h3>
              <p className="text-xs text-[#5B6472]">Dual control levels (1 or 2 stages), candidate roles, bulk approval rules, and SLA hours</p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setEditingApproval({
                  transactionType: '',
                  approvalLevels: 1,
                  level1Role: 'BRMGR',
                  level2Role: '',
                  bulkApproveAllowed: false,
                  slaHours: 24,
                  active: true,
                });
                setShowApprovalModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Workflow Configuration
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Transaction Type</th>
                  <th className="p-3">Hierarchy / Scope</th>
                  <th className="p-3">Maker Role</th>
                  <th className="p-3">Approval Levels</th>
                  <th className="p-3">Level 1 Checker</th>
                  <th className="p-3">Level 2 Escalation</th>
                  <th className="p-3 text-center">Bulk</th>
                  <th className="p-3 text-right">SLA Hours</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {approvalConfigs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-semibold text-[#00205B]">
                      <div>{cfg.transactionType}</div>
                      {cfg.exceptionType && cfg.exceptionType !== 'All' && (
                        <div className="text-[10px] text-amber-700 font-medium">{cfg.exceptionType}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-[#00205B]">{cfg.hierarchyLevel || 'Branch'}</span>
                      {(cfg.branchCode || cfg.districtName || cfg.hoDepartment) && (
                        <div className="text-[10px] text-[#5B6472]">{cfg.branchCode || cfg.districtName || cfg.hoDepartment}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{cfg.makerRole || 'Any'}</td>
                    <td className="p-3">{cfg.approvalLevels} Stage(s)</td>
                    <td className="p-3 font-bold text-[#00205B]">{cfg.level1Role}</td>
                    <td className="p-3">{cfg.level2Role || '—'}</td>
                    <td className="p-3 text-center">{cfg.bulkApproveAllowed ? 'Yes' : 'No'}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{cfg.slaHours} hrs</td>
                    <td className="p-3"><StatusChip label={cfg.active ? 'Active' : 'Disabled'} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingApproval(cfg);
                          setShowApprovalModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit SLA / Roles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 6: Reminder Schedules --- */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Policy Expiry Pre-Alert Reminder Schedules (US-09.2)</h3>
              <p className="text-xs text-[#5B6472]">Configured working-day offsets below trigger the reminder engine; changes are applied to runtime scheduling immediately after save.</p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setEditingReminder({
                  name: '',
                  daysBeforeExpiry: 15,
                  channelsJson: '["Email","SMS"]',
                  recipientRolesJson: '["CRO","BRO","BRMGR"]',
                  active: true,
                  audience: 'Staff',
                  triggerBasis: 'Before Expiry',
                  dayType: 'Working Day',
                  recurrence: 'One-time',
                  continueUntil: 'Renewed',
                });
                setShowReminderModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Reminder Schedule
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Reminder Name</th>
                  <th className="p-3">Audience</th>
                  <th className="p-3">Offset & Trigger Basis</th>
                  <th className="p-3">Recurrence / Limit</th>
                  <th className="p-3">Channels</th>
                  <th className="p-3">Recipients</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {reminderSchedules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-bold text-[#00205B]">{r.name || r.id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${r.audience === 'Customer' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                        {r.audience || 'Staff'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-[#00205B] tabular-nums">
                      {r.triggerBasis === 'After Expiry' ? `T + ${r.daysBeforeExpiry}` : `T - ${r.daysBeforeExpiry}`} Days ({r.dayType || 'Working Day'})
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#101828]">{r.recurrence || 'One-time'}</div>
                      {r.recurrenceUnit === 'MINUTES' && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠️ Testing ({r.recurrenceInterval || 1} min)
                        </span>
                      )}
                      <div className="text-[10px] text-[#5B6472]">Until: {r.continueUntil || 'Renewed'}</div>
                    </td>
                    <td className="p-3 font-medium">{r.channelsJson}</td>
                    <td className="p-3 font-mono text-[11px]">{r.audience === 'Customer' ? 'Customer Contact' : r.recipientRolesJson}</td>
                    <td className="p-3"><StatusChip label={r.active ? 'Active' : 'Paused'} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingReminder(r);
                          setShowReminderModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 7: Approved Insurers --- */}
      {activeTab === 'insurers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Approved Insurance Companies List</h3>
              <p className="text-xs text-[#5B6472]">National Bank of Ethiopia licensed underwriters approved for collateral coverage</p>
            </div>
            <button
              onClick={() => {
                setEditingInsurer({ name: '', active: true });
                setShowInsurerModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Approved Insurer
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Insurer ID</th>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {insurers.map((ins) => (
                  <tr key={ins.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-mono text-[#00205B]">{ins.id}</td>
                    <td className="p-3 font-bold text-[#00205B]">{ins.name}</td>
                    <td className="p-3"><StatusChip label={ins.active ? 'Approved' : 'Suspended'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingInsurer(ins);
                          setShowInsurerModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          await onSaveInsurer({ ...ins, active: !ins.active });
                          showToast(`Insurer ${ins.name} status updated.`);
                        }}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        {ins.active ? 'Suspend' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 8: Collateral Taxonomy --- */}
      {activeTab === 'taxonomy' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Collateral Asset Taxonomy & Mandatory Insurance Rules</h3>
              <p className="text-xs text-[#5B6472]">Asset classification categories and mandated insurance coverage types</p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setEditingTaxonomy({
                  category: 'Immovable Properties',
                  subCategory: '',
                  insuranceMandatory: true,
                  mandatoryCoverageType: 'Fire & Lightning',
                });
                setShowTaxonomyModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Taxonomy Rule
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Sub-Category</th>
                  <th className="p-3">Insurance Mandatory</th>
                  <th className="p-3">Mandatory Coverage Type</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {taxonomies.map((tax) => (
                  <tr key={tax.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-bold text-[#00205B]">{tax.category}</td>
                    <td className="p-3">{tax.subCategory}</td>
                    <td className="p-3">
                      <StatusChip label={tax.insuranceMandatory ? 'Mandatory' : 'Optional'} />
                    </td>
                    <td className="p-3 font-semibold text-[#00205B]">{tax.mandatoryCoverageType}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingTaxonomy(tax);
                          setShowTaxonomyModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit Rule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 9: Mandatory Document Rules --- */}
      {activeTab === 'doc-rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Mandatory Collateral Ownership Document Rules</h3>
              <p className="text-xs text-[#5B6472]">Define document requirements (e.g. Title Deeds, Valuation Reports) by asset category</p>
            </div>
            <div className="flex items-center space-x-2">
              {onDeleteAllMandatoryDocRules && mandatoryDocRules.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to remove ALL ${mandatoryDocRules.length} mandatory document rules? This cannot be undone.`)) {
                      try {
                        await onDeleteAllMandatoryDocRules();
                        showToast('All mandatory document rules have been removed.');
                      } catch (e: any) {
                        showToast(e?.message || 'Failed to remove all document rules.');
                      }
                    }
                  }}
                  className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove All Rules
                </button>
              )}
              <button
                onClick={() => {
                  setModalError(null);
                  setEditingDocRule({ segment: 'All Segments', collateralCategory: 'All Categories', documentType: '', mandatory: true });
                  setShowDocRuleModal(true);
                }}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add Document Rule
              </button>
            </div>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Collateral Category</th>
                  <th className="p-3">Business Segment</th>
                  <th className="p-3">Asset Sub-Type</th>
                  <th className="p-3">Required Document Type</th>
                  <th className="p-3">Ownership Scope</th>
                  <th className="p-3">Applicability</th>
                  <th className="p-3">Requirement</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {mandatoryDocRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-bold text-[#00205B]">{rule.collateralCategory}</td>
                    <td className="p-3 font-medium text-[#00205B]">{rule.segment || 'All Segments'}</td>
                    <td className="p-3 font-medium text-[#00205B]">{rule.collateralType || 'All Sub-Types'}</td>
                    <td className="p-3 font-semibold">{rule.documentType}</td>
                    <td className="p-3">{rule.ownershipCondition || 'Any'}</td>
                    <td className="p-3">{rule.applicabilityCondition || 'Standard'}</td>
                    <td className="p-3">
                      <StatusChip label={rule.mandatory ? 'Mandatory' : 'Recommended'} />
                    </td>
                    <td className="p-3">
                      <StatusChip label={rule.active !== false ? 'Active' : 'Disabled'} />
                    </td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingDocRule(rule);
                          setShowDocRuleModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit
                      </button>
                      {onDeleteMandatoryDocRule && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete mandatory document rule "${rule.documentType}" for ${rule.collateralCategory}?`)) {
                              try {
                                await onDeleteMandatoryDocRule(rule.id);
                                showToast(`Document rule "${rule.documentType}" deleted successfully.`);
                              } catch (e: any) {
                                showToast(e?.message || 'Failed to delete document rule.');
                              }
                            }
                          }}
                          className="text-red-600 hover:underline font-semibold"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 10: System Parameters --- */}
      {activeTab === 'parameters' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border border-[#E2E8F0] gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">System Global Configuration Parameters</h3>
              <p className="text-xs text-[#5B6472]">Values are validated and applied immediately.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5B6472]" />
              <input
                type="text"
                placeholder="Search parameter by key or usage..."
                value={paramSearch}
                onChange={(e) => setParamSearch(e.target.value)}
                className="input-field pl-8 text-xs w-full"
              />
            </div>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Parameter Key</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Runtime Use</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {systemParameters
                  .filter((p) => {
                    if (!paramSearch.trim()) return true;
                    const q = paramSearch.toLowerCase();
                    return p.paramKey.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
                  })
                  .map((param) => (
                    <tr key={param.paramKey} className="hover:bg-[#EFF5FB]">
                      <td className="p-3 font-mono font-bold text-[#00205B]">{param.paramKey}</td>
                      <td className="p-3 font-semibold text-emerald-800">{param.paramValue}</td>
                      <td className="p-3"><StatusChip label={['min_coverage_adequacy_pct', 'max_insurer_concentration_pct', 'policy_expiry_grace_period_days', 'dual_control_strict_mode', 'default_currency', 'cbs_sync_mode', 'cbs_sync_interval_minutes'].includes(param.paramKey) ? 'Runtime' : 'Configured'} /></td>
                      <td className="p-3 text-[#5B6472]">{param.description}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setEditingParam(param);
                            setShowParamModal(true);
                          }}
                          className="text-[#00205B] hover:underline font-semibold"
                        >
                          Edit Value
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 11: Holiday Calendar --- */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Bank Holiday Calendar & Business Day Rules</h3>
              <p className="text-xs text-[#5B6472]">Official Ethiopian public and banking holidays for SLA calculation</p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setEditingHoliday({ holidayDate: '2026-09-11', description: 'Enkutatash (Ethiopian New Year)' });
                setShowHolidayModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Bank Holiday
            </button>
          </div>

          <div className="cims-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Holiday Date</th>
                  <th className="p-3">Holiday Name / Description</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {holidayCalendars.map((h) => (
                  <tr key={h.id} className="hover:bg-[#EFF5FB]">
                    <td className="p-3 font-mono font-bold text-[#00205B]">{h.holidayDate}</td>
                    <td className="p-3 font-semibold">{h.description}</td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingHoliday(h);
                          setShowHolidayModal(true);
                        }}
                        className="text-[#00205B] hover:underline font-semibold"
                      >
                        Edit
                      </button>
                      {onDeleteHoliday && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete bank holiday "${h.description}" (${h.holidayDate})?`)) {
                              try {
                                await onDeleteHoliday(h.id);
                                showToast(`Bank holiday "${h.description}" deleted successfully.`);
                              } catch (e: any) {
                                showToast(e?.message || 'Failed to delete holiday.');
                              }
                            }
                          }}
                          className="text-red-600 hover:underline font-semibold"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Tab 12: Credit Policy Insurance Coverage Rules (BR-18) --- */}
      {activeTab === 'coverage-rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#101828] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00205B]" />
                Credit Policy Insurance Coverage Rules (BR-18)
              </h3>
              <p className="text-xs text-[#5B6472]">
                Configure required coverage percentages and over-insurance tolerances by collateral type and business segment.
              </p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setEditingCoverageRule({
                  ruleCode: `ICR-${Date.now().toString().slice(-4)}`,
                  collateralType: 'Buildings',
                  customerSegment: 'ALL',
                  requiredCoveragePct: 100,
                  overInsuranceTolerancePct: 20,
                  effectiveFrom: new Date().toISOString().substring(0, 10),
                  active: true,
                  approvalStatus: 'Approved',
                });
                setShowCoverageRuleModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Coverage Rule
            </button>
          </div>

          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs flex items-start gap-2.5 text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[11px] text-amber-900">
                Credit Policy Mandate &amp; Non-Assumed Defaults
              </strong>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Coverage thresholds must be explicitly configured according to Bank Credit Policy. Proposed default of 100% is tentative pending Credit Committee confirmation. Over-insurance tolerance is informational and does not block facility processing. Recalculation is triggered automatically upon rule changes.
              </p>
            </div>
          </div>

          <div className="cims-card overflow-x-auto">
            {loadingCoverageRules ? (
              <div className="p-8 text-center text-xs text-[#5B6472]">Loading Credit Policy coverage rules…</div>
            ) : coverageRules.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5B6472] space-y-2">
                <p>No insurance coverage rules defined.</p>
                <button
                  onClick={loadCoverageRules}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Refresh Rules
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                  <tr>
                    <th className="p-3">Rule Code</th>
                    <th className="p-3">Collateral Type</th>
                    <th className="p-3">Customer Segment</th>
                    <th className="p-3">Required Coverage %</th>
                    <th className="p-3">Over-Insurance Tolerance %</th>
                    <th className="p-3">Effective Period</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Approval</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {coverageRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-[#EFF5FB]">
                      <td className="p-3 font-mono font-bold text-[#00205B]">{rule.ruleCode}</td>
                      <td className="p-3 font-semibold text-[#00205B]">{rule.collateralType}</td>
                      <td className="p-3">{rule.customerSegment || 'ALL'}</td>
                      <td className="p-3 font-bold text-slate-800">
                        {rule.requiredCoveragePct != null ? `${rule.requiredCoveragePct}%` : 'Unconfigured'}
                      </td>
                      <td className="p-3 font-medium text-slate-600">
                        {rule.overInsuranceTolerancePct != null ? `+${rule.overInsuranceTolerancePct}%` : 'Not Set'}
                      </td>
                      <td className="p-3 text-[11px] text-[#5B6472]">
                        {rule.effectiveFrom || 'Immediate'}
                        {rule.effectiveTo ? ` to ${rule.effectiveTo}` : ' (Indefinite)'}
                      </td>
                      <td className="p-3">
                        <StatusChip label={rule.active !== false ? 'Active' : 'Disabled'} />
                      </td>
                      <td className="p-3">
                        <StatusChip label={rule.approvalStatus || 'Approved'} />
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setEditingCoverageRule(rule);
                            setShowCoverageRuleModal(true);
                          }}
                          className="text-[#00205B] hover:underline font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleCoverageRule(rule.id)}
                          className={`hover:underline font-semibold ${rule.active !== false ? 'text-amber-700' : 'text-emerald-700'}`}
                        >
                          {rule.active !== false ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS FOR ADMIN CRUD OPERATIONS (PRODUCTION-GRADE GOVERNANCE) */}
      {/* ========================================================================= */}

      {/* Segment Modal */}
      {showSegmentModal && editingSegment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingSegment.id ? 'Edit Business Segment' : 'Add New Business Segment'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Segment Name *</label>
                <input
                  type="text"
                  value={editingSegment.name || ''}
                  onChange={(e) => setEditingSegment({ ...editingSegment, name: e.target.value })}
                  placeholder="e.g. Agricultural Banking, Retail Banking"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Description</label>
                <textarea
                  value={editingSegment.description || ''}
                  onChange={(e) => setEditingSegment({ ...editingSegment, description: e.target.value })}
                  placeholder="Scope, collateral policy, and credit facility governance criteria"
                  rows={3}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Risk Profile</label>
                <select
                  value={editingSegment.riskProfile || 'Medium'}
                  onChange={(e) => setEditingSegment({ ...editingSegment, riskProfile: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowSegmentModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingSegment.name || !editingSegment.name.trim()) {
                    setModalError('Business segment name is mandatory.');
                    return;
                  }
                  executeModalSave(() => onSaveSegment(editingSegment), 'Business segment saved successfully!', () => setShowSegmentModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Segment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingUser.id ? `Edit User — ${editingUser.username}` : 'Create Staff User Account'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Username *</label>
                <input
                  type="text"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  placeholder="e.g. brmgr_bole, cro_agro"
                  className="input-field w-full font-mono font-semibold"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editingUser.name || editingUser.fullName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value, fullName: e.target.value })}
                  placeholder="e.g. Abebe Bikila"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Role Persona *</label>
                <select
                  value={editingUser.role || 'CRO'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="input-field w-full font-bold text-[#00205B]"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  placeholder="e.g. +251 91 123 4567"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="e.g. user@bank.et"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Domicile Operating Branch</label>
                <select
                  value={editingUser.branch || (branches[0]?.name || 'Main Branch')}
                  onChange={(e) => setEditingUser({ ...editingUser, branch: e.target.value })}
                  className="input-field w-full"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Primary Business Segment</label>
                <select
                  value={editingUser.segment || (segments[0]?.name || 'Corporate Banking')}
                  onChange={(e) => {
                    const newSeg = e.target.value;
                    const prevList: string[] = Array.isArray(editingUser.segmentIds) ? editingUser.segmentIds : [];
                    const nextList = prevList.includes(newSeg) ? prevList : [...prevList, newSeg];
                    setEditingUser({ ...editingUser, segment: newSeg, segmentIds: nextList });
                  }}
                  className="input-field w-full"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder={editingUser.id ? "Leave blank to keep current password" : "Leave blank for default (password123)"}
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="input-field w-full"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Policy: min 8 chars, 1 uppercase, 1 digit, 1 special char.
                </span>
              </div>
              <div className="col-span-2">
                <label className="font-semibold text-[#5B6472] block mb-1">Authorized Business Segment(s) (Multi-Select)</label>
                <div className="flex flex-wrap gap-2 p-2 border border-[#E2E8F0] rounded bg-slate-50">
                  {segments.map((s) => {
                    const currentSegs: string[] = Array.isArray(editingUser.segmentIds) ? editingUser.segmentIds : [editingUser.segment || 'Corporate Banking'];
                    const checked = currentSegs.includes(s.name);
                    return (
                      <label key={s.id} className="flex items-center gap-1.5 text-xs text-[#00205B] cursor-pointer bg-white px-2 py-1 rounded border border-[#CBD5E1]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...currentSegs, s.name]
                              : currentSegs.filter(x => x !== s.name);
                            setEditingUser({ ...editingUser, segmentIds: next });
                          }}
                          className="rounded text-[#00205B]"
                        />
                        <span className="font-medium">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={editingUser.active !== false}
                  onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00205B] focus:ring-[#3E7AB0] cursor-pointer"
                />
                <label htmlFor="userActiveCheck" className="font-semibold text-[#101828] cursor-pointer">
                  Active Account (Login Allowed)
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowUserModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingUser.username || !editingUser.username.trim()) {
                    setModalError('Username is mandatory.');
                    return;
                  }
                  if (editingUser.password && editingUser.password.trim()) {
                    const pwd = editingUser.password.trim();
                    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd)) {
                      setModalError('Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character.');
                      return;
                    }
                  }
                  const userPayload = {
                    ...editingUser,
                    fullName: editingUser.fullName || editingUser.name || editingUser.username,
                    segmentIds: Array.isArray(editingUser.segmentIds)
                      ? editingUser.segmentIds.join(',')
                      : (editingUser.segmentIds || editingUser.segment || 'Corporate Banking'),
                  };
                  executeModalSave(() => onSaveUser(userPayload), 'User account saved successfully!', () => setShowUserModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Send Test Email Modal --- */}
      {showSendEmailModal && selectedEmailUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#00205B]" />
                <h3 className="text-base font-bold text-[#00205B]">
                  Send Email — {selectedEmailUser.name || selectedEmailUser.fullName || selectedEmailUser.username}
                </h3>
              </div>
              <button
                onClick={() => setShowSendEmailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recipient Details Card */}
            <div className="p-3 bg-[#EFF5FB] rounded-lg border border-[#DCE4EE] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5B6472] font-semibold">Recipient Name:</span>
                <span className="font-bold text-[#101828]">{selectedEmailUser.name || selectedEmailUser.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472] font-semibold">Username:</span>
                <span className="text-[#101828]">{selectedEmailUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472] font-semibold">Configured Email:</span>
                <span className={`font-mono font-bold ${selectedEmailUser.email ? 'text-blue-700' : 'text-red-600'}`}>
                  {selectedEmailUser.email || 'None Configured (Delivery Blocked)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472] font-semibold">Role / Branch:</span>
                <span className="text-[#101828]">{selectedEmailUser.role} / {selectedEmailUser.branch}</span>
              </div>
            </div>

            {/* Error or Warning Banner */}
            {(!selectedEmailUser.email || selectedEmailUser.email.trim() === '') && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Missing Email Address:</strong> This user does not have a configured email address. Please click 'Edit' to update their email before dispatching.
                </div>
              </div>
            )}

            {emailError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{emailError}</span>
              </div>
            )}

            {/* Dispatch Result Feedback */}
            {emailResult && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  emailResult.success
                    ? emailResult.isSimulator
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-green-50 border-green-200 text-green-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {emailResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    {emailResult.success
                      ? emailResult.isSimulator
                        ? 'Simulated Dispatch Completed (Simulator Mode)'
                        : 'Real Email Dispatched via Office 365 SMTP'
                      : 'Delivery Failed'}
                  </span>
                </div>
                <div className="text-[11px] space-y-0.5 pl-5">
                  <div><strong>Provider Mode:</strong> <span className="font-mono">{emailResult.provider || 'OFFICE365_SMTP'}</span></div>
                  <div><strong>Delivery Status:</strong> <span className="font-semibold">{emailResult.status}</span></div>
                  {emailResult.deliveryReference && (
                    <div><strong>Reference:</strong> <span className="font-mono">{emailResult.deliveryReference}</span></div>
                  )}
                  {emailResult.errorMessage && (
                    <div className="text-red-700"><strong>Error:</strong> {emailResult.errorMessage}</div>
                  )}
                  <div><strong>Timestamp:</strong> {emailResult.timestamp}</div>
                </div>
              </div>
            )}

            {/* Subject Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#101828]">Subject:</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject"
                className="w-full text-xs p-2.5 bg-[#EFF5FB] border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3E7AB0]"
              />
            </div>

            {/* Message Body Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#101828]">Message Body:</label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Enter email body"
                className="w-full text-xs p-2.5 bg-[#EFF5FB] border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3E7AB0] resize-y"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowSendEmailModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
                disabled={emailSending}
              >
                Close
              </button>
              <button
                onClick={async () => {
                  if (!selectedEmailUser.email || selectedEmailUser.email.trim() === '') {
                    setEmailError('User does not have a configured email address.');
                    return;
                  }
                  if (!emailSubject.trim()) {
                    setEmailError('Email subject is required.');
                    return;
                  }
                  setEmailSending(true);
                  setEmailError('');
                  setEmailResult(null);
                  try {
                    const res = await cimsApi.sendAdminTestEmail(
                      selectedEmailUser.id || selectedEmailUser.userId || selectedEmailUser.username,
                      emailSubject,
                      emailBody
                    );
                    setEmailResult(res);
                    if (res?.success) {
                      showToast(`Test email dispatched successfully (${res.provider || 'SMTP'})`);
                    } else {
                      setEmailError(res?.errorMessage || 'Email dispatch failed on provider.');
                    }
                  } catch (err: any) {
                    setEmailError(err.message || 'Failed to dispatch test email.');
                  } finally {
                    setEmailSending(false);
                  }
                }}
                disabled={emailSending || !selectedEmailUser.email}
                className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
              >
                {emailSending ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingBranch.id ? 'Edit Operating Branch' : 'Add New Operating Branch'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Branch Code *</label>
                <input
                  type="text"
                  value={editingBranch.code || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. BRN-010"
                  className="input-field w-full font-mono font-semibold"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={editingBranch.name || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  placeholder="e.g. Kazanchis Branch"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Parent District Directorate</label>
                <select
                  value={editingBranch.parentDistrictId || (districts[0]?.districtName || 'Head Office')}
                  onChange={(e) => setEditingBranch({ ...editingBranch, parentDistrictId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="Head Office">Head Office Directorate</option>
                  {Array.from(new Set(districts.map((d: any) => d.districtName))).map((dName) => {
                    const match = districts.find((d: any) => d.districtName === dName);
                    return (
                      <option key={dName} value={dName}>
                        {dName} {match?.areaOffice ? `(${match.areaOffice})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Area Office (Optional)</label>
                <input
                  type="text"
                  value={editingBranch.areaOffice || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, areaOffice: e.target.value })}
                  placeholder="e.g. Bole Sub-City Area Office"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Branch Tier / Type</label>
                <select
                  value={editingBranch.type || 'Branch'}
                  onChange={(e) => setEditingBranch({ ...editingBranch, type: e.target.value as any })}
                  className="input-field w-full"
                >
                  <option value="Branch">Standard Operating Branch</option>
                  <option value="CorporateCenter">Corporate Banking Center</option>
                  <option value="DistrictOffice">District Office Directorate</option>
                  <option value="HeadOffice">Head Office Executive Division</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Supported Business Segments</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-[#E2E8F0] rounded bg-slate-50">
                  {segments.map((seg) => {
                    const activeSegs: string[] = (() => {
                      try {
                        if (!editingBranch.segmentIds) return [];
                        if (editingBranch.segmentIds.startsWith('[')) return JSON.parse(editingBranch.segmentIds);
                        return editingBranch.segmentIds.split(',').map(s => s.trim());
                      } catch { return []; }
                    })();
                    const isSelected = activeSegs.includes(seg.id) || activeSegs.includes(seg.name);
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? activeSegs.filter(s => s !== seg.id && s !== seg.name)
                            : [...activeSegs, seg.id];
                          setEditingBranch({ ...editingBranch, segmentIds: JSON.stringify(next) });
                        }}
                        className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${isSelected
                          ? 'bg-[#00205B] text-white border-[#00205B] shadow-xs'
                          : 'bg-white text-[#5B6472] border-[#E2E8F0] hover:bg-slate-100'
                          }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{seg.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingBranch.code || !editingBranch.code.trim()) {
                    setModalError('Branch code is mandatory.');
                    return;
                  }
                  if (!editingBranch.name || !editingBranch.name.trim()) {
                    setModalError('Branch name is mandatory.');
                    return;
                  }
                  executeModalSave(() => onSaveBranch(editingBranch), 'Operating branch saved successfully!', () => setShowBranchModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Config Modal */}
      {showApprovalModal && editingApproval && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingApproval.id ? `Configure Workflow: ${editingApproval.transactionType}` : 'Add New Approval Workflow Configuration'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Transaction / Action Type *</label>
                <select
                  value={editingApproval.transactionType || 'Register Collateral'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, transactionType: e.target.value })}
                  className="input-field w-full font-bold text-[#00205B]"
                  disabled={Boolean(editingApproval.id)}
                >
                  <option value="Register Collateral">Register Collateral</option>
                  <option value="Release Collateral">Release Collateral</option>
                  <option value="Register Policy">Register Policy</option>
                  <option value="Policy Endorsement">Policy Endorsement</option>
                  <option value="Policy Cancellation / Closure">Policy Cancellation / Closure</option>
                  <option value="Valuation Update">Valuation Update</option>
                  <option value="Exception Resolution">Exception Resolution</option>
                </select>
                <p className="text-[10px] text-[#5B6472] mt-0.5">Matched dynamically against task actions (Document verification uses document status)</p>
              </div>
              {editingApproval.transactionType === 'Exception Resolution' && (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Exception Type (Action Scope)</label>
                  <select
                    value={editingApproval.exceptionType || 'All'}
                    onChange={(e) => setEditingApproval({ ...editingApproval, exceptionType: e.target.value })}
                    className="input-field w-full font-medium"
                  >
                    <option value="All">All Exception Types</option>
                    <option value="Overdue Valuation">Overdue Valuation</option>
                    <option value="Expired Insurance Policy">Expired Insurance Policy</option>
                    <option value="Missing Mandatory Document">Missing Mandatory Document</option>
                    <option value="Insufficient Insurance Coverage">Insufficient Insurance Coverage</option>
                    <option value="Under-Valued Collateral">Under-Valued Collateral</option>
                  </select>
                </div>
              )}
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Applicable Hierarchy Level</label>
                <select
                  value={editingApproval.hierarchyLevel || 'Branch'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, hierarchyLevel: e.target.value })}
                  className="input-field w-full font-semibold"
                >
                  <option value="Global">Global (All Organizational Units)</option>
                  <option value="Branch">Branch Level</option>
                  <option value="District">District Directorate Level</option>
                  <option value="HeadOffice">Head Office Executive Level</option>
                </select>
              </div>
              {editingApproval.hierarchyLevel === 'Branch' && (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Specific Branch Scope</label>
                  <select
                    value={editingApproval.branchCode || ''}
                    onChange={(e) => setEditingApproval({ ...editingApproval, branchCode: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingApproval.hierarchyLevel === 'District' && (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Specific District Scope</label>
                  <select
                    value={editingApproval.districtName || ''}
                    onChange={(e) => setEditingApproval({ ...editingApproval, districtName: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">All Districts</option>
                    {Array.from(new Set(districts.map((d: any) => d.districtName))).map((dName) => (
                      <option key={dName} value={dName}>{dName}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingApproval.hierarchyLevel === 'HeadOffice' && (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Head Office Department</label>
                  <select
                    value={editingApproval.hoDepartment || 'Credit Administration'}
                    onChange={(e) => setEditingApproval({ ...editingApproval, hoDepartment: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="Credit Administration">Credit Administration Department</option>
                    <option value="Risk Management">Risk Management Directorate</option>
                    <option value="Legal & Recovery">Legal & Recovery Directorate</option>
                    <option value="Operations">Operations Division</option>
                  </select>
                </div>
              )}
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Maker Initiator Role</label>
                <select
                  value={editingApproval.makerRole || 'Any'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, makerRole: e.target.value })}
                  className="input-field w-full font-medium"
                >
                  <option value="Any">Any Maker Role</option>
                  {ALL_ROLES.filter(r => !['SYSADMIN', 'AUDITOR', 'RDONLY'].includes(r)).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Dual-Control Stages</label>
                <select
                  value={editingApproval.approvalLevels || 1}
                  onChange={(e) => setEditingApproval({ ...editingApproval, approvalLevels: Number(e.target.value) })}
                  className="input-field w-full"
                >
                  <option value={1}>1 Stage (Level 1 Primary Checker)</option>
                  <option value={2}>2 Stages (Level 1 Checker + Level 2 Directorate Escalation)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Level 1 Candidate Checker Role *</label>
                <select
                  value={editingApproval.level1Role || 'BRMGR'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, level1Role: e.target.value })}
                  className="input-field w-full font-bold text-[#00205B]"
                >
                  {ALL_ROLES.filter(r => r !== 'SYSADMIN' && r !== 'RDONLY' && r !== 'AUDITOR').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {Number(editingApproval.approvalLevels) === 2 && (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Level 2 Escalation Checker Role *</label>
                  <select
                    value={editingApproval.level2Role || 'HODEPT'}
                    onChange={(e) => setEditingApproval({ ...editingApproval, level2Role: e.target.value })}
                    className="input-field w-full font-bold text-amber-900"
                  >
                    {ALL_ROLES.filter(r => ['HODEPT', 'DISTDIR', 'SRMGMT', 'EXEC', 'RISK', 'COMPLIANCE'].includes(r)).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">SLA Target Resolution (Hours) *</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={editingApproval.slaHours !== undefined ? editingApproval.slaHours : 24}
                  onChange={(e) => setEditingApproval({ ...editingApproval, slaHours: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bulkApprove"
                  checked={editingApproval.bulkApproveAllowed || false}
                  onChange={(e) => setEditingApproval({ ...editingApproval, bulkApproveAllowed: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="bulkApprove" className="font-semibold text-[#101828]">Allow 1-Click Dual-Control Bulk Approval</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeConfig"
                  checked={editingApproval.active !== false}
                  onChange={(e) => setEditingApproval({ ...editingApproval, active: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="activeConfig" className="font-semibold text-[#101828]">Active Workflow Routing Rule</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowApprovalModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingApproval.transactionType || !editingApproval.transactionType.trim()) {
                    setModalError('Transaction type is mandatory.');
                    return;
                  }
                  if (!editingApproval.slaHours || editingApproval.slaHours <= 0) {
                    setModalError('Approval SLA hours must be greater than zero.');
                    return;
                  }
                  executeModalSave(() => onSaveApprovalConfig(editingApproval), 'Approval workflow configuration updated!', () => setShowApprovalModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && editingReminder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingReminder.id ? `Configure Expiry Reminder (T - ${editingReminder.daysBeforeExpiry} Days)` : 'Add New Expiry Reminder Schedule'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Reminder Name *</label>
                <input
                  type="text"
                  value={editingReminder.name || ''}
                  onChange={(e) => setEditingReminder({ ...editingReminder, name: e.target.value })}
                  placeholder="e.g. 30 Working Days Pre-Expiry Notice"
                  className="input-field w-full font-bold"
                />
                <p className="mt-1 text-[10px] text-[#5B6472]">
                  Required and unique. This name is shown in the schedule listing and used when linking notification templates.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Target Audience *</label>
                  <select
                    value={editingReminder.audience || 'Staff'}
                    onChange={(e) => setEditingReminder({ ...editingReminder, audience: e.target.value as any })}
                    className="input-field w-full font-semibold"
                  >
                    <option value="Staff">Staff (Bank Officers)</option>
                    <option value="Customer">Customer (Borrower / Pledgor)</option>
                    <option value="Both">Both (Staff & Customer)</option>
                    <option value="Insurer">Insurer (Insurance Company)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Trigger Basis *</label>
                  <select
                    value={editingReminder.triggerBasis || 'Before Expiry'}
                    onChange={(e) => setEditingReminder({ ...editingReminder, triggerBasis: e.target.value as any })}
                    className="input-field w-full font-semibold"
                  >
                    <option value="Before Expiry">Before Expiry (Pre-Alert)</option>
                    <option value="After Expiry">After Expiry (Grace/Breach Alert)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Offset Count *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={editingReminder.daysBeforeExpiry ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? ('' as any) : Number(e.target.value);
                      setEditingReminder({ ...editingReminder, daysBeforeExpiry: v, offsetDays: v });
                    }}
                    className="input-field w-full font-bold text-[#00205B]"
                    disabled={Boolean(editingReminder.id)}
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Day Calculation Type *</label>
                  <select
                    value={editingReminder.dayType || 'Working Day'}
                    onChange={(e) => setEditingReminder({ ...editingReminder, dayType: e.target.value as any })}
                    className="input-field w-full"
                  >
                    <option value="Working Day">Working Day (NBE Bank Calendar)</option>
                    <option value="Calendar Day">Calendar Day</option>
                  </select>
                </div>
              </div>

              {/* Requirement 6: Recurrence Interval N and Unit Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Recurrence Interval (N) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1"
                    value={editingReminder.recurrenceInterval ?? (editingReminder.recurrence?.includes('15') ? 15 : 1)}
                    onChange={(e) => {
                      const val = e.target.value === '' ? ('' as any) : Math.max(1, parseInt(e.target.value, 10) || 1);
                      const unit = editingReminder.recurrenceUnit || (editingReminder.recurrence?.includes('Minute') ? 'MINUTES' : 'DAYS');
                      let recStr = 'One-time';
                      if (unit === 'MINUTES') {
                        recStr = `Every ${val} Minutes (For testing purposes)`;
                      } else if (unit === 'CALENDAR_DAYS') {
                        recStr = val === 1 ? 'One-time' : `Every ${val} Calendar Days`;
                      } else {
                        recStr = val === 1 ? 'One-time' : `Every ${val} Working Days`;
                      }
                      setEditingReminder({
                        ...editingReminder,
                        recurrenceInterval: val,
                        recurrence: recStr,
                      });
                    }}
                    className="input-field w-full font-bold text-[#00205B]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Recurrence Unit *</label>
                  <select
                    value={editingReminder.recurrenceUnit || (editingReminder.recurrence?.includes('Minute') ? 'MINUTES' : (editingReminder.dayType === 'Calendar Day' ? 'CALENDAR_DAYS' : 'DAYS'))}
                    onChange={(e) => {
                      const u = e.target.value;
                      const interval = editingReminder.recurrenceInterval || 1;
                      let recStr = 'One-time';
                      if (u === 'MINUTES') {
                        recStr = `Every ${interval} Minutes (For testing purposes)`;
                      } else if (u === 'CALENDAR_DAYS') {
                        recStr = interval === 1 ? 'One-time' : `Every ${interval} Calendar Days`;
                      } else {
                        recStr = interval === 1 ? 'One-time' : `Every ${interval} Working Days`;
                      }
                      setEditingReminder({
                        ...editingReminder,
                        recurrenceUnit: u,
                        recurrence: recStr,
                        dayType: u === 'CALENDAR_DAYS' ? 'Calendar Day' : (u === 'MINUTES' ? (editingReminder.dayType || 'Working Day') : 'Working Day'),
                      });
                    }}
                    className="input-field w-full font-semibold"
                  >
                    <option value="DAYS">Days (Working Days)</option>
                    <option value="CALENDAR_DAYS">Days (Calendar Days)</option>
                    <option value="MINUTES">Testing Option: Every N Minutes (For testing purposes)</option>
                  </select>
                </div>
              </div>

              {editingReminder.recurrenceUnit === 'MINUTES' && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">⚠️ Testing Option Active: </span>
                    <span>This reminder schedule evaluates and triggers every <strong>{editingReminder.recurrenceInterval || 1} minute(s)</strong> at runtime for testing notification workflows.</span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Continue Until *</label>
                <select
                  value={editingReminder.continueUntil || 'Renewed'}
                  onChange={(e) => setEditingReminder({ ...editingReminder, continueUntil: e.target.value as any })}
                  className="input-field w-full"
                >
                  <option value="Renewed">Policy Renewed</option>
                  <option value="Resolved">Exception Resolved</option>
                  <option value="Manual Termination">Manual Termination</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Notification Channels *</label>
                <div className="flex gap-2">
                  {['Email', 'SMS'].map((ch) => {
                    const current: string[] = (() => {
                      try { return JSON.parse(editingReminder.channelsJson || '[]'); } catch { return ['Email', 'SMS']; }
                    })();
                    const active = current.some(x => x.toLowerCase() === ch.toLowerCase());
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          const next = active ? current.filter(x => x.toLowerCase() !== ch.toLowerCase()) : [...current, ch];
                          setEditingReminder({ ...editingReminder, channelsJson: JSON.stringify(next) });
                        }}
                        className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all ${active ? 'bg-[#00205B] text-white border-[#00205B] shadow-sm' : 'bg-white text-[#5B6472] border-[#E2E8F0]'}`}
                      >
                        {active ? '✓ ' : '+ '}{ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              {editingReminder.audience !== 'Customer' ? (
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Target Recipient Roles *</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-1 border border-[#E2E8F0] rounded">
                    {['CRO', 'BRO', 'SRM', 'BRM', 'BRMGR', 'COLLDOCOFF', 'MGRCOLLDOC', 'DISTDIR', 'HODEPT', 'COMPLIANCE', 'RISK', 'EXEC'].map((role) => {
                      const current: string[] = (() => {
                        try { return JSON.parse(editingReminder.recipientRolesJson || '[]'); } catch { return ['CRO', 'BRMGR']; }
                      })();
                      const active = current.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            const next = active ? current.filter(x => x !== role) : [...current, role];
                            setEditingReminder({ ...editingReminder, recipientRolesJson: JSON.stringify(next) });
                          }}
                          className={`py-1 px-2.5 rounded text-xs font-semibold border transition-all ${active ? 'bg-[#00205B] text-white border-[#00205B] shadow-sm' : 'bg-slate-50 text-[#5B6472] border-[#E2E8F0]'}`}
                        >
                          {active ? '✓ ' : '+ '}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs">
                  <p className="font-semibold">Customer Notification Routing</p>
                  <p className="text-[11px] text-amber-800">Alerts will be automatically dispatched to the customer primary mobile number (SMS) and registered corporate email from the customer master profile.</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeRem"
                  checked={editingReminder.active !== false}
                  onChange={(e) => setEditingReminder({ ...editingReminder, active: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="activeRem" className="font-semibold text-[#101828]">Enable Automated Alert Dispatch Engine</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowReminderModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingReminder.name || !editingReminder.name.trim()) {
                    setModalError('Reminder name is mandatory.');
                    return;
                  }
                  if (!editingReminder.daysBeforeExpiry || editingReminder.daysBeforeExpiry <= 0) {
                    setModalError('Working days before expiry must be greater than zero.');
                    return;
                  }
                  if (editingReminder.recurrenceInterval !== undefined && (!Number.isInteger(Number(editingReminder.recurrenceInterval)) || Number(editingReminder.recurrenceInterval) <= 0)) {
                    setModalError('Recurrence interval (N) must be a positive integer greater than zero.');
                    return;
                  }
                  executeModalSave(() => onSaveReminderSchedule(editingReminder), 'Reminder schedule updated successfully!', () => setShowReminderModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insurer Modal */}
      {showInsurerModal && editingInsurer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingInsurer.id ? 'Edit Approved Underwriter' : 'Add NBE Approved Insurer'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Insurance Company Name *</label>
                <input
                  type="text"
                  value={editingInsurer.name || ''}
                  onChange={(e) => setEditingInsurer({ ...editingInsurer, name: e.target.value })}
                  placeholder="e.g. Ethiopian Insurance Corporation, Nyala Insurance S.C."
                  className="input-field w-full font-bold text-[#00205B]"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeIns"
                  checked={editingInsurer.active !== false}
                  onChange={(e) => setEditingInsurer({ ...editingInsurer, active: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="activeIns" className="font-semibold text-[#101828]">NBE Approved Underwriter (Active for Pledging)</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowInsurerModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingInsurer.name || !editingInsurer.name.trim()) {
                    setModalError('Insurer company name is mandatory.');
                    return;
                  }
                  executeModalSave(() => onSaveInsurer(editingInsurer), 'Approved insurer saved successfully!', () => setShowInsurerModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Insurer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Taxonomy Modal */}
      {showTaxonomyModal && editingTaxonomy && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingTaxonomy.id ? 'Edit Collateral Asset Taxonomy Rule' : 'Add New Collateral Taxonomy Rule'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Asset Category *</label>
                <select
                  value={editingTaxonomy.category || 'Immovable Properties'}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, category: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  <option value="Immovable Properties">Immovable Properties</option>
                  <option value="Movable Properties">Movable Properties</option>
                  <option value="Business Mortgages">Business Mortgages</option>
                  <option value="Financial Assets">Financial Assets</option>
                  <option value="Guarantees">Guarantees</option>
                  <option value="Agricultural/Other">Agricultural/Other</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Collateral Type / Sub-Type *</label>
                <input
                  type="text"
                  value={editingTaxonomy.subCategory || ''}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, subCategory: e.target.value, subType: e.target.value })}
                  placeholder="e.g. Commercial Building, Heavy Commercial Truck, Marketable Shares"
                  className="input-field w-full font-semibold"
                />
                <p className="text-[10px] text-[#5B6472] mt-0.5">Asset classification without hardcoding hair-cut formulas</p>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Mandatory Insurance Coverage Type</label>
                <input
                  type="text"
                  value={editingTaxonomy.mandatoryCoverageType || ''}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, mandatoryCoverageType: e.target.value })}
                  placeholder="e.g. Fire & Lightning, Comprehensive Motor, All Risks"
                  className="input-field w-full font-semibold text-[#00205B]"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taxMandatory"
                  checked={editingTaxonomy.insuranceMandatory !== false}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, insuranceMandatory: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="taxMandatory" className="font-semibold text-[#101828]">Insurance Coverage is Strictly Mandatory for Pledging</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxActive"
                  checked={editingTaxonomy.active !== false}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, active: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="taxActive" className="font-semibold text-[#101828]">Active Asset Classification for Collateral Intake</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowTaxonomyModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingTaxonomy.category || !editingTaxonomy.category.trim()) {
                    setModalError('Category is mandatory.');
                    return;
                  }
                  if (!editingTaxonomy.subCategory || !editingTaxonomy.subCategory.trim()) {
                    setModalError('Sub-category is mandatory.');
                    return;
                  }
                  executeModalSave(() => onSaveTaxonomy(editingTaxonomy), 'Taxonomy rule saved successfully!', () => setShowTaxonomyModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Taxonomy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Rule Modal */}
      {showDocRuleModal && editingDocRule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingDocRule.id ? 'Edit Mandatory Document Rule' : 'Add Mandatory Document Rule'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Collateral Category *</label>
                <select
                  value={
                    editingDocRule.collateralCategory === 'All'
                      ? 'All Categories'
                      : editingDocRule.collateralCategory || 'All Categories'
                  }
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, collateralCategory: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  <option value="All Categories">All Categories (Applies to Any Collateral)</option>
                  <option value="Immovable Properties">Immovable Properties</option>
                  <option value="Movable Properties">Movable Properties</option>
                  <option value="Business Mortgages">Business Mortgages</option>
                  <option value="Financial Assets">Financial Assets</option>
                  <option value="Guarantees">Guarantees</option>
                  <option value="Agricultural/Other">Agricultural/Other</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Business Segment *</label>
                <select
                  value={editingDocRule.segment || 'All Segments'}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, segment: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  <option value="All Segments">All Segments</option>
                  {segments.filter((s) => s.active !== false).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[#5B6472]">
                  All Segments applies everywhere. A specific segment takes precedence for that segment; duplicate document types are only required once.
                </p>
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Collateral Sub-Type / Scope (Optional)</label>
                <input
                  type="text"
                  value={editingDocRule.collateralType || ''}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, collateralType: e.target.value })}
                  placeholder="e.g. Building, Commercial Vehicle, Machinery (or leave blank for Any)"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Required Document Type *</label>
                <input
                  type="text"
                  value={editingDocRule.documentType || ''}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, documentType: e.target.value })}
                  placeholder="e.g. Title Deed / Ownership Certificate, Vehicle Logbook, Valuation Report"
                  className="input-field w-full font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Ownership Condition</label>
                  <select
                    value={editingDocRule.ownershipCondition || 'Any'}
                    onChange={(e) => setEditingDocRule({ ...editingDocRule, ownershipCondition: e.target.value })}
                    className="input-field w-full font-medium"
                  >
                    <option value="Any">Any Ownership</option>
                    <option value="Borrower-Owned">Borrower-Owned</option>
                    <option value="Third-Party-Owned">Third-Party-Owned</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Applicability Condition</label>
                  <select
                    value={editingDocRule.applicabilityCondition || 'Standard'}
                    onChange={(e) => setEditingDocRule({ ...editingDocRule, applicabilityCondition: e.target.value })}
                    className="input-field w-full font-medium"
                  >
                    <option value="Standard">Standard Asset</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Leased">Leased Asset</option>
                    <option value="Imported">Imported / Transit Asset</option>
                    <option value="All">All Conditions</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="docMandatory"
                  checked={editingDocRule.mandatory !== false}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, mandatory: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="docMandatory" className="font-semibold text-[#101828]">Mandatory Gatekeeper for Collateral Release & Verification</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="docRuleActive"
                  checked={editingDocRule.active !== false}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, active: e.target.checked })}
                  className="w-4 h-4 text-[#00205B] rounded border-[#E2E8F0]"
                />
                <label htmlFor="docRuleActive" className="font-semibold text-[#101828]">Active Compliance Validation Rule</label>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#E2E8F0]">
              <div>
                {editingDocRule.id && onDeleteMandatoryDocRule && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to delete mandatory document rule "${editingDocRule.documentType}"?`)) {
                        try {
                          await onDeleteMandatoryDocRule(editingDocRule.id!);
                          setShowDocRuleModal(false);
                          showToast(`Document rule "${editingDocRule.documentType}" deleted successfully.`);
                        } catch (e: any) {
                          setModalError(e?.message || 'Failed to delete document rule.');
                        }
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Rule
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDocRuleModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!editingDocRule.documentType || !editingDocRule.documentType.trim()) {
                      setModalError('Required document type is mandatory.');
                      return;
                    }
                    executeModalSave(() => onSaveMandatoryDocRule(editingDocRule), 'Mandatory document rule saved successfully!', () => setShowDocRuleModal(false));
                  }}
                  disabled={modalSaving}
                  className="btn-primary text-xs"
                >
                  {modalSaving ? 'Saving...' : 'Save Document Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parameter Modal */}
      {showParamModal && editingParam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              Configure Parameter: <span className="font-mono text-[#00205B]">{editingParam.paramKey}</span>
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            {(() => {
              const paramKey = (editingParam.paramKey || '').toLowerCase();
              const paramType = (editingParam.paramType || '').toLowerCase();
              const isPct = paramType === 'percentage' || paramKey.includes('pct') || paramKey.includes('threshold') || paramKey.includes('rate');
              const isBool = paramType === 'boolean' || paramKey.includes('enabled') || paramKey.includes('strict') || paramKey.includes('require') || ['true', 'false'].includes((editingParam.paramValue || '').toLowerCase());
              const isDaysOrHours = paramType.includes('days') || paramType === 'duration' || paramType === 'numeric' || paramKey.includes('period') || paramKey.includes('frequency') || paramKey.includes('interval') || paramKey.includes('timelines') || paramKey.includes('days') || paramKey.includes('hours');

              return (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-[#5B6472] block mb-1">
                      Parameter Value * {isPct && <span className="text-blue-600 font-bold">(Percentage: 0 - 100%)</span>}
                      {isDaysOrHours && <span className="text-amber-700 font-bold">({editingParam.paramType || 'Numeric/Days/Hours'})</span>}
                      {isBool && <span className="text-emerald-700 font-bold">(Boolean: true / false)</span>}
                    </label>
                    {isBool ? (
                      <select
                        value={(editingParam.paramValue || 'true').toLowerCase()}
                        onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                        className="input-field w-full font-bold text-[#00205B]"
                      >
                        <option value="true">true (Active / Enabled)</option>
                        <option value="false">false (Inactive / Disabled)</option>
                      </select>
                    ) : isPct ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editingParam.paramValue || ''}
                          onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                          className="input-field w-full pr-8 font-bold text-[#00205B]"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-2 text-[#5B6472] font-bold">%</span>
                      </div>
                    ) : isDaysOrHours ? (
                      <input
                        type="text"
                        value={editingParam.paramValue || ''}
                        onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                        placeholder="e.g. 30"
                        className="input-field w-full font-bold text-[#00205B]"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editingParam.paramValue || ''}
                        onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                        className="input-field w-full font-bold text-[#00205B]"
                      />
                    )}
                  </div>
                  <div>
                    <label className="font-semibold text-[#5B6472] block mb-1">Description</label>
                    <textarea
                      value={editingParam.description || ''}
                      onChange={(e) => setEditingParam({ ...editingParam, description: e.target.value })}
                      rows={2}
                      className="input-field w-full text-[#5B6472]"
                    />
                  </div>
                  {editingParam.paramKey && usageMap[editingParam.paramKey] && (
                    <div className="p-2.5 bg-sky-50 border border-sky-200 text-sky-900 rounded text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1 text-[#00205B]">
                        <Info className="w-3.5 h-3.5" />
                        <span>Real Runtime System Impact</span>
                      </div>
                      <p className="text-[11px] text-sky-800 leading-relaxed">
                        {usageMap[editingParam.paramKey]}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowParamModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingParam.paramValue || !editingParam.paramValue.trim()) {
                    setModalError('Parameter value cannot be empty.');
                    return;
                  }
                  const key = (editingParam.paramKey || '').toLowerCase();
                  const pType = (editingParam.paramType || '').toLowerCase();
                  if (pType === 'percentage' || key.includes('pct') || key.includes('threshold') || key.includes('rate')) {
                    const val = Number(editingParam.paramValue);
                    if (isNaN(val) || val < 0 || val > 100) {
                      setModalError('Percentage parameter must be a valid number between 0% and 100%.');
                      return;
                    }
                  }
                  if (pType === 'numeric' || pType === 'duration' || (pType.includes('days') && !editingParam.paramValue.includes(','))) {
                    const val = Number(editingParam.paramValue);
                    if (isNaN(val) || val < 0) {
                      setModalError('Numeric / duration parameter must be a non-negative number.');
                      return;
                    }
                  }
                  executeModalSave(() => onSaveParameter(editingParam), 'System parameter updated and cache refreshed immediately!', () => setShowParamModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Parameter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {showHolidayModal && editingHoliday && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#00205B]">
              {editingHoliday.id ? 'Edit Bank Holiday' : 'Add Bank Holiday to Business Calendar'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Holiday Date (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  value={editingHoliday.holidayDate || ''}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, holidayDate: e.target.value })}
                  className="input-field w-full font-mono font-bold text-[#00205B]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Official Name / Description *</label>
                <input
                  type="text"
                  value={editingHoliday.description || ''}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, description: e.target.value })}
                  placeholder="e.g. Meskel (Finding of the True Cross), Id Al Fitr"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowHolidayModal(false)} className="btn-secondary text-xs" disabled={modalSaving}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingHoliday.holidayDate || !editingHoliday.holidayDate.trim()) {
                    setModalError('Holiday date is mandatory.');
                    return;
                  }
                  if (!editingHoliday.description || !editingHoliday.description.trim()) {
                    setModalError('Holiday description is mandatory.');
                    return;
                  }
                  executeModalSave(() => onSaveHoliday(editingHoliday), 'Bank holiday saved to business calendar!', () => setShowHolidayModal(false));
                }}
                disabled={modalSaving}
                className="btn-primary text-xs"
              >
                {modalSaving ? 'Saving...' : 'Save Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coverage Rule Modal (BR-18) */}
      {showCoverageRuleModal && editingCoverageRule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#00205B] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00205B]" />
                {editingCoverageRule.id ? 'Edit Insurance Coverage Rule (BR-18)' : 'Add Insurance Coverage Rule (BR-18)'}
              </h3>
              <button
                onClick={() => setShowCoverageRuleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Rule Code *</label>
                  <input
                    type="text"
                    value={editingCoverageRule.ruleCode || ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, ruleCode: e.target.value })}
                    className="input-field w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Collateral Type *</label>
                  <input
                    type="text"
                    placeholder="e.g. Buildings, Vehicles, Machinery"
                    value={editingCoverageRule.collateralType || ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, collateralType: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Customer / Business Segment</label>
                  <select
                    value={editingCoverageRule.customerSegment || 'ALL'}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, customerSegment: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="ALL">ALL — Universal Application</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Required Coverage Percentage (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    placeholder="e.g. 100"
                    value={editingCoverageRule.requiredCoveragePct ?? ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, requiredCoveragePct: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                    className="input-field w-full font-bold"
                  />
                  <span className="text-[10px] text-amber-700 italic">Per Credit Policy (e.g. 100% of structure value)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Over-Insurance Tolerance (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 20"
                    value={editingCoverageRule.overInsuranceTolerancePct ?? ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, overInsuranceTolerancePct: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                    className="input-field w-full"
                  />
                  <span className="text-[10px] text-[#5B6472]">Informational threshold; non-blocking</span>
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Approval Status</label>
                  <select
                    value={editingCoverageRule.approvalStatus || 'Approved'}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, approvalStatus: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="Approved">Approved (Credit Policy Committee)</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Under Review">Under Review</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Effective From (Date)</label>
                  <input
                    type="date"
                    value={editingCoverageRule.effectiveFrom || ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, effectiveFrom: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Effective To (Date - Optional)</label>
                  <input
                    type="date"
                    value={editingCoverageRule.effectiveTo || ''}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, effectiveTo: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#5B6472] block mb-1">Description / Credit Policy Reference</label>
                <textarea
                  rows={2}
                  value={editingCoverageRule.description || ''}
                  onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, description: e.target.value })}
                  placeholder="e.g. Dashen Bank Credit Policy Section 4.2 - Standard commercial building coverage"
                  className="input-field w-full"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCoverageRule.active !== false}
                    onChange={(e) => setEditingCoverageRule({ ...editingCoverageRule, active: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-[#00205B]">Active Rule in Insurance Adequacy Engine</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowCoverageRuleModal(false)}
                className="btn-secondary text-xs"
                disabled={coverageRuleSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoverageRule}
                disabled={coverageRuleSaving}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {coverageRuleSaving ? 'Saving Rule…' : 'Save Coverage Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
