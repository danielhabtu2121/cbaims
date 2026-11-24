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
} from 'lucide-react';
import { RolePermission } from '../../types';
import { findScreenPermission } from '../../auth/session';

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
  permissionScreen: string;
  badgeCount?: number;
}

interface SidebarProps {
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  userRole: string;
  isAdmin?: boolean;
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
  isAdmin = false,
  permissions,
  pendingApprovalCount = 0,
  openExceptionCount = 0,
  collapsed,
  onToggleCollapse,
}) => {
  // Navigation comes exclusively from the backend role/screen permission matrix.
  // The Administration module additionally requires the backend-authoritative isAdmin flag.
  const navItems: NavItemDef[] = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard, section: 'Core', permissionScreen: 'Dashboard' },
    { id: 'customers', label: 'Customers', icon: Users, section: 'Portfolios', permissionScreen: 'Customers' },
    { id: 'facilities', label: 'Facilities / Loans', icon: CreditCard, section: 'Portfolios', permissionScreen: 'Facilities' },
    { id: 'collateral', label: 'Collateral', icon: Building2, section: 'Portfolios', permissionScreen: 'Collateral' },
    { id: 'insurance', label: 'Insurance Policies', icon: FileCheck, section: 'Portfolios', permissionScreen: 'Insurance' },
    {
      id: 'approvals',
      label: 'Workflow Approvals',
      icon: CheckSquare,
      section: 'Governance',
      permissionScreen: 'Approvals',
      badgeCount: pendingApprovalCount,
    },
    {
      id: 'exceptions',
      label: 'Exceptions',
      icon: AlertTriangle,
      section: 'Governance',
      permissionScreen: 'Exceptions',
      badgeCount: openExceptionCount,
    },
    { id: 'documents', label: 'Documents (DMS)', icon: FolderOpen, section: 'Governance', permissionScreen: 'Documents' },
    { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Analytics', permissionScreen: 'Reports' },
    { id: 'audit', label: 'Audit Trail', icon: History, section: 'Analytics', permissionScreen: 'Audit Trail' },
    { id: 'notifications', label: 'Notifications', icon: Bell, section: 'System', permissionScreen: 'Notifications' },
    { id: 'admin', label: 'Administration', icon: Settings, section: 'System', permissionScreen: 'Administration' },
    { id: 'cbs-sim', label: 'CBS Simulator', icon: Cpu, section: 'System', permissionScreen: 'CBS Simulator' },
  ];

  const isPageAllowed = (item: NavItemDef): boolean => {
    if (item.id === 'admin' && !isAdmin) return false;
    const permission = findScreenPermission(permissions || [], userRole, item.permissionScreen);
    return permission ? permission.canView : item.id === 'dashboard';
  };

  const visibleItems = navItems.filter(isPageAllowed);
  const sections = Array.from(new Set(visibleItems.map((i) => i.section)));

  return (
    <aside
      className={`h-full flex flex-col justify-between shrink-0 select-none bg-[#00205B] text-white border-r border-[#143666] transition-all duration-200 z-30 shadow-md ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center px-3.5 border-b border-[#143666] bg-[#07152B]/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
            <img src="/dashen-logo.png" alt="Dashen Bank Logo" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-[12px] font-extrabold tracking-wider text-white uppercase block leading-tight">
                DASHEN BANK
              </span>
              <span className="text-[10px] text-[#D48806] font-semibold tracking-tight block truncate">
                CBAIMS ENTERPRISE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Navigation Item List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-dark py-3 px-2 space-y-4">
        {sections.map((sec) => {
          const itemsInSection = visibleItems.filter((i) => i.section === sec);
          return (
            <div key={sec} className="space-y-1">
              {!collapsed && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200/90 px-2.5 py-1 select-none">
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
                      className={`w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-xs font-semibold transition-all group ${
                        isActive
                          ? 'bg-white/15 text-white font-bold border-l-3 border-[#D48806] shadow-xs'
                          : 'text-blue-100 hover:bg-white/10 hover:text-white border-l-3 border-transparent'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#D48806]' : 'text-blue-200 group-hover:text-white'
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate text-[12.5px] tracking-tight">{item.label}</span>
                        )}
                      </div>

                      {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1 shadow-xs ${
                            item.id === 'exceptions'
                              ? 'bg-red-500 text-white'
                              : 'bg-[#D48806] text-white'
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
      <div className="shrink-0 p-2.5 border-t border-[#143666] bg-[#07152B]/90 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 text-[11px] text-blue-200/70 font-medium pl-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="text-[10.5px]">Production Online</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-1.5 text-blue-200/80 hover:text-white hover:bg-[#143666] rounded-md p-1.5 transition-colors text-xs ${
            collapsed ? 'w-full justify-center' : ''
          }`}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-[11px] font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
