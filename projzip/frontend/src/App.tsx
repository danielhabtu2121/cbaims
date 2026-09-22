import React, { useState, useEffect, useMemo } from 'react';
import { Lock } from 'lucide-react';
import {
  UserSession,
  Customer,
  LoanAccount,
  Collateral,
  LoanCollateralLink,
  InsurancePolicy,
  PolicyEndorsement,
  OwnershipDocument,
  CimsException,
  NotificationItem,
  AuditLog,
  WorkflowTask,
  Delegation,
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
  CbsCustomer,
  CbsFacility,
  CbsCollateral,
  CbsSyncLog,
  RoleCode,
} from './types';
import { cimsApi } from './api/cimsApi';
import { TopBar } from './components/layout/TopBar';
import { Sidebar, NavPageId } from './components/layout/Sidebar';
import { Breadcrumbs } from './components/layout/Breadcrumbs';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { SessionTimeoutModal } from './components/layout/SessionTimeoutModal';
import { ChangePasswordModal } from './components/layout/ChangePasswordModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { DashboardContainer } from './components/dashboards/DashboardContainer';
import { CustomerManager } from './components/customers/CustomerManager';
import { FacilityManager } from './components/facilities/FacilityManager';
import { CollateralManager } from './components/collateral/CollateralManager';
import { PolicyManager } from './components/policies/PolicyManager';
import { MakerCheckerInbox } from './components/workflow/MakerCheckerInbox';
import { ExceptionManager } from './components/exceptions/ExceptionManager';
import { DocumentRepository } from './components/documents/DocumentRepository';
import { ReportCatalog } from './components/reports/ReportCatalog';
import { AdminPortal } from './components/admin/AdminPortal';
import { AuditTrailViewer } from './components/audit/AuditTrailViewer';
import { NotificationManager } from './components/notifications/NotificationManager';
import { CbsSimulator } from './components/cbs/CbsSimulator';

// 16 Pre-Seeded Bank Personas
const INITIAL_PERSONAS: UserSession[] = [
  {
    userId: 'brmgr_user',
    username: 'brmgr_user',
    name: 'Abebe Bikila',
    role: 'BRMGR',
    roleName: 'Branch Manager',
    branch: 'Bole Special Branch',
    branchCode: 'BOLE-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-brmgr',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'cro_user',
    username: 'cro_user',
    name: 'Derartu Tulu',
    role: 'CRO',
    roleName: 'Corporate Relationship Officer',
    branch: 'Bole Special Branch',
    branchCode: 'BOLE-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-cro',
    canApprove: false,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'exec_user',
    username: 'exec_user',
    name: 'Dr. Haile Gebrselassie',
    role: 'EXEC',
    roleName: 'Executive Director / VP',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-exec',
    canApprove: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    userId: 'distdir_user',
    username: 'distdir_user',
    name: 'Kenenisa Bekele',
    role: 'DISTDIR',
    roleName: 'District Director',
    branch: 'East Addis District',
    branchCode: 'DIST-EAA-01',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-distdir',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'hodept_user',
    username: 'hodept_user',
    name: 'Tirunesh Dibaba',
    role: 'HODEPT',
    roleName: 'Head Office Department Head',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking'],
    token: 'jwt-token-hodept',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'srm_user',
    username: 'srm_user',
    name: 'Sileshi Sihine',
    role: 'SRM',
    roleName: 'Senior Relationship Manager',
    branch: 'Bole Special Branch',
    branchCode: 'BOLE-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-srm',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'brm_user',
    username: 'brm_user',
    name: 'Meseret Defar',
    role: 'BRM',
    roleName: 'Branch Relationship Manager',
    branch: 'Bole Special Branch',
    branchCode: 'BOLE-001',
    segment: 'Retail Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-brm',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'bro_user',
    username: 'bro_user',
    name: 'Gete Wami',
    role: 'BRO',
    roleName: 'Branch Relationship Officer',
    branch: 'Bole Special Branch',
    branchCode: 'BOLE-001',
    segment: 'Retail Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-bro',
    canApprove: false,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'mgrcolldoc_user',
    username: 'mgrcolldoc_user',
    name: 'Fatuma Roba',
    role: 'MGRCOLLDOC',
    roleName: 'Manager Collateral & Documentation',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-mgrcolldoc',
    canApprove: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'colldocoff_user',
    username: 'colldocoff_user',
    name: 'Gezahegne Abera',
    role: 'COLLDOCOFF',
    roleName: 'Collateral & Documentation Officer',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking'],
    token: 'jwt-token-colldocoff',
    canApprove: false,
    canCreate: true,
    canEdit: true,
    canDelete: false,
  },
  {
    userId: 'compliance_user',
    username: 'compliance_user',
    name: 'Almaz Ayana',
    role: 'COMPLIANCE',
    roleName: 'Compliance Officer',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-compliance',
    canApprove: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    userId: 'risk_user',
    username: 'risk_user',
    name: 'Lelisa Desisa',
    role: 'RISK',
    roleName: 'Risk Management Officer',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-risk',
    canApprove: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    userId: 'auditor_user',
    username: 'auditor_user',
    name: 'Tsegaye Kebede',
    role: 'AUDITOR',
    roleName: 'Internal Auditor',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-auditor',
    canApprove: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    userId: 'sysadmin_user',
    username: 'sysadmin_user',
    name: 'System Administrator',
    role: 'SYSADMIN',
    roleName: 'System Administrator',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-sysadmin',
    canApprove: false,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    userId: 'srmgmt_user',
    username: 'srmgmt_user',
    name: 'Senior Management Lead',
    role: 'SRMGMT',
    roleName: 'Senior Management',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'],
    token: 'jwt-token-srmgmt',
    canApprove: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    userId: 'rdonly_user',
    username: 'rdonly_user',
    name: 'Read Only Viewer',
    role: 'RDONLY',
    roleName: 'Read Only Inspector',
    branch: 'Head Office',
    branchCode: 'HQ-001',
    segment: 'Corporate Banking',
    segmentIds: ['Corporate Banking'],
    token: 'jwt-token-rdonly',
    canApprove: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
];

export function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('cims.currentUser') || 'null');
      if (stored?.role && stored?.username) return { ...stored, userId: stored.userId || stored.id || stored.username, name: stored.name || stored.fullName || stored.username, roleName: stored.roleName || stored.role, canApprove: stored.role === 'SYSADMIN' ? false : stored.canApprove };
    } catch {}
    return INITIAL_PERSONAS[0];
  });
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('Corporate Banking');

  // Modals & Drawers
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessionTimeout, setShowSessionTimeout] = useState(false);

  // Application Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilities, setFacilities] = useState<LoanAccount[]>([]);
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [links, setLinks] = useState<LoanCollateralLink[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [endorsements, setEndorsements] = useState<PolicyEndorsement[]>([]);
  const [documents, setDocuments] = useState<OwnershipDocument[]>([]);
  const [exceptions, setExceptions] = useState<CimsException[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workflowTasks, setWorkflowTasks] = useState<WorkflowTask[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [segments, setSegments] = useState<BusinessSegment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [approvalConfigs, setApprovalConfigs] = useState<ApprovalHierarchyConfig[]>([]);
  const [reminderSchedules, setReminderSchedules] = useState<ReminderSchedule[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [insurers, setInsurers] = useState<ApprovedInsurer[]>([]);
  const [taxonomies, setTaxonomies] = useState<CollateralTaxonomy[]>([]);
  const [mandatoryDocRules, setMandatoryDocRules] = useState<MandatoryDocumentRule[]>([]);
  const [holidayCalendars, setHolidayCalendars] = useState<HolidayCalendar[]>([]);
  const [systemParameters, setSystemParameters] = useState<SystemParameter[]>([]);
  const [cbsCustomers, setCbsCustomers] = useState<CbsCustomer[]>([]);
  const [cbsFacilities, setCbsFacilities] = useState<CbsFacility[]>([]);
  const [cbsCollaterals, setCbsCollaterals] = useState<CbsCollateral[]>([]);
  const [cbsSyncLogs, setCbsSyncLogs] = useState<CbsSyncLog[]>([]);
  const [allUsersList, setAllUsersList] = useState<UserSession[]>(INITIAL_PERSONAS);

  // Fetch initial data
  const loadData = async () => {
    try {
      const [
        custRes,
        facRes,
        colRes,
        linkRes,
        polRes,
        endRes,
        docRes,
        excRes,
        notifRes,
        auditRes,
        taskRes,
        delRes,
        segRes,
        brRes,
        permRes,
        apprRes,
        remRes,
        schedRes,
        insRes,
        taxRes,
        mandRes,
        holRes,
        paramRes,
        cbsCustRes,
        cbsFacRes,
        cbsColRes,
        cbsLogRes,
        usersRes,
      ] = await Promise.all([
        cimsApi.getCustomers(),
        cimsApi.getFacilities(),
        cimsApi.getCollaterals(),
        cimsApi.getLinks(),
        cimsApi.getPolicies(),
        cimsApi.getEndorsements(),
        cimsApi.getDocuments(),
        cimsApi.getExceptions(),
        cimsApi.getNotifications(),
        cimsApi.getAuditLogs(),
        cimsApi.getWorkflowTasks(currentUser?.role, undefined, currentUser?.username || currentUser?.userId),
        cimsApi.getDelegations(),
        cimsApi.getSegments(),
        cimsApi.getBranches(),
        cimsApi.getPermissions(),
        cimsApi.getApprovalConfigs(),
        cimsApi.getReminderSchedules(),
        cimsApi.getScheduledReports(),
        cimsApi.getApprovedInsurers(),
        cimsApi.getTaxonomies(),
        cimsApi.getMandatoryDocRules(),
        cimsApi.getHolidayCalendars(),
        cimsApi.getSystemParameters(),
        cimsApi.getCbsCustomers(),
        cimsApi.getCbsFacilities(),
        cimsApi.getCbsCollaterals(),
        cimsApi.getCbsSyncLogs(),
        cimsApi.getUsers(),
      ]);

      setCustomers(custRes);
      setFacilities(facRes);
      setCollaterals(colRes);
      setLinks(linkRes);
      setPolicies(polRes);
      setEndorsements(endRes);
      setDocuments(docRes);
      setExceptions(excRes);
      setNotifications(notifRes);
      setAuditLogs(auditRes);
      setWorkflowTasks(taskRes);
      setDelegations(delRes);
      setSegments(segRes);
      setBranches(brRes);
      setPermissions(permRes);
      setApprovalConfigs(apprRes);
      setReminderSchedules(remRes);
      setScheduledReports(schedRes);
      setInsurers(insRes);
      setTaxonomies(taxRes);
      setMandatoryDocRules(mandRes);
      setHolidayCalendars(holRes);
      setSystemParameters(paramRes);
      setCbsCustomers(cbsCustRes);
      setCbsFacilities(cbsFacRes);
      setCbsCollaterals(cbsColRes);
      setCbsSyncLogs(cbsLogRes);

      if (usersRes && usersRes.length > 0) {
        const mappedUsers: UserSession[] = usersRes.map((u: any) => ({
          userId: u.id || u.username,
          username: u.username,
          name: u.fullName || u.name || u.username,
          role: u.role as RoleCode,
          roleName: u.role,
          branch: u.branch || 'Bole Special Branch',
          branchCode: u.branchCode || 'BRN-001',
          segment: u.segment || 'Corporate Banking',
          segmentIds: [u.segment || 'Corporate Banking'],
          canApprove: ['BRMGR', 'SRMGMT', 'HODEPT', 'DISTDIR', 'EXEC', 'MGRCOLLDOC'].includes(u.role),
          canCreate: true,
          canEdit: true,
          canDelete: true,
        }));
        setAllUsersList(mappedUsers);
      }
    } catch (err) {
      console.warn('Backend API communication error. Using localized fallback data.');
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Auth Handlers
  const handleLogin = async (user: string, pass: string) => {
    try {
      const authRes = await cimsApi.login(user, pass);
      if (authRes.success && authRes.user) {
        const u = authRes.user;
        const session: UserSession = {
          userId: u.id || u.username,
          username: u.username,
          name: u.fullName || u.name || u.username,
          role: u.role as RoleCode,
          roleName: u.role,
          branch: u.branch || 'Bole Special Branch',
          branchCode: u.branchCode || 'BRN-001',
          segment: u.segment || 'Corporate Banking',
          segmentIds: [u.segment || 'Corporate Banking'],
          canApprove: ['BRMGR', 'SRMGMT', 'HODEPT', 'DISTDIR', 'EXEC', 'MGRCOLLDOC'].includes(u.role),
          canCreate: true,
          canEdit: true,
          canDelete: true,
        };
        setCurrentUser(session);
        cimsApi.setCurrentUser(session);
        return true;
      }
    } catch (e) {
      console.warn('Backend login request error, checking local personas:', e);
    }
    const matched = allUsersList.find((p) => p.username.toLowerCase() === user.toLowerCase() || p.userId.toLowerCase() === user.toLowerCase()) ||
                    INITIAL_PERSONAS.find((p) => p.username.toLowerCase() === user.toLowerCase() || p.userId.toLowerCase() === user.toLowerCase());
    if (matched) {
      setCurrentUser(matched);
      cimsApi.setCurrentUser(matched);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    cimsApi.setCurrentUser(null);
  };

  // CBS Simulator Handlers
  const handleSyncEntity = async (type: string, id: string) => {
    await cimsApi.syncCbsEntity(type, id);
    await loadData();
  };

  const handleSyncAll = async () => {
    await cimsApi.syncAllPending();
    await loadData();
  };

  const handleSaveCbsCustomer = async (cust: Partial<CbsCustomer>) => {
    await cimsApi.saveCbsCustomer(cust);
    await loadData();
  };

  const handleSaveCbsFacility = async (fac: Partial<CbsFacility>) => {
    await cimsApi.saveCbsFacility(fac);
    await loadData();
  };

  const handleSaveCbsCollateral = async (col: Partial<CbsCollateral>) => {
    await cimsApi.saveCbsCollateral(col);
    await loadData();
  };

  // Business Handlers
  const handleRegisterManualCustomer = async (cust: Partial<Customer>) => {
    await cimsApi.registerCustomer(cust, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleMaintainCustomer = async (customerId: string, changes: Record<string, any>) => {
    await cimsApi.updateCustomer(customerId, changes, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleMaintainCollateral = async (collateralId: string, changes: Record<string, any>) => {
    await cimsApi.updateCollateral(collateralId, changes, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleRegisterCollateral = async (col: Partial<Collateral>, allocations?: any[], documents?: any[]) => {
    try {
      if ((allocations && allocations.length > 0) || (documents && documents.length > 0)) {
        await cimsApi.registerCollateralWithAllocations(col, allocations || [], currentUser?.username || 'CRO_USER', documents);
      } else {
        await cimsApi.createCollateral(col, currentUser?.username || 'CRO_USER');
      }
      await loadData();
    } catch (e: any) {
      alert(`Collateral registration failed: ${e?.message || 'The collateral could not be registered.'}`);
      throw e;
    }
  };

  const handleAddLink = async (loanId: string, collateralId: string, amount: number) => {
    await cimsApi.addFacilityLink(loanId, collateralId, amount, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleRemoveLink = async (linkId: string) => {
    await cimsApi.removeFacilityLink(linkId, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleValidateRelease = async (collateralId: string) => {
    return await cimsApi.validateReleaseCollateral(collateralId);
  };

  const handleInitiateTransfer = async (collateralId: string, destSeg: string, reason: string) => {
    await cimsApi.transferCollateralSegment(collateralId, destSeg, reason, currentUser?.userId || currentUser?.username);
    await loadData();
  };

  const handleCreatePolicyDraft = async (pol: Partial<InsurancePolicy>, documents?: any[]) => {
    try {
      await cimsApi.registerInsurancePolicy(pol, currentUser?.username || 'CRO_USER', documents);
      await loadData();
    } catch (e: any) {
      alert(`Policy registration failed: ${e?.message || 'The policy could not be saved.'}`);
      throw e;
    }
  };

  const handleSubmitPolicy = async (policyId: string) => {
    try {
      await cimsApi.submitPolicy(policyId, currentUser?.username || 'CRO_USER');
      await loadData();
    } catch (e: any) {
      alert(`Policy submission failed: ${e?.message || 'The policy could not be submitted.'}`);
      throw e;
    }
  };

  const handleAmendPolicy = async (policyId: string, pol: Partial<InsurancePolicy>, reason: string) => {
    await cimsApi.amendPolicy(policyId, pol, reason, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleRenewPolicy = async (policyId: string, amt: number, prem: number, exp: string) => {
    await cimsApi.renewPolicy(policyId, amt, prem, exp, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleEndorsePolicy = async (policyId: string, endorsementNo: string, description: string, effectiveDate?: string) => {
    await cimsApi.endorsePolicy(policyId, endorsementNo, description, effectiveDate, undefined, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleReplacePolicy = async (policyId: string, replacement: any, reason: string) => {
    await cimsApi.replacePolicy(policyId, replacement, reason, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleCancelPolicy = async (policyId: string, reason: string) => {
    await cimsApi.cancelPolicy(policyId, reason, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleClosePolicy = async (policyId: string, reason: string) => {
    await cimsApi.closePolicy(policyId, reason, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleReopenPolicy = async (policyId: string, reason: string) => {
    await cimsApi.reopenPolicy(policyId, reason, currentUser?.username || 'CRO_USER');
    await loadData();
  };

  const handleApproveTask = async (taskId: string, comments: string) => {
    try {
      await cimsApi.approveWorkflowTask(taskId, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      await loadData();
    } catch (e: any) {
      alert(`Approval failed: ${e?.message || 'The approval could not be completed.'}`);
      throw e;
    }
  };

  const handleRejectTask = async (taskId: string, comments: string) => {
    try {
      await cimsApi.rejectWorkflowTask(taskId, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      await loadData();
    } catch (e: any) {
      alert(`Rejection failed: ${e?.message || 'The rejection could not be completed.'}`);
      throw e;
    }
  };

  const handleReturnTask = async (taskId: string, note: string) => {
    try {
      await cimsApi.returnWorkflowTask(taskId, note, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      await loadData();
    } catch (e: any) {
      alert(`Return failed: ${e?.message || 'The task could not be returned.'}`);
      throw e;
    }
  };

  const handleResubmitTask = async (taskId: string) => {
    await cimsApi.resubmitWorkflowTask(taskId, currentUser?.username || currentUser?.userId || 'CRO_USER');
    await loadData();
  };

  const handleBulkApprove = async (taskIds: string[], comments: string) => {
    await cimsApi.bulkApproveWorkflowTasks(taskIds, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
    await loadData();
  };

  const handleCreateDelegation = async (del: Partial<Delegation>) => {
    await cimsApi.createDelegation(del);
    await loadData();
  };

  const handleRevokeDelegation = async (id: string) => {
    await cimsApi.revokeDelegation(id);
    await loadData();
  };

  const handleResolveException = async (id: string, action: string, notes: string) => {
    await cimsApi.resolveException(id, action, notes);
    await loadData();
  };

  const handleEscalateException = async (id: string, role: string) => {
    await cimsApi.escalateException(id, role);
    await loadData();
  };

  const handleScanExceptions = async () => {
    await cimsApi.triggerPortfolioScan();
    await loadData();
  };

  const handleUploadDocument = async (entityType: string, entityId: string, name: string, type: string, expiry?: string, fileDetails?: any) => {
    await cimsApi.uploadDocument(entityType, entityId, name, type, expiry, currentUser?.username || 'COLLDOCOFF_USER', fileDetails);
    await loadData();
  };

  const handleSaveScheduledReport = async (report: Partial<ScheduledReport>) => {
    await cimsApi.saveScheduledReport(report);
    await loadData();
  };

  const handleSaveSegment = async (seg: Partial<BusinessSegment>) => {
    await cimsApi.saveSegment(seg);
    await loadData();
  };

  const handleToggleSegmentStatus = async (id: string, active: boolean) => {
    await cimsApi.toggleSegmentStatus(id, active);
    await loadData();
  };

  const handleSavePermissionsBatch = async (perms: RolePermission[]) => {
    await cimsApi.saveRolePermissionsBatch(perms);
    await loadData();
  };

  const handleSaveUser = async (user: any) => {
    await cimsApi.saveUser(user);
    await loadData();
  };

  const handleToggleUserStatus = async (userId: string, active: boolean) => {
    await cimsApi.toggleUserStatus(userId, active);
    await loadData();
  };

  const handleSaveBranch = async (branch: Partial<Branch>) => {
    await cimsApi.saveBranch(branch);
    await loadData();
  };

  const handleSaveApprovalConfig = async (cfg: Partial<ApprovalHierarchyConfig>) => {
    await cimsApi.saveApprovalConfig(cfg);
    await loadData();
  };

  const handleSaveReminderSchedule = async (sched: Partial<ReminderSchedule>) => {
    await cimsApi.saveReminderSchedule(sched);
    await loadData();
  };

  const handleSaveParameter = async (param: Partial<SystemParameter>) => {
    await cimsApi.saveSystemParameter(param);
    await loadData();
  };

  const handleSaveInsurer = async (ins: Partial<ApprovedInsurer>) => {
    await cimsApi.saveApprovedInsurer(ins);
    await loadData();
  };

  const handleSaveTaxonomy = async (tax: Partial<CollateralTaxonomy>) => {
    await cimsApi.saveCollateralTaxonomy(tax);
    await loadData();
  };

  const handleSaveMandatoryDocRule = async (rule: Partial<MandatoryDocumentRule>) => {
    await cimsApi.saveMandatoryDocRule(rule);
    await loadData();
  };

  const handleSaveHoliday = async (holiday: Partial<HolidayCalendar>) => {
    await cimsApi.saveHolidayCalendar(holiday);
    await loadData();
  };

  // Dynamically resolve screen permissions for current page and current user's role
  const activeScreenPermission = useMemo(() => {
    if (!permissions || permissions.length === 0 || !currentUser) return null;
    const pageKey = activePage.toLowerCase().replace(/[^a-z0-9]/g, '');
    return permissions.find((p) => {
      if (p.roleCode !== currentUser.role) return false;
      const screen = p.screenName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (screen === pageKey || screen.includes(pageKey) || pageKey.includes(screen)) return true;
      if (pageKey === 'collateral' && screen.includes('collat')) return true;
      if (pageKey === 'customers' && screen.includes('custom')) return true;
      if (pageKey === 'facilities' && screen.includes('facilit')) return true;
      if (pageKey === 'insurance' && (screen.includes('insuran') || screen.includes('polic'))) return true;
      if (pageKey === 'approvals' && (screen.includes('approv') || screen.includes('workflow'))) return true;
      if (pageKey === 'exceptions' && screen.includes('except')) return true;
      if (pageKey === 'documents' && (screen.includes('docum') || screen.includes('dms'))) return true;
      if (pageKey === 'reports' && screen.includes('report')) return true;
      if (pageKey === 'audit' && screen.includes('audit')) return true;
      if (pageKey === 'cbssim' && screen.includes('cbs')) return true;
      if (pageKey === 'notifications' && screen.includes('notif')) return true;
      return false;
    });
  }, [permissions, currentUser, activePage]);

  const effectiveUserSession: UserSession = useMemo(() => {
    if (!currentUser) return INITIAL_PERSONAS[0];
    if (currentUser.role === 'SYSADMIN') {
      return { ...currentUser, canCreate: true, canEdit: true, canApprove: false, canDelete: true };
    }
    if (activeScreenPermission) {
      return {
        ...currentUser,
        canCreate: activeScreenPermission.canCreate,
        canEdit: activeScreenPermission.canEdit,
        canApprove: activeScreenPermission.canApprove,
        canDelete: activeScreenPermission.canDelete,
      };
    }
    return currentUser;
  }, [currentUser, activeScreenPermission]);

  const isCurrentPageViewAllowed = useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.role === 'SYSADMIN') return true;
    if (activePage === 'admin') return false;
    if (activeScreenPermission) {
      return activeScreenPermission.canView;
    }
    return true;
  }, [currentUser, activePage, activeScreenPermission]);

  // If not logged in, render Login screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSelectPersona={(persona) => { setCurrentUser(persona); cimsApi.setCurrentUser(persona); }}
        availablePersonas={allUsersList}
      />
    );
  }

  const unreadNotifs = notifications.filter((n) => n.status !== 'Sent').length;

  // Memoized Scoped Data Collections based on selectedSegment and currentUser role
  const effectiveSegment = useMemo(() => {
    const isBankWideRole = ['EXEC', 'SRMGMT', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK', 'MGRCOLLDOC', 'DISTDIR', 'BRMGR'].includes(currentUser.role);
    if (isBankWideRole) {
      return selectedSegment || 'ALL';
    }
    if (currentUser.role === 'HODEPT') {
      return currentUser.segment || 'Corporate Banking';
    }
    const userSegmentList = currentUser.segmentIds && currentUser.segmentIds.length > 0
      ? currentUser.segmentIds
      : (currentUser.segment ? [currentUser.segment] : ['Corporate Banking']);
    if (userSegmentList.length > 1) {
      return userSegmentList.includes(selectedSegment) ? selectedSegment : (selectedSegment === 'ALL' ? 'ALL' : userSegmentList[0]);
    }
    return currentUser.segment || 'Corporate Banking';
  }, [currentUser, selectedSegment]);

  const scopedCustomers = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return customers;
    return customers.filter(c => c.segment?.toLowerCase() === effectiveSegment.toLowerCase());
  }, [customers, effectiveSegment]);

  const scopedCustomerIds = useMemo(() => {
    return new Set(scopedCustomers.flatMap(c => [c.id, c.cif].filter(Boolean)));
  }, [scopedCustomers]);

  const scopedFacilities = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return facilities;
    return facilities.filter(f => {
      if (f.segment && f.segment.toLowerCase() === effectiveSegment.toLowerCase()) return true;
      if (f.customerId && scopedCustomerIds.has(f.customerId)) return true;
      return false;
    });
  }, [facilities, scopedCustomerIds, effectiveSegment]);

  const scopedCollaterals = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return collaterals;
    return collaterals.filter(col => {
      if (col.owningSegment && col.owningSegment.toLowerCase() === effectiveSegment.toLowerCase()) return true;
      if (col.customerId && scopedCustomerIds.has(col.customerId)) return true;
      return false;
    });
  }, [collaterals, scopedCustomerIds, effectiveSegment]);

  const scopedCollateralIds = useMemo(() => {
    return new Set(scopedCollaterals.map(c => c.id).filter(Boolean));
  }, [scopedCollaterals]);

  const scopedLinks = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return links;
    return links.filter(l => scopedCollateralIds.has(l.collateralId));
  }, [links, scopedCollateralIds, effectiveSegment]);

  const scopedPolicies = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return policies;
    return policies.filter(p => {
      if (p.collateralId && scopedCollateralIds.has(p.collateralId)) return true;
      if (p.customerId && scopedCustomerIds.has(p.customerId)) return true;
      return false;
    });
  }, [policies, scopedCollateralIds, scopedCustomerIds, effectiveSegment]);

  const scopedDocuments = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return documents;
    return documents.filter(d => {
      if (d.collateralId && scopedCollateralIds.has(d.collateralId)) return true;
      if (d.entityId && (scopedCollateralIds.has(d.entityId) || scopedCustomerIds.has(d.entityId))) return true;
      return false;
    });
  }, [documents, scopedCollateralIds, scopedCustomerIds, effectiveSegment]);

  const scopedExceptions = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return exceptions;
    return exceptions.filter(e => {
      if (e.entityId && (scopedCollateralIds.has(e.entityId) || scopedCustomerIds.has(e.entityId))) return true;
      return false;
    });
  }, [exceptions, scopedCollateralIds, scopedCustomerIds, effectiveSegment]);

  const scopedWorkflowTasks = useMemo(() => {
    if (!effectiveSegment || effectiveSegment === 'ALL') return workflowTasks;
    return workflowTasks.filter(t => {
      if (t.entityId && (scopedCollateralIds.has(t.entityId) || scopedCustomerIds.has(t.entityId))) return true;
      return true;
    });
  }, [workflowTasks, scopedCollateralIds, scopedCustomerIds, effectiveSegment]);

  const pendingApprovals = scopedWorkflowTasks.filter((t) => t.status === 'Pending').length;
  const openExceptions = scopedExceptions.filter((e) => e.status !== 'Resolved').length;

  return (
    <div className="h-screen bg-[#EFF5FB] flex flex-col font-sans text-[#101828] overflow-hidden">
      {/* TopBar */}
      <TopBar
        currentUser={currentUser}
        allUsers={allUsersList}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          if (['EXEC', 'SRMGMT', 'BRMGR', 'DISTDIR', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK', 'MGRCOLLDOC'].includes(user.role)) {
            setSelectedSegment('ALL');
          } else {
            setSelectedSegment(user.segment || 'Corporate Banking');
          }
        }}
        selectedSegment={selectedSegment}
        onSelectSegment={setSelectedSegment}
        availableSegments={segments && segments.length > 0 ? segments.filter(s => s.active !== false).map(s => s.name) : (currentUser.segmentIds || ['Corporate Banking'])}
        unreadNotificationCount={unreadNotifs}
        pendingApprovalCount={pendingApprovals}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenApprovals={() => setActivePage('approvals')}
        onChangePassword={() => setShowChangePassword(true)}
        onDelegateAuthority={() => setActivePage('approvals')}
        onLogout={handleLogout}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => setActivePage(page)}
          userRole={currentUser.role}
          permissions={permissions}
          pendingApprovalCount={pendingApprovals}
          openExceptionCount={openExceptions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0 bg-[#EFF5FB]">
          <div className="sticky top-0 z-20 shrink-0">
            <Breadcrumbs activePage={activePage} onNavigateHome={() => setActivePage('dashboard')} />
          </div>

          {/* Active Business Segment Scope Indicator */}
          {effectiveSegment !== 'ALL' && (
            <div className="mx-6 mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-700">🏢 Active Segment Filter:</span>
                <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-300">{effectiveSegment}</span>
                <span className="text-blue-600 text-[11px]">(All master records, loans, collateral, and policies are scoped to this business unit)</span>
              </div>
              {['EXEC', 'SRMGMT', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK'].includes(currentUser.role) && (
                <button
                  onClick={() => setSelectedSegment('ALL')}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline hover:no-underline"
                >
                  View All Segments (Bank-Wide)
                </button>
              )}
            </div>
          )}

          {/* Page Routing */}
          <div className="flex-1 pb-10">
            {!isCurrentPageViewAllowed ? (
              <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Access Restricted by Administrator</h2>
                <p className="text-xs text-gray-600 max-w-md mt-2">
                  Your current role <strong>({currentUser.role})</strong> does not have View permission for the <strong>{activePage.toUpperCase()}</strong> module as configured in the System Administration Role Matrix (§2.1).
                </p>
                <button onClick={() => setActivePage('dashboard')} className="btn-primary mt-4 py-1.5 px-4 text-xs">
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
            {activePage === 'dashboard' && (
              <DashboardContainer
                currentUser={effectiveUserSession}
                selectedSegment={selectedSegment}
                onSelectSegment={setSelectedSegment}
                customers={scopedCustomers}
                facilities={scopedFacilities}
                collaterals={scopedCollaterals}
                policies={scopedPolicies}
                exceptions={scopedExceptions}
                workflowTasks={scopedWorkflowTasks}
                documents={scopedDocuments}
                links={scopedLinks}
                segments={segments}
                branches={branches}
                systemParameters={systemParameters}
                onNavigate={(page, params) => {
                  setActivePage(page);
                }}
                onApproveTask={handleApproveTask}
                onRejectTask={handleRejectTask}
              />
            )}

            {activePage === 'customers' && (
              <CustomerManager
                customers={scopedCustomers}
                facilities={scopedFacilities}
                collaterals={scopedCollaterals}
                policies={scopedPolicies}
                documents={scopedDocuments}
                segments={segments}
                branches={branches}
                currentUser={effectiveUserSession}
                onRegisterManualCustomer={handleRegisterManualCustomer}
                onMaintainCustomer={handleMaintainCustomer}
              />
            )}

            {activePage === 'facilities' && (
              <FacilityManager
                facilities={scopedFacilities}
                customers={scopedCustomers}
                collaterals={scopedCollaterals}
                links={scopedLinks}
                policies={scopedPolicies}
              />
            )}

            {activePage === 'collateral' && (
              <CollateralManager
                collaterals={scopedCollaterals}
                facilities={scopedFacilities}
                links={scopedLinks}
                policies={scopedPolicies}
                documents={scopedDocuments}
                exceptions={scopedExceptions}
                taxonomies={taxonomies}
                mandatoryDocRules={mandatoryDocRules}
                segments={segments}
                branches={branches}
                customers={scopedCustomers}
                systemParameters={systemParameters}
                currentUser={effectiveUserSession}
                onRegisterCollateral={handleRegisterCollateral}
                onAddLink={handleAddLink}
                onRemoveLink={handleRemoveLink}
                onValidateRelease={handleValidateRelease}
                onInitiateTransfer={handleInitiateTransfer}
                onMaintainCollateral={handleMaintainCollateral}
              />
            )}

            {activePage === 'insurance' && (
              <PolicyManager
                policies={scopedPolicies}
                endorsements={endorsements}
                collaterals={scopedCollaterals}
                customers={scopedCustomers}
                insurers={insurers}
                documents={scopedDocuments}
                systemParameters={systemParameters}
                currentUser={effectiveUserSession}
                onCreatePolicyDraft={handleCreatePolicyDraft}
                onSubmitPolicy={handleSubmitPolicy}
                onAmendPolicy={handleAmendPolicy}
                onRenewPolicy={handleRenewPolicy}
                onEndorsePolicy={handleEndorsePolicy}
                onReplacePolicy={handleReplacePolicy}
                onCancelPolicy={handleCancelPolicy}
                onClosePolicy={handleClosePolicy}
                onReopenPolicy={handleReopenPolicy}
              />
            )}

            {activePage === 'approvals' && (
              <MakerCheckerInbox
                tasks={scopedWorkflowTasks}
                delegations={delegations}
                allUsers={allUsersList}
                currentUser={effectiveUserSession}
                onApproveTask={handleApproveTask}
                onRejectTask={handleRejectTask}
                onReturnTask={handleReturnTask}
                onResubmitTask={handleResubmitTask}
                onBulkApprove={handleBulkApprove}
                onCreateDelegation={handleCreateDelegation}
                onRevokeDelegation={handleRevokeDelegation}
              />
            )}

            {activePage === 'exceptions' && (
              <ExceptionManager
                exceptions={scopedExceptions}
                currentUser={effectiveUserSession}
                onResolveException={handleResolveException}
                onEscalateException={handleEscalateException}
                onScanNow={handleScanExceptions}
              />
            )}

            {activePage === 'documents' && (
              <DocumentRepository
                documents={scopedDocuments}
                collaterals={scopedCollaterals}
                mandatoryDocRules={mandatoryDocRules}
                currentUser={effectiveUserSession}
                onUploadDocument={handleUploadDocument}
                onRefreshData={loadData}
              />
            )}

            {activePage === 'reports' && (
              <ReportCatalog
                customers={scopedCustomers}
                facilities={scopedFacilities}
                collaterals={scopedCollaterals}
                policies={scopedPolicies}
                exceptions={scopedExceptions}
                auditLogs={auditLogs}
                scheduledReports={scheduledReports}
                currentUser={effectiveUserSession}
                onSaveScheduledReport={handleSaveScheduledReport}
              />
            )}

            {activePage === 'admin' && (
              <AdminPortal
                segments={segments}
                branches={branches}
                permissions={permissions}
                approvalConfigs={approvalConfigs}
                reminderSchedules={reminderSchedules}
                scheduledReports={scheduledReports}
                insurers={insurers}
                taxonomies={taxonomies}
                mandatoryDocRules={mandatoryDocRules}
                holidayCalendars={holidayCalendars}
                systemParameters={systemParameters}
                allUsers={allUsersList}
                currentUser={effectiveUserSession}
                onSaveSegment={handleSaveSegment}
                onToggleSegmentStatus={handleToggleSegmentStatus}
                onSavePermissionsBatch={handleSavePermissionsBatch}
                onSaveUser={handleSaveUser}
                onToggleUserStatus={handleToggleUserStatus}
                onSaveBranch={handleSaveBranch}
                onSaveApprovalConfig={handleSaveApprovalConfig}
                onSaveReminderSchedule={handleSaveReminderSchedule}
                onSaveParameter={handleSaveParameter}
                onSaveInsurer={handleSaveInsurer}
                onSaveTaxonomy={handleSaveTaxonomy}
                onSaveMandatoryDocRule={handleSaveMandatoryDocRule}
                onSaveHoliday={handleSaveHoliday}
              />
            )}

            {activePage === 'audit' && (
              <AuditTrailViewer auditLogs={auditLogs} currentUser={effectiveUserSession} />
            )}

            {activePage === 'notifications' && (
              <NotificationManager
                notifications={notifications}
                currentUser={effectiveUserSession}
                onTriggerScan={handleScanExceptions}
              />
            )}

            {activePage === 'cbs-sim' && (
              <CbsSimulator
                customers={cbsCustomers}
                facilities={cbsFacilities}
                collaterals={cbsCollaterals}
                syncLogs={cbsSyncLogs}
                onSyncEntity={handleSyncEntity}
                onSyncAll={handleSyncAll}
                onSaveCustomer={handleSaveCbsCustomer}
                onSaveFacility={handleSaveCbsFacility}
                onSaveCollateral={handleSaveCbsCollateral}
              />
            )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
      />

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={async () => true}
      />

      <SessionTimeoutModal
        isOpen={showSessionTimeout}
        onStayLoggedIn={() => setShowSessionTimeout(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;

