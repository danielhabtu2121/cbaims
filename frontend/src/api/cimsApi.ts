import {
  Customer,
  LoanAccount,
  Collateral,
  LoanCollateralLink,
  InsurancePolicy,
  PolicyEndorsement,
  OwnershipDocument,
  WorkflowTask,
  ApprovalHistory,
  CimsException,
  CimsExceptionInvestigationNote,
  CimsExceptionEscalationHistory,
  CimsExceptionAssignmentHistory,
  ExceptionSummaryDto,
  ScanResultDto,
  NotificationItem,
  NotificationTemplate,
  AuditLog,
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
  Delegation,
  Collateral360Dto,
  InsuranceComplianceDto,
  StructuredPolicyHistoryItem,
  ValidationCheckItemDto,
  PolicyPreValidationResultDto,
  EntryTimeExceptionRequest,
  CollateralFacilityLinkDto,
  CollateralCandidateDto,
  FacilityCandidateDto,
  CollateralSecuredFacilitiesSummaryDto,
  FacilityCollateralSummaryDto,
  RelationshipRequestDto,
  RelationshipValidationResultDto,
  LoanCollateralLinkHistoryDto,
  CbsRelationshipReconciliationDto,
  SecondDegreeValidationResult,
  DegreeDetailsDto,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_CIMS_API_BASE || '/api';
export const SESSION_EXPIRED_EVENT = 'cims.session_expired';

// Once the local session is expired, no protected request may be issued again
// until a new login resets this guard. The backend independently enforces the
// same rule by rejecting expired/revoked tokens.
let sessionExpired = false;
let sessionExpiryEventDispatched = false;

export function resetSessionState(): void {
  sessionExpired = false;
  sessionExpiryEventDispatched = false;
}

function isPublicAuthEndpointPath(pathname: string): boolean {
  return /\/api\/auth\/(login|forgot-password|reset-password|policy)$/.test(pathname);
}

function expiredSessionError(): Error & { status: number } {
  const error = new Error('Your session has expired. Please sign in again.') as Error & { status: number };
  error.status = 401;
  return error;
}

function getStoredSession(): any {
  try { return JSON.parse(localStorage.getItem('cims.currentUser') || 'null'); } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const session = getStoredSession();
  const token = localStorage.getItem('cims.token') || session?.token;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  let pathname = rawUrl;
  try { pathname = new URL(rawUrl, window.location.origin).pathname; } catch { }

  const isPublicAuthEndpoint = isPublicAuthEndpointPath(pathname);
  if (sessionExpired && !isPublicAuthEndpoint) {
    return Promise.reject(expiredSessionError());
  }
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('cims.token') || getStoredSession()?.token;
  if (token && !isPublicAuthEndpoint && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return window.fetch(input, { ...init, headers }).then((response) => {
    // A 401 from any protected API means the server-side session is missing,
    // expired or revoked. Clear local credentials and force the single login URL.
    if (response.status === 401 && !isPublicAuthEndpoint) {
      clearSession();
      if (typeof window !== 'undefined' && !sessionExpiryEventDispatched) {
        sessionExpiryEventDispatched = true;
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { message: 'Your session has expired. Please sign in again.' },
        }));
      }
    }
    return response;
  });
}

function rememberSession(user: any, token?: string) {
  resetSessionState();
  try {
    const sessionToSave = { ...user };
    if (token) {
      sessionToSave.token = token;
      localStorage.setItem('cims.token', token);
    } else if (user?.token) {
      localStorage.setItem('cims.token', user.token);
    } else {
      localStorage.removeItem('cims.token');
    }
    localStorage.setItem('cims.currentUser', JSON.stringify(sessionToSave));
  } catch { }
}

function clearSession() {
  sessionExpired = true;
  try {
    localStorage.removeItem('cims.currentUser');
    localStorage.removeItem('cims.token');
    localStorage.setItem('cims.logout_event', String(Date.now()));
  } catch { }
}

function createApiError(response: Response, payload: any, fallbackMessage: string) {
  const error = new Error(payload?.error || payload?.message || fallbackMessage) as Error & { status: number };
  error.status = response.status;
  return error;
}

let stateInFlight: Promise<FullCimsState> | null = null;
let stateCache: FullCimsState | null = null;
let stateCacheAt = 0;
let sessionValidationInFlight: Promise<{ valid: boolean; active?: boolean; username?: string }> | null = null;
const STATE_CACHE_TTL_MS = 1500;

function invalidateStateCache() {
  stateCache = null;
  stateCacheAt = 0;
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(url, {
    ...options,
    headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    throw createApiError(response, payload, `Request failed with HTTP ${response.status}`);
  }
  if ((options.method || 'GET').toUpperCase() !== 'GET') invalidateStateCache();
  return payload as T;
}

export interface FullCimsState {
  customers: Customer[];
  facilities: LoanAccount[];
  loans: LoanAccount[];
  collaterals: Collateral[];
  links: LoanCollateralLink[];
  policies: InsurancePolicy[];
  endorsements: PolicyEndorsement[];
  documents: OwnershipDocument[];
  templates: NotificationTemplate[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  exceptions: CimsException[];
  segments: BusinessSegment[];
  branches: Branch[];
  users: any[];
  rolePermissions: RolePermission[];
  workflowTasks: WorkflowTask[];
  approvalHistories: any[];
  delegations: Delegation[];
  approvalConfigs: ApprovalHierarchyConfig[];
  reminderSchedules: ReminderSchedule[];
  scheduledReports: ScheduledReport[];
  insurers: ApprovedInsurer[];
  taxonomies: CollateralTaxonomy[];
  mandatoryDocRules: MandatoryDocumentRule[];
  holidayCalendars: HolidayCalendar[];
  systemParameters: SystemParameter[];
  cbsSyncLogs: CbsSyncLog[];
  cbsSync: any;
  systemDate: string;
}

export const cimsApi = {
  async login(identifier: string, password = 'password123'): Promise<{ success: boolean; user?: any; token?: string; message?: string; sessionTimeoutMinutes?: number }> {
    try {
      const res = await authenticatedFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        return {
          success: false,
          message: res.status === 401
            ? 'Invalid username or password.'
            : `Service returned HTTP ${res.status}. Please try again shortly.`
        };
      }
      if (!res.ok) {
        return {
          success: false,
          message: data?.message || data?.error || `Authentication failed (HTTP ${res.status}).`
        };
      }
      if (data?.success && data?.user) {
        const token = data.token;
        rememberSession({ ...data.user, token }, token);
      }
      return data;
    } catch (e: any) {
      return {
        success: false,
        message: e.message && !e.message.includes('fetch')
          ? e.message
          : 'Unable to connect to the CIMS service. Please try again shortly.'
      };
    }
  },

  async logout(): Promise<void> {
    try {
      await authenticatedFetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch { }
    clearSession();
  },

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string; simulationResetToken?: string }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    return await res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return await res.json();
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return await res.json();
  },

  async keepSessionAlive(): Promise<{ success: boolean; message?: string; expiresAt?: string; sessionTimeoutMinutes?: number }> {
    try {
      const res = await authenticatedFetch(`${API_BASE}/auth/session/refresh`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, message: 'Session extension rejected' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Session extension failed' };
    }
  },

  async validateSession(): Promise<{ valid: boolean; active?: boolean; username?: string; user?: any }> {
    if (!sessionValidationInFlight) {
      sessionValidationInFlight = (async () => {
        const res = await authenticatedFetch(`${API_BASE}/auth/session/validate`, {
          headers: authHeaders(),
        });
        if (res.status === 401) return { valid: false };
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw createApiError(res, payload, 'Session validation failed.');
        }
        return await res.json();
      })();
    }
    try { return await sessionValidationInFlight; } finally { sessionValidationInFlight = null; }
  },

  async getPasswordPolicy(): Promise<{
    minLength: number;
    requireSpecial: boolean;
    requireUppercase: boolean;
    requireDigit: boolean;
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    sessionTimeoutMinutes: number;
  }> {
    try {
      const res = await authenticatedFetch(`${API_BASE}/auth/policy`);
      if (res.ok) return await res.json();
    } catch { }
    return {
      minLength: 8,
      requireSpecial: true,
      requireUppercase: true,
      requireDigit: true,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      sessionTimeoutMinutes: 15,
    };
  },

  setCurrentUser(user: any | null) { if (user) rememberSession(user); else clearSession(); },

  async getCurrentRuntimeConfiguration(): Promise<any> {
    return requestJson<any>(`${API_BASE}/admin/runtime`);
  },

  invalidateState() { invalidateStateCache(); },

  async fetchFullState(force = false): Promise<FullCimsState> {
    const now = Date.now();
    if (!force && stateCache && now - stateCacheAt < STATE_CACHE_TTL_MS) return stateCache;
    if (!force && stateInFlight) return stateInFlight;
    stateInFlight = (async () => {
      const res = await authenticatedFetch(`${API_BASE}/state`, { headers: authHeaders() });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw createApiError(res, payload, 'Failed to fetch system state');
      }
      const data = await res.json() as FullCimsState;
      stateCache = data;
      stateCacheAt = Date.now();
      return data;
    })();
    try { return await stateInFlight; } finally { stateInFlight = null; }
  },

  // Convenience entity getters (queries state or individual endpoints)
  async getCustomers(): Promise<Customer[]> {
    const state = await this.fetchFullState();
    return state.customers || [];
  },

  async getFacilities(): Promise<LoanAccount[]> {
    const state = await this.fetchFullState();
    return state.facilities || state.loans || [];
  },

  async getCollaterals(): Promise<Collateral[]> {
    const state = await this.fetchFullState();
    return state.collaterals || [];
  },

  async getLinks(): Promise<LoanCollateralLink[]> {
    const state = await this.fetchFullState();
    return state.links || [];
  },

  async getPagedCustomers(page = 0, size = 25, search = '', segment = ''): Promise<{ content: Customer[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set('search', search.trim());
    if (segment && segment !== 'ALL') params.set('segment', segment);
    return requestJson(`${API_BASE}/customers/paged?${params.toString()}`);
  },

  async getPagedFacilities(page = 0, size = 25, search = '', segment = ''): Promise<{ content: LoanAccount[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set('search', search.trim());
    if (segment && segment !== 'ALL') params.set('segment', segment);
    return requestJson(`${API_BASE}/facilities/paged?${params.toString()}`);
  },

  async getPagedCollaterals(page = 0, size = 25, search = '', segment = '', origin = ''): Promise<{ content: Collateral[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set('search', search.trim());
    if (segment && segment !== 'ALL') params.set('segment', segment);
    if (origin && origin !== 'ALL') params.set('origin', origin);
    return requestJson(`${API_BASE}/collaterals/paged?${params.toString()}`);
  },

  async getPolicies(): Promise<InsurancePolicy[]> {
    const state = await this.fetchFullState();
    return state.policies || [];
  },

  async getEndorsements(): Promise<PolicyEndorsement[]> {
    const state = await this.fetchFullState();
    return state.endorsements || [];
  },

  async getDocuments(): Promise<OwnershipDocument[]> {
    const state = await this.fetchFullState();
    return state.documents || [];
  },

  async getExceptions(): Promise<CimsException[]> {
    const state = await this.fetchFullState();
    return state.exceptions || [];
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const state = await this.fetchFullState();
    return state.notifications || [];
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const state = await this.fetchFullState();
      return state.auditLogs || [];
    } catch {
      return [];
    }
  },

  async getWorkflowTasks(role?: string, status?: string, makerId?: string): Promise<WorkflowTask[]> {
    try {
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      if (makerId) params.set('makerId', makerId);
      const res = await authenticatedFetch(`${API_BASE}/workflow/tasks?${params.toString()}`, { headers: authHeaders() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || payload?.message || 'Unable to load workflow tasks.');
      return Array.isArray(payload) ? payload : (payload?.workflowTasks || []);
    } catch (e) {
      throw e;
    }
  },

  async getTaskHistory(taskId: string): Promise<ApprovalHistory[]> {
    try {
      const res = await authenticatedFetch(`${API_BASE}/workflow/tasks/${encodeURIComponent(taskId)}/history`, { headers: authHeaders() });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  },

  async getDelegations(): Promise<Delegation[]> {
    try {
      const state = await this.fetchFullState();
      return state.delegations || [];
    } catch {
      return [];
    }
  },

  async getSegments(): Promise<BusinessSegment[]> {
    try {
      const state = await this.fetchFullState();
      return state.segments || [];
    } catch {
      return [];
    }
  },

  async getBranches(): Promise<Branch[]> {
    try {
      const state = await this.fetchFullState();
      return state.branches || [];
    } catch {
      return [];
    }
  },

  async getPermissions(): Promise<RolePermission[]> {
    try {
      const state = await this.fetchFullState();
      return state.rolePermissions || [];
    } catch {
      return [];
    }
  },

  async getApprovalConfigs(): Promise<ApprovalHierarchyConfig[]> {
    try {
      const state = await this.fetchFullState();
      return state.approvalConfigs || [];
    } catch {
      return [];
    }
  },

  async getReminderSchedules(): Promise<ReminderSchedule[]> {
    try {
      const state = await this.fetchFullState();
      return state.reminderSchedules || [];
    } catch {
      return [];
    }
  },

  async getScheduledReports(): Promise<ScheduledReport[]> {
    try {
      const state = await this.fetchFullState();
      return state.scheduledReports || [];
    } catch {
      return [];
    }
  },

  async getApprovedInsurers(): Promise<ApprovedInsurer[]> {
    try {
      const state = await this.fetchFullState();
      return state.insurers || [];
    } catch {
      return [];
    }
  },

  async getTaxonomies(): Promise<CollateralTaxonomy[]> {
    try {
      const state = await this.fetchFullState();
      return state.taxonomies || [];
    } catch {
      return [];
    }
  },

  async getMandatoryDocRules(): Promise<MandatoryDocumentRule[]> {
    try {
      const state = await this.fetchFullState();
      return state.mandatoryDocRules || [];
    } catch {
      return [];
    }
  },

  async getHolidayCalendars(): Promise<HolidayCalendar[]> {
    try {
      const state = await this.fetchFullState();
      return state.holidayCalendars || [];
    } catch {
      return [];
    }
  },

  async getSystemParameters(): Promise<SystemParameter[]> {
    try {
      const state = await this.fetchFullState();
      return state.systemParameters || [];
    } catch {
      return [];
    }
  },

  async getUsers(): Promise<any[]> {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
      if (res.ok) return res.json();
      const state = await this.fetchFullState();
      return state.users || [];
    } catch {
      return [];
    }
  },

  // CBS Simulator
  async getCbsCustomers(): Promise<CbsCustomer[]> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/customers`);
    return res.ok ? res.json() : [];
  },

  async saveCbsCustomer(cust: Partial<CbsCustomer>): Promise<CbsCustomer> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cust),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to save CBS Customer');
    }
    invalidateStateCache();
    return res.json();
  },

  async getCbsFacilities(): Promise<CbsFacility[]> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/facilities`);
    return res.ok ? res.json() : [];
  },

  async saveCbsFacility(fac: Partial<CbsFacility>): Promise<CbsFacility> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/facilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fac),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to save CBS Facility');
    }
    invalidateStateCache();
    return res.json();
  },

  async getCbsCollaterals(): Promise<CbsCollateral[]> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/collaterals`);
    return res.ok ? res.json() : [];
  },

  async saveCbsCollateral(col: Partial<CbsCollateral>): Promise<CbsCollateral> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/collaterals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(col),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to save CBS Collateral');
    }
    invalidateStateCache();
    return res.json();
  },

  async syncCbsEntity(entityType: string, id: string, userId = 'SYSADMIN'): Promise<{ success: boolean; message: string; errorCategory?: string; failingView?: string; status?: number }> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-integration/sync/${entityType}/${id}?userId=${userId}`, {
      method: 'POST',
    });
    invalidateStateCache();
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = payload?.message || payload?.error || `CBS sync failed with HTTP ${res.status}`;
      return {
        success: false,
        message: msg,
        errorCategory: payload?.errorCategory,
        failingView: payload?.failingView,
        status: res.status,
      };
    }
    return payload || { success: true, message: 'Sync completed' };
  },

  async syncAllPending(userId = 'SYSADMIN'): Promise<{ success: boolean; message: string; errorCategory?: string; failingView?: string; status?: number }> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-integration/sync-all?userId=${userId}`, {
      method: 'POST',
    });
    invalidateStateCache();
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = payload?.message || payload?.error || `CBS sync failed with HTTP ${res.status}`;
      return {
        success: false,
        message: msg,
        errorCategory: payload?.errorCategory,
        failingView: payload?.failingView,
        status: res.status,
      };
    }
    return payload || { success: true, message: 'Sync completed' };
  },

  async getCbsSyncLogs(): Promise<CbsSyncLog[]> {
    const res = await authenticatedFetch(`${API_BASE}/cbs-sim/sync-logs`);
    return res.ok ? res.json() : [];
  },

  // Customer Management
  async registerCustomer(cust: Partial<Customer>, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await authenticatedFetch(`${API_BASE}/customers/add?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cust),
    });
    invalidateStateCache();
    return res.json();
  },

  // Maker-checker "maintain" (post-registration edit) for an already-authorized customer.
  // The change is submitted for checker approval; nothing changes on screen until approved.
  async updateCustomer(customerId: string, changes: Record<string, any>, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await authenticatedFetch(`${API_BASE}/customers/${encodeURIComponent(customerId)}/update?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Unable to submit customer changes for approval.');
    }
    return data;
  },

  // Collateral Management
  async createCollateral(col: Partial<Collateral>, userId = 'CRO_USER'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/collateral/register-native?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(col),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false || payload?.error) throw new Error(payload?.error || payload?.message || 'Unable to register collateral.');
    invalidateStateCache();
    return payload;
  },

  // Maker-checker "maintain" (post-registration edit) for an already-authorized collateral
  // record - e.g. revised valuation, haircut, or next review date.
  async updateCollateral(collateralId: string, changes: Record<string, any>, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/update?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Unable to submit collateral changes for approval.');
    }
    return data;
  },

  async addFacilityLink(
    loanId: string,
    collateralId: string,
    amount: number,
    userId?: string,
    linkageType?: string,
    effectiveDate?: string,
    endDate?: string
  ): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    let url = `${API_BASE}/links/add?loanId=${encodeURIComponent(loanId)}&collateralId=${encodeURIComponent(collateralId)}&amount=${amount}&userId=${encodeURIComponent(effectiveUserId)}`;
    if (linkageType) url += `&linkageType=${encodeURIComponent(linkageType)}`;
    if (effectiveDate) url += `&effectiveDate=${encodeURIComponent(effectiveDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    const res = await authenticatedFetch(url, {
      method: 'POST',
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || data?.message || 'Unable to link facility to collateral.');
    }
    return data;
  },

  async removeFacilityLink(linkId: string, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await authenticatedFetch(`${API_BASE}/links/remove?linkId=${encodeURIComponent(linkId)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async validateReleaseCollateral(collateralId: string): Promise<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/collateral/validate-release?collateralId=${collateralId}`);
    return res.json();
  },

  async transferCollateralSegment(collateralId: string, destSegment: string, reason: string, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    // Backend route is /transfers/initiate with a `destinationSegment` param - this used to
    // point at a /collateral/transfer-segment URL that the backend never exposed, so every
    // segment transfer request silently 404'd.
    const res = await authenticatedFetch(`${API_BASE}/transfers/initiate?collateralId=${encodeURIComponent(collateralId)}&destinationSegment=${encodeURIComponent(destSegment)}&reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async changeCollateralOwnership(collateralId: string, payload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/change-ownership?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Unable to record collateral ownership change.');
    }
    return data;
  },

  async getCollateral360(collateralId: string): Promise<Collateral360Dto> {
    return requestJson<Collateral360Dto>(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/360`);
  },

  async getCollateralDocumentChecklist(collateralId: string): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/document-checklist`);
  },

  async getCollateralTaxonomy(): Promise<CollateralTaxonomy[]> {
    return requestJson<CollateralTaxonomy[]>(`${API_BASE}/collateral/taxonomy`);
  },

  async verifyCollateralOwner(collateralId: string, ownerId: string, status = 'Verified', comments = '', userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/verify-owner?ownerId=${encodeURIComponent(ownerId)}&status=${encodeURIComponent(status)}&comments=${encodeURIComponent(comments)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || 'Unable to update owner verification.');
    }
    return data;
  },

  async addCollateralOwner(collateralId: string, owner: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/add-owner?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(owner),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || 'Unable to add owner.');
    }
    return data;
  },

  async updateCollateralOwner(collateralId: string, ownerId: string, owner: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/update-owner?ownerId=${encodeURIComponent(ownerId)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(owner),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || 'Unable to update owner.');
    }
    return data;
  },

  async allocateCollateralFacilities(collateralId: string, allocations: any[], userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/allocate-facilities?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(allocations),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || 'Unable to allocate facilities.');
    }
    return data;
  },

  async registerCollateralWithAllocations(collateral: any, allocations: any[], arg3?: any, arg4?: any): Promise<any> {
    let documents: any[] | undefined;
    let userId: string | undefined;
    if (typeof arg3 === 'string') {
      userId = arg3;
      documents = arg4;
    } else {
      documents = arg3;
      userId = arg4;
    }
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/register-with-allocations?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ collateral, allocations, documents }),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || 'Unable to register collateral with allocations.');
    }
    return data;
  },

  async requestCollateralRelease(collateralId: string, reason = 'Facility settled', userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || 'CRO_USER';
    const res = await authenticatedFetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/request-release?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    invalidateStateCache();
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || 'Unable to request collateral release.');
    }
    return data;
  },

  // Policy Lifecycle
  async createPolicyDraft(policy: Partial<InsurancePolicy>, userId = 'CRO_USER'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/policies/add?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false || payload?.error) throw new Error(payload?.error || payload?.message || 'Unable to save policy.');
    invalidateStateCache();
    return payload;
  },

  async submitPolicy(policyId: string, userId = 'CRO_USER'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/policies/submit?policyId=${encodeURIComponent(policyId)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST', headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false || payload?.error) throw new Error(payload?.error || payload?.message || 'Unable to submit policy for approval.');
    invalidateStateCache();
    return payload;
  },

  async amendPolicy(policyId: string, policy: Partial<InsurancePolicy>, reason: string, userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/policies/${encodeURIComponent(policyId)}/amend?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy, documents }),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.message || payload?.error || 'Unable to amend policy.');
    invalidateStateCache();
    return payload;
  },

  async getPolicyHistory(policyId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/history`);
  },

  async renewPolicy(policyId: string, newAmount: number, newPremium: number, newExpiryDate: string, userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/policies/${encodeURIComponent(policyId)}/renew?newAmount=${newAmount}&newPremium=${newPremium}&newExpiryDate=${encodeURIComponent(newExpiryDate)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAmount, newPremium, newExpiryDate, documents }),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.message || payload?.error || 'Unable to renew policy.');
    invalidateStateCache();
    return payload;
  },

  // Workflow / Dual Control
  async approveWorkflowTask(taskId: string, comments = 'Approved by Checker', userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/tasks/${taskId}/approve?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to approve workflow task.');
    invalidateStateCache();
    return payload;
  },

  async rejectWorkflowTask(taskId: string, comments: string, userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/tasks/${taskId}/reject?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to reject workflow task.');
    invalidateStateCache();
    return payload;
  },

  async returnWorkflowTask(taskId: string, correctionNote: string, userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/tasks/${taskId}/return?userId=${userId}&role=${role}&correctionNote=${encodeURIComponent(correctionNote)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to return workflow task.');
    invalidateStateCache();
    return payload;
  },

  async resubmitWorkflowTask(taskId: string, userId: string): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/tasks/${taskId}/resubmit?userId=${encodeURIComponent(userId)}`, {
      method: 'POST', headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to resubmit workflow task.');
    invalidateStateCache();
    return payload;
  },

  async bulkApproveWorkflowTasks(taskIds: string[], comments = 'Bulk approved', userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/bulk-approve?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(taskIds),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) {
      const errMsg = Array.isArray(payload?.failures) && payload.failures.length > 0
        ? payload.failures.join('; ')
        : (payload?.error || payload?.message || 'Unable to bulk authorize tasks.');
      throw new Error(errMsg);
    }
    invalidateStateCache();
    return payload;
  },

  async createDelegation(delegation: Partial<Delegation>): Promise<Delegation> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/delegations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delegation),
    });
    invalidateStateCache();
    return res.json();
  },

  async revokeDelegation(id: string): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/workflow/delegations/${id}/revoke`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  // Exceptions (US-12.1 - US-12.4)
  async triggerPortfolioScan(): Promise<ScanResultDto> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/scan-now`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || payload?.error || 'Exception scan failed.');
    invalidateStateCache();
    return payload;
  },

  async getExceptionSummary(): Promise<ExceptionSummaryDto> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/summary`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exception summary.');
    return res.json();
  },

  async getExceptionsList(filters?: { status?: string; role?: string; severity?: string; type?: string; slaStatus?: string; search?: string }): Promise<CimsException[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.slaStatus) params.set('slaStatus', filters.slaStatus);
    if (filters?.search) params.set('search', filters.search);

    const res = await authenticatedFetch(`${API_BASE}/exceptions?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exceptions.');
    return res.json();
  },

  async resolveException(
    id: string,
    correctiveAction: string,
    resolutionNotes: string,
    evidenceDocument?: string,
    userId?: string,
    isOverride?: boolean,
    overrideReason?: string
  ): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        correctiveAction,
        resolutionNotes,
        evidenceDocument: evidenceDocument || undefined,
        userId,
        isOverride: !!isOverride,
        overrideReason: overrideReason || undefined,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to resolve exception.');
    }
    invalidateStateCache();
    return payload;
  },

  async addExceptionEvidence(
    id: string,
    payload: { documentId?: string; documentName?: string; dmsRef?: string; notes?: string; userId?: string }
  ): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const resPayload = await res.json();
    if (!res.ok) {
      throw new Error(resPayload?.message || resPayload?.error || 'Failed to associate evidence.');
    }
    invalidateStateCache();
    return resPayload;
  },

  async recordExceptionCorrectiveAction(
    id: string,
    payload: { correctiveAction: string; actionNotes?: string; targetCompletionDate?: string; userId?: string }
  ): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/corrective-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const resPayload = await res.json();
    if (!res.ok) {
      throw new Error(resPayload?.message || resPayload?.error || 'Failed to record corrective action.');
    }
    invalidateStateCache();
    return resPayload;
  },

  async escalateException(
    id: string,
    escalationRole: string,
    reason?: string,
    targetUserId?: string,
    userId?: string
  ): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        escalationRole,
        reason: reason || `Operational escalation to ${escalationRole}`,
        targetUserId,
        userId,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to escalate exception.');
    }
    invalidateStateCache();
    return payload;
  },

  async assignException(
    id: string,
    payload: { assignedToRole?: string; assignedRole?: string; assignedToUserId?: string; assignedUserId?: string; reason?: string; remarks?: string },
    userId?: string
  ): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        assignedRole: payload.assignedRole || payload.assignedToRole,
        assignedUserId: payload.assignedUserId || payload.assignedToUserId,
        reason: payload.reason || payload.remarks,
        userId,
      }),
    });
    const payloadRes = await res.json();
    if (!res.ok) {
      throw new Error(payloadRes?.message || payloadRes?.error || 'Failed to assign exception.');
    }
    invalidateStateCache();
    return payloadRes;
  },

  async addExceptionInvestigationNote(id: string, noteText: string, userId?: string): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/investigation-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ noteText, userId }),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to add investigation note.');
    }
    invalidateStateCache();
    return payload;
  },

  async getExceptionHistory(id: string): Promise<{
    investigationNotes: CimsExceptionInvestigationNote[];
    escalationHistory: CimsExceptionEscalationHistory[];
    assignmentHistory: CimsExceptionAssignmentHistory[];
  }> {
    const res = await authenticatedFetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/history`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exception history.');
    return res.json();
  },

  // Documents (DMS)
  async uploadDocument(
    entityType: string,
    entityId: string,
    docName: string,
    docType: string,
    expiryDate?: string,
    userId = 'COLLDOCOFF_USER',
    fileDetails?: {
      fileName?: string;
      fileSize?: number;
      contentType?: string;
      fileContent?: string;
      remarks?: string;
      parentDocumentId?: string;
      versionNotes?: string;
      forceNew?: boolean;
    }
  ): Promise<any> {
    const payload = {
      entityType,
      entityId,
      docName,
      docType,
      expiryDate,
      uploadedBy: userId,
      fileName: fileDetails?.fileName,
      fileSize: fileDetails?.fileSize,
      contentType: fileDetails?.contentType,
      fileContent: fileDetails?.fileContent,
      remarks: fileDetails?.remarks,
      parentDocumentId: fileDetails?.parentDocumentId,
      versionNotes: fileDetails?.versionNotes,
      forceNew: fileDetails?.forceNew,
    };
    const res = await authenticatedFetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    invalidateStateCache();
    return res.json();
  },

  async fetchDocumentVersions(docId: string): Promise<OwnershipDocument[]> {
    return requestJson<OwnershipDocument[]>(`${API_BASE}/documents/${encodeURIComponent(docId)}/versions`);
  },

  async fetchDocumentById(docId: string): Promise<OwnershipDocument> {
    return requestJson<OwnershipDocument>(`${API_BASE}/documents/${encodeURIComponent(docId)}`);
  },

  async fetchDocumentPreview(docId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/documents/${encodeURIComponent(docId)}/preview`);
  },

  async fetchDocumentHistory(docId: string): Promise<{
    rootDocumentId: string;
    documentName: string;
    documentType: string;
    entityType: string;
    entityId: string;
    currentVersion: OwnershipDocument;
    totalVersions: number;
    versions: OwnershipDocument[];
    auditLogs: any[];
  }> {
    return requestJson(`${API_BASE}/documents/${encodeURIComponent(docId)}/history`);
  },

  async uploadDocumentVersion(docId: string, payload: { fileName?: string; fileSize?: number; contentType?: string; fileContent?: string; versionNotes?: string; expiryDate?: string; uploadedBy?: string }): Promise<any> {
    return requestJson(`${API_BASE}/documents/${encodeURIComponent(docId)}/version`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyDocument(docId: string, verificationStatus: string, remarks: string, verifiedBy = 'COLLDOCOFF_USER'): Promise<any> {
    return requestJson(`${API_BASE}/documents/${encodeURIComponent(docId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verificationStatus, remarks, verifiedBy }),
    });
  },

  async archiveDocument(docId: string, userId = 'COLLDOCOFF_USER'): Promise<any> {
    return requestJson(`${API_BASE}/documents/${encodeURIComponent(docId)}/archive?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
    });
  },

  async searchDocuments(params: Record<string, string | undefined>): Promise<OwnershipDocument[]> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && v.trim() !== '') q.set(k, v.trim());
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<OwnershipDocument[]>(`${API_BASE}/documents/search${qs}`);
  },

  // Admin Configuration
  async saveSegment(seg: Partial<BusinessSegment>, userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/segments/save?adminUserId=${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify(seg) }); },
  async saveUser(user: any, adminUserId = 'SYSADMIN'): Promise<any> {
    const payload = {
      ...user,
      fullName: user.fullName || user.name || user.username,
      segmentIds: Array.isArray(user.segmentIds) ? user.segmentIds.join(',') : user.segmentIds,
    };
    return requestJson<any>(`${API_BASE}/admin/users/save?adminUserId=${encodeURIComponent(adminUserId)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async saveBranch(branch: Partial<Branch>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/branches/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(branch) }); },
  async saveApprovalConfig(config: Partial<ApprovalHierarchyConfig>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/approval-configs/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(config) }); },
  async saveReminderSchedule(schedule: Partial<ReminderSchedule>, adminUserId = 'SYSADMIN'): Promise<ReminderSchedule> { return requestJson<ReminderSchedule>(`${API_BASE}/admin/reminder-schedules/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(schedule) }); },
  async saveScheduledReport(report: Partial<ScheduledReport>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/scheduled-reports/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(report) }); },
  async saveSystemParameter(param: Partial<SystemParameter>, adminUserId = 'SYSADMIN'): Promise<SystemParameter> { return requestJson<SystemParameter>(`${API_BASE}/admin/parameters/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(param) }); },
  async saveApprovedInsurer(insurer: Partial<ApprovedInsurer>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/insurers/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(insurer) }); },
  async saveRolePermission(permission: Partial<RolePermission>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/permissions/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(permission) }); },
  async saveRolePermissionsBatch(permissions: RolePermission[], adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/permissions/save-batch?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(permissions) }); },
  async saveCollateralTaxonomy(taxonomy: Partial<CollateralTaxonomy>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/taxonomy/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(taxonomy) }); },
  async saveMandatoryDocRule(rule: Partial<MandatoryDocumentRule>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/document-rules/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(rule) }); },
  async deleteMandatoryDocRule(ruleId: string, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/document-rules/${encodeURIComponent(ruleId)}/delete?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST' }); },
  async deleteAllMandatoryDocRules(adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/document-rules/delete-all?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST' }); },
  async saveHolidayCalendar(holiday: Partial<HolidayCalendar>, adminUserId = 'SYSADMIN'): Promise<HolidayCalendar> { return requestJson<HolidayCalendar>(`${API_BASE}/admin/holidays/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(holiday) }); },
  async deleteHolidayCalendar(holidayId: string, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/holidays/${encodeURIComponent(holidayId)}/delete?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST' }); },
  async getDistricts(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/districts`); },
  async saveDistrict(district: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/districts/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(district) }); },

  // --- Organization & Hierarchy APIs ---
  async getOrgUnits(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/org-units`); },
  async saveOrgUnit(unit: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/org-units/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(unit) }); },
  async getCanonicalDistricts(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/canonical-districts`); },
  async getBranchSegments(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/branch-segments`); },
  async saveBranchSegment(bsa: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/branch-segments/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(bsa) }); },

  // --- CBS Branch & Segment Mapping APIs ---
  async getCbsBranchMappings(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/cbs-branch-mappings`); },
  async saveCbsBranchMapping(mapping: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/cbs-branch-mappings/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(mapping) }); },
  async getCbsSegmentMappings(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/cbs-segment-mappings`); },
  async saveCbsSegmentMapping(mapping: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/cbs-segment-mappings/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(mapping) }); },

  // --- User Org & Portfolio Assignment APIs ---
  async getUserOrgAssignments(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/user-org-assignments`); },
  async saveUserOrgAssignment(uoa: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/user-org-assignments/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(uoa) }); },
  async getPortfolioAssignments(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/portfolio-assignments`); },
  async savePortfolioAssignment(pa: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/portfolio-assignments/save?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(pa) }); },
  async reassignPortfolio(payload: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/portfolio-assignments/reassign?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(payload) }); },
  async getUnassignedRecords(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/unassigned-records`); },
  async getImpactPreview(payload: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/impact-preview?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify(payload) }); },
  async toggleSegmentStatus(segmentId: string, active: boolean, userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/segments/${encodeURIComponent(segmentId)}/toggle-status?active=${active}&adminUserId=${encodeURIComponent(userId)}`, { method: 'POST' }); },
  async toggleUserStatus(userId: string, active: boolean, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/toggle-status?active=${active}&adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'POST' }); },

  async getAdminRuntimeConfiguration(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/runtime`); },
  async getAdminHealth(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/health`); },
  async getConfigurationUsage(): Promise<Record<string, string>> { return requestJson<Record<string, string>>(`${API_BASE}/admin/configuration-usage`); },
  async getDependencyHealth(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/health/dependencies`); },
  async checkBusinessDate(date: string): Promise<any> { return requestJson<any>(`${API_BASE}/admin/calendar/check?date=${encodeURIComponent(date)}`); },
  async addWorkingDays(date: string, days: number): Promise<any> { return requestJson<any>(`${API_BASE}/admin/calendar/add-working-days?date=${encodeURIComponent(date)}&days=${days}`); },
  async previewNotificationTemplate(template: string, context: Record<string, unknown> = {}): Promise<{ preview: string }> { return requestJson<{ preview: string }>(`${API_BASE}/admin/templates/preview`, { method: 'POST', body: JSON.stringify({ template, context }) }); },
  async validateNotificationTemplate(subject: string, body: string): Promise<any> { return requestJson<any>(`${API_BASE}/admin/templates/validate`, { method: 'POST', body: JSON.stringify({ subject, body }) }); },
  async saveNotificationTemplate(template: NotificationTemplate, adminUserId = 'SYSADMIN'): Promise<NotificationTemplate> { return requestJson<NotificationTemplate>(`${API_BASE}/admin/templates/save?userId=${encodeURIComponent(adminUserId)}`, { method: 'POST', body: JSON.stringify({ id: template.id, name: template.name, type: template.type || template.channel || 'Email', channel: template.channel || template.type || 'Email', eventType: template.eventType || 'Expiry Reminder', triggerDaysBefore: template.triggerDaysBefore || 0, scheduleId: template.scheduleId, audience: template.audience, subject: template.subject || '', body: template.body, active: template.active !== false }) }); },
  async getNotificationTemplates(): Promise<NotificationTemplate[]> { return requestJson<NotificationTemplate[]>(`${API_BASE}/admin/templates`); },
  async runPolicyReminders(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/reminders/run?userId=${encodeURIComponent(userId)}`, { method: 'POST' }); },
  async runRenewalEscalations(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/escalations/run?userId=${encodeURIComponent(userId)}`, { method: 'POST' }); },
  async scanExceptionsNow(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/exceptions/scan?userId=${encodeURIComponent(userId)}`, { method: 'POST' }); },

  // --- Outbound Notifications & Integration Gateway APIs ---
  async fetchNotificationsDirect(channel?: string, status?: string, recipient?: string, query?: string, limit = 100): Promise<NotificationItem[]> {
    const q = new URLSearchParams();
    if (channel && channel !== 'ALL') q.set('channel', channel);
    if (status && status !== 'ALL') q.set('status', status);
    if (recipient) q.set('recipient', recipient);
    if (query) q.set('query', query);
    q.set('limit', String(limit));
    return requestJson<NotificationItem[]>(`${API_BASE}/notifications?${q.toString()}`);
  },

  async resendNotification(id: string, operatorId = 'SYSADMIN'): Promise<NotificationItem> {
    return requestJson<NotificationItem>(`${API_BASE}/notifications/${encodeURIComponent(id)}/resend?operatorId=${encodeURIComponent(operatorId)}`, {
      method: 'POST',
    });
  },

  async getNotificationIntegrationsStatus(): Promise<any> {
    return requestJson<any>(`${API_BASE}/notifications/integrations/status`);
  },

  async getNotificationIntegrationsConfig(): Promise<Record<string, string>> {
    return requestJson<Record<string, string>>(`${API_BASE}/notifications/integrations/config`);
  },

  async saveNotificationIntegrationsConfig(config: Record<string, string>, updatedBy = 'SYSADMIN'): Promise<Record<string, string>> {
    return requestJson<Record<string, string>>(`${API_BASE}/notifications/integrations/config?updatedBy=${encodeURIComponent(updatedBy)}`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async testOutlookIntegration(recipient: string, subject?: string, body?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/notifications/integrations/outlook/test`, {
      method: 'POST',
      body: JSON.stringify({ recipient, subject, body }),
    });
  },

  async testSmsIntegration(phone: string, message?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/notifications/integrations/sms/test`, {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
  },

  async markNotificationRead(id: string): Promise<NotificationItem> {
    return requestJson<NotificationItem>(`${API_BASE}/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    });
  },

  async markAllNotificationsRead(recipient?: string): Promise<{ success: boolean; markedCount: number }> {
    const q = recipient ? `?recipient=${encodeURIComponent(recipient)}` : '';
    return requestJson<{ success: boolean; markedCount: number }>(`${API_BASE}/notifications/mark-all-read${q}`, {
      method: 'POST',
    });
  },

  async getNotificationUnreadCount(recipient?: string): Promise<{ unreadCount: number }> {
    const q = recipient ? `?recipient=${encodeURIComponent(recipient)}` : '';
    return requestJson<{ unreadCount: number }>(`${API_BASE}/notifications/unread-count${q}`);
  },

  async deleteNotification(id: string): Promise<{ success: boolean; message: string }> {
    return requestJson<{ success: boolean; message: string }>(`${API_BASE}/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async sendAdminTestEmail(userId: string, subject?: string, body?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ userId, subject, body }),
    });
  },

  // --- Customer 360 Hub API ---
  async fetchCustomer360(customerId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/customers/${encodeURIComponent(customerId)}/360`);
  },

  // --- Exposure & Adequacy Summary API ---
  async fetchCollateralExposureSummary(collateralId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/exposure-summary`);
  },

  // --- Insurance Lifecycle API ---
  async registerInsurancePolicy(policy: any, userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/register?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ policy, documents }),
    });
    invalidateStateCache();
    return res;
  },

  async endorsePolicy(policyId: string, endorsementNo: string, description: string, effectiveDate?: string, documentId?: string, userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const params = new URLSearchParams({
      endorsementNo,
      description,
      userId,
    });
    if (effectiveDate) params.set('effectiveDate', effectiveDate);
    if (documentId) params.set('documentId', documentId);
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/endorse?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
    invalidateStateCache();
    return res;
  },

  async replacePolicy(policyId: string, replacement: any, reason = 'Policy replacement', userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/replace?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ replacement, policy: replacement, documents }),
    });
    invalidateStateCache();
    return res;
  },

  async cancelPolicy(policyId: string, reason = 'Borrower requested cancellation', userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/cancel?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
    invalidateStateCache();
    return res;
  },

  async closePolicy(policyId: string, reason = 'Matured without claim', userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/close?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
    invalidateStateCache();
    return res;
  },

  async reopenPolicy(policyId: string, reason = 'Reopened for active facility coverage', userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/reopen?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
    invalidateStateCache();
    return res;
  },

  async updatePolicyAllocations(
    policyId: string,
    collateralAllocations: { collateralId: string; allocatedInsuredAmount: number }[]
  ): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/policies/${encodeURIComponent(policyId)}/allocations`, {
      method: 'POST',
      body: JSON.stringify({ collateralAllocations }),
    });
    invalidateStateCache();
    return res;
  },

  async evaluatePolicyCompliance(collateralId: string, policy?: any, loanAccountId?: string): Promise<InsuranceComplianceDto> {
    const params = new URLSearchParams({ collateralId });
    if (loanAccountId) params.set('loanAccountId', loanAccountId);
    return requestJson<InsuranceComplianceDto>(`${API_BASE}/policies/evaluate-compliance?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(policy || {}),
    });
  },

  // --- CBS Synchronization API ---
  async syncAllCbs(userId = 'SYSTEM'): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/cbs/sync/all`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
    invalidateStateCache();
    return res;
  },

  async syncCustomerFromCbs(cif: string, userId = 'SYSTEM'): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/cbs/sync/customer/${encodeURIComponent(cif)}`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
    invalidateStateCache();
    return res;
  },

  async syncFacilityFromCbs(loanRef: string, userId = 'SYSTEM'): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/cbs/sync/facility/${encodeURIComponent(loanRef)}`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
    invalidateStateCache();
    return res;
  },

  async syncCollateralFromCbs(collateralCode: string, userId = 'SYSTEM'): Promise<any> {
    const res = await requestJson<any>(`${API_BASE}/cbs/sync/collateral/${encodeURIComponent(collateralCode)}`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
    invalidateStateCache();
    return res;
  },

  async fetchCbsSyncLogs(): Promise<CbsSyncLog[]> {
    return requestJson<CbsSyncLog[]>(`${API_BASE}/cbs/sync/logs`);
  },

  async fetchCbsSyncStatus(): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/status`);
  },

  // --- Scoped Production Dashboard APIs ---
  async getDashboardSummary(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
    category?: string;
    status?: string;
    expiry?: string;
  } = {}): Promise<import('../types').DashboardSummary> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    if (params.category && params.category !== 'ALL') q.set('category', params.category);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.expiry && params.expiry !== 'ALL') q.set('expiry', params.expiry);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<import('../types').DashboardSummary>(`${API_BASE}/dashboard/summary${qs}`);
  },

  async getDashboardCharts(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
    category?: string;
    status?: string;
    expiry?: string;
  } = {}): Promise<import('../types').DashboardChartData> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    if (params.category && params.category !== 'ALL') q.set('category', params.category);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.expiry && params.expiry !== 'ALL') q.set('expiry', params.expiry);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<import('../types').DashboardChartData>(`${API_BASE}/dashboard/charts${qs}`);
  },

  async getDashboardPortfolio(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
    category?: string;
    status?: string;
    expiry?: string;
  } = {}): Promise<import('../types').DashboardPortfolioRow[]> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    if (params.category && params.category !== 'ALL') q.set('category', params.category);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.expiry && params.expiry !== 'ALL') q.set('expiry', params.expiry);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<import('../types').DashboardPortfolioRow[]>(`${API_BASE}/dashboard/portfolio${qs}`);
  },

  async getDashboardWorkQueue(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
  } = {}): Promise<import('../types').DashboardWorkQueueItem[]> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<import('../types').DashboardWorkQueueItem[]>(`${API_BASE}/dashboard/work-queue${qs}`);
  },

  getDashboardExportUrl(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
    category?: string;
    status?: string;
    expiry?: string;
  } = {}): string {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    if (params.category && params.category !== 'ALL') q.set('category', params.category);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.expiry && params.expiry !== 'ALL') q.set('expiry', params.expiry);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return `${API_BASE}/dashboard/export${qs}`;
  },

  // --- 9-Level Progressive Hierarchical Drill-Down APIs ---
  async getHierarchyBank(userId?: string): Promise<any> {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/bank${qs}`);
  },

  async getHierarchySegment(segment: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (segment) q.set('segment', segment);
    if (userId) q.set('userId', userId);
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/segment?${q.toString()}`);
  },

  async getHierarchyDistrict(district: string, segment?: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (district) q.set('district', district);
    if (segment && segment !== 'ALL') q.set('segment', segment);
    if (userId) q.set('userId', userId);
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/district?${q.toString()}`);
  },

  async getHierarchyArea(area: string, district?: string, segment?: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (area) q.set('area', area);
    if (district) q.set('district', district);
    if (segment && segment !== 'ALL') q.set('segment', segment);
    if (userId) q.set('userId', userId);
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/area?${q.toString()}`);
  },

  async getHierarchyBranch(branch: string, segment?: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (branch) q.set('branch', branch);
    if (segment && segment !== 'ALL') q.set('segment', segment);
    if (userId) q.set('userId', userId);
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/branch?${q.toString()}`);
  },

  async getHierarchyCustomer(cif: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/customer/${encodeURIComponent(cif)}${qs}`);
  },

  async getHierarchyFacility(facilityId: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/facility/${encodeURIComponent(facilityId)}${qs}`);
  },

  async getHierarchyCollateral(collateralId: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/collateral/${encodeURIComponent(collateralId)}${qs}`);
  },

  async getHierarchyPolicy(policyId: string, userId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any>(`${API_BASE}/dashboard/hierarchy/policy/${encodeURIComponent(policyId)}${qs}`);
  },

  // --- Dashboard V2 Architecture Endpoints ---
  async getDashboardSnapshots(scopeLevel = 'BANK', scopeId = 'ALL'): Promise<{ scopeLevel: string; scopeId: string; hasSufficientData: boolean; message: string; snapshots: import('../types').DashboardSnapshot[]; periodOverPeriodDeltas?: any }> {
    const q = new URLSearchParams({ scopeLevel, scopeId });
    return requestJson<any>(`${API_BASE}/dashboard/snapshots?${q.toString()}`);
  },

  async captureDashboardSnapshot(scopeLevel = 'BANK', scopeId = 'ALL', userId?: string): Promise<import('../types').DashboardSnapshot> {
    const q = new URLSearchParams({ scopeLevel, scopeId });
    if (userId) q.set('userId', userId);
    return requestJson<import('../types').DashboardSnapshot>(`${API_BASE}/dashboard/snapshots/capture?${q.toString()}`, { method: 'POST' });
  },

  async getDashboardKpiExplanation(kpiKey: string, params: { userId?: string; segment?: string; district?: string; branch?: string } = {}): Promise<import('../types').KpiExplanation> {
    const q = new URLSearchParams({ kpiKey });
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    return requestJson<import('../types').KpiExplanation>(`${API_BASE}/dashboard/kpi-explanation?${q.toString()}`);
  },

  async getDashboardSharedCollaterals(params: { userId?: string; segment?: string; district?: string; branch?: string } = {}): Promise<any[]> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any[]>(`${API_BASE}/dashboard/shared-collaterals${qs}`);
  },

  async getDashboardRequiresAttention(params: { userId?: string; segment?: string; district?: string; branch?: string } = {}): Promise<any[]> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<any[]>(`${API_BASE}/dashboard/requires-attention${qs}`);
  },

  async getDashboardPaginatedPortfolio(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
    category?: string;
    status?: string;
    expiry?: string;
    search?: string;
    page?: number;
    size?: number;
    sortField?: string;
    sortDir?: string;
  } = {}): Promise<import('../types').PaginatedPortfolioResponse> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    if (params.category && params.category !== 'ALL') q.set('category', params.category);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.expiry && params.expiry !== 'ALL') q.set('expiry', params.expiry);
    if (params.search) q.set('search', params.search);
    if (params.page !== undefined) q.set('page', String(params.page));
    if (params.size !== undefined) q.set('size', String(params.size));
    if (params.sortField) q.set('sortField', params.sortField);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return requestJson<import('../types').PaginatedPortfolioResponse>(`${API_BASE}/dashboard/portfolio/paginated?${q.toString()}`);
  },

  async getDashboardRiskConcentration(params: {
    userId?: string;
    segment?: string;
    district?: string;
    branch?: string;
  } = {}): Promise<import('../types').EnterpriseRiskConcentration> {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<import('../types').EnterpriseRiskConcentration>(`${API_BASE}/dashboard/risk-concentration${qs}`);
  },

  async getDashboardEnterpriseSearch(
    query: string,
    params: {
      userId?: string;
      segment?: string;
      district?: string;
      branch?: string;
    } = {}
  ): Promise<import('../types').EnterpriseSearchResponse> {
    const q = new URLSearchParams({ q: query });
    if (params.userId) q.set('userId', params.userId);
    if (params.segment && params.segment !== 'ALL') q.set('segment', params.segment);
    if (params.district && params.district !== 'ALL') q.set('district', params.district);
    if (params.branch && params.branch !== 'ALL') q.set('branch', params.branch);
    return requestJson<import('../types').EnterpriseSearchResponse>(`${API_BASE}/dashboard/search?${q.toString()}`);
  },

  async preValidatePolicy(
    policy: Partial<InsurancePolicy>,
    documents?: any[]
  ): Promise<PolicyPreValidationResultDto> {
    return requestJson<PolicyPreValidationResultDto>(`${API_BASE}/policies/pre-validate`, {
      method: 'POST',
      body: JSON.stringify({ policy, documents: documents || [] }),
    });
  },

  async submitPolicyExceptionRequest(
    request: EntryTimeExceptionRequest,
    userId?: string
  ): Promise<{ success: boolean; message: string; exceptionId: string; policyId: string; workflowTaskId: string }> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<{ success: boolean; message: string; exceptionId: string; policyId: string; workflowTaskId: string }>(
      `${API_BASE}/policies/submit-exception-request${q}`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },

  async preValidateCollateral(
    collateral: Partial<Collateral>,
    documents?: any[],
    allocations?: any[],
    owners?: any[]
  ): Promise<PolicyPreValidationResultDto> {
    return requestJson<PolicyPreValidationResultDto>(`${API_BASE}/collateral/pre-validate`, {
      method: 'POST',
      body: JSON.stringify({
        collateral,
        documents: documents || [],
        allocations: allocations || [],
        owners: owners || [],
      }),
    });
  },

  async submitCollateralExceptionRequest(
    request: EntryTimeExceptionRequest,
    userId?: string
  ): Promise<{ success: boolean; message: string; exceptionId: string; collateralId: string; workflowTaskId: string }> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<{ success: boolean; message: string; exceptionId: string; collateralId: string; workflowTaskId: string }>(
      `${API_BASE}/collateral/submit-exception-request${q}`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },

  // --- Module 3: Relationship & Allocation APIs ---
  async getCollateralSecuredFacilities(collateralId: string): Promise<CollateralSecuredFacilitiesSummaryDto> {
    return requestJson<CollateralSecuredFacilitiesSummaryDto>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/facilities`);
  },

  async getFacilitySecuringCollaterals(facilityId: string): Promise<FacilityCollateralSummaryDto> {
    return requestJson<FacilityCollateralSummaryDto>(`${API_BASE}/facilities/${encodeURIComponent(facilityId)}/collaterals`);
  },

  async getEligibleCollateralsForFacility(facilityId: string, userId?: string): Promise<CollateralCandidateDto[]> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<CollateralCandidateDto[]>(`${API_BASE}/facilities/${encodeURIComponent(facilityId)}/eligible-collaterals${q}`);
  },

  async getEligibleFacilitiesForCollateral(collateralId: string, targetCustomerId?: string, userId?: string): Promise<LoanAccount[]> {
    const q = new URLSearchParams();
    if (targetCustomerId) q.append('targetCustomerId', targetCustomerId);
    if (userId) q.append('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<LoanAccount[]>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/eligible-facilities${qs}`);
  },

  async getCandidateFacilitiesForCollateral(collateralId: string, targetCustomerId?: string, userId?: string): Promise<FacilityCandidateDto[]> {
    const q = new URLSearchParams();
    if (targetCustomerId) q.append('targetCustomerId', targetCustomerId);
    if (userId) q.append('userId', userId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return requestJson<FacilityCandidateDto[]>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/candidate-facilities${qs}`);
  },

  async searchExistingCollateral(params: { code?: string; titleDeedNumber?: string; registrationNumber?: string; excludeId?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params.code) q.append('code', params.code);
    if (params.titleDeedNumber) q.append('titleDeedNumber', params.titleDeedNumber);
    if (params.registrationNumber) q.append('registrationNumber', params.registrationNumber);
    if (params.excludeId) q.append('excludeId', params.excludeId);
    return requestJson<any>(`${API_BASE}/collaterals/search-existing?${q.toString()}`);
  },

  async getAllCollateralFacilityLinks(filters?: { collateralId?: string; facilityId?: string; customerId?: string; status?: string }): Promise<CollateralFacilityLinkDto[]> {
    const q = new URLSearchParams();
    if (filters?.collateralId) q.append('collateralId', filters.collateralId);
    if (filters?.facilityId) q.append('facilityId', filters.facilityId);
    if (filters?.customerId) q.append('customerId', filters.customerId);
    if (filters?.status) q.append('status', filters.status);
    return requestJson<CollateralFacilityLinkDto[]>(`${API_BASE}/collateral-facility-links?${q.toString()}`);
  },

  async getCollateralFacilityLinkById(id: string): Promise<CollateralFacilityLinkDto> {
    return requestJson<CollateralFacilityLinkDto>(`${API_BASE}/collateral-facility-links/${encodeURIComponent(id)}`);
  },

  async createCollateralFacilityLink(dto: RelationshipRequestDto, userId?: string): Promise<CollateralFacilityLinkDto> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<CollateralFacilityLinkDto>(`${API_BASE}/collateral-facility-links${q}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async updateCollateralFacilityLink(id: string, dto: RelationshipRequestDto, userId?: string): Promise<CollateralFacilityLinkDto> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<CollateralFacilityLinkDto>(`${API_BASE}/collateral-facility-links/${encodeURIComponent(id)}${q}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  },

  async endCollateralFacilityLink(id: string, reason?: string, userId?: string): Promise<CollateralFacilityLinkDto> {
    const q = new URLSearchParams();
    if (reason) q.append('reason', reason);
    if (userId) q.append('userId', userId);
    return requestJson<CollateralFacilityLinkDto>(`${API_BASE}/collateral-facility-links/${encodeURIComponent(id)}/end?${q.toString()}`, {
      method: 'POST',
    });
  },

  async getCollateralFacilityLinkHistory(id: string): Promise<LoanCollateralLinkHistoryDto[]> {
    return requestJson<LoanCollateralLinkHistoryDto[]>(`${API_BASE}/collateral-facility-links/${encodeURIComponent(id)}/history`);
  },

  async validateCollateralFacilityLink(dto: RelationshipRequestDto): Promise<RelationshipValidationResultDto> {
    return requestJson<RelationshipValidationResultDto>(`${API_BASE}/collateral-facility-links/validate`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async validateCollateralRelease(collateralId: string): Promise<{ canRelease: boolean; reason: string; activeFacilitiesCount: number; activeOutstandingBalance: number; hasApprovedException: boolean }> {
    return requestJson<any>(`${API_BASE}/collateral-facility-links/validate-release?collateralId=${encodeURIComponent(collateralId)}`);
  },

  async getPortfolioExposureSummary(): Promise<{ totalFacilitiesCount: number; totalBankPortfolioExposure: number; securedFacilitiesCount: number; singleCountedAllocatedCollateral: number; netUncoveredExposure: number }> {
    return requestJson<any>(`${API_BASE}/portfolio/exposure-summary`);
  },

  async reconcileCbsRelationships(): Promise<CbsRelationshipReconciliationDto> {
    return requestJson<CbsRelationshipReconciliationDto>(`${API_BASE}/collateral-facility-links/reconcile-cbs`);
  },

  // 1st / 2nd Degree Collateral Prioritization & Mortgage Registration
  async validateSecondDegreeCollateral(collateral: Partial<Collateral>): Promise<SecondDegreeValidationResult> {
    return requestJson<SecondDegreeValidationResult>(`${API_BASE}/collaterals/second-degree/validate`, {
      method: 'POST',
      body: JSON.stringify(collateral),
    });
  },

  async promoteCollateralToFirstDegree(collateralId: string, reviewNotes: string, reviewedBy?: string): Promise<{ success: boolean; message: string; collateral: Collateral }> {
    const q = new URLSearchParams();
    if (reviewNotes) q.append('reviewNotes', reviewNotes);
    if (reviewedBy) q.append('reviewedBy', reviewedBy);
    return requestJson<any>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/promote?${q.toString()}`, {
      method: 'POST',
    });
  },

  async refreshFirstDegreeBalance(collateralId: string, balance?: number, asOfDate?: string, updatedBy?: string): Promise<{ success: boolean; message: string; collateral: Collateral }> {
    const q = new URLSearchParams();
    if (balance !== undefined && balance !== null) q.append('balance', balance.toString());
    if (asOfDate) q.append('asOfDate', asOfDate);
    if (updatedBy) q.append('updatedBy', updatedBy);
    return requestJson<any>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/refresh-first-degree-balance?${q.toString()}`, {
      method: 'POST',
    });
  },

  async getCollateralDegreeDetails(collateralId: string): Promise<DegreeDetailsDto> {
    return requestJson<DegreeDetailsDto>(`${API_BASE}/collaterals/${encodeURIComponent(collateralId)}/degree-details`);
  },

  async getPromotionEligibleCollaterals(): Promise<Collateral[]> {
    return requestJson<Collateral[]>(`${API_BASE}/collaterals/promotion-eligible`);
  },

  // --- Insurance Adequacy & Coverage Rules (BR-18, BR-03, BR-11) ---
  async getInsuranceAdequacy(collateralId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/insurance-adequacy/${encodeURIComponent(collateralId)}`);
  },

  async getInsuranceCoverageRules(): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/insurance-adequacy/rules`);
  },

  async saveInsuranceCoverageRule(rule: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/insurance-adequacy/rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  },

  async toggleInsuranceCoverageRule(ruleId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/insurance-adequacy/rules/${encodeURIComponent(ruleId)}/toggle`, {
      method: 'POST',
    });
  },

  async submitInsuranceException(exception: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/insurance-adequacy/exceptions`, {
      method: 'POST',
      body: JSON.stringify(exception),
    });
  },

  async approveInsuranceException(exceptionId: string, comments?: string): Promise<any> {
    const q = new URLSearchParams();
    if (comments) q.append('comments', comments);
    return requestJson<any>(`${API_BASE}/insurance-adequacy/exceptions/${encodeURIComponent(exceptionId)}/approve?${q.toString()}`, {
      method: 'POST',
    });
  },

  async rejectInsuranceException(exceptionId: string, comments: string): Promise<any> {
    const q = new URLSearchParams();
    q.append('comments', comments);
    return requestJson<any>(`${API_BASE}/insurance-adequacy/exceptions/${encodeURIComponent(exceptionId)}/reject?${q.toString()}`, {
      method: 'POST',
    });
  },

  async resolveInsuranceException(exceptionId: string, notes?: string): Promise<any> {
    const q = new URLSearchParams();
    if (notes) q.append('notes', notes);
    return requestJson<any>(`${API_BASE}/insurance-adequacy/exceptions/${encodeURIComponent(exceptionId)}/resolve?${q.toString()}`, {
      method: 'POST',
    });
  },

  // --- Early Collateral Release & Pre-Release Impact Assessment ---
  async getPreReleaseImpactCheck(collateralId: string, facilityIds?: string[]): Promise<any> {
    const q = new URLSearchParams();
    q.append('collateralId', collateralId);
    if (facilityIds && facilityIds.length > 0) q.append('facilityIds', facilityIds.join(','));
    return requestJson<any>(`${API_BASE}/collateral-release/pre-release-check?${q.toString()}`);
  },

  async submitEarlyReleaseRequest(payload: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral-release/requests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAllReleaseRequests(): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/collateral-release/requests`);
  },

  async getReleaseRequestById(id: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral-release/requests/${encodeURIComponent(id)}`);
  },

  async approveReleaseRequest(id: string, comments?: string): Promise<any> {
    const q = new URLSearchParams();
    if (comments) q.append('comments', comments);
    return requestJson<any>(`${API_BASE}/collateral-release/requests/${encodeURIComponent(id)}/approve?${q.toString()}`, {
      method: 'POST',
    });
  },

  async rejectReleaseRequest(id: string, comments?: string): Promise<any> {
    const q = new URLSearchParams();
    if (comments) q.append('comments', comments);
    return requestJson<any>(`${API_BASE}/collateral-release/requests/${encodeURIComponent(id)}/reject?${q.toString()}`, {
      method: 'POST',
    });
  },

  async recordManualCbsUpdate(id: string, payload: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral-release/requests/${encodeURIComponent(id)}/manual-cbs-update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --- Production CBS-Imported Collateral Management & Data Enrichment ---
  async getCbsSyncedCollaterals(params?: {
    page?: number;
    size?: number;
    search?: string;
    segment?: string;
    district?: string;
    branch?: string;
    collateralType?: string;
    dataQualityStatus?: string;
    assignedCro?: string;
    insuranceStatus?: string;
  }): Promise<{ content: any[]; totalElements: number; totalPages: number; currentPage: number; pageSize: number }> {
    const q = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) q.append('page', params.page.toString());
      if (params.size !== undefined) q.append('size', params.size.toString());
      if (params.search) q.append('search', params.search);
      if (params.segment) q.append('segment', params.segment);
      if (params.district) q.append('district', params.district);
      if (params.branch) q.append('branch', params.branch);
      if (params.collateralType) q.append('collateralType', params.collateralType);
      if (params.dataQualityStatus) q.append('dataQualityStatus', params.dataQualityStatus);
      if (params.assignedCro) q.append('assignedCro', params.assignedCro);
      if (params.insuranceStatus) q.append('insuranceStatus', params.insuranceStatus);
    }
    return requestJson(`${API_BASE}/collateral/cbs-synced?${q.toString()}`);
  },

  async getCollateralOverview(params?: {
    page?: number;
    size?: number;
    search?: string;
    originType?: string;
    segment?: string;
    branch?: string;
    dataQualityStatus?: string;
  }): Promise<{ content: any[]; totalElements: number; totalPages: number; currentPage: number; pageSize: number }> {
    const q = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) q.append('page', params.page.toString());
      if (params.size !== undefined) q.append('size', params.size.toString());
      if (params.search) q.append('search', params.search);
      if (params.originType) q.append('originType', params.originType);
      if (params.segment) q.append('segment', params.segment);
      if (params.branch) q.append('branch', params.branch);
      if (params.dataQualityStatus) q.append('dataQualityStatus', params.dataQualityStatus);
    }
    return requestJson(`${API_BASE}/collateral/overview?${q.toString()}`);
  },

  async getDataQualitySummary(): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/data-quality-summary`);
  },

  async getQualityFindings(id: string): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/collateral/${encodeURIComponent(id)}/quality-findings`);
  },

  async getCbsSnapshot(id: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(id)}/cbs-snapshot`);
  },

  async getCollateralProvenance(id: string): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/collateral/${encodeURIComponent(id)}/provenance`);
  },

  async enrichCollateral(id: string, payload: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(id)}/enrich`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async submitEnrichmentForChecker(id: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(id)}/submit-enrichment`, {
      method: 'POST',
    });
  },

  async approveEnrichment(id: string, notes?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(id)}/approve-enrichment`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async rejectEnrichment(id: string, reason?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/${encodeURIComponent(id)}/reject-enrichment`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async previewCbsImport(): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/import/preview`);
  },

  async runCbsImport(batchRef?: string, chunkSize?: number): Promise<any> {
    const q = new URLSearchParams();
    if (batchRef) q.append('batchRef', batchRef);
    if (chunkSize) q.append('chunkSize', chunkSize.toString());
    return requestJson<any>(`${API_BASE}/collateral/import/run?${q.toString()}`, {
      method: 'POST',
    });
  },

  async getCbsImportBatches(): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/collateral/import/batches`);
  },

  async getCbsDuplicateQueue(status?: string): Promise<any[]> {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    return requestJson<any[]>(`${API_BASE}/collateral/duplicate-queue?${q.toString()}`);
  },

  async resolveCbsDuplicate(payload: { queueId: string; decision: string; notes?: string }): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/duplicate-queue/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCbsUnresolvedLinks(status?: string): Promise<any[]> {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    return requestJson<any[]>(`${API_BASE}/collateral/unresolved-links?${q.toString()}`);
  },

  async resolveCbsUnresolvedLink(payload: { linkId: string; loanId: string }): Promise<any> {
    return requestJson<any>(`${API_BASE}/collateral/unresolved-links/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --- Production CBS Oracle 3-View Integration Operations ---
  async setCbsMode(mode: 'SIMULATOR' | 'REAL'): Promise<{ message: string; mode: string }> {
    return requestJson<any>(`${API_BASE}/cbs/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  async getCbsConfig(): Promise<{
    mode: string;
    oracle?: {
      jdbcUrl: string;
      rawJdbcUrl: string;
      username: string;
      hasPassword: boolean;
      schema: string;
      customerView: string;
      facilityView: string;
      collateralView: string;
      isConfigured: boolean;
    };
    connectionStatus: string;
    connectionMessage: string;
  }> {
    return requestJson<any>(`${API_BASE}/cbs/config`);
  },

  async updateCbsConfig(payload: {
    mode?: string;
    jdbcUrl?: string;
    username?: string;
    password?: string;
    schema?: string;
    customerView?: string;
    facilityView?: string;
    collateralView?: string;
  }): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/config`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async testCbsConnection(payload?: {
    jdbcUrl?: string;
    username?: string;
    password?: string;
  }): Promise<{ mode: string; status: string; message: string; timestamp: string }> {
    return requestJson<any>(`${API_BASE}/cbs/test-connection`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  async getCbsHealth(): Promise<{ mode: string; status: string; message: string; timestamp: string }> {
    return requestJson<any>(`${API_BASE}/cbs/health`);
  },

  async validateCbsSchema(): Promise<{ status: string; message: string; totalColumnsVerified?: number; missingColumns?: any; verifiedColumns?: any }> {
    return requestJson<any>(`${API_BASE}/cbs/schema/validate`);
  },

  async previewCbsThreeViews(): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/three-views/preview`);
  },

  async executeCbsThreeViewsImport(batchRef?: string, chunkSize?: number): Promise<any> {
    const q = new URLSearchParams();
    if (batchRef) q.append('batchRef', batchRef);
    if (chunkSize) q.append('chunkSize', chunkSize.toString());
    return requestJson<any>(`${API_BASE}/cbs/three-views/import?${q.toString()}`, {
      method: 'POST',
    });
  },

  async getCustomerCbsSnapshot(cifOrId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/snapshots/customer/${encodeURIComponent(cifOrId)}`);
  },

  async getFacilityCbsSnapshot(accOrId: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/snapshots/facility/${encodeURIComponent(accOrId)}`);
  },

  async getCustomerProvenance(customerId: string): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/cbs/provenance/customer/${encodeURIComponent(customerId)}`);
  },

  async getFacilityProvenance(facilityId: string): Promise<any[]> {
    return requestJson<any[]>(`${API_BASE}/cbs/provenance/facility/${encodeURIComponent(facilityId)}`);
  },

  async enrichCustomer(customerId: string, payload: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/customers/${encodeURIComponent(customerId)}/enrich`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async enrichFacility(facilityId: string, payload: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/facilities/${encodeURIComponent(facilityId)}/enrich`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCbsUnresolvedEntities(status?: string): Promise<any[]> {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    return requestJson<any[]>(`${API_BASE}/cbs/unresolved-entities?${q.toString()}`);
  },

  async resolveCbsEntity(id: string, notes?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/unresolved-entities/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async getCbsDuplicateCollisions(status?: string): Promise<any[]> {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    return requestJson<any[]>(`${API_BASE}/cbs/duplicate-collisions?${q.toString()}`);
  },

  async resolveCbsDuplicateCollision(id: string, decision: string, notes?: string): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/duplicate-collisions/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  },

  async getCbsCodeMappings(type?: string): Promise<any[]> {
    const q = new URLSearchParams();
    if (type) q.append('type', type);
    return requestJson<any[]>(`${API_BASE}/cbs/code-mappings?${q.toString()}`);
  },

  async saveCbsCodeMapping(mapping: any): Promise<any> {
    return requestJson<any>(`${API_BASE}/cbs/code-mappings`, {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  },
};


