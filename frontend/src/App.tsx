import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
} from './types';
import { cimsApi, SESSION_EXPIRED_EVENT } from './api/cimsApi';
import {
  defaultSegmentFor,
  findScreenPermission,
  isReadOnlyUser,
  normalizePermissions,
  scopeSignature,
  toUserSession,
} from './auth/session';
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
import { NotificationProvider, useInAppNotification } from './context/NotificationContext';

function getPageFromUrl(): NavPageId {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const route = path || hash;
  if (route === 'admin' || route === 'sysadmin') return 'admin';
  if (route === 'collateral' || route === 'collaterals') return 'collateral';
  if (route === 'facilities' || route === 'facility') return 'facilities';
  if (route === 'insurance' || route === 'policies' || route === 'policy') return 'insurance';
  if (route === 'customers' || route === 'customer') return 'customers';
  if (route === 'approvals' || route === 'workflow') return 'approvals';
  if (route === 'exceptions' || route === 'exception') return 'exceptions';
  if (route === 'documents' || route === 'dms') return 'documents';
  if (route === 'reports' || route === 'report') return 'reports';
  if (route === 'audit' || route === 'audittrail') return 'audit';
  if (route === 'notifications' || route === 'notif') return 'notifications';
  if (route === 'cbssim' || route === 'cbs-sim' || route === 'cbs') return 'cbs-sim';
  return 'dashboard';
}

function updateUrlForPage(page: NavPageId) {
  if (typeof window === 'undefined') return;
  const targetPath = page === 'dashboard' ? '/' : `/${page}`;
  if (window.location.pathname !== targetPath) {
    window.history.pushState({ page }, '', targetPath);
  }
}

function AppContent() {
  const { showToast, showError, showSuccess, showWarning, showConfirm } = useInAppNotification();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('cims.currentUser') || 'null');
      const token = localStorage.getItem('cims.token') || stored?.token;
      if (
        stored?.role &&
        stored?.username &&
        typeof token === 'string' &&
        token.startsWith('cims_tkn.')
      ) {
        return toUserSession({ ...stored, token });
      }
    } catch { }
    return null;
  });
  const [sessionVerified, setSessionVerified] = useState(() => !currentUser);
  const [activePage, setActivePage] = useState<NavPageId>(() => getPageFromUrl());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(() => defaultSegmentFor(currentUser));
  const authoritativeScopeRef = useRef<string>(scopeSignature(currentUser));

  useEffect(() => {
    const onPopState = () => {
      setActivePage(getPageFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Deep-linking navigation target IDs
  const [targetFacilityId, setTargetFacilityId] = useState<string | null>(null);
  const [targetCollateralId, setTargetCollateralId] = useState<string | null>(null);
  const [targetPolicyId, setTargetPolicyId] = useState<string | null>(null);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetDocumentId, setTargetDocumentId] = useState<string | null>(null);
  const [targetExceptionId, setTargetExceptionId] = useState<string | null>(null);

  const handleNavigate = (page: string, params?: Record<string, any>) => {
    let targetPage: NavPageId = page as NavPageId;
    if (page === 'policies') targetPage = 'insurance';
    if (page === 'collaterals') targetPage = 'collateral';

    // Always clear stale deep links. A detail modal must only open when the
    // caller explicitly supplies an id for this navigation.
    const byPageId = params?.id || params?.entityId || null;
    setTargetFacilityId(params?.facilityId || (targetPage === 'facilities' ? byPageId : null));
    setTargetCollateralId(params?.collateralId || (targetPage === 'collateral' ? byPageId : null));
    setTargetPolicyId(params?.policyId || (targetPage === 'insurance' ? byPageId : null));
    setTargetCustomerId(params?.customerId || params?.cif || (targetPage === 'customers' ? (params?.selectedCif || byPageId) : null));
    setTargetDocumentId(params?.documentId || (targetPage === 'documents' ? byPageId : null));
    setTargetExceptionId(params?.exceptionId || (targetPage === 'exceptions' ? byPageId : null));

    setActivePage(targetPage);
    updateUrlForPage(targetPage);
  };

  // Modals & Drawers
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessionTimeout, setShowSessionTimeout] = useState(false);

  const expireSession = useCallback((message: string) => {
    cimsApi.setCurrentUser(null);
    setCurrentUser(null);
    setLoginNotice(message);
    setActivePage('dashboard');
    setShowSessionTimeout(false);
    setShowNotifications(false);
    setShowChangePassword(false);
    setSessionVerified(true);
    setSelectedSegment('ALL');
    setTargetFacilityId(null);
    setTargetCollateralId(null);
    setTargetPolicyId(null);
    setTargetCustomerId(null);
    setTargetDocumentId(null);
    setTargetExceptionId(null);
  }, []);

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
  const [allUsersList, setAllUsersList] = useState<UserSession[]>([]);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  const applyAuthoritativeUser = useCallback((next: UserSession | null) => {
    const signature = scopeSignature(next);
    if (signature === authoritativeScopeRef.current) return;
    authoritativeScopeRef.current = signature;
    cimsApi.setCurrentUser(next);
    setCurrentUser(next);
  }, []);

  // Fetch initial data. The validated backend user is the only source of
  // role, branch, segment and permission values used by the workspace.
  const loadData = async (actor: UserSession | null = currentUser) => {
    if (!actor) return;
    try {
      setDataLoadError(null);
      const session = await cimsApi.validateSession();
      if (!session.valid || session.active === false || !session.user) {
        expireSession('Your session expired. Please sign in again.');
        return;
      }

      const token = localStorage.getItem('cims.token') || actor.token;
      const validated = toUserSession({ ...session.user, token });
      if (!validated || validated.username.toLowerCase() !== actor.username.toLowerCase()) {
        expireSession('Your session is no longer valid. Please sign in again.');
        return;
      }
      applyAuthoritativeUser(validated);
      setSessionVerified(true);

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
        cimsApi.getWorkflowTasks(validated.role, undefined, validated.username || validated.userId),
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

      const effectivePermissions = normalizePermissions(
        validated.permissions?.length ? validated.permissions : permRes,
        permRes,
        validated.role
      );
      setPermissions(effectivePermissions);
      const userWithPermissions = toUserSession(
        { ...session.user, permissions: effectivePermissions, token },
        effectivePermissions
      );
      if (userWithPermissions) applyAuthoritativeUser(userWithPermissions);

      setAllUsersList(
        Array.isArray(usersRes)
          ? usersRes
              .map((u: any) => toUserSession({ ...u, permissions: effectivePermissions }, effectivePermissions))
              .filter((u): u is UserSession => u !== null)
          : []
      );
    } catch (err: any) {
      if (err?.status === 401) {
        expireSession('Your session expired. Please sign in again.');
        return;
      }
      setSessionVerified(true);
      console.warn('Backend API communication error.', err);
      setDataLoadError(err?.message || 'Unable to communicate with CIMS backend services');
    }
  };

  useEffect(() => {
    if (currentUser) {
      authoritativeScopeRef.current = scopeSignature(currentUser);
      setSelectedSegment(defaultSegmentFor(currentUser));
      setSessionVerified(false);
      cimsApi.setCurrentUser(currentUser);
      loadData(currentUser);
    } else {
      setSessionVerified(true);
    }
    // Reload when the authenticated identity changes, not when its permissions object is refreshed.
  }, [currentUser?.userId]);

  // Session Inactivity Timeout Tracking (Default 15 minutes or from backend policy)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(15);
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState(120);
  const lastActivityRef = useRef<number>(Date.now());
  const lastSessionRefreshRef = useRef<number>(0);

  useEffect(() => {
    cimsApi.getPasswordPolicy().then((p) => {
      if (p?.sessionTimeoutMinutes) setSessionTimeoutMinutes(p.sessionTimeoutMinutes);
    }).catch(() => { });
  }, []);

  // Cross-tab synchronization for logout events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cims.logout_event' || (e.key === 'cims.token' && !e.newValue)) {
        expireSession('Your session has ended. Please sign in again.');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [expireSession]);

  // Any protected API returning 401 means the backend session expired.
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      expireSession(detail?.message || 'Your session has expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [expireSession]);

  useEffect(() => {
    if (!currentUser) return;
    lastActivityRef.current = Date.now();
    lastSessionRefreshRef.current = Date.now();

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      // Slide the server-side session at most once a minute; the backend is
      // still authoritative and rejects expired/revoked tokens independently.
      if (now - lastSessionRefreshRef.current >= 60_000) {
        lastSessionRefreshRef.current = now;
        void cimsApi.keepSessionAlive().catch(() => { });
      }
    };

    const events = ['mousemove', 'mousedown', 'pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart', 'focus', 'visibilitychange'];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleMinutes = (Date.now() - lastActivityRef.current) / (60 * 1000);
      const warningThreshold = Math.max(1, sessionTimeoutMinutes - 2);
      if (idleMinutes >= sessionTimeoutMinutes) {
        setShowSessionTimeout(false);
        void cimsApi.logout().catch(() => { });
        expireSession('Your session expired due to inactivity. Please sign in again.');
      } else if (idleMinutes >= warningThreshold) {
        setSessionWarningSeconds(Math.max(1, Math.ceil((sessionTimeoutMinutes - idleMinutes) * 60)));
        setShowSessionTimeout(true);
      }
    }, 10_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(interval);
    };
  }, [currentUser, sessionTimeoutMinutes, expireSession]);

  const handleStayLoggedIn = async () => {
    try {
      const res = await cimsApi.keepSessionAlive();
      if (res && res.success) {
        lastActivityRef.current = Date.now();
        lastSessionRefreshRef.current = Date.now();
        if (res.sessionTimeoutMinutes) setSessionTimeoutMinutes(res.sessionTimeoutMinutes);
        if (res.expiresAt) setSessionWarningSeconds(Math.max(1, Math.ceil((new Date(res.expiresAt).getTime() - Date.now()) / 1000)));
        setShowSessionTimeout(false);
      } else {
        await handleLogout();
      }
    } catch {
      await handleLogout();
    }
  };

  // Auth Handlers
  const handleLogin = async (user: string, pass: string): Promise<boolean | { success: boolean; message?: string }> => {
    try {
      const authRes = await cimsApi.login(user, pass);
      if (authRes.success && authRes.user) {
        if (!authRes.token) {
          return { success: false, message: 'Authentication failed: server did not issue a valid session token.' };
        }
        const session = toUserSession({ ...authRes.user, token: authRes.token });
        if (!session) {
          return { success: false, message: 'Authentication failed: server did not return a valid user role.' };
        }
        authoritativeScopeRef.current = scopeSignature(session);
        setSelectedSegment(defaultSegmentFor(session));
        setSessionVerified(false);
        setCurrentUser(session);
        cimsApi.setCurrentUser(session);
        setLoginNotice(null);
        setActivePage('dashboard');
        setTargetFacilityId(null);
        setTargetCollateralId(null);
        setTargetPolicyId(null);
        setTargetCustomerId(null);
        setTargetDocumentId(null);
        setTargetExceptionId(null);
        lastActivityRef.current = Date.now();
        lastSessionRefreshRef.current = Date.now();
        if (authRes.sessionTimeoutMinutes) setSessionTimeoutMinutes(authRes.sessionTimeoutMinutes);
        return { success: true };
      } else if (authRes && !authRes.success) {
        return { success: false, message: authRes.message || 'Invalid username/email or password.' };
      }
    } catch (e: any) {
      console.warn('Backend login request error:', e);
      return { success: false, message: e?.message || 'Authentication service error.' };
    }
    return { success: false, message: 'Invalid credentials or account is locked.' };
  };

  const handleLogout = async () => {
    try {
      await cimsApi.logout();
    } catch { }
    setCurrentUser(null);
    cimsApi.setCurrentUser(null);
    setLoginNotice(null);
    setShowSessionTimeout(false);
    setTargetFacilityId(null);
    setTargetCollateralId(null);
    setTargetPolicyId(null);
    setTargetCustomerId(null);
    setTargetDocumentId(null);
    setTargetExceptionId(null);
  };

  // CBS Simulator Handlers
  const handleSyncEntity = async (type: string, id: string) => {
    const res = await cimsApi.syncCbsEntity(type, id);
    await loadData();
    return res;
  };

  const handleSyncAll = async () => {
    const res = await cimsApi.syncAllPending();
    await loadData();
    return res;
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
      showError(e?.message || 'The collateral could not be registered.', 'Collateral Registration Failed');
      throw e;
    }
  };

  const handleAddLink = async (
    loanId: string,
    collateralId: string,
    amount: number,
    linkageType?: string,
    effectiveDate?: string,
    endDate?: string
  ) => {
    await cimsApi.addFacilityLink(loanId, collateralId, amount, currentUser?.userId || currentUser?.username, linkageType, effectiveDate, endDate);
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
      showError(e?.message || 'The policy could not be saved.', 'Policy Registration Failed');
      throw e;
    }
  };

  const handleSubmitPolicy = async (policyId: string) => {
    try {
      await cimsApi.submitPolicy(policyId, currentUser?.username || 'CRO_USER');
      await loadData();
    } catch (e: any) {
      showError(e?.message || 'The policy could not be submitted.', 'Policy Submission Failed');
      throw e;
    }
  };

  const handleAmendPolicy = async (policyId: string, pol: Partial<InsurancePolicy>, reason: string, documents?: any[]) => {
    await cimsApi.amendPolicy(policyId, pol, reason, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleRenewPolicy = async (policyId: string, amt: number, prem: number, exp: string, documents?: any[]) => {
    await cimsApi.renewPolicy(policyId, amt, prem, exp, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleEndorsePolicy = async (policyId: string, endorsementNo: string, description: string, effectiveDate?: string, documentId?: string, documents?: any[]) => {
    await cimsApi.endorsePolicy(policyId, endorsementNo, description, effectiveDate, documentId, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleReplacePolicy = async (policyId: string, replacement: any, reason: string, documents?: any[]) => {
    await cimsApi.replacePolicy(policyId, replacement, reason, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleCancelPolicy = async (policyId: string, reason: string, documents?: any[]) => {
    await cimsApi.cancelPolicy(policyId, reason, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleClosePolicy = async (policyId: string, reason: string, documents?: any[]) => {
    await cimsApi.closePolicy(policyId, reason, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleReopenPolicy = async (policyId: string, reason: string, documents?: any[]) => {
    await cimsApi.reopenPolicy(policyId, reason, currentUser?.username || 'CRO_USER', documents);
    await loadData();
  };

  const handleApproveTask = async (taskId: string, comments: string) => {
    try {
      const res = await cimsApi.approveWorkflowTask(taskId, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      // Optimistically update workflow tasks state immediately so the approved task immediately transitions out of the pending queue
      setWorkflowTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
              ...t,
              status: (res?.workflowStatus || 'Approved') as any,
              currentStep: res?.action === 'APPROVE_LEVEL1' ? 'Level 2 Review' : 'Completed',
              candidateRole: res?.action === 'APPROVE_LEVEL1' ? (res?.candidateRole || t.candidateRole) : t.candidateRole,
              completedAt: new Date().toISOString(),
              remarks: comments || t.remarks,
            }
            : t
        )
      );
      await loadData();
    } catch (e: any) {
      showError(e?.message || 'The approval could not be completed.', 'Approval Failed');
      throw e;
    }
  };

  const handleRejectTask = async (taskId: string, comments: string) => {
    try {
      await cimsApi.rejectWorkflowTask(taskId, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      setWorkflowTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'Rejected' as any, currentStep: 'Rejected', remarks: comments || t.remarks }
            : t
        )
      );
      await loadData();
    } catch (e: any) {
      showError(e?.message || 'The rejection could not be completed.', 'Rejection Failed');
      throw e;
    }
  };

  const handleReturnTask = async (taskId: string, note: string) => {
    try {
      await cimsApi.returnWorkflowTask(taskId, note, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
      setWorkflowTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'Returned' as any, currentStep: 'Returned to Maker', remarks: note || t.remarks }
            : t
        )
      );
      await loadData();
    } catch (e: any) {
      showError(e?.message || 'The task could not be returned.', 'Return Failed');
      throw e;
    }
  };

  const handleResubmitTask = async (taskId: string) => {
    await cimsApi.resubmitWorkflowTask(taskId, currentUser?.username || currentUser?.userId || 'CRO_USER');
    setWorkflowTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'Pending' as any, currentStep: 'Checker Review' }
          : t
      )
    );
    await loadData();
  };

  const handleBulkApprove = async (taskIds: string[], comments: string) => {
    const idSet = new Set(taskIds);
    await cimsApi.bulkApproveWorkflowTasks(taskIds, comments, currentUser?.username || 'BRMGR_USER', currentUser?.role || 'BRMGR');
    setWorkflowTasks((prev) =>
      prev.map((t) =>
        idSet.has(t.id)
          ? { ...t, status: 'Approved' as any, currentStep: 'Completed', completedAt: new Date().toISOString() }
          : t
      )
    );
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

  const handleResolveException = async (id: string, action: string, notes: string, evidenceDoc?: string) => {
    await cimsApi.resolveException(id, action, notes, evidenceDoc);
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
    await cimsApi.saveMandatoryDocRule(rule, currentUser?.username || 'SYSADMIN');
    await loadData();
  };

  const handleDeleteMandatoryDocRule = async (ruleId: string) => {
    await cimsApi.deleteMandatoryDocRule(ruleId, currentUser?.username || 'SYSADMIN');
    await loadData();
  };

  const handleDeleteAllMandatoryDocRules = async () => {
    await cimsApi.deleteAllMandatoryDocRules(currentUser?.username || 'SYSADMIN');
    await loadData();
  };

  const handleSaveHoliday = async (holiday: Partial<HolidayCalendar>) => {
    await cimsApi.saveHolidayCalendar(holiday);
    await loadData();
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    await cimsApi.deleteHolidayCalendar(holidayId, currentUser?.username || 'SYSADMIN');
    await loadData();
  };

  const handleResendNotification = async (id: string) => {
    try {
      const updated = await cimsApi.resendNotification(id, currentUser?.username || 'SYSADMIN');
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...updated } : n)));
      await loadData();
    } catch (e: any) {
      console.error('Notification retry failed', e);
    }
  };

  // Dynamically resolve authority from the backend permission matrix for the current role.
  const permissionSource = currentUser?.permissions?.length ? currentUser.permissions : permissions;

  const canViewActivePage = useMemo(() => {
    if (!currentUser) return true;
    if (activePage === 'dashboard') return true;
    if (activePage === 'admin') return currentUser.isAdmin === true;
    const permission = findScreenPermission(permissionSource, currentUser.role, activePage);
    return permission ? permission.canView : false;
  }, [currentUser, activePage, permissionSource]);

  // Unauthorized modules are never rendered. Return the user to the single
  // role-driven dashboard instead of displaying an access-denied screen.
  useEffect(() => {
    if (currentUser && !canViewActivePage && activePage !== 'dashboard') {
      setActivePage('dashboard');
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.replaceState({ page: 'dashboard' }, '', '/');
      }
    }
  }, [currentUser, canViewActivePage, activePage]);

  const visiblePage: NavPageId = canViewActivePage ? activePage : 'dashboard';

  const activeScreenPermission = useMemo(
    () => findScreenPermission(permissionSource, currentUser?.role || '', visiblePage),
    [permissionSource, currentUser?.role, visiblePage]
  );

  const effectiveUserSession: UserSession = useMemo(() => {
    // Rendered only when authenticated; this keeps the type non-null for child props.
    if (!currentUser) return currentUser as unknown as UserSession;
    const readOnly = isReadOnlyUser(currentUser);
    return {
      ...currentUser,
      canCreate: readOnly ? false : activeScreenPermission ? activeScreenPermission.canCreate : currentUser.canCreate === true,
      canEdit: readOnly ? false : activeScreenPermission ? activeScreenPermission.canEdit : currentUser.canEdit === true,
      canApprove: readOnly || currentUser.isAdmin === true
        ? false
        : activeScreenPermission ? activeScreenPermission.canApprove : currentUser.canApprove === true,
      canDelete: readOnly ? false : activeScreenPermission ? activeScreenPermission.canDelete : currentUser.canDelete === true,
    };
  }, [currentUser, activeScreenPermission]);

  const unreadNotifs = notifications.filter((n) => n.status !== 'Sent').length;

  // Memoized Scoped Data Collections based on selectedSegment and currentUser role
  const effectiveSegment = useMemo(() => {
    if (!currentUser) return selectedSegment || 'ALL';
    if (currentUser.bankWide === true) return selectedSegment || 'ALL';
    const allowed = currentUser.allowedSegments?.length
      ? currentUser.allowedSegments
      : (currentUser.segmentIds?.length ? currentUser.segmentIds : (currentUser.segment ? [currentUser.segment] : []));
    if (allowed.length > 1) {
      if (selectedSegment === 'ALL') return 'ALL';
      return allowed.includes(selectedSegment) ? selectedSegment : allowed[0];
    }
    return allowed[0] || selectedSegment || 'ALL';
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

  // If not logged in, render Login screen
  if (currentUser && !sessionVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFF5FB] text-sm text-slate-600">
        Checking your session...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        sessionNotice={loginNotice}
      />
    );
  }

  return (
    <div className="h-screen bg-[#EFF5FB] flex flex-col font-sans text-[#101828] overflow-hidden">
      {/* TopBar */}
      <TopBar
        currentUser={currentUser}
        selectedSegment={selectedSegment}
        onSelectSegment={setSelectedSegment}
        availableSegments={segments && segments.length > 0
          ? segments.filter(s => s.active !== false).map(s => s.name)
          : (currentUser.allowedSegments || currentUser.segmentIds || [])}
        unreadNotificationCount={unreadNotifs}
        pendingApprovalCount={pendingApprovals}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenApprovals={() => setActivePage('approvals')}
        onChangePassword={() => setShowChangePassword(true)}
        onDelegateAuthority={() => setActivePage('approvals')}
        onLogout={handleLogout}
        customers={customers}
        facilities={facilities}
        collaterals={collaterals}
        policies={policies}
        documents={documents}
        exceptions={exceptions}
        onNavigate={handleNavigate}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <Sidebar
          activePage={visiblePage}
          onNavigate={handleNavigate}
          userRole={currentUser.role}
          isAdmin={currentUser.isAdmin === true}
          permissions={permissionSource}
          pendingApprovalCount={pendingApprovals}
          openExceptionCount={openExceptions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0 bg-[#EFF5FB]">
          <div className="sticky top-0 z-20 shrink-0">
            <Breadcrumbs activePage={visiblePage} onNavigateHome={() => setActivePage('dashboard')} />
          </div>

          {/* Data Load Error Banner (Audit Finding 68) */}
          {dataLoadError && (
            <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-300 rounded-lg flex items-center justify-between text-xs text-red-900 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded">Backend Connection Error</span>
                <span>{dataLoadError}. Backend-sourced records may be incomplete until the connection is restored.</span>
              </div>
              <button onClick={() => loadData()} className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* Active Business Segment Scope Indicator */}
          {effectiveSegment !== 'ALL' && (
            <div className="mx-6 mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-700">ðŸ¢ Active Segment Filter:</span>
                <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-300">{effectiveSegment}</span>
                <span className="text-blue-600 text-[11px]">(All master records, loans, collateral, and policies are scoped to this business unit)</span>
              </div>
              {currentUser.bankWide === true && (
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
                {visiblePage === 'dashboard' && (
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
                    onNavigate={handleNavigate}
                    onApproveTask={handleApproveTask}
                    onRejectTask={handleRejectTask}
                  />
                )}

                {visiblePage === 'customers' && (
                  <CustomerManager
                    customers={scopedCustomers}
                    facilities={scopedFacilities}
                    collaterals={scopedCollaterals}
                    policies={scopedPolicies}
                    documents={scopedDocuments}
                    segments={segments}
                    branches={branches}
                    currentUser={effectiveUserSession}
                    selectedSegment={effectiveSegment}
                    initialCustomerId={targetCustomerId}
                    onNavigate={handleNavigate}
                    onRegisterManualCustomer={handleRegisterManualCustomer}
                    onMaintainCustomer={handleMaintainCustomer}
                  />
                )}

                {visiblePage === 'facilities' && (
                  <FacilityManager
                    facilities={scopedFacilities}
                    customers={scopedCustomers}
                    collaterals={scopedCollaterals}
                    links={scopedLinks}
                    policies={scopedPolicies}
                    initialFacilityId={targetFacilityId}
                    currentUser={effectiveUserSession}
                    selectedSegment={effectiveSegment}
                    onNavigate={handleNavigate}
                    onRefreshData={loadData}
                  />
                )}

                {visiblePage === 'collateral' && (
                  <CollateralManager
                    collaterals={scopedCollaterals}
                    facilities={scopedFacilities}
                    links={scopedLinks}
                    policies={scopedPolicies}
                    documents={scopedDocuments}
                    exceptions={scopedExceptions}
                    taxonomies={taxonomies}
                    mandatoryDocRules={mandatoryDocRules}
                    selectedSegment={effectiveSegment}
                    segments={segments}
                    branches={branches}
                    customers={scopedCustomers}
                    systemParameters={systemParameters}
                    currentUser={effectiveUserSession}
                    initialCollateralId={targetCollateralId}
                    onNavigate={handleNavigate}
                    onRegisterCollateral={handleRegisterCollateral}
                    onAddLink={handleAddLink}
                    onRemoveLink={handleRemoveLink}
                    onValidateRelease={handleValidateRelease}
                    onInitiateTransfer={handleInitiateTransfer}
                    onMaintainCollateral={handleMaintainCollateral}
                    onRefreshData={loadData}
                  />
                )}

                {visiblePage === 'insurance' && (
                  <PolicyManager
                    policies={scopedPolicies}
                    endorsements={endorsements}
                    collaterals={scopedCollaterals}
                    customers={scopedCustomers}
                    insurers={insurers}
                    documents={scopedDocuments}
                    systemParameters={systemParameters}
                    taxonomies={taxonomies}
                    currentUser={effectiveUserSession}
                    initialPolicyId={targetPolicyId}
                    onNavigate={handleNavigate}
                    onCreatePolicyDraft={handleCreatePolicyDraft}
                    onSubmitPolicy={handleSubmitPolicy}
                    onAmendPolicy={handleAmendPolicy}
                    onRenewPolicy={handleRenewPolicy}
                    onEndorsePolicy={handleEndorsePolicy}
                    onReplacePolicy={handleReplacePolicy}
                    onCancelPolicy={handleCancelPolicy}
                    onClosePolicy={handleClosePolicy}
                    onReopenPolicy={handleReopenPolicy}
                    onReload={loadData}
                  />
                )}

                {visiblePage === 'approvals' && (
                  <MakerCheckerInbox
                    tasks={scopedWorkflowTasks}
                    delegations={delegations}
                    allUsers={allUsersList}
                    currentUser={effectiveUserSession}
                    customers={scopedCustomers}
                    facilities={scopedFacilities}
                    collaterals={scopedCollaterals}
                    policies={scopedPolicies}
                    documents={scopedDocuments}
                    links={scopedLinks}
                    exceptions={scopedExceptions}
                    branches={branches}
                    insurers={insurers}
                    onApproveTask={handleApproveTask}
                    onRejectTask={handleRejectTask}
                    onReturnTask={handleReturnTask}
                    onResubmitTask={handleResubmitTask}
                    onBulkApprove={handleBulkApprove}
                    onCreateDelegation={handleCreateDelegation}
                    onRevokeDelegation={handleRevokeDelegation}
                    onReload={loadData}
                  />
                )}

                {visiblePage === 'exceptions' && (
                  <ExceptionManager
                    exceptions={scopedExceptions}
                    currentUser={effectiveUserSession}
                    collaterals={scopedCollaterals}
                    facilities={scopedFacilities}
                    policies={scopedPolicies}
                    customers={scopedCustomers}
                    documents={scopedDocuments}
                    mandatoryDocRules={mandatoryDocRules}
                    insurers={insurers}
                    users={allUsersList}
                    initialExceptionId={targetExceptionId}
                    onResolveException={handleResolveException}
                    onEscalateException={handleEscalateException}
                    onScanNow={handleScanExceptions}
                    onNavigate={handleNavigate}
                    onRefreshData={loadData}
                  />
                )}

                {visiblePage === 'documents' && (
                  <DocumentRepository
                    documents={scopedDocuments}
                    collaterals={scopedCollaterals}
                    mandatoryDocRules={mandatoryDocRules}
                    currentUser={effectiveUserSession}
                    initialDocumentId={targetDocumentId}
                    onUploadDocument={handleUploadDocument}
                    onRefreshData={loadData}
                  />
                )}

                {visiblePage === 'reports' && (
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
                    documents={documents}
                    mandatoryDocRules={mandatoryDocRules}
                    insurers={insurers}
                    branches={branches}
                    segments={segments}
                  />
                )}

                {visiblePage === 'admin' && (
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
                    onDeleteMandatoryDocRule={handleDeleteMandatoryDocRule}
                    onDeleteAllMandatoryDocRules={handleDeleteAllMandatoryDocRules}
                    onSaveHoliday={handleSaveHoliday}
                    onDeleteHoliday={handleDeleteHoliday}
                  />
                )}

                {visiblePage === 'audit' && (
                  <AuditTrailViewer auditLogs={auditLogs} currentUser={effectiveUserSession} />
                )}

                {visiblePage === 'notifications' && (
                  <NotificationManager
                    notifications={notifications}
                    currentUser={effectiveUserSession}
                    onTriggerScan={handleScanExceptions}
                    onResend={handleResendNotification}
                    onRefresh={loadData}
                  />
                )}

                {visiblePage === 'cbs-sim' && (
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
        onSubmit={async (oldPass, newPass) => {
          const res = await cimsApi.changePassword(oldPass, newPass);
          if (res.success) {
            return true;
          } else {
            throw new Error(res.message || 'Failed to update password');
          }
        }}
      />

      <SessionTimeoutModal
        isOpen={showSessionTimeout}
        secondsRemaining={sessionWarningSeconds}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
    </div>
  );
}

export function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;

