import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { NavPageId } from './Sidebar';

interface BreadcrumbsProps {
  activePage: NavPageId;
  detailItemName?: string;
  onNavigateHome: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ activePage, detailItemName, onNavigateHome }) => {
  const pageTitles: Record<NavPageId, string> = {
    dashboard: 'Dashboard',
    customers: 'Customer Master',
    facilities: 'Credit Facilities & Loans',
    collateral: 'Collateral Management',
    insurance: 'Insurance Policies',
    approvals: 'Workflow Approvals',
    exceptions: 'Exception Management',
    documents: 'Document Repository (DMS)',
    reports: 'Reports & Analytics',
    notifications: 'Notification Management',
    admin: 'System Administration',
    audit: 'Immutable Audit Trail',
    'cbs-sim': 'Core Banking System (CBS) Simulator',
  };

  return (
    <div
      style={{
        backgroundColor: '#F4F8FD',
        padding: '10px 24px',
        borderBottom: '1px solid #DCE4EE',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#5B6B82',
      }}
    >
      <button
        onClick={onNavigateHome}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: 'none',
          color: '#2C6295',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Home style={{ width: '13px', height: '13px' }} />
        <span>Home</span>
      </button>
      <ChevronRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
      <span style={{ fontWeight: detailItemName ? 500 : 700, color: detailItemName ? '#5B6B82' : '#0F172A' }}>
        {pageTitles[activePage] || activePage}
      </span>
      {detailItemName && (
        <>
          <ChevronRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
          <span style={{ fontWeight: 700, color: '#0F172A' }}>{detailItemName}</span>
        </>
      )}
    </div>
  );
};
