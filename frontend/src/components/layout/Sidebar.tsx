import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Building2,
  FileCheck,
  CheckSquare,
  AlertTriangle,
  FolderOpen,
  BarChart3,
  Bell,
  Settings,
  History,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { RoleCode, RolePermission } from '../../types';

export type NavPageId =
  | 'dashboard'
  | 'customers'
  | 'facilities'
  | 'collateral'
  | 'insurance'
  | 'approvals'
  | 'exceptions'
  | 'documents'
  | 'reports'
  | 'notifications'
  | 'admin'
  | 'audit'
  | 'cbs-sim';

interface NavItemDef {
  id: NavPageId;
  label: string;
  icon: React.ElementType;
  section: string;
  allowedRoles: RoleCode[];
  badgeCount?: number;
}

interface SidebarProps {
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  userRole: RoleCode;
  permissions?: RolePermission[];
  pendingApprovalCount?: number;
  openExceptionCount?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  userRole,
  permissions,
  pendingApprovalCount = 0,
  openExceptionCount = 0,
  collapsed,
  onToggleCollapse,
}) => {
  const allRoles: RoleCode[] = [
    'EXEC',
    'SYSADMIN',
    'SRMGMT',
    'HODEPT',
    'DISTDIR',
    'BRMGR',
    'SRM',
    'BRM',
    'CRO',
    'BRO',
    'MGRCOLLDOC',
    'COLLDOCOFF',
    'COMPLIANCE',
    'RISK',
    'AUDITOR',
    'RDONLY',
  ];

  const navItems: NavItemDef[] = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard, section: 'Core', allowedRoles: allRoles },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      section: 'Portfolios',
      allowedRoles: ['EXEC', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR', 'SRM', 'BRM', 'CRO', 'BRO', 'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'],
    },
    {
      id: 'facilities',
      label: 'Facilities / Loans',
      icon: CreditCard,
      section: 'Portfolios',
      allowedRoles: ['EXEC', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR', 'SRM', 'BRM', 'CRO', 'BRO', 'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'],
    },
    {
      id: 'collateral',
      label: 'Collateral',
      icon: Building2,
      section: 'Portfolios',
      allowedRoles: ['EXEC', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR', 'SRM', 'BRM', 'CRO', 'BRO', 'MGRCOLLDOC', 'COLLDOCOFF', 'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'],
    },
    {
      id: 'insurance',
      label: 'Insurance Policies',
      icon: FileCheck,
      section: 'Portfolios',
      allowedRoles: ['EXEC', 'SRMGMT', 'HODEPT', 'DISTDIR', 'BRMGR', 'SRM', 'BRM', 'CRO', 'BRO', 'COMPLIANCE', 'RISK', 'AUDITOR', 'RDONLY'],
    },
    {
      id: 'approvals',
      label: 'Workflow Approvals',
      icon: CheckSquare,
      section: 'Governance',
      allowedRoles: allRoles,
      badgeCount: pendingApprovalCount,
    },
    {
      id: 'exceptions',
      label: 'Exceptions',
      icon: AlertTriangle,
      section: 'Governance',
      allowedRoles: allRoles,
      badgeCount: openExceptionCount,
    },
    {
      id: 'documents',
      label: 'Documents (DMS)',
      icon: FolderOpen,
      section: 'Governance',
      allowedRoles: allRoles,
    },
    { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Analytics', allowedRoles: allRoles },
    { id: 'audit', label: 'Audit Trail', icon: History, section: 'Analytics', allowedRoles: allRoles },
    { id: 'notifications', label: 'Notifications', icon: Bell, section: 'System', allowedRoles: allRoles },
    { id: 'admin', label: 'Administration', icon: Settings, section: 'System', allowedRoles: ['SYSADMIN'] },
    { id: 'cbs-sim', label: 'CBS Simulator', icon: Cpu, section: 'System', allowedRoles: ['SYSADMIN', 'AUDITOR'] },
  ];

  const isPageAllowed = (item: NavItemDef): boolean => {
    if (userRole === 'SYSADMIN') return true;
    if (item.id === 'admin') return false;

    if (permissions && permissions.length > 0) {
      const match = permissions.find((p) => {
        if (p.roleCode !== userRole) return false;
        const s = p.screenName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const navId = item.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        const label = item.label.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (s === navId || navId.includes(s) || s.includes(navId)) return true;
        if (s === label || label.includes(s) || s.includes(label)) return true;
        if (item.id === 'facilities' && s.includes('facilit')) return true;
        if (item.id === 'approvals' && (s.includes('approv') || s.includes('workflow'))) return true;
        if (item.id === 'insurance' && (s.includes('insuran') || s.includes('polic'))) return true;
        if (item.id === 'documents' && (s.includes('docum') || s.includes('dms'))) return true;
        if (item.id === 'audit' && s.includes('audit')) return true;
        if (item.id === 'cbs-sim' && s.includes('cbs')) return true;
        if (item.id === 'notifications' && s.includes('notif')) return true;
        return false;
      });

      if (match !== undefined) {
        return match.canView;
      }
    }

    return item.allowedRoles.includes(userRole);
  };

  const visibleItems = navItems.filter(isPageAllowed);
  const sections = Array.from(new Set(visibleItems.map((i) => i.section)));

  return (
    <aside
      className={`h-full flex flex-col justify-between shrink-0 select-none bg-[#0E284E] text-white border-r border-[#1B4580] transition-all duration-200 z-30 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Scrollable Navigation Item List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-dark py-3 px-2 space-y-4">
        {sections.map((sec) => {
          const itemsInSection = visibleItems.filter((i) => i.section === sec);
          return (
            <div key={sec} className="space-y-1">
              {!collapsed && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8FA5C2] px-2.5 py-1">
                  {sec}
                </div>
              )}
              <div className="space-y-0.5">
                {itemsInSection.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between py-2 px-2.5 rounded-md text-xs font-semibold transition-all group ${
                        isActive
                          ? 'bg-[#1B4580] text-white border-l-4 border-[#B8863B] shadow-xs'
                          : 'text-[#C5D5E8] hover:bg-[#143666] hover:text-white border-l-4 border-transparent'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#B8863B]' : 'text-[#8FA5C2] group-hover:text-white'
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate text-[12.5px] tracking-tight">{item.label}</span>
                        )}
                      </div>

                      {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
                            item.id === 'exceptions'
                              ? 'bg-red-600 text-white'
                              : 'bg-[#B8863B] text-[#0E284E]'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned Collapse Toggle Footer */}
      <div className="shrink-0 p-2.5 border-t border-[#1B4580] bg-[#0A1C36] flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#8FA5C2] font-medium pl-1">
            <Shield className="w-3 h-3 text-[#B8863B]" />
            <span>CDIMS Enterprise</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-1.5 text-[#C5D5E8] hover:text-white hover:bg-[#1B4580] rounded p-1.5 transition-colors text-xs ${
            collapsed ? 'w-full justify-center' : ''
          }`}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-[11px]">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
