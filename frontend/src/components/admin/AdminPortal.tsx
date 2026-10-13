import React, { useState } from 'react';
import {
  Settings,
  Users,
  Building2,
  GitMerge,
  UserCheck,
  Clock,
  Bell,
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
  onSaveHoliday: (holiday: Partial<HolidayCalendar>) => Promise<void>;
  onDeleteHoliday?: (id: string) => Promise<void>;
}

const ALL_ROLES = [
  'EXEC', 'SYSADMIN', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR',
  'SRM', 'BRM', 'CRO', 'BRO', 'MGRCOLLDOC', 'COLLDOCOFF',
  'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  segments,
  branches,
  permissions,
  approvalConfigs,
  reminderSchedules,
  scheduledReports,
  insurers,
  taxonomies,
  mandatoryDocRules,
  holidayCalendars,
  systemParameters,
  allUsers,
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
  onSaveHoliday,
  onDeleteHoliday,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'runtime'
    | 'segments'
    | 'users'
    | 'permissions'
    | 'branches'
    | 'approval-configs'
    | 'reminders'
    | 'insurers'
    | 'taxonomy'
    | 'doc-rules'
    | 'parameters'
    | 'holidays'
    | 'templates'
  >('overview');

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
  const [usageMap, setUsageMap] = useState<Record<string,string>>({});
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
          <h1 className="text-xl font-extrabold text-[#102E4A] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#1F4E7A]" />
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
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'overview' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          ⚡ Control Center
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'runtime' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          Runtime Configuration
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'segments' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          1. Business Segments ({segments.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'users' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          2. Users ({allUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'permissions' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          3. Role Permissions Matrix ({localPermissions.length})
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'branches' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          4. Branch Hierarchy ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab('approval-configs')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'approval-configs' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          5. Approval Workflows ({approvalConfigs.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'reminders' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          6. Reminder Schedules ({reminderSchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('insurers')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'insurers' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          7. Approved Insurers ({insurers.length})
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'taxonomy' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          8. Collateral Taxonomy ({taxonomies.length})
        </button>
        <button
          onClick={() => setActiveTab('doc-rules')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'doc-rules' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          9. Document Rules ({mandatoryDocRules.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'templates' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          Notification Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'parameters' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          10. System Parameters ({systemParameters.length})
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'holidays' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          11. Holiday Calendar ({holidayCalendars.length})
        </button>
      </div>

      {/* --- Tab 0: Overview / Governance Control Center --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={handleRunRemindersNow} disabled={runningReminders} className="px-3 py-2 rounded-lg bg-[#102E4A] text-white text-xs font-bold disabled:opacity-50">{runningReminders ? 'Running reminders…' : 'Run reminders now'}</button>
            <button onClick={handleRunEscalations} disabled={runningEscalations} className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold disabled:opacity-50">{runningEscalations ? 'Escalating…' : 'Run renewal escalations'}</button>
            <button onClick={handleScanExceptions} disabled={scanningExceptions} className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold disabled:opacity-50">{scanningExceptions ? 'Scanning…' : 'Scan exceptions now'}</button>
          </div>
          {/* Health & Diagnostic Banner */}
          <div className={`p-5 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            healthData?.status === 'HEALTHY' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  healthData?.status === 'HEALTHY' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
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
                className="px-4 py-2 bg-[#102E4A] hover:bg-[#173F63] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
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
                  <Sliders className="w-4 h-4 text-[#1F4E7A]" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{systemParameters.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Live runtime thresholds & rules</p>
              </div>
              <button onClick={() => setActiveTab('parameters')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Parameters →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Approved Insurers</span>
                  <Shield className="w-4 h-4 text-blue-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{insurers.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Underwriters & concentration caps</p>
              </div>
              <button onClick={() => setActiveTab('insurers')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Manage Insurers →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Approval Workflows</span>
                  <GitMerge className="w-4 h-4 text-purple-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{approvalConfigs.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Maker-Checker SLA hierarchies</p>
              </div>
              <button onClick={() => setActiveTab('approval-configs')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Workflows →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Reminder Schedules</span>
                  <Bell className="w-4 h-4 text-amber-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{reminderSchedules.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Working-day pre-expiry alerts</p>
              </div>
              <button onClick={() => setActiveTab('reminders')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Reminders →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Taxonomies & Haircuts</span>
                  <FileText className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{taxonomies.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Asset categories & valuation rules</p>
              </div>
              <button onClick={() => setActiveTab('taxonomy')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Taxonomy →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Holiday Calendar</span>
                  <Calendar className="w-4 h-4 text-rose-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{holidayCalendars.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Bank holidays & working days</p>
              </div>
              <button onClick={() => setActiveTab('holidays')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Holidays →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Mandatory Doc Rules</span>
                  <FileCheck className="w-4 h-4 text-indigo-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{mandatoryDocRules.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Required compliance documents</p>
              </div>
              <button onClick={() => setActiveTab('doc-rules')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
                Configure Rules →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6472] uppercase">Users & RBAC</span>
                  <Users className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-2xl font-black text-[#102E4A] mt-2">{allUsers.length}</div>
                <p className="text-[11px] text-[#5B6472] mt-1">Bank personnel & matrix permissions</p>
              </div>
              <button onClick={() => setActiveTab('users')} className="mt-3 text-xs font-bold text-[#1F4E7A] hover:underline text-left">
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
              <h3 className="text-sm font-bold text-[#102E4A]">Effective Runtime Configuration</h3>
              <p className="text-xs text-[#5B6472] mt-1">These are the values currently consumed by the backend business services, not merely values stored in Admin.</p>
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
                <div className="text-xl font-black text-[#102E4A] mt-2">{value}</div>
                <div className="text-[11px] text-[#5B6472] mt-1">{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="cims-card p-5">
              <h4 className="font-bold text-sm text-[#102E4A]">Business-Day Calculator</h4>
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
              <h4 className="font-bold text-sm text-[#102E4A]">Configuration Health</h4>
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
            <div><h3 className="text-sm font-bold text-[#102E4A]">Notification Templates</h3><p className="text-xs text-[#5B6472]">Templates are validated and consumed when CIMS generates notifications.</p></div>
            <button onClick={() => setTemplateDraft({ id: '', name: '', type: 'Email', channel: 'Email', triggerDaysBefore: 30, subject: '', body: '', active: true })} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New Template</button>
          </div>
          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs"><thead className="bg-[#EFF5FB] border-b border-[#E2E8F0]"><tr><th className="p-3">Name</th><th className="p-3">Channel</th><th className="p-3">Trigger</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">{templates.map(t => <tr key={t.id} className="hover:bg-[#EFF5FB]"><td className="p-3 font-semibold">{t.name}</td><td className="p-3">{t.type || t.channel}</td><td className="p-3">{t.triggerDaysBefore || 0} working days</td><td className="p-3"><StatusChip label={t.active === false ? 'Inactive' : 'Active'} /></td><td className="p-3 text-right"><button onClick={() => setTemplateDraft(t)} className="text-[#1F4E7A] font-semibold hover:underline">Edit</button></td></tr>)}</tbody></table>
          </div>
          {templateDraft && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold text-[#102E4A]">{templateDraft.id ? 'Edit' : 'Create'} Notification Template</h3>
                    <p className="text-xs text-[#5B6472]">Production templates are strictly validated and dispatched by the automated notification engine.</p>
                  </div>
                  <button onClick={() => { setTemplateDraft(null); setModalError(null); }}><X className="w-5 h-5 text-[#5B6472] hover:text-[#102E4A]" /></button>
                </div>

                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Template Name *</label>
                    <input className="input-field w-full" placeholder="e.g. Policy Expiry 30-Day Reminder" value={templateDraft.name} onChange={e => setTemplateDraft({...templateDraft, name:e.target.value})}/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Event Type *</label>
                    <select
                      className="input-field w-full font-semibold text-[#102E4A]"
                      value={templateDraft.eventType || 'Expiry Reminder'}
                      onChange={e => setTemplateDraft({...templateDraft, eventType: e.target.value})}
                    >
                      <option value="Expiry Reminder">Expiry Reminder</option>
                      <option value="Expired Policy">Expired Policy</option>
                      <option value="Renewal Requirement">Renewal Requirement</option>
                      <option value="Approval Request">Approval Request</option>
                      <option value="Rejected Policy">Rejected Policy</option>
                      <option value="Missing Documentation">Missing Documentation</option>
                      <option value="Compliance Exception">Compliance Exception</option>
                      <option value="Policy Cancellation">Policy Cancellation</option>
                      <option value="Policy Endorsement">Policy Endorsement</option>
                      <option value="System Alert">System Alert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Channel *</label>
                    <select className="input-field w-full" value={templateDraft.channel || templateDraft.type || 'Email'} onChange={e => setTemplateDraft({...templateDraft, type:e.target.value, channel:e.target.value as any})}>
                      <option value="Email">Email</option>
                      <option value="SMS">SMS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Trigger (Working Days Before Expiry)</label>
                    <input className="input-field w-full" type="number" min="0" placeholder="e.g. 30" value={templateDraft.triggerDaysBefore ?? 0} onChange={e => setTemplateDraft({...templateDraft, triggerDaysBefore:Number(e.target.value)})}/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">
                      Email Subject {(templateDraft.channel || templateDraft.type) === 'Email' ? <span className="text-red-600">* (Mandatory for Email)</span> : <span className="text-slate-400 font-normal">(Optional for SMS)</span>}
                    </label>
                    <input
                      className="input-field w-full"
                      placeholder="e.g. Action Required: Insurance Expiry for {PolicyNumber}"
                      value={templateDraft.subject || ''}
                      onChange={e => setTemplateDraft({...templateDraft, subject:e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-[#5B6472]">Message Body * (Click placeholder token to insert)</label>
                    <span className="text-[10px] text-[#5B6472]">Standardized tokens supported by backend dispatcher</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    {[
                      '{CustomerName}',
                      '{LoanAccountNumber}',
                      '{CollateralID}',
                      '{PolicyNumber}',
                      '{ExpiryDate}',
                      '{RMName}',
                      '{RMPhone}',
                      '{DaysOverdue}',
                      '{InsurerName}',
                      '{Amount}',
                      '{MakerID}',
                      '{Branch}',
                      '{DaysRemaining}'
                    ].map(ph => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => setTemplateDraft({ ...templateDraft, body: (templateDraft.body || '') + ph })}
                        className="px-2 py-0.5 text-[11px] font-mono bg-white border border-[#CBD5E1] rounded hover:border-[#1F4E7A] hover:bg-[#EFF5FB] text-[#1F4E7A] transition-colors"
                        title={`Insert ${ph}`}
                      >
                        + {ph}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    className="input-field w-full font-mono text-xs" 
                    rows={6} 
                    placeholder="Dear {CustomerName},\n\nPlease be advised that policy {PolicyNumber} covering collateral {CollateralID} (Loan Ref: {LoanAccountNumber}) will expire in {DaysRemaining} days on {ExpiryDate}. Please contact your Relationship Manager {RMName} ({RMPhone})..." 
                    value={templateDraft.body} 
                    onChange={e => setTemplateDraft({...templateDraft, body:e.target.value})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs flex items-center gap-2 cursor-pointer font-medium text-[#102E4A]">
                    <input type="checkbox" checked={templateDraft.active !== false} onChange={e => setTemplateDraft({...templateDraft, active:e.target.checked})}/> 
                    Template Active (Participates in automated schedule dispatch)
                  </label>
                  <button 
                    type="button"
                    onClick={async () => {
                      setModalError(null);
                      try {
                        const r = await cimsApi.previewNotificationTemplate(templateDraft.body, {
                          CustomerName: 'Commercial Borrower Corp',
                          LoanAccountNumber: 'LN-2026-9901',
                          PolicyNumber: 'POL-2026-8819',
                          CollateralID: 'COL-MORT-402',
                          ExpiryDate: '2026-10-31',
                          RMName: 'Alemayehu Tadesse',
                          RMPhone: '+251 91 123 4567',
                          DaysOverdue: 0,
                          DaysRemaining: 30,
                          InsurerName: 'Ethiopian Insurance Corporation',
                          Amount: 12500000,
                          MakerID: 'LOAN_OFFICER_1',
                          Branch: 'Main Corporate Branch'
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
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs whitespace-pre-wrap max-h-36 overflow-auto font-mono text-[#334155]">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Generated Output Preview</div>
                    {templatePreview}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                  <button onClick={() => { setTemplateDraft(null); setModalError(null); }} className="btn-secondary text-xs">Cancel</button>
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
                      executeModalSave(
                        async () => {
                          await cimsApi.saveNotificationTemplate(templateDraft, currentUser.userId);
                          setTemplatePreview('');
                          await loadRuntimeData();
                        },
                        'Notification template saved and validated against runtime schema!',
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
          )}
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-semibold text-[#102E4A]">{seg.name}</td>
                    <td className="p-3 text-[#5B6472]">{seg.description}</td>
                    <td className="p-3"><StatusChip label={seg.riskProfile || 'Medium'} /></td>
                    <td className="p-3"><StatusChip label={seg.active ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingSegment(seg);
                          setShowSegmentModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-semibold text-[#102E4A]">{u.username}</td>
                    <td className="p-3">{u.name || u.fullName}</td>
                    <td className="p-3 font-bold text-[#1F4E7A]">{u.role}</td>
                    <td className="p-3">{u.branch}</td>
                    <td className="p-3">{u.segment}</td>
                    <td className="p-3"><StatusChip label={u.active !== false ? 'Active' : 'Locked'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setShowUserModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
                      >
                        Edit
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
                  className="input-field text-xs py-1 px-2 font-semibold text-[#102E4A]"
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
                        className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
                      />
                    </td>

                    {/* Create Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canCreate}
                        onChange={() => handleTogglePerm(p.id, 'canCreate')}
                        className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
                      />
                    </td>

                    {/* Edit Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canEdit}
                        onChange={() => handleTogglePerm(p.id, 'canEdit')}
                        className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0] focus:ring-[#3E7AB0] cursor-pointer"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-semibold text-[#102E4A]">{b.code}</td>
                    <td className="p-3">{b.name}</td>
                    <td className="p-3 font-medium text-[#1F4E7A]">{b.type}</td>
                    <td className="p-3">{b.parentDistrictId || 'Head Office'}</td>
                    <td className="p-3"><StatusChip label={b.active !== false ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setShowBranchModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-semibold text-[#102E4A]">
                      <div>{cfg.transactionType}</div>
                      {cfg.exceptionType && cfg.exceptionType !== 'All' && (
                        <div className="text-[10px] text-amber-700 font-medium">{cfg.exceptionType}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-[#1F4E7A]">{cfg.hierarchyLevel || 'Branch'}</span>
                      {(cfg.branchCode || cfg.districtName || cfg.hoDepartment) && (
                        <div className="text-[10px] text-[#5B6472]">{cfg.branchCode || cfg.districtName || cfg.hoDepartment}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{cfg.makerRole || 'Any'}</td>
                    <td className="p-3">{cfg.approvalLevels} Stage(s)</td>
                    <td className="p-3 font-bold text-[#1F4E7A]">{cfg.level1Role}</td>
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
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
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
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${r.audience === 'Customer' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                        {r.audience || 'Staff'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-[#102E4A] tabular-nums">
                      {r.triggerBasis === 'After Expiry' ? `T + ${r.daysBeforeExpiry}` : `T - ${r.daysBeforeExpiry}`} Days ({r.dayType || 'Working Day'})
                    </td>
                    <td className="p-3">
                      <div>{r.recurrence || 'One-time'}</div>
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
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-mono text-[#1F4E7A]">{ins.id}</td>
                    <td className="p-3 font-bold text-[#102E4A]">{ins.name}</td>
                    <td className="p-3"><StatusChip label={ins.active ? 'Approved' : 'Suspended'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingInsurer(ins);
                          setShowInsurerModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-bold text-[#102E4A]">{tax.category}</td>
                    <td className="p-3">{tax.subCategory}</td>
                    <td className="p-3">
                      <StatusChip label={tax.insuranceMandatory ? 'Mandatory' : 'Optional'} />
                    </td>
                    <td className="p-3 font-semibold text-[#1F4E7A]">{tax.mandatoryCoverageType}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingTaxonomy(tax);
                          setShowTaxonomyModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
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
            <button
              onClick={() => {
                setModalError(null);
                setEditingDocRule({ collateralCategory: 'Immovable Properties', documentType: '', mandatory: true });
                setShowDocRuleModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Document Rule
            </button>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                <tr>
                  <th className="p-3">Collateral Category</th>
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
                    <td className="p-3 font-bold text-[#102E4A]">{rule.collateralCategory}</td>
                    <td className="p-3 font-medium text-[#1F4E7A]">{rule.collateralType || 'All Sub-Types'}</td>
                    <td className="p-3 font-semibold">{rule.documentType}</td>
                    <td className="p-3">{rule.ownershipCondition || 'Any'}</td>
                    <td className="p-3">{rule.applicabilityCondition || 'Standard'}</td>
                    <td className="p-3">
                      <StatusChip label={rule.mandatory ? 'Mandatory' : 'Recommended'} />
                    </td>
                    <td className="p-3">
                      <StatusChip label={rule.active !== false ? 'Active' : 'Disabled'} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingDocRule(rule);
                          setShowDocRuleModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
                      >
                        Edit
                      </button>
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
              <p className="text-xs text-[#5B6472]">Values are validated by the backend and immediately loaded into the runtime configuration service.</p>
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

          <div className="cims-card overflow-hidden">
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
                      <td className="p-3 font-mono font-bold text-[#102E4A]">{param.paramKey}</td>
                      <td className="p-3 font-semibold text-emerald-800">{param.paramValue}</td>
                      <td className="p-3"><StatusChip label={['min_coverage_adequacy_pct','max_insurer_concentration_pct','policy_expiry_grace_period_days','dual_control_strict_mode','default_currency','cbs_sync_mode','cbs_sync_interval_minutes'].includes(param.paramKey) ? 'Runtime' : 'Configured'} /></td>
                      <td className="p-3 text-[#5B6472]">{param.description}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setEditingParam(param);
                            setShowParamModal(true);
                          }}
                          className="text-[#1F4E7A] hover:underline font-semibold"
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

          <div className="cims-card overflow-hidden">
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
                    <td className="p-3 font-mono font-bold text-[#102E4A]">{h.holidayDate}</td>
                    <td className="p-3 font-semibold">{h.description}</td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setEditingHoliday(h);
                          setShowHolidayModal(true);
                        }}
                        className="text-[#1F4E7A] hover:underline font-semibold"
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

      {/* ========================================================================= */}
      {/* MODALS FOR ADMIN CRUD OPERATIONS (PRODUCTION-GRADE GOVERNANCE) */}
      {/* ========================================================================= */}

      {/* Segment Modal */}
      {showSegmentModal && editingSegment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  className="input-field w-full font-bold text-[#1F4E7A]"
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
                <label className="font-semibold text-[#5B6472] block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep password123"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div className="col-span-2">
                <label className="font-semibold text-[#5B6472] block mb-1">Authorized Business Segment(s) (Multi-Select)</label>
                <div className="flex flex-wrap gap-2 p-2 border border-[#E2E8F0] rounded bg-slate-50">
                  {segments.map((s) => {
                    const currentSegs: string[] = Array.isArray(editingUser.segmentIds) ? editingUser.segmentIds : [editingUser.segment || 'Corporate Banking'];
                    const checked = currentSegs.includes(s.name);
                    return (
                      <label key={s.id} className="flex items-center gap-1.5 text-xs text-[#102E4A] cursor-pointer bg-white px-2 py-1 rounded border border-[#CBD5E1]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...currentSegs, s.name]
                              : currentSegs.filter(x => x !== s.name);
                            setEditingUser({ ...editingUser, segmentIds: next });
                          }}
                          className="rounded text-[#1F4E7A]"
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
                  className="w-4 h-4 rounded text-[#102E4A] focus:ring-[#3E7AB0] cursor-pointer"
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
                  executeModalSave(() => onSaveUser(editingUser), 'User account saved successfully!', () => setShowUserModal(false));
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

      {/* Branch Modal */}
      {showBranchModal && editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                        className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-[#102E4A] text-white border-[#102E4A] shadow-xs'
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  className="input-field w-full font-bold text-[#102E4A]"
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
                  className="input-field w-full font-bold text-[#1F4E7A]"
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
                  value={editingApproval.slaHours || 24}
                  onChange={(e) => setEditingApproval({ ...editingApproval, slaHours: Number(e.target.value) })}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bulkApprove"
                  checked={editingApproval.bulkApproveAllowed || false}
                  onChange={(e) => setEditingApproval({ ...editingApproval, bulkApproveAllowed: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
                />
                <label htmlFor="bulkApprove" className="font-semibold text-[#101828]">Allow 1-Click Dual-Control Bulk Approval</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeConfig"
                  checked={editingApproval.active !== false}
                  onChange={(e) => setEditingApproval({ ...editingApproval, active: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
              {editingReminder.id ? `Configure Expiry Reminder (T - ${editingReminder.daysBeforeExpiry} Days)` : 'Add New Expiry Reminder Schedule'}
            </h3>
            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}
            <div className="space-y-3 text-xs">
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
                    value={editingReminder.daysBeforeExpiry || ''}
                    onChange={(e) => setEditingReminder({ ...editingReminder, daysBeforeExpiry: Number(e.target.value) })}
                    className="input-field w-full font-bold text-[#102E4A]"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#5B6472] block mb-1">Recurrence *</label>
                  <select
                    value={editingReminder.recurrence || 'One-time'}
                    onChange={(e) => setEditingReminder({ ...editingReminder, recurrence: e.target.value as any })}
                    className="input-field w-full"
                  >
                    <option value="One-time">One-time Trigger</option>
                    <option value="Every N Working Days">Every N Working Days</option>
                    <option value="Every N Calendar Days">Every N Calendar Days</option>
                  </select>
                </div>
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
                        className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all ${active ? 'bg-[#102E4A] text-white border-[#102E4A] shadow-sm' : 'bg-white text-[#5B6472] border-[#E2E8F0]'}`}
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
                          className={`py-1 px-2.5 rounded text-xs font-semibold border transition-all ${active ? 'bg-[#1F4E7A] text-white border-[#1F4E7A] shadow-sm' : 'bg-slate-50 text-[#5B6472] border-[#E2E8F0]'}`}
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
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
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
                  if (!editingReminder.daysBeforeExpiry || editingReminder.daysBeforeExpiry <= 0) {
                    setModalError('Working days before expiry must be greater than zero.');
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  className="input-field w-full font-bold text-[#102E4A]"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeIns"
                  checked={editingInsurer.active !== false}
                  onChange={(e) => setEditingInsurer({ ...editingInsurer, active: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  className="input-field w-full font-semibold text-[#1F4E7A]"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taxMandatory"
                  checked={editingTaxonomy.insuranceMandatory !== false}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, insuranceMandatory: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
                />
                <label htmlFor="taxMandatory" className="font-semibold text-[#101828]">Insurance Coverage is Strictly Mandatory for Pledging</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxActive"
                  checked={editingTaxonomy.active !== false}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, active: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  value={editingDocRule.collateralCategory || 'Immovable Properties'}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, collateralCategory: e.target.value })}
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
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
                />
                <label htmlFor="docMandatory" className="font-semibold text-[#101828]">Mandatory Gatekeeper for Collateral Release & Verification</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="docRuleActive"
                  checked={editingDocRule.active !== false}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, active: e.target.checked })}
                  className="w-4 h-4 text-[#102E4A] rounded border-[#E2E8F0]"
                />
                <label htmlFor="docRuleActive" className="font-semibold text-[#101828]">Active Compliance Validation Rule</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
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
      )}

      {/* Parameter Modal */}
      {showParamModal && editingParam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
              Configure Parameter: <span className="font-mono text-[#1F4E7A]">{editingParam.paramKey}</span>
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
                        className="input-field w-full font-bold text-[#102E4A]"
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
                          className="input-field w-full pr-8 font-bold text-[#102E4A]"
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
                        className="input-field w-full font-bold text-[#102E4A]"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editingParam.paramValue || ''}
                        onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                        className="input-field w-full font-bold text-[#102E4A]"
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
                      <div className="font-bold flex items-center gap-1 text-[#1F4E7A]">
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#102E4A]">
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
                  className="input-field w-full font-mono font-bold text-[#102E4A]"
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
    </div>
  );
};
