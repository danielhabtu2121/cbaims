import { RoleCode, RolePermission, UserSession } from '../types';

/**
 * Converts the authoritative user object returned by the backend login and
 * /api/auth/session/validate endpoints into the frontend session shape.
 *
 * Branch, segment, district, role and all permissions are taken from the
 * persisted backend user. There are deliberately no client-side role defaults
 * or persona lookups here.
 */
export function toUserSession(raw: any, fallbackPermissions: RolePermission[] = []): UserSession | null {
  if (!raw) return null;
  const role = String(raw.role || '').trim().toUpperCase() as RoleCode;
  if (!role) return null;

  const permissions = normalizePermissions(raw.permissions, fallbackPermissions, role);
  const approvalPermission = permissions.find((p) => screenKey(p.screenName) === 'approvals');
  const allowedSegments = stringList(raw.allowedSegments).length
    ? stringList(raw.allowedSegments)
    : (stringList(raw.segmentIds).length ? stringList(raw.segmentIds) : stringList(raw.segment ? [raw.segment] : []));

  return {
    userId: String(raw.userId || raw.id || raw.username || ''),
    username: String(raw.username || ''),
    name: String(raw.name || raw.fullName || raw.displayName || raw.username || ''),
    fullName: String(raw.fullName || raw.name || ''),
    displayName: raw.displayName,
    role,
    roleName: String(raw.roleName || role),
    branch: String(raw.branch || ''),
    branchCode: raw.branchCode,
    district: raw.district,
    segment: String(raw.segment || ''),
    segmentIds: allowedSegments,
    allowedSegments,
    allowedBranches: stringList(raw.allowedBranches),
    allowedDistricts: stringList(raw.allowedDistricts),
    bankWide: raw.bankWide === true,
    readOnly: raw.readOnly === true,
    scopeRestricted: raw.scopeRestricted === true,
    isAdmin: raw.isAdmin === true || role === 'SYSADMIN' || String(role).includes('SYSADMIN') || String(role).includes('ADMIN'),
    active: raw.active !== false,
    email: raw.email,
    phone: raw.phone,
    permissions,
    canApprove: raw.readOnly === true ? false : approvalPermission
      ? approvalPermission.canApprove === true
      : raw.canApprove === true,
    canCreate: raw.canCreate === true,
    canEdit: raw.canEdit === true,
    canDelete: raw.canDelete === true,
    token: raw.token,
  };
}

export function normalizePermissions(
  primary: any,
  fallback: RolePermission[] = [],
  role?: string
): RolePermission[] {
  const source = Array.isArray(primary) && primary.length > 0 ? primary : fallback;
  if (!Array.isArray(source)) return [];
  return source.filter((p: any) => !role || String(p?.roleCode || '').toUpperCase() === role);
}

export function screenKey(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findScreenPermission(
  permissions: RolePermission[],
  role: string,
  page: string
): RolePermission | undefined {
  const key = screenKey(page);
  return permissions.find((p) => {
    if (String(p.roleCode || '').toUpperCase() !== role) return false;
    const s = screenKey(p.screenName);
    if (!s) return false;
    if (s === key || s.includes(key) || key.includes(s)) return true;
    if (key === 'collateral' && s.includes('collat')) return true;
    if (key === 'customers' && s.includes('custom')) return true;
    if (key === 'facilities' && s.includes('facilit')) return true;
    if (key === 'insurance' && (s.includes('insuran') || s.includes('polic'))) return true;
    if (key === 'approvals' && (s.includes('approv') || s.includes('workflow'))) return true;
    if (key === 'exceptions' && s.includes('except')) return true;
    if (key === 'documents' && (s.includes('docum') || s.includes('dms'))) return true;
    if (key === 'reports' && s.includes('report')) return true;
    if (key === 'audit' && s.includes('audit')) return true;
    if (key === 'notifications' && s.includes('notif')) return true;
    if (key === 'cbssim' && s.includes('cbs')) return true;
    if (key === 'admin' && (s.includes('admin') || s.includes('system'))) return true;
    return false;
  });
}

export function scopeSignature(session: UserSession | null): string {
  if (!session) return '';
  return JSON.stringify({
    username: session.username,
    role: session.role,
    branch: session.branch,
    district: session.district,
    segment: session.segment,
    segmentIds: session.segmentIds,
    allowedSegments: session.allowedSegments,
    allowedBranches: session.allowedBranches,
    allowedDistricts: session.allowedDistricts,
    bankWide: session.bankWide,
    readOnly: session.readOnly,
    scopeRestricted: session.scopeRestricted,
    isAdmin: session.isAdmin,
    permissions: session.permissions,
  });
}

/** Initial UI scope filter derived only from the authenticated backend user. */
export function defaultSegmentFor(session: UserSession | null): string {
  if (!session) return 'ALL';
  const allowed = session.allowedSegments?.length
    ? session.allowedSegments
    : (session.segmentIds?.length ? session.segmentIds : (session.segment ? [session.segment] : []));
  if (session.bankWide === true || allowed.length > 1) return 'ALL';
  return allowed[0] || 'ALL';
}

/** Centralized read-only check backed by the backend scope flag. */
export function isReadOnlyUser(session: UserSession | null | undefined): boolean {
  return session?.readOnly === true;
}

export function canMutate(
  session: UserSession | null | undefined,
  capability: 'canCreate' | 'canEdit' | 'canDelete' = 'canCreate'
): boolean {
  if (isReadOnlyUser(session)) return false;
  return session?.[capability] === true;
}

export function canApproveAction(session: UserSession | null | undefined): boolean {
  // System administrators are configuration owners, not business approvers.
  if (isReadOnlyUser(session) || session?.isAdmin === true) return false;
  return session?.canApprove === true;
}

function stringList(value: any): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return stringList(parsed);
    } catch { /* plain single value */ }
    return [value.trim()];
  }
  return [];
}
