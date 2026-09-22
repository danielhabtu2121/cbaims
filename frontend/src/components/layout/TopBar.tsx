import React, { useState } from 'react';
import { Shield, Bell, CheckSquare, Search, User, Key, UserCheck, LogOut, ChevronDown, RefreshCw } from 'lucide-react';
import { UserSession } from '../../types';

interface TopBarProps {
  currentUser: UserSession;
  allUsers: UserSession[];
  onSwitchUser: (user: UserSession) => void;
  selectedSegment: string;
  onSelectSegment: (segment: string) => void;
  availableSegments: string[];
  unreadNotificationCount: number;
  pendingApprovalCount: number;
  onOpenNotifications: () => void;
  onOpenApprovals: () => void;
  onChangePassword: () => void;
  onDelegateAuthority: () => void;
  onLogout: () => void;
  onGlobalSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  selectedSegment,
  onSelectSegment,
  availableSegments,
  unreadNotificationCount,
  pendingApprovalCount,
  onOpenNotifications,
  onOpenApprovals,
  onChangePassword,
  onDelegateAuthority,
  onLogout,
  onGlobalSearch,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isBankWideRole = ['EXEC', 'SRMGMT', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK', 'MGRCOLLDOC'].includes(currentUser.role);
  const isMultiSegmentRole = isBankWideRole || ['DISTDIR', 'BRMGR', 'BRO', 'CRO'].includes(currentUser.role);
  const userSegmentList = currentUser.segmentIds && currentUser.segmentIds.length > 0
    ? currentUser.segmentIds
    : (currentUser.segment ? [currentUser.segment] : ['Corporate Banking']);
  const canSelectSegment = isMultiSegmentRole || userSegmentList.length > 1;

  const segmentOptions = isMultiSegmentRole
    ? (availableSegments && availableSegments.length > 0 ? availableSegments : ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'])
    : userSegmentList;

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: '#0E284E',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid #1B4580',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left side: Logo & Wordmark & Segment Chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8B6BFF 0%, #6D4FE0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>CBAIMS</div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#B9D3EB', textTransform: 'uppercase' }}>
              Collateral &amp; Bank Asset Insurance Management
            </div>
          </div>
        </div>

        {/* Business Segment Selector / Scope Badge */}
        {canSelectSegment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B9D3EB', fontWeight: 600 }}>Segment:</span>
            <select
              value={selectedSegment}
              onChange={(e) => onSelectSegment(e.target.value)}
              style={{
                backgroundColor: '#143666',
                color: '#FFFFFF',
                border: '1px solid #25589E',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              title="Filter entire application data by Business Segment"
            >
              {isMultiSegmentRole && (
                <option value="ALL" style={{ backgroundColor: '#0E284E', color: '#FFFFFF' }}>
                  🌐 All Segments {currentUser.role === 'BRMGR' ? '(Branch-Wide)' : currentUser.role === 'DISTDIR' ? '(District-Wide)' : '(Bank-Wide)'}
                </option>
              )}
              {segmentOptions.map((seg) => (
                <option key={seg} value={seg} style={{ backgroundColor: '#0E284E', color: '#FFFFFF' }}>
                  🏢 {seg}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            title="Authorized Segment (Locked to Your Assigned Role & Jurisdiction Scope)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '12px',
              backgroundColor: '#143666',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #1B4580',
              fontSize: '11px',
              color: '#B9D3EB',
            }}
          >
            <span>Segment:</span>
            <strong style={{ color: '#FFFFFF' }}>{currentUser.segment || selectedSegment || 'Corporate Banking'}</strong>
            <span style={{ fontSize: '10px', opacity: 0.8 }} title="Organizational scope locked">🔒</span>
          </div>
        )}
      </div>

      {/* Center: Global Search */}
      <div style={{ flex: 1, maxWidth: '400px', margin: '0 24px', position: 'relative' }}>
        <Search
          style={{
            position: 'absolute',
            left: '10px',
            top: '8px',
            width: '14px',
            height: '14px',
            color: '#B9D3EB',
          }}
        />
        <input
          type="text"
          placeholder="Global Search (CIF, Policy #, Collateral ID, Reg No)..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (onGlobalSearch) onGlobalSearch(e.target.value);
          }}
          style={{
            width: '100%',
            backgroundColor: '#143666',
            border: '1px solid #1B4580',
            borderRadius: '6px',
            padding: '6px 12px 6px 32px',
            fontSize: '12px',
            color: '#FFFFFF',
            outline: 'none',
          }}
        />
      </div>

      {/* Right side: Actions & User Persona */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Approvals Bell Icon with badge */}
        {currentUser.canApprove && (
          <button
            onClick={onOpenApprovals}
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              color: '#B9D3EB',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
            title="Approvals Inbox"
          >
            <CheckSquare style={{ width: '18px', height: '18px' }} />
            {pendingApprovalCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: '#C0362C',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '1px 4px',
                  minWidth: '14px',
                  textAlign: 'center',
                }}
              >
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}

        {/* Notifications Bell Icon with badge */}
        <button
          onClick={onOpenNotifications}
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            color: '#B9D3EB',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
          }}
          title="Notification Center"
        >
          <Bell style={{ width: '18px', height: '18px' }} />
          {unreadNotificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                backgroundColor: '#C0362C',
                color: '#FFFFFF',
                fontSize: '9px',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '1px 4px',
                minWidth: '14px',
                textAlign: 'center',
              }}
            >
              {unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Switch Persona Fast-Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            style={{
              backgroundColor: '#143666',
              color: '#FFFFFF',
              border: '1px solid #1B4580',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title="Switch Testing Role Persona"
          >
            <RefreshCw style={{ width: '12px', height: '12px', color: '#1E6FD9' }} />
            <span>Persona: {currentUser.role}</span>
            <ChevronDown style={{ width: '12px', height: '12px', opacity: 0.7 }} />
          </button>

          {showPersonaMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: '6px',
                width: '260px',
                maxHeight: '340px',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '8px',
                border: '1px solid #DCE4EE',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5B6B82', padding: '6px 8px', borderBottom: '1px solid #DCE4EE' }}>
                Select Active Role Persona (16 Pre-Seeded Roles)
              </div>
              {allUsers.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => {
                    onSwitchUser(u);
                    setShowPersonaMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: u.userId === currentUser.userId ? '#E8F0FA' : 'transparent',
                    color: u.userId === currentUser.userId ? '#08192E' : '#0F172A',
                    fontWeight: u.userId === currentUser.userId ? 700 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{u.name}</span>
                    <span style={{ fontSize: '10px', color: '#2E6FB8', fontWeight: 700 }}>{u.role}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#5B6B82' }}>{u.branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Avatar Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#2E6FB8',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="md:block">
              <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2 }}>{currentUser.name}</div>
              <div style={{ fontSize: '10px', color: '#B9D3EB' }}>{currentUser.role}</div>
            </div>
            <ChevronDown style={{ width: '12px', height: '12px', opacity: 0.7 }} />
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: '6px',
                width: '200px',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '8px',
                border: '1px solid #DCE4EE',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid #DCE4EE' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{currentUser.name}</div>
                <div style={{ fontSize: '11px', color: '#5B6B82' }}>{currentUser.role}</div>
                <div style={{ fontSize: '10px', color: '#5B6B82', marginTop: '2px' }}>{currentUser.branch}</div>
              </div>

              <div style={{ padding: '4px 0' }}>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onChangePassword();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: '#0F172A',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Key style={{ width: '14px', height: '14px', color: '#5B6B82' }} />
                  Change Password
                </button>

                {currentUser.canApprove && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onDelegateAuthority();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      fontSize: '12px',
                      color: '#0F172A',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <UserCheck style={{ width: '14px', height: '14px', color: '#5B6B82' }} />
                    Delegate Approval Authority
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: '#C0362C',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTop: '1px solid #DCE4EE',
                    marginTop: '4px',
                  }}
                >
                  <LogOut style={{ width: '14px', height: '14px', color: '#C0362C' }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
