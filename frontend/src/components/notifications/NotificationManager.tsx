import React, { useState } from 'react';
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
} from 'lucide-react';
import { NotificationItem, UserSession } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';

interface NotificationManagerProps {
  notifications: NotificationItem[];
  currentUser: UserSession;
  onResend?: (id: string) => Promise<void>;
  onTriggerScan?: () => Promise<void>;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  notifications,
  currentUser,
  onResend,
  onTriggerScan,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'Email' | 'SMS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Sent' | 'Failed' | 'Pending'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [triggering, setTriggering] = useState(false);

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

  const notificationColumns: ColumnDef<NotificationItem>[] = [
    {
      header: 'Channel',
      accessorKey: 'channel',
      cell: (r) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
            r.channel === 'SMS' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
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
          <div className="font-semibold text-brand-900">{r.recipientName || 'Officer / Customer'}</div>
          <div className="text-[11px] text-text-secondary font-mono">{r.recipient}</div>
        </div>
      ),
    },
    {
      header: 'Subject / Template',
      accessorKey: 'subject',
      cell: (r) => (
        <div>
          <div className="font-medium text-text-primary truncate max-w-xs">{r.subject || 'Automated Alert'}</div>
          <div className="text-[10px] text-text-secondary font-mono">{r.templateCode || 'SYSTEM_NOTICE'}</div>
        </div>
      ),
    },
    {
      header: 'Entity Ref',
      accessorKey: 'entityId',
      cell: (r) => (
        <span className="text-xs font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
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
      cell: (r) => <StatusChip label={r.status || 'Sent'} size="sm" />,
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
                await onResend(r.id);
              }}
              className="btn-primary py-1 px-2 text-xs"
              title="Retry Delivery"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-text-secondary uppercase">Total Dispatched</span>
            <Bell className="w-4 h-4 text-brand-700" />
          </div>
          <p className="text-2xl font-extrabold text-brand-900 mt-2">{totalCount}</p>
          <span className="text-xs text-text-secondary mt-1 block">Live outbound messages</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-text-secondary uppercase">Email Notices</span>
            <Mail className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-900 mt-2">{emailCount}</p>
          <span className="text-xs text-indigo-700 mt-1 block">SMTP gateway deliveries</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-text-secondary uppercase">SMS Alerts</span>
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-blue-900 mt-2">{smsCount}</p>
          <span className="text-xs text-blue-700 mt-1 block">Telecom SMS aggregations</span>
        </div>

        <div className="cims-card p-4">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-text-secondary uppercase">Failed / Queued</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-800 mt-2">{failedCount}</p>
          <span className="text-xs text-amber-700 mt-1 block">Automatic retry enabled</span>
        </div>
      </div>

      {/* Control Bar: Filters & Scan Button */}
      <div className="cims-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Channel Filter */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setChannelFilter('ALL')}
              className={`px-3 py-1.5 font-medium ${
                channelFilter === 'ALL' ? 'bg-brand-900 text-white' : 'bg-white text-text-secondary hover:bg-gray-50'
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setChannelFilter('Email')}
              className={`px-3 py-1.5 font-medium ${
                channelFilter === 'Email' ? 'bg-brand-900 text-white' : 'bg-white text-text-secondary hover:bg-gray-50'
              }`}
            >
              Email ({emailCount})
            </button>
            <button
              onClick={() => setChannelFilter('SMS')}
              className={`px-3 py-1.5 font-medium ${
                channelFilter === 'SMS' ? 'bg-brand-900 text-white' : 'bg-white text-text-secondary hover:bg-gray-50'
              }`}
            >
              SMS ({smsCount})
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="p-1.5 border border-border rounded text-xs bg-white"
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
            {triggering ? 'Scanning Portfolio Expiries...' : 'Run Policy Expiry Reminders'}
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

      {/* Preview Payload Drawer */}
      {showDrawer && selectedNotif && (
        <div className="fixed inset-0 bg-brand-900/50 flex justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 bg-brand-900 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                      selectedNotif.channel === 'SMS' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
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
              <div className="cims-card p-4 space-y-2 bg-brand-50 border-brand-100">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-secondary block">Recipient Name:</span>
                    <span className="font-bold text-text-primary">{selectedNotif.recipientName || 'Banking Officer'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Target Destination:</span>
                    <span className="font-mono text-brand-900 font-bold">{selectedNotif.recipient}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Template Code:</span>
                    <span className="font-mono text-text-primary">{selectedNotif.templateCode || 'MANUAL'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Dispatched Timestamp:</span>
                    <span className="text-text-primary">{selectedNotif.sentAt?.replace('T', ' ')}</span>
                  </div>
                  {selectedNotif.entityId && (
                    <div className="col-span-2">
                      <span className="text-text-secondary block">Linked Entity:</span>
                      <span className="font-mono text-brand-800 font-bold">
                        {selectedNotif.entityType} → {selectedNotif.entityId}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-text-primary mb-2 text-xs uppercase tracking-wider">Message Payload Body</h4>
                <div className="p-4 bg-gray-50 border border-border rounded-lg text-xs leading-relaxed text-text-primary font-mono whitespace-pre-wrap">
                  {selectedNotif.messageBody}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-brand-50 flex justify-end gap-2">
              <button onClick={() => setShowDrawer(false)} className="btn-secondary py-1.5 px-4 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
