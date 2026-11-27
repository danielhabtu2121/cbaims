import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  ExternalLink,
  RotateCw,
  Settings,
  Check,
  X,
  Activity,
  Key,
} from 'lucide-react';
import { NotificationItem, UserSession } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';

interface NotificationManagerProps {
  notifications: NotificationItem[];
  currentUser: UserSession;
  onResend?: (id: string) => Promise<void>;
  onTriggerScan?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  notifications,
  currentUser,
  onResend,
  onTriggerScan,
  onRefresh,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'Email' | 'SMS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Sent' | 'Failed' | 'Pending'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Integration Gateway State
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, string>>({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState<'email' | 'sms' | null>(null);
  const [showTestModal, setShowTestModal] = useState<'email' | 'sms' | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Test form state
  const [testRecipient, setTestRecipient] = useState('credit-ops@cims-bank.et');
  const [testSubject, setTestSubject] = useState('CBAIMS Outlook Integration Verification Test');
  const [testEmailBody, setTestEmailBody] = useState('This is an automated test dispatch verifying that CBAIMS Microsoft Office 365 SMTP outbound integration is active and operating.');
  const [testPhone, setTestPhone] = useState('+251911000111');
  const [testSmsBody, setTestSmsBody] = useState('CBAIMS SMS Gateway Alert: Verification ping successful. Integration is online.');

  // Config form state
  const [editingConfig, setEditingConfig] = useState<Record<string, string>>({});

  const loadIntegrations = async () => {
    setLoadingStatus(true);
    try {
      const [status, config] = await Promise.all([
        cimsApi.getNotificationIntegrationsStatus(),
        cimsApi.getNotificationIntegrationsConfig(),
      ]);
      setIntegrationStatus(status);
      setIntegrationConfig(config);
    } catch (e) {
      console.error('Failed to load notification integrations status', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleToggleChannel = async (channel: 'email' | 'sms', currentEnabled: boolean) => {
    const key = channel === 'email' ? 'email_notifications_enabled' : 'sms_notifications_enabled';
    const nextVal = (!currentEnabled).toString();
    try {
      await cimsApi.saveNotificationIntegrationsConfig({ [key]: nextVal }, currentUser.username || 'SYSADMIN');
      await loadIntegrations();
    } catch (e) {
      console.error('Failed to toggle channel status', e);
    }
  };

  const handleOpenConfig = (channel: 'email' | 'sms') => {
    setEditingConfig({ ...integrationConfig });
    setModalFeedback(null);
    setShowConfigModal(channel);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setModalFeedback(null);
    try {
      await cimsApi.saveNotificationIntegrationsConfig(editingConfig, currentUser.username || 'SYSADMIN');
      setModalFeedback({ type: 'success', message: 'Gateway configuration saved successfully.' });
      await loadIntegrations();
      setTimeout(() => setShowConfigModal(null), 1200);
    } catch (e: any) {
      setModalFeedback({ type: 'error', message: e.message || 'Failed to save gateway configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunEmailTest = async () => {
    setTesting(true);
    setModalFeedback(null);
    try {
      const result = await cimsApi.testOutlookIntegration(testRecipient, testSubject, testEmailBody);
      if (result.success) {
        setModalFeedback({
          type: 'success',
          message: `Email dispatched successfully! Ref: ${result.deliveryReference || 'SMTP OK'} (Timestamp: ${result.timestamp})`,
        });
        await loadIntegrations();
        if (onRefresh) await onRefresh();
      } else {
        setModalFeedback({
          type: 'error',
          message: `Delivery failed: ${result.errorMessage || 'Unknown SMTP error'}`,
        });
      }
    } catch (e: any) {
      setModalFeedback({ type: 'error', message: e.message || 'SMTP connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleRunSmsTest = async () => {
    setTesting(true);
    setModalFeedback(null);
    try {
      const result = await cimsApi.testSmsIntegration(testPhone, testSmsBody);
      if (result.success) {
        setModalFeedback({
          type: 'success',
          message: `SMS dispatched successfully! Ref: ${result.deliveryReference || 'SMS API OK'} (Timestamp: ${result.timestamp})`,
        });
        await loadIntegrations();
        if (onRefresh) await onRefresh();
      } else {
        setModalFeedback({
          type: 'error',
          message: `SMS dispatch failed: ${result.errorMessage || 'Unknown DataPower error'}`,
        });
      }
    } catch (e: any) {
      setModalFeedback({ type: 'error', message: e.message || 'SMS connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (channelFilter !== 'ALL' && n.channel !== channelFilter) return false;
    if (statusFilter !== 'ALL' && n.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.recipient?.toLowerCase().includes(q) ||
        n.recipientName?.toLowerCase().includes(q) ||
        n.subject?.toLowerCase().includes(q) ||
        n.messageBody?.toLowerCase().includes(q) ||
        n.entityId?.toLowerCase().includes(q) ||
        n.templateCode?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCount = notifications.length;
  const emailCount = notifications.filter((n) => n.channel === 'Email').length;
  const smsCount = notifications.filter((n) => n.channel === 'SMS').length;
  const failedCount = notifications.filter((n) => n.status === 'Failed').length;

  const handleScanNow = async () => {
    if (!onTriggerScan) return;
    setTriggering(true);
    try {
      await onTriggerScan();
    } finally {
      setTriggering(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    if (!onResend) return;
    setRetryingId(id);
    try {
      await onResend(id);
    } finally {
      setRetryingId(null);
    }
  };

  const notificationColumns: ColumnDef<NotificationItem>[] = [
    {
      header: 'Channel',
      accessorKey: 'channel',
      cell: (r) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${r.channel === 'SMS' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
            }`}
        >
          {r.channel === 'SMS' ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
          {r.channel}
        </span>
      ),
    },
    {
      header: 'Recipient',
      accessorKey: 'recipient',
      cell: (r) => (
        <div>
          <div className="font-semibold text-[#00205B]">{r.recipientName || 'Officer / Customer'}</div>
          <div className="text-[11px] text-[#5B6472] font-mono">{r.recipient}</div>
        </div>
      ),
    },
    {
      header: 'Subject / Template',
      accessorKey: 'subject',
      cell: (r) => (
        <div>
          <div className="font-medium text-[#101828] truncate max-w-xs">{r.subject || 'Automated Alert'}</div>
          <div className="text-[10px] text-[#5B6472] font-mono">{r.templateCode || 'SYSTEM_NOTICE'}</div>
        </div>
      ),
    },
    {
      header: 'Entity Ref',
      accessorKey: 'entityId',
      cell: (r) => (
        <span className="text-xs font-mono text-[#00205B] bg-[#EFF5FB] px-2 py-0.5 rounded border border-[#B9D3EB]">
          {r.entityType ? `${r.entityType}: ` : ''}{r.entityId || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Dispatched At',
      accessorKey: 'sentAt',
      cell: (r) => r.sentAt?.replace('T', ' ').substring(0, 16) || 'Just now',
      sortable: true,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusChip label={r.status || 'Sent'} size="sm" />
          {r.status === 'Failed' && (
            <span title={r.errorMessage || 'Delivery failed'}>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNotif(r);
              setShowDrawer(true);
            }}
            className="btn-secondary py-1 px-2 text-xs"
          >
            View Payload
          </button>
          {r.status === 'Failed' && onResend && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await handleRetryItem(r.id);
              }}
              disabled={retryingId === r.id}
              className="btn-primary py-1 px-2 text-xs flex items-center gap-1"
              title="Retry Delivery"
            >
              <RotateCw className={`w-3 h-3 ${retryingId === r.id ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const emailGateway = integrationStatus?.email;
  const smsGateway = integrationStatus?.sms;

  return (
    <div className="p-6 space-y-6">
      {/* Real Outbound Gateways Architecture Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Office 365 Email Gateway Card */}
        <div className="cims-card p-4 border border-[#B9D3EB] bg-gradient-to-br from-white to-[#F8FAFC] shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#00205B]">Office 365 SMTP Gateway</h3>
                <p className="text-[11px] text-[#5B6472]">Bank Official Mail Delivery Infrastructure</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${emailGateway?.connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : emailGateway?.enabled
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
              >
                <Activity className="w-3 h-3" />
                {emailGateway?.connected ? 'Online' : emailGateway?.enabled ? 'Standby / Auth Required' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0]">
            <div>
              <span className="text-[#5B6472] block">SMTP Host & Port:</span>
              <span className="font-mono font-semibold text-[#00205B]">
                {emailGateway?.host || 'smtp.office365.com'}:{emailGateway?.port || 587}
              </span>
            </div>
            <div>
              <span className="text-[#5B6472] block">Protocol & TLS:</span>
              <span className="font-semibold text-emerald-700">STARTTLS (Strict Certs)</span>
            </div>
            <div className="col-span-2">
              <span className="text-[#5B6472] block">Configured Sender:</span>
              <span className="font-mono text-[#00205B]">{emailGateway?.sender || 'CBAIMS@dashenbanksc.com'}</span>
            </div>
            {emailGateway?.message && (
              <div className="col-span-2 text-[10px] text-[#5B6472] truncate">
                <span className="font-medium">Status:</span> {emailGateway.message}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#00205B]">
              <input
                type="checkbox"
                checked={emailGateway?.enabled ?? true}
                onChange={() => handleToggleChannel('email', emailGateway?.enabled ?? true)}
                className="rounded border-[#CBD5E1] text-[#00205B] focus:ring-0"
              />
              Email Dispatch Active
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenConfig('email')}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                title="Configure Office 365 SMTP Settings"
              >
                <Settings className="w-3 h-3" />
                Configure
              </button>
              <button
                onClick={() => {
                  setModalFeedback(null);
                  setShowTestModal('email');
                }}
                className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Test Email
              </button>
            </div>
          </div>
        </div>

        {/* Dashen DataPower SMS Gateway Card */}
        <div className="cims-card p-4 border border-[#B9D3EB] bg-gradient-to-br from-white to-[#F8FAFC] shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#00205B]">Dashen DataPower SMS Gateway</h3>
                <p className="text-[11px] text-[#5B6472]">Enterprise OAuth 2.0 Telecom Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${smsGateway?.connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : smsGateway?.enabled
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
              >
                <Activity className="w-3 h-3" />
                {smsGateway?.connected ? 'Online' : smsGateway?.enabled ? 'Standby / Auth Required' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0]">
            <div className="col-span-2">
              <span className="text-[#5B6472] block">OAuth 2.0 Token Endpoint:</span>
              <span className="font-mono text-[10px] text-[#00205B] truncate block">
                {smsGateway?.tokenUrl || 'https://datapower-cp4iuat.dashenbanksc.com:9443/.../oauth2/token'}
              </span>
            </div>
            <div>
              <span className="text-[#5B6472] block">Auth Scheme & Scope:</span>
              <span className="font-mono text-[#00205B]">Basic Header / {smsGateway?.scope || 'DASHEN'}</span>
            </div>
            <div>
              <span className="text-[#5B6472] block">Challenge Algorithm:</span>
              <span className="font-semibold text-indigo-700">S256 Strict</span>
            </div>
            {smsGateway?.message && (
              <div className="col-span-2 text-[10px] text-[#5B6472] truncate">
                <span className="font-medium">Status:</span> {smsGateway.message}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#00205B]">
              <input
                type="checkbox"
                checked={smsGateway?.enabled ?? true}
                onChange={() => handleToggleChannel('sms', smsGateway?.enabled ?? true)}
                className="rounded border-[#CBD5E1] text-[#00205B] focus:ring-0"
              />
              SMS Dispatch Active
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenConfig('sms')}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                title="Configure Dashen DataPower SMS Settings"
              >
                <Settings className="w-3 h-3" />
                Configure
              </button>
              <button
                onClick={() => {
                  setModalFeedback(null);
                  setShowTestModal('sms');
                }}
                className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Test SMS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#5B6472] uppercase">Total Dispatched</span>
            <Bell className="w-4 h-4 text-[#00205B]" />
          </div>
          <p className="text-2xl font-extrabold text-[#00205B] mt-2">{totalCount}</p>
          <span className="text-xs text-[#5B6472] mt-1 block">Live outbound messages</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#5B6472] uppercase">Email Notices</span>
            <Mail className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-900 mt-2">{emailCount}</p>
          <span className="text-xs text-indigo-700 mt-1 block">Office 365 SMTP deliveries</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#5B6472] uppercase">SMS Alerts</span>
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-blue-900 mt-2">{smsCount}</p>
          <span className="text-xs text-blue-700 mt-1 block">DataPower SMS dispatches</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#5B6472] uppercase">Failed / Queued</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-800 mt-2">{failedCount}</p>
          <span className="text-xs text-amber-700 mt-1 block">Automatic retry enabled</span>
        </div>
      </div>

      {/* Control Bar: Filters & Scan Button */}
      <div className="cims-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
            <input
              type="text"
              placeholder="Search recipient, policy, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded text-xs w-64 bg-white"
            />
          </div>

          {/* Channel Filter */}
          <div className="flex rounded-md border border-[#E2E8F0] overflow-hidden text-xs">
            <button
              onClick={() => setChannelFilter('ALL')}
              className={`px-3 py-1.5 font-medium ${channelFilter === 'ALL' ? 'bg-[#00205B] text-white' : 'bg-white text-[#5B6472] hover:bg-gray-50'
                }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setChannelFilter('Email')}
              className={`px-3 py-1.5 font-medium ${channelFilter === 'Email' ? 'bg-[#00205B] text-white' : 'bg-white text-[#5B6472] hover:bg-gray-50'
                }`}
            >
              Email ({emailCount})
            </button>
            <button
              onClick={() => setChannelFilter('SMS')}
              className={`px-3 py-1.5 font-medium ${channelFilter === 'SMS' ? 'bg-[#00205B] text-white' : 'bg-white text-[#5B6472] hover:bg-gray-50'
                }`}
            >
              SMS ({smsCount})
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
          >
            <option value="ALL">All Delivery Statuses</option>
            <option value="Sent">Sent / Delivered</option>
            <option value="Failed">Failed Delivery</option>
            <option value="Pending">Pending Dispatch</option>
          </select>
        </div>

        {/* Action button */}
        {onTriggerScan && (
          <button
            onClick={handleScanNow}
            disabled={triggering}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Scanning Portfolio Expiries...' : 'Run Reminder Engine Now'}
          </button>
        )}
      </div>

      {/* Main Table */}
      <DataGrid
        title="Outbound Notifications & Alerts Log"
        subtitle="Full real-time audit trail of dual-control authorizations, policy renewals, and exception notifications"
        data={filteredNotifications}
        columns={notificationColumns}
        keyExtractor={(n) => n.id}
        onRowClick={(n) => {
          setSelectedNotif(n);
          setShowDrawer(true);
        }}
      />

      {/* Drawer: Detailed Payload & Delivery Diagnostics */}
      {showDrawer && selectedNotif && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${selectedNotif.channel === 'SMS' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                      }`}
                  >
                    {selectedNotif.channel === 'SMS' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {selectedNotif.channel} Outbound
                  </span>
                  <StatusChip label={selectedNotif.status} size="sm" />
                </div>
                <h2 className="text-sm font-bold mt-2">{selectedNotif.subject || 'System Notification'}</h2>
              </div>
              <button onClick={() => setShowDrawer(false)} className="text-white hover:text-gray-300 text-lg">✕</button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Failure Diagnostic Alert */}
              {selectedNotif.status === 'Failed' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Outbound Delivery Failure Diagnostic</span>
                  </div>
                  <p className="text-xs text-rose-700 font-mono break-words">
                    {selectedNotif.errorMessage || 'No specific error code recorded by gateway.'}
                  </p>
                  {selectedNotif.retryCount !== undefined && (
                    <div className="text-[11px] text-rose-600 font-medium">
                      Retry attempts recorded: {selectedNotif.retryCount}
                    </div>
                  )}
                  {onResend && (
                    <button
                      onClick={async () => {
                        await handleRetryItem(selectedNotif.id);
                        setShowDrawer(false);
                      }}
                      disabled={retryingId === selectedNotif.id}
                      className="mt-2 btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${retryingId === selectedNotif.id ? 'animate-spin' : ''}`} />
                      {retryingId === selectedNotif.id ? 'Retrying dispatch...' : 'Retry Delivery Now'}
                    </button>
                  )}
                </div>
              )}

              <div className="cims-card p-4 space-y-2 bg-[#EFF5FB] border-[#DCE9F5]">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#5B6472] block">Recipient Name:</span>
                    <span className="font-bold text-[#101828]">{selectedNotif.recipientName || 'Banking Officer'}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Target Destination:</span>
                    <span className="font-mono text-[#00205B] font-bold">{selectedNotif.recipient}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Template Code:</span>
                    <span className="font-mono text-[#101828]">{selectedNotif.templateCode || 'MANUAL'}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block">Dispatched Timestamp:</span>
                    <span className="text-[#101828]">{selectedNotif.sentAt?.replace('T', ' ')}</span>
                  </div>
                  {selectedNotif.entityId && (
                    <div className="col-span-2">
                      <span className="text-[#5B6472] block">Linked Entity:</span>
                      <span className="font-mono text-[#173F63] font-bold">
                        {selectedNotif.entityType} → {selectedNotif.entityId}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#101828] mb-2 text-xs uppercase tracking-wider">Rendered Outbound Body</h4>
                <div className="p-4 bg-gray-50 border border-[#E2E8F0] rounded-lg text-xs leading-relaxed text-[#101828] font-mono whitespace-pre-wrap">
                  {selectedNotif.messageBody}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#EFF5FB] flex justify-end gap-2">
              <button onClick={() => setShowDrawer(false)} className="btn-secondary py-1.5 px-4 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gateway Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-[#00205B]">
                  {showConfigModal === 'email' ? 'Configure Office 365 SMTP Provider' : 'Configure Dashen DataPower SMS Provider'}
                </h3>
                <p className="text-xs text-[#5B6472]">
                  Settings are saved and take effect immediately.
                </p>
              </div>
              <button onClick={() => setShowConfigModal(null)} className="text-[#5B6472] hover:text-[#00205B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${modalFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
              >
                {modalFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            {showConfigModal === 'email' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">SMTP Host</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      value={editingConfig['smtp_host'] || 'smtp.office365.com'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_host: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Port</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      type="number"
                      value={editingConfig['smtp_port'] || '587'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_port: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">SMTP Sender Address</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      value={editingConfig['smtp_sender'] || 'CBAIMS@dashenbanksc.com'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_sender: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Timeout (ms)</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      type="number"
                      value={editingConfig['smtp_timeout_ms'] || '10000'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_timeout_ms: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">SMTP Username / Account</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      placeholder="CBAIMS@dashenbanksc.com"
                      value={editingConfig['smtp_username'] || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">
                      SMTP Password (Masked)
                    </label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      type="password"
                      placeholder="••••••••"
                      value={editingConfig['smtp_password'] || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, smtp_password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg text-[11px] text-[#00205B] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Security & Credential Fallback Policy
                  </div>
                  <p className="text-[#5B6472]">
                    Credentials can also be supplied via server environment variables <code className="text-[#00205B] font-bold">CBAIMS_SMTP_USERNAME</code> and <code className="text-[#00205B] font-bold">CBAIMS_SMTP_PASSWORD</code>. TLS certificate verification is always strictly enforced.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">OAuth Token Endpoint URL</label>
                  <input
                    className="input-field w-full font-mono text-xs"
                    value={editingConfig['sms_token_url'] || 'https://datapower-cp4iuat.dashenbanksc.com:9443/dashen-bank/sandbox/oauth19/oauth2/token'}
                    onChange={(e) => setEditingConfig({ ...editingConfig, sms_token_url: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">SMS Dispatch Endpoint URL</label>
                  <input
                    className="input-field w-full font-mono text-xs"
                    value={editingConfig['sms_url'] || 'https://datapower-cp4iuat.dashenbanksc.com:9443/dashen-bank/sandbox/SMS/send'}
                    onChange={(e) => setEditingConfig({ ...editingConfig, sms_url: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">OAuth Scope</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      value={editingConfig['sms_scope'] || 'DASHEN'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, sms_scope: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Timeout (ms)</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      type="number"
                      value={editingConfig['sms_timeout_ms'] || '10000'}
                      onChange={(e) => setEditingConfig({ ...editingConfig, sms_timeout_ms: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Client ID</label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      placeholder="DataPower Client ID"
                      value={editingConfig['sms_client_id'] || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, sms_client_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">
                      Client Secret (Masked)
                    </label>
                    <input
                      className="input-field w-full font-mono text-xs"
                      type="password"
                      placeholder="••••••••"
                      value={editingConfig['sms_client_secret'] || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, sms_client_secret: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg text-[11px] text-[#00205B] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Security & Credential Fallback Policy
                  </div>
                  <p className="text-[#5B6472]">
                    Credentials can also be supplied via server environment variables <code className="text-[#00205B] font-bold">CBAIMS_SMS_CLIENT_ID</code> and <code className="text-[#00205B] font-bold">CBAIMS_SMS_CLIENT_SECRET</code>. Tokens are cached safely in server memory until 60 seconds before expiry.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowConfigModal(null)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connectivity Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-[#00205B]">
                  {showTestModal === 'email' ? 'Test Office 365 Email Connectivity' : 'Test DataPower SMS Connectivity'}
                </h3>
                <p className="text-xs text-[#5B6472]">
                  Executes actual handshake and live dispatch against configured endpoints.
                </p>
              </div>
              <button onClick={() => setShowTestModal(null)} className="text-[#5B6472] hover:text-[#00205B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${modalFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
              >
                {modalFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <span className="break-words">{modalFeedback.message}</span>
              </div>
            )}

            {showTestModal === 'email' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Test Recipient Email *</label>
                  <input
                    className="input-field w-full font-mono text-xs"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Subject</label>
                  <input
                    className="input-field w-full text-xs"
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Body</label>
                  <textarea
                    className="input-field w-full text-xs font-mono"
                    rows={3}
                    value={testEmailBody}
                    onChange={(e) => setTestEmailBody(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">Test Recipient Phone (Ethiopia) *</label>
                  <input
                    className="input-field w-full font-mono text-xs"
                    placeholder="+251911000111 or 0911000111"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6472] mb-1">SMS Message</label>
                  <textarea
                    className="input-field w-full text-xs font-mono"
                    rows={3}
                    value={testSmsBody}
                    onChange={(e) => setTestSmsBody(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setShowTestModal(null)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={showTestModal === 'email' ? handleRunEmailTest : handleRunSmsTest}
                disabled={testing}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {testing ? 'Testing Handshake...' : 'Send Test Notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
