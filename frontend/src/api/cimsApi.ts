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
  CollateralSecuredFacilitiesSummaryDto,
  FacilityCollateralSummaryDto,
  RelationshipRequestDto,
  RelationshipValidationResultDto,
  LoanCollateralLinkHistoryDto,
  CbsRelationshipReconciliationDto,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_CIMS_API_BASE || '/api';

function getStoredSession(): any {
  try { return JSON.parse(localStorage.getItem('cims.currentUser') || 'null'); } catch { return null; }
}

function authHeaders(): Record<string,string> {
  const session=getStoredSession();
  return { 'X-User-Id': session?.userId || session?.username || '', 'X-User-Role': session?.role || '' };
}

function rememberSession(user: any) {
  try { localStorage.setItem('cims.currentUser', JSON.stringify(user)); } catch {}
}

function clearSession() { try { localStorage.removeItem('cims.currentUser'); } catch {} }

let stateInFlight: Promise<FullCimsState> | null = null;
let stateCache: FullCimsState | null = null;
let stateCacheAt = 0;
const STATE_CACHE_TTL_MS = 1500;

function invalidateStateCache() {
  stateCache = null;
  stateCacheAt = 0;
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed with HTTP ${response.status}`;
    throw new Error(message);
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
  async login(username: string, password = 'password123'): Promise<{ success: boolean; user?: any; token?: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data?.success && data?.user) rememberSession(data.user);
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'Login request failed' };
    }
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
      const res = await fetch(`${API_BASE}/state`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch system state');
      const data = await res.json() as FullCimsState;
      stateCache = data;
      stateCacheAt = Date.now();
      return data;
    })();
    try { return await stateInFlight; } finally { stateInFlight = null; }
  },

  // Convenience entity getters (queries state or individual endpoints)
  async getCustomers(): Promise<Customer[]> {
    try {
      const state = await this.fetchFullState();
      return state.customers || [];
    } catch {
      return [];
    }
  },

  async getFacilities(): Promise<LoanAccount[]> {
    try {
      const state = await this.fetchFullState();
      return state.facilities || state.loans || [];
    } catch {
      return [];
    }
  },

  async getCollaterals(): Promise<Collateral[]> {
    try {
      const state = await this.fetchFullState();
      return state.collaterals || [];
    } catch {
      return [];
    }
  },

  async getLinks(): Promise<LoanCollateralLink[]> {
    try {
      const state = await this.fetchFullState();
      return state.links || [];
    } catch {
      return [];
    }
  },

  async getPolicies(): Promise<InsurancePolicy[]> {
    try {
      const state = await this.fetchFullState();
      return state.policies || [];
    } catch {
      return [];
    }
  },

  async getEndorsements(): Promise<PolicyEndorsement[]> {
    try {
      const state = await this.fetchFullState();
      return state.endorsements || [];
    } catch {
      return [];
    }
  },

  async getDocuments(): Promise<OwnershipDocument[]> {
    try {
      const state = await this.fetchFullState();
      return state.documents || [];
    } catch {
      return [];
    }
  },

  async getExceptions(): Promise<CimsException[]> {
    try {
      const state = await this.fetchFullState();
      return state.exceptions || [];
    } catch {
      return [];
    }
  },

  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const state = await this.fetchFullState();
      return state.notifications || [];
    } catch {
      return [];
    }
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
      const res = await fetch(`${API_BASE}/workflow/tasks?${params.toString()}`, { headers: authHeaders() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || payload?.message || 'Unable to load workflow tasks.');
      return Array.isArray(payload) ? payload : (payload?.workflowTasks || []);
    } catch (e) {
      throw e;
    }
  },

  async getTaskHistory(taskId: string): Promise<ApprovalHistory[]> {
    try {
      const res = await fetch(`${API_BASE}/workflow/tasks/${encodeURIComponent(taskId)}/history`, { headers: authHeaders() });
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
      const res = await fetch(`${API_BASE}/admin/users`);
      if (res.ok) return res.json();
      return [];
    } catch {
      return [];
    }
  },

  // CBS Simulator
  async getCbsCustomers(): Promise<CbsCustomer[]> {
    const res = await fetch(`${API_BASE}/cbs-sim/customers`);
    return res.ok ? res.json() : [];
  },

  async saveCbsCustomer(cust: Partial<CbsCustomer>): Promise<CbsCustomer> {
    const res = await fetch(`${API_BASE}/cbs-sim/customers`, {
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
    const res = await fetch(`${API_BASE}/cbs-sim/facilities`);
    return res.ok ? res.json() : [];
  },

  async saveCbsFacility(fac: Partial<CbsFacility>): Promise<CbsFacility> {
    const res = await fetch(`${API_BASE}/cbs-sim/facilities`, {
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
    const res = await fetch(`${API_BASE}/cbs-sim/collaterals`);
    return res.ok ? res.json() : [];
  },

  async saveCbsCollateral(col: Partial<CbsCollateral>): Promise<CbsCollateral> {
    const res = await fetch(`${API_BASE}/cbs-sim/collaterals`, {
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

  async syncCbsEntity(entityType: string, id: string, userId = 'SYSADMIN'): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/cbs-integration/sync/${entityType}/${id}?userId=${userId}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async syncAllPending(userId = 'SYSADMIN'): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/cbs-integration/sync-all?userId=${userId}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async getCbsSyncLogs(): Promise<CbsSyncLog[]> {
    const res = await fetch(`${API_BASE}/cbs-sim/sync-logs`);
    return res.ok ? res.json() : [];
  },

  // Customer Management
  async registerCustomer(cust: Partial<Customer>, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await fetch(`${API_BASE}/customers/add?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(customerId)}/update?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/register-native?userId=${encodeURIComponent(userId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/update?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(url, {
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
    const res = await fetch(`${API_BASE}/links/remove?linkId=${encodeURIComponent(linkId)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async validateReleaseCollateral(collateralId: string): Promise<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string }> {
    const res = await fetch(`${API_BASE}/collateral/validate-release?collateralId=${collateralId}`);
    return res.json();
  },

  async transferCollateralSegment(collateralId: string, destSegment: string, reason: string, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    // Backend route is /transfers/initiate with a `destinationSegment` param - this used to
    // point at a /collateral/transfer-segment URL that the backend never exposed, so every
    // segment transfer request silently 404'd.
    const res = await fetch(`${API_BASE}/transfers/initiate?collateralId=${encodeURIComponent(collateralId)}&destinationSegment=${encodeURIComponent(destSegment)}&reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(effectiveUserId)}`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  async changeCollateralOwnership(collateralId: string, payload: any, userId?: string): Promise<any> {
    const effectiveUserId = userId || getStoredSession()?.userId || getStoredSession()?.username || '';
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/change-ownership?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/verify-owner?ownerId=${encodeURIComponent(ownerId)}&status=${encodeURIComponent(status)}&comments=${encodeURIComponent(comments)}&userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/add-owner?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/update-owner?ownerId=${encodeURIComponent(ownerId)}&userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/allocate-facilities?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/register-with-allocations?userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/collateral/${encodeURIComponent(collateralId)}/request-release?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(effectiveUserId)}`, {
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
    const res = await fetch(`${API_BASE}/policies/add?userId=${userId}`, {
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
    const res = await fetch(`${API_BASE}/policies/submit?policyId=${encodeURIComponent(policyId)}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST', headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false || payload?.error) throw new Error(payload?.error || payload?.message || 'Unable to submit policy for approval.');
    invalidateStateCache();
    return payload;
  },

  async amendPolicy(policyId: string, policy: Partial<InsurancePolicy>, reason: string, userId = 'CRO_USER', documents?: any[]): Promise<any> {
    const res = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyId)}/amend?reason=${encodeURIComponent(reason)}&userId=${encodeURIComponent(userId)}`, {
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
    const res = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyId)}/renew?newAmount=${newAmount}&newPremium=${newPremium}&newExpiryDate=${encodeURIComponent(newExpiryDate)}&userId=${encodeURIComponent(userId)}`, {
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
    const res = await fetch(`${API_BASE}/workflow/tasks/${taskId}/approve?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to approve workflow task.');
    invalidateStateCache();
    return payload;
  },

  async rejectWorkflowTask(taskId: string, comments: string, userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await fetch(`${API_BASE}/workflow/tasks/${taskId}/reject?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to reject workflow task.');
    invalidateStateCache();
    return payload;
  },

  async returnWorkflowTask(taskId: string, correctionNote: string, userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await fetch(`${API_BASE}/workflow/tasks/${taskId}/return?userId=${userId}&role=${role}&correctionNote=${encodeURIComponent(correctionNote)}`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to return workflow task.');
    invalidateStateCache();
    return payload;
  },

  async resubmitWorkflowTask(taskId: string, userId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/workflow/tasks/${taskId}/resubmit?userId=${encodeURIComponent(userId)}`, {
      method: 'POST', headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || 'Unable to resubmit workflow task.');
    invalidateStateCache();
    return payload;
  },

  async bulkApproveWorkflowTasks(taskIds: string[], comments = 'Bulk approved', userId = 'BRMGR_USER', role = 'BRMGR'): Promise<any> {
    const res = await fetch(`${API_BASE}/workflow/bulk-approve?userId=${userId}&role=${role}&comments=${encodeURIComponent(comments)}`, {
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
    const res = await fetch(`${API_BASE}/workflow/delegations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delegation),
    });
    invalidateStateCache();
    return res.json();
  },

  async revokeDelegation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/workflow/delegations/${id}/revoke`, {
      method: 'POST',
    });
    invalidateStateCache();
    return res.json();
  },

  // Exceptions (US-12.1 - US-12.4)
  async triggerPortfolioScan(): Promise<ScanResultDto> {
    const res = await fetch(`${API_BASE}/exceptions/scan-now`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || payload?.error || 'Exception scan failed.');
    invalidateStateCache();
    return payload;
  },

  async getExceptionSummary(): Promise<ExceptionSummaryDto> {
    const res = await fetch(`${API_BASE}/exceptions/summary`, {
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

    const res = await fetch(`${API_BASE}/exceptions?${params.toString()}`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/resolve`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/evidence`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/corrective-action`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/escalate`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/assign`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/investigation-notes`, {
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
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(id)}/history`, {
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
    const res = await fetch(`${API_BASE}/documents/upload`, {
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
  async saveSegment(seg: Partial<BusinessSegment>, userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/segments/save?adminUserId=${encodeURIComponent(userId)}`, {method:'POST',body:JSON.stringify(seg)}); },
  async saveUser(user: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/users/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(user)}); },
  async saveBranch(branch: Partial<Branch>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/branches/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(branch)}); },
  async saveApprovalConfig(config: Partial<ApprovalHierarchyConfig>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/approval-configs/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(config)}); },
  async saveReminderSchedule(schedule: Partial<ReminderSchedule>, adminUserId = 'SYSADMIN'): Promise<ReminderSchedule> { return requestJson<ReminderSchedule>(`${API_BASE}/admin/reminder-schedules/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(schedule)}); },
  async saveScheduledReport(report: Partial<ScheduledReport>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/scheduled-reports/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(report)}); },
  async saveSystemParameter(param: Partial<SystemParameter>, adminUserId = 'SYSADMIN'): Promise<SystemParameter> { return requestJson<SystemParameter>(`${API_BASE}/admin/parameters/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(param)}); },
  async saveApprovedInsurer(insurer: Partial<ApprovedInsurer>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/insurers/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(insurer)}); },
  async saveRolePermission(permission: Partial<RolePermission>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/permissions/save?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(permission)}); },
  async saveRolePermissionsBatch(permissions: RolePermission[], adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/permissions/save-batch?adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(permissions)}); },
  async saveCollateralTaxonomy(taxonomy: Partial<CollateralTaxonomy>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/taxonomy/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(taxonomy)}); },
  async saveMandatoryDocRule(rule: Partial<MandatoryDocumentRule>, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/document-rules/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(rule)}); },
  async saveHolidayCalendar(holiday: Partial<HolidayCalendar>, adminUserId = 'SYSADMIN'): Promise<HolidayCalendar> { return requestJson<HolidayCalendar>(`${API_BASE}/admin/holidays/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(holiday)}); },
  async deleteHolidayCalendar(holidayId: string, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/holidays/${encodeURIComponent(holidayId)}/delete?userId=${encodeURIComponent(adminUserId)}`, {method:'POST'}); },
  async getDistricts(): Promise<any[]> { return requestJson<any[]>(`${API_BASE}/admin/districts`); },
  async saveDistrict(district: any, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/districts/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify(district)}); },
  async toggleSegmentStatus(segmentId: string, active: boolean, userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/segments/${encodeURIComponent(segmentId)}/toggle-status?active=${active}&adminUserId=${encodeURIComponent(userId)}`, {method:'POST'}); },
  async toggleUserStatus(userId: string, active: boolean, adminUserId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/toggle-status?active=${active}&adminUserId=${encodeURIComponent(adminUserId)}`, {method:'POST'}); },

  async getAdminRuntimeConfiguration(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/runtime`); },
  async getAdminHealth(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/health`); },
  async getConfigurationUsage(): Promise<Record<string,string>> { return requestJson<Record<string,string>>(`${API_BASE}/admin/configuration-usage`); },
  async getDependencyHealth(): Promise<any> { return requestJson<any>(`${API_BASE}/admin/health/dependencies`); },
  async checkBusinessDate(date: string): Promise<any> { return requestJson<any>(`${API_BASE}/admin/calendar/check?date=${encodeURIComponent(date)}`); },
  async addWorkingDays(date: string, days: number): Promise<any> { return requestJson<any>(`${API_BASE}/admin/calendar/add-working-days?date=${encodeURIComponent(date)}&days=${days}`); },
  async previewNotificationTemplate(template: string, context: Record<string, unknown> = {}): Promise<{preview:string}> { return requestJson<{preview:string}>(`${API_BASE}/admin/templates/preview`, {method:'POST',body:JSON.stringify({template,context})}); },
  async validateNotificationTemplate(subject: string, body: string): Promise<any> { return requestJson<any>(`${API_BASE}/admin/templates/validate`, {method:'POST',body:JSON.stringify({subject,body})}); },
  async saveNotificationTemplate(template: NotificationTemplate, adminUserId = 'SYSADMIN'): Promise<NotificationTemplate> { return requestJson<NotificationTemplate>(`${API_BASE}/admin/templates/save?userId=${encodeURIComponent(adminUserId)}`, {method:'POST',body:JSON.stringify({id:template.id,name:template.name,type:template.type||template.channel||'Email',triggerDaysBefore:template.triggerDaysBefore||0,subject:template.subject||'',body:template.body,active:template.active!==false})}); },
  async getNotificationTemplates(): Promise<NotificationTemplate[]> { return requestJson<NotificationTemplate[]>(`${API_BASE}/admin/templates`); },
  async runPolicyReminders(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/reminders/run?userId=${encodeURIComponent(userId)}`, {method:'POST'}); },
  async runRenewalEscalations(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/escalations/run?userId=${encodeURIComponent(userId)}`, {method:'POST'}); },
  async scanExceptionsNow(userId = 'SYSADMIN'): Promise<any> { return requestJson<any>(`${API_BASE}/admin/exceptions/scan?userId=${encodeURIComponent(userId)}`, {method:'POST'}); },

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
};

