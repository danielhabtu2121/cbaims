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
  const [runningEscalations, setRunningEscalations] = useState(false);
  const [scanningExceptions, setScanningExceptions] = useState(false);

  const loadRuntimeData = React.useCallback(async () => {
    setRuntimeLoading(true);
    try {
      const [runtime, templateRows, usage, dependencies] = await Promise.all([
        cimsApi.getAdminRuntimeConfiguration(),
        cimsApi.getNotificationTemplates(),
        cimsApi.getConfigurationUsage(),
        cimsApi.getDependencyHealth(),
      ]);
      setRuntimeData(runtime);
      setTemplates(templateRows || []);
      setUsageMap(usage || {});
      setDependencyHealth(dependencies || null);
    } catch (error: any) {
      showToast(error?.message || 'Unable to load runtime configuration.');
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

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
          <h1 className="text-xl font-extrabold text-brand-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-700" />
            System Administration & Governance
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Configure business segments, users, role permissions, branch hierarchies, approval workflows, and bank reference data
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-border bg-white px-4 pt-3 rounded-t-lg gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'overview' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          ⚡ Control Center
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'runtime' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Runtime Configuration
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'segments' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          1. Business Segments ({segments.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'users' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          2. Users ({allUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'permissions' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          3. Role Permissions Matrix ({localPermissions.length})
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'branches' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          4. Branch Hierarchy ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab('approval-configs')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'approval-configs' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          5. Approval Workflows ({approvalConfigs.length})
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'reminders' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          6. Reminder Schedules ({reminderSchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('insurers')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'insurers' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          7. Approved Insurers ({insurers.length})
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'taxonomy' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          8. Collateral Taxonomy ({taxonomies.length})
        </button>
        <button
          onClick={() => setActiveTab('doc-rules')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'doc-rules' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          9. Document Rules ({mandatoryDocRules.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'templates' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Notification Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'parameters' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          10. System Parameters ({systemParameters.length})
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
            activeTab === 'holidays' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          11. Holiday Calendar ({holidayCalendars.length})
        </button>
      </div>

      {/* --- Tab 0: Overview / Governance Control Center --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={handleRunRemindersNow} disabled={runningReminders} className="px-3 py-2 rounded-lg bg-brand-900 text-white text-xs font-bold disabled:opacity-50">{runningReminders ? 'Running reminders…' : 'Run reminders now'}</button>
            <button onClick={handleRunEscalations} disabled={runningEscalations} className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-bold disabled:opacity-50">{runningEscalations ? 'Escalating…' : 'Run renewal escalations'}</button>
            <button onClick={handleScanExceptions} disabled={scanningExceptions} className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-bold disabled:opacity-50">{scanningExceptions ? 'Scanning…' : 'Scan exceptions now'}</button>
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
                className="px-4 py-2 bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
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
                  <span className="text-xs font-bold text-text-secondary uppercase">System Parameters</span>
                  <Sliders className="w-4 h-4 text-brand-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{systemParameters.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Live runtime thresholds & rules</p>
              </div>
              <button onClick={() => setActiveTab('parameters')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Parameters →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Approved Insurers</span>
                  <Shield className="w-4 h-4 text-blue-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{insurers.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Underwriters & concentration caps</p>
              </div>
              <button onClick={() => setActiveTab('insurers')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Manage Insurers →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Approval Workflows</span>
                  <GitMerge className="w-4 h-4 text-purple-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{approvalConfigs.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Maker-Checker SLA hierarchies</p>
              </div>
              <button onClick={() => setActiveTab('approval-configs')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Workflows →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Reminder Schedules</span>
                  <Bell className="w-4 h-4 text-amber-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{reminderSchedules.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Working-day pre-expiry alerts</p>
              </div>
              <button onClick={() => setActiveTab('reminders')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Reminders →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Taxonomies & Haircuts</span>
                  <FileText className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{taxonomies.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Asset categories & valuation rules</p>
              </div>
              <button onClick={() => setActiveTab('taxonomy')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Taxonomy →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Holiday Calendar</span>
                  <Calendar className="w-4 h-4 text-rose-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{holidayCalendars.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Bank holidays & working days</p>
              </div>
              <button onClick={() => setActiveTab('holidays')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Holidays →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Mandatory Doc Rules</span>
                  <FileCheck className="w-4 h-4 text-indigo-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{mandatoryDocRules.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Required compliance documents</p>
              </div>
              <button onClick={() => setActiveTab('doc-rules')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Configure Rules →
              </button>
            </div>

            <div className="cims-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">Users & RBAC</span>
                  <Users className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-2xl font-black text-brand-900 mt-2">{allUsers.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Bank personnel & matrix permissions</p>
              </div>
              <button onClick={() => setActiveTab('users')} className="mt-3 text-xs font-bold text-brand-700 hover:underline text-left">
                Manage Users →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Runtime Configuration --- */}
      {activeTab === 'runtime' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white p-5 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-brand-900">Effective Runtime Configuration</h3>
              <p className="text-xs text-text-secondary mt-1">These are the values currently consumed by the backend business services, not merely values stored in Admin.</p>
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</div>
                <div className="text-xl font-black text-brand-900 mt-2">{value}</div>
                <div className="text-[11px] text-text-secondary mt-1">{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="cims-card p-5">
              <h4 className="font-bold text-sm text-brand-900">Business-Day Calculator</h4>
              <p className="text-xs text-text-secondary mt-1">Verify that Admin holiday configuration is being consumed by runtime calendar logic.</p>
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
              <h4 className="font-bold text-sm text-brand-900">Configuration Health</h4>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${runtimeData?.health?.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{runtimeData?.health?.status || 'CHECKING'}</span>
                <span className="text-xs text-text-secondary">{runtimeData?.health?.healthyCount ?? 0} healthy checks · {runtimeData?.health?.warningCount ?? 0} warnings</span>
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
        <div className="mt-6 bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-bold text-text-primary">Runtime configuration consumers</h3><p className="text-xs text-text-secondary">Every administrator-controlled value should have a defined business consumer.</p></div>
            <span className="text-xs font-semibold text-text-secondary">Dependencies: {dependencyHealth ? 'Available' : 'Loading'}</span>
          </div>
          <div className="space-y-2">
            {Object.entries(usageMap).map(([key, consumer]) => (
              <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 border-b border-border last:border-0 py-3">
                <code className="text-xs font-bold text-brand-800 md:w-64">{key}</code>
                <span className="text-xs text-text-secondary">{consumer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-border">
            <div><h3 className="text-sm font-bold text-brand-900">Notification Templates</h3><p className="text-xs text-text-secondary">Templates are validated and consumed when CIMS generates notifications.</p></div>
            <button onClick={() => setTemplateDraft({ id: '', name: '', type: 'Email', channel: 'Email', triggerDaysBefore: 30, subject: '', body: '', active: true })} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New Template</button>
          </div>
          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs"><thead className="bg-brand-50 border-b border-border"><tr><th className="p-3">Name</th><th className="p-3">Channel</th><th className="p-3">Trigger</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-border">{templates.map(t => <tr key={t.id} className="hover:bg-brand-50"><td className="p-3 font-semibold">{t.name}</td><td className="p-3">{t.type || t.channel}</td><td className="p-3">{t.triggerDaysBefore || 0} working days</td><td className="p-3"><StatusChip label={t.active === false ? 'Inactive' : 'Active'} /></td><td className="p-3 text-right"><button onClick={() => setTemplateDraft(t)} className="text-brand-700 font-semibold hover:underline">Edit</button></td></tr>)}</tbody></table>
          </div>
          {templateDraft && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
              <div className="flex justify-between"><div><h3 className="font-bold text-brand-900">{templateDraft.id ? 'Edit' : 'Create'} Notification Template</h3><p className="text-xs text-text-secondary">Unsupported placeholders are rejected by the backend.</p></div><button onClick={() => setTemplateDraft(null)}><X className="w-5 h-5" /></button></div>
              <div className="grid grid-cols-2 gap-3 text-xs"><input className="input-field" placeholder="Template name" value={templateDraft.name} onChange={e => setTemplateDraft({...templateDraft, name:e.target.value})}/><select className="input-field" value={templateDraft.type || 'Email'} onChange={e => setTemplateDraft({...templateDraft, type:e.target.value, channel:e.target.value as any})}><option>Email</option><option>SMS</option></select><input className="input-field" type="number" min="0" placeholder="Trigger working days" value={templateDraft.triggerDaysBefore ?? 0} onChange={e => setTemplateDraft({...templateDraft, triggerDaysBefore:Number(e.target.value)})}/><input className="input-field" placeholder="Subject" value={templateDraft.subject || ''} onChange={e => setTemplateDraft({...templateDraft, subject:e.target.value})}/></div>
              <textarea className="input-field w-full" rows={8} placeholder="Body" value={templateDraft.body} onChange={e => setTemplateDraft({...templateDraft, body:e.target.value})}/>
              <div className="flex items-center justify-between"><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={templateDraft.active !== false} onChange={e => setTemplateDraft({...templateDraft, active:e.target.checked})}/> Active</label><button onClick={async()=>{try{const r=await cimsApi.previewNotificationTemplate(templateDraft.body,{CustomerName:'Sample Customer',PolicyNumber:'POL-SAMPLE',CollateralID:'COL-SAMPLE',ExpiryDate:'2026-12-31',DaysRemaining:30,Amount:100000});setTemplatePreview(r.preview);}catch(e:any){showToast(e.message)}}} className="btn-secondary text-xs">Preview</button></div>
              {templatePreview && <div className="p-3 rounded bg-slate-50 border text-xs whitespace-pre-wrap max-h-40 overflow-auto">{templatePreview}</div>}
              <div className="flex justify-end gap-2 pt-2 border-t"><button onClick={()=>setTemplateDraft(null)} className="btn-secondary text-xs">Cancel</button><button onClick={async()=>{try{await cimsApi.saveNotificationTemplate(templateDraft,currentUser.userId);setTemplateDraft(null);setTemplatePreview('');await loadRuntimeData();showToast('Notification template saved and activated according to its status.')}catch(e:any){showToast(e.message)}}} className="btn-primary text-xs">Save Template</button></div>
            </div></div>
          )}
        </div>
      )}

      {/* --- Tab 1: Business Segments --- */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Business Segment Portfolio Units</h3>
              <p className="text-xs text-text-secondary">Core business divisions governing collateral ownership & portfolio segregation</p>
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Segment Name</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Risk Profile</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {segments.map((seg) => (
                  <tr key={seg.id} className="hover:bg-brand-50">
                    <td className="p-3 font-semibold text-brand-900">{seg.name}</td>
                    <td className="p-3 text-text-secondary">{seg.description}</td>
                    <td className="p-3"><StatusChip label={seg.riskProfile || 'Medium'} /></td>
                    <td className="p-3"><StatusChip label={seg.active ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingSegment(seg);
                          setShowSegmentModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">User Accounts & Roles</h3>
              <p className="text-xs text-text-secondary">Manage staff accounts, role mappings, branch domiciliaries, and security locks</p>
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
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Create New User
            </button>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
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
              <tbody className="divide-y divide-border">
                {allUsers.map((u) => (
                  <tr key={u.id || u.userId} className="hover:bg-brand-50">
                    <td className="p-3 font-semibold text-brand-900">{u.username}</td>
                    <td className="p-3">{u.name || u.fullName}</td>
                    <td className="p-3 font-bold text-brand-700">{u.role}</td>
                    <td className="p-3">{u.branch}</td>
                    <td className="p-3">{u.segment}</td>
                    <td className="p-3"><StatusChip label={u.active !== false ? 'Active' : 'Locked'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setShowUserModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Role × Screen Access Permission Matrix (§2.1)</h3>
              <p className="text-xs text-text-secondary">Granular permissions governing screen visibility, creation, editing, checker approval, and deletion</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Filter Role:</label>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="input-field text-xs py-1 px-2 font-semibold text-brand-900"
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold sticky top-0 z-10">
                <tr>
                  <th className="p-3 bg-brand-50">Role Code</th>
                  <th className="p-3 bg-brand-50">Screen / Module</th>
                  <th className="p-3 text-center bg-brand-50">View</th>
                  <th className="p-3 text-center bg-brand-50">Create</th>
                  <th className="p-3 text-center bg-brand-50">Edit</th>
                  <th className="p-3 text-center bg-brand-50 text-emerald-800">Approve (Checker)</th>
                  <th className="p-3 text-center bg-brand-50 text-red-800">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPermissions.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50">
                    <td className="p-3 font-bold text-brand-800">{p.roleCode}</td>
                    <td className="p-3 font-semibold text-text-primary">{p.screenName}</td>
                    
                    {/* View Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canView}
                        onChange={() => handleTogglePerm(p.id, 'canView')}
                        className="w-4 h-4 text-brand-900 rounded border-border focus:ring-brand-500 cursor-pointer"
                      />
                    </td>

                    {/* Create Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canCreate}
                        onChange={() => handleTogglePerm(p.id, 'canCreate')}
                        className="w-4 h-4 text-brand-900 rounded border-border focus:ring-brand-500 cursor-pointer"
                      />
                    </td>

                    {/* Edit Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.canEdit}
                        onChange={() => handleTogglePerm(p.id, 'canEdit')}
                        className="w-4 h-4 text-brand-900 rounded border-border focus:ring-brand-500 cursor-pointer"
                      />
                    </td>

                    {/* Approve Checkbox */}
                    <td className="p-3 text-center bg-emerald-50/50">
                      <input
                        type="checkbox"
                        checked={p.canApprove}
                        onChange={() => handleTogglePerm(p.id, 'canApprove')}
                        className="w-4 h-4 text-emerald-600 rounded border-border focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Delete Checkbox */}
                    <td className="p-3 text-center bg-red-50/50">
                      <input
                        type="checkbox"
                        checked={p.canDelete}
                        onChange={() => handleTogglePerm(p.id, 'canDelete')}
                        className="w-4 h-4 text-red-600 rounded border-border focus:ring-red-500 cursor-pointer"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Branch Network & District Hierarchy</h3>
              <p className="text-xs text-text-secondary">Head Office, District Directorates, and Operating Branches</p>
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Branch Code</th>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Parent District</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-50">
                    <td className="p-3 font-semibold text-brand-900">{b.code}</td>
                    <td className="p-3">{b.name}</td>
                    <td className="p-3 font-medium text-brand-700">{b.type}</td>
                    <td className="p-3">{b.parentDistrictId || 'Head Office'}</td>
                    <td className="p-3"><StatusChip label={b.active !== false ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setShowBranchModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Approval Hierarchy & Flowable BPMN Mapping (§14.4)</h3>
              <p className="text-xs text-text-secondary">Dual control levels (1 or 2 stages), candidate roles, bulk approval rules, and SLA hours</p>
            </div>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Transaction Type</th>
                  <th className="p-3">Approval Levels</th>
                  <th className="p-3">Level 1 Role</th>
                  <th className="p-3">Level 2 Role</th>
                  <th className="p-3 text-center">Bulk Approve</th>
                  <th className="p-3 text-right">SLA Hours</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvalConfigs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-brand-50">
                    <td className="p-3 font-semibold text-brand-900">{cfg.transactionType}</td>
                    <td className="p-3">{cfg.approvalLevels} Stage(s)</td>
                    <td className="p-3 font-bold text-brand-700">{cfg.level1Role}</td>
                    <td className="p-3">{cfg.level2Role || '—'}</td>
                    <td className="p-3 text-center">{cfg.bulkApproveAllowed ? 'Yes' : 'No'}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{cfg.slaHours} hrs</td>
                    <td className="p-3"><StatusChip label={cfg.active ? 'Active' : 'Disabled'} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingApproval(cfg);
                          setShowApprovalModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Policy Expiry Pre-Alert Reminder Schedules (US-09.2)</h3>
              <p className="text-xs text-text-secondary">Configured working-day offsets below trigger the reminder engine; changes are applied to runtime scheduling immediately after save.</p>
            </div>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Offset (Days Before Expiry)</th>
                  <th className="p-3">Delivery Channels</th>
                  <th className="p-3">Recipient Roles</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reminderSchedules.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50">
                    <td className="p-3 font-bold text-brand-900 tabular-nums">T - {r.daysBeforeExpiry} Days</td>
                    <td className="p-3">{r.channelsJson}</td>
                    <td className="p-3 font-mono">{r.recipientRolesJson}</td>
                    <td className="p-3"><StatusChip label={r.active ? 'Active' : 'Paused'} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingReminder(r);
                          setShowReminderModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Approved Insurance Companies List</h3>
              <p className="text-xs text-text-secondary">National Bank of Ethiopia licensed underwriters approved for collateral coverage</p>
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Insurer ID</th>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {insurers.map((ins) => (
                  <tr key={ins.id} className="hover:bg-brand-50">
                    <td className="p-3 font-mono text-brand-700">{ins.id}</td>
                    <td className="p-3 font-bold text-brand-900">{ins.name}</td>
                    <td className="p-3"><StatusChip label={ins.active ? 'Approved' : 'Suspended'} /></td>
                    <td className="p-3 text-right space-x-3">
                      <button
                        onClick={() => {
                          setEditingInsurer(ins);
                          setShowInsurerModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Collateral Asset Taxonomy & Mandatory Insurance Rules</h3>
              <p className="text-xs text-text-secondary">Asset classification categories and mandated insurance coverage types</p>
            </div>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Sub-Category</th>
                  <th className="p-3">Insurance Mandatory</th>
                  <th className="p-3">Mandatory Coverage Type</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {taxonomies.map((tax) => (
                  <tr key={tax.id} className="hover:bg-brand-50">
                    <td className="p-3 font-bold text-brand-900">{tax.category}</td>
                    <td className="p-3">{tax.subCategory}</td>
                    <td className="p-3">
                      <StatusChip label={tax.insuranceMandatory ? 'Mandatory' : 'Optional'} />
                    </td>
                    <td className="p-3 font-semibold text-brand-700">{tax.mandatoryCoverageType}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingTaxonomy(tax);
                          setShowTaxonomyModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Mandatory Collateral Ownership Document Rules</h3>
              <p className="text-xs text-text-secondary">Define document requirements (e.g. Title Deeds, Valuation Reports) by asset category</p>
            </div>
            <button
              onClick={() => {
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Collateral Category</th>
                  <th className="p-3">Required Document Type</th>
                  <th className="p-3">Requirement Level</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mandatoryDocRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-brand-50">
                    <td className="p-3 font-bold text-brand-900">{rule.collateralCategory}</td>
                    <td className="p-3 font-semibold">{rule.documentType}</td>
                    <td className="p-3">
                      <StatusChip label={rule.mandatory ? 'Mandatory' : 'Recommended'} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingDocRule(rule);
                          setShowDocRuleModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">System Global Configuration Parameters</h3>
              <p className="text-xs text-text-secondary">Values are validated by the backend and immediately loaded into the runtime configuration service.</p>
            </div>
          </div>

          <div className="cims-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Parameter Key</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Runtime Use</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {systemParameters.map((param) => (
                  <tr key={param.paramKey} className="hover:bg-brand-50">
                    <td className="p-3 font-mono font-bold text-brand-900">{param.paramKey}</td>
                    <td className="p-3 font-semibold text-emerald-800">{param.paramValue}</td>
                    <td className="p-3"><StatusChip label={['min_coverage_adequacy_pct','max_insurer_concentration_pct','policy_expiry_grace_period_days','dual_control_strict_mode','default_currency','cbs_sync_mode','cbs_sync_interval_minutes'].includes(param.paramKey) ? 'Runtime' : 'Configured'} /></td>
                    <td className="p-3 text-text-secondary">{param.description}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingParam(param);
                          setShowParamModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Bank Holiday Calendar & Business Day Rules</h3>
              <p className="text-xs text-text-secondary">Official Ethiopian public and banking holidays for SLA calculation</p>
            </div>
            <button
              onClick={() => {
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
              <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                <tr>
                  <th className="p-3">Holiday Date</th>
                  <th className="p-3">Holiday Name / Description</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holidayCalendars.map((h) => (
                  <tr key={h.id} className="hover:bg-brand-50">
                    <td className="p-3 font-mono font-bold text-brand-900">{h.holidayDate}</td>
                    <td className="p-3 font-semibold">{h.description}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingHoliday(h);
                          setShowHolidayModal(true);
                        }}
                        className="text-brand-700 hover:underline font-semibold"
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

      {/* ========================================================================= */}
      {/* MODALS FOR ADMIN CRUD OPERATIONS */}
      {/* ========================================================================= */}

      {/* Segment Modal */}
      {showSegmentModal && editingSegment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingSegment.id ? 'Edit Business Segment' : 'Add New Business Segment'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Segment Name</label>
                <input
                  type="text"
                  value={editingSegment.name || ''}
                  onChange={(e) => setEditingSegment({ ...editingSegment, name: e.target.value })}
                  placeholder="e.g. Agricultural Banking"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Description</label>
                <textarea
                  value={editingSegment.description || ''}
                  onChange={(e) => setEditingSegment({ ...editingSegment, description: e.target.value })}
                  placeholder="Scope and asset governance criteria"
                  rows={3}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Risk Profile</label>
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
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowSegmentModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveSegment(editingSegment);
                  setShowSegmentModal(false);
                  showToast('Business segment saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Segment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingUser.id ? `Edit User — ${editingUser.username}` : 'Create Staff User'}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Username</label>
                <input
                  type="text"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.name || editingUser.fullName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value, fullName: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Role Code</label>
                <select
                  value={editingUser.role || 'CRO'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Domicile Branch</label>
                <select
                  value={editingUser.branch || 'Bole Special Branch'}
                  onChange={(e) => setEditingUser({ ...editingUser, branch: e.target.value })}
                  className="input-field w-full"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Primary Segment</label>
                <select
                  value={editingUser.segment || 'Corporate Banking'}
                  onChange={(e) => setEditingUser({ ...editingUser, segment: e.target.value })}
                  className="input-field w-full"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to use password123"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={editingUser.active !== false}
                  onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-900 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="userActiveCheck" className="font-semibold text-text-primary cursor-pointer">
                  Active Account (Enabled)
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowUserModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveUser(editingUser);
                  setShowUserModal(false);
                  showToast('User account saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingBranch.id ? 'Edit Branch' : 'Add Operating Branch'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Branch Code</label>
                <input
                  type="text"
                  value={editingBranch.code || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value })}
                  placeholder="e.g. BRN-010"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={editingBranch.name || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Parent District</label>
                <select
                  value={editingBranch.parentDistrictId || 'Head Office'}
                  onChange={(e) => setEditingBranch({ ...editingBranch, parentDistrictId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="Head Office">Head Office</option>
                  <option value="brn-dist-east">Addis Ababa East District</option>
                  <option value="brn-dist-west">Addis Ababa West District</option>
                  <option value="brn-dist-north">Northern District</option>
                  <option value="brn-dist-south">Southern District</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveBranch(editingBranch);
                  setShowBranchModal(false);
                  showToast('Branch saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Config Modal */}
      {showApprovalModal && editingApproval && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              Configure Workflow: {editingApproval.transactionType}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Approval Levels</label>
                <select
                  value={editingApproval.approvalLevels || 1}
                  onChange={(e) => setEditingApproval({ ...editingApproval, approvalLevels: Number(e.target.value) })}
                  className="input-field w-full"
                >
                  <option value={1}>1 Stage (Level 1 Checker)</option>
                  <option value={2}>2 Stages (Level 1 Checker + Level 2 Department Head)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Level 1 Candidate Role</label>
                <select
                  value={editingApproval.level1Role || 'BRMGR'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, level1Role: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Level 2 Candidate Role (if 2 stages)</label>
                <select
                  value={editingApproval.level2Role || 'HODEPT'}
                  onChange={(e) => setEditingApproval({ ...editingApproval, level2Role: e.target.value })}
                  className="input-field w-full font-bold"
                >
                  <option value="">None</option>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">SLA Target (Hours)</label>
                <input
                  type="number"
                  value={editingApproval.slaHours || 24}
                  onChange={(e) => setEditingApproval({ ...editingApproval, slaHours: Number(e.target.value) })}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bulkApprove"
                  checked={editingApproval.bulkApproveAllowed || false}
                  onChange={(e) => setEditingApproval({ ...editingApproval, bulkApproveAllowed: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded border-border"
                />
                <label htmlFor="bulkApprove" className="font-semibold text-text-primary">Allow 1-Click Bulk Approval</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowApprovalModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveApprovalConfig(editingApproval);
                  setShowApprovalModal(false);
                  showToast('Approval workflow configuration updated!');
                }}
                className="btn-primary text-xs"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && editingReminder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              Configure Expiry Reminder (T - {editingReminder.daysBeforeExpiry} Days)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Notification Channels (JSON Array)</label>
                <input
                  type="text"
                  value={editingReminder.channelsJson || '["Email","SMS"]'}
                  onChange={(e) => setEditingReminder({ ...editingReminder, channelsJson: e.target.value })}
                  className="input-field w-full font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Recipient Roles (JSON Array)</label>
                <input
                  type="text"
                  value={editingReminder.recipientRolesJson || '["CRO","BRO","BRMGR"]'}
                  onChange={(e) => setEditingReminder({ ...editingReminder, recipientRolesJson: e.target.value })}
                  className="input-field w-full font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeRem"
                  checked={editingReminder.active || false}
                  onChange={(e) => setEditingReminder({ ...editingReminder, active: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded border-border"
                />
                <label htmlFor="activeRem" className="font-semibold text-text-primary">Enable Automated Alert Trigger</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowReminderModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveReminderSchedule(editingReminder);
                  setShowReminderModal(false);
                  showToast('Reminder schedule updated!');
                }}
                className="btn-primary text-xs"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insurer Modal */}
      {showInsurerModal && editingInsurer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingInsurer.id ? 'Edit Approved Insurer' : 'Add Approved Insurer'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Company Name</label>
                <input
                  type="text"
                  value={editingInsurer.name || ''}
                  onChange={(e) => setEditingInsurer({ ...editingInsurer, name: e.target.value })}
                  placeholder="e.g. Lion Insurance Company S.C."
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeIns"
                  checked={editingInsurer.active !== false}
                  onChange={(e) => setEditingInsurer({ ...editingInsurer, active: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded border-border"
                />
                <label htmlFor="activeIns" className="font-semibold text-text-primary">NBE Approved Underwriter</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowInsurerModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveInsurer(editingInsurer);
                  setShowInsurerModal(false);
                  showToast('Insurer saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Insurer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Taxonomy Modal */}
      {showTaxonomyModal && editingTaxonomy && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">Edit Collateral Taxonomy Rule</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Category</label>
                <input
                  type="text"
                  value={editingTaxonomy.category || ''}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, category: e.target.value })}
                  className="input-field w-full font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Sub-Category</label>
                <input
                  type="text"
                  value={editingTaxonomy.subCategory || ''}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, subCategory: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Mandatory Coverage Type</label>
                <input
                  type="text"
                  value={editingTaxonomy.mandatoryCoverageType || ''}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, mandatoryCoverageType: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="taxMandatory"
                  checked={editingTaxonomy.insuranceMandatory || false}
                  onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, insuranceMandatory: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded border-border"
                />
                <label htmlFor="taxMandatory" className="font-semibold text-text-primary">Insurance is Strictly Mandatory</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowTaxonomyModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveTaxonomy(editingTaxonomy);
                  setShowTaxonomyModal(false);
                  showToast('Taxonomy rule saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Rule Modal */}
      {showDocRuleModal && editingDocRule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingDocRule.id ? 'Edit Document Rule' : 'Add Document Rule'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Collateral Category</label>
                <select
                  value={editingDocRule.collateralCategory || 'Immovable Properties'}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, collateralCategory: e.target.value })}
                  className="input-field w-full"
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
                <label className="font-semibold text-text-secondary block mb-1">Required Document Type</label>
                <input
                  type="text"
                  value={editingDocRule.documentType || ''}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, documentType: e.target.value })}
                  placeholder="e.g. Title Deed / Ownership Certificate"
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="docMandatory"
                  checked={editingDocRule.mandatory !== false}
                  onChange={(e) => setEditingDocRule({ ...editingDocRule, mandatory: e.target.checked })}
                  className="w-4 h-4 text-brand-900 rounded border-border"
                />
                <label htmlFor="docMandatory" className="font-semibold text-text-primary">Mandatory for Collateral Release & Verification</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowDocRuleModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveMandatoryDocRule(editingDocRule);
                  setShowDocRuleModal(false);
                  showToast('Document rule saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Document Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parameter Modal */}
      {showParamModal && editingParam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              Edit Parameter: {editingParam.paramKey}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Parameter Value</label>
                <input
                  type="text"
                  value={editingParam.paramValue || ''}
                  onChange={(e) => setEditingParam({ ...editingParam, paramValue: e.target.value })}
                  className="input-field w-full font-bold text-brand-900"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Description</label>
                <textarea
                  value={editingParam.description || ''}
                  onChange={(e) => setEditingParam({ ...editingParam, description: e.target.value })}
                  rows={2}
                  className="input-field w-full text-text-secondary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowParamModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveParameter(editingParam);
                  setShowParamModal(false);
                  showToast('System parameter updated successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Parameter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {showHolidayModal && editingHoliday && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-brand-900">
              {editingHoliday.id ? 'Edit Bank Holiday' : 'Add Bank Holiday'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Holiday Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={editingHoliday.holidayDate || ''}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, holidayDate: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="font-semibold text-text-secondary block mb-1">Description</label>
                <input
                  type="text"
                  value={editingHoliday.description || ''}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, description: e.target.value })}
                  placeholder="e.g. Meskel (Finding of the True Cross)"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button onClick={() => setShowHolidayModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSaveHoliday(editingHoliday);
                  setShowHolidayModal(false);
                  showToast('Bank holiday saved successfully!');
                }}
                className="btn-primary text-xs"
              >
                Save Holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
