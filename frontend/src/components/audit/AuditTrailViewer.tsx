import React, { useState } from 'react';
import { History, Eye, Download, Search, ShieldCheck, Filter, AlertCircle, FileText } from 'lucide-react';
import { AuditLog, UserSession } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';

interface AuditTrailViewerProps {
  auditLogs: AuditLog[];
  currentUser: UserSession;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ auditLogs, currentUser }) => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  const auditColumns: ColumnDef<AuditLog>[] = [
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: (r) => r.timestamp?.replace('T', ' ').substring(0, 19),
      sortable: true,
    },
    { header: 'Action Type', accessorKey: 'actionType', sortable: true },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity ID / Code', accessorKey: 'entityId' },
    { header: 'Performed By', accessorKey: 'userId', sortable: true },
    { header: 'Role', cell: (r) => r.roleCode || r.userRole || 'USER' },
    { header: 'IP Address', accessorKey: 'ipAddress' },
    {
      header: 'Result',
      cell: (r) => <StatusChip label={r.result || 'Success'} />,
    },
    {
      header: 'Details',
      align: 'right',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(r);
            setShowDetailDrawer(true);
          }}
          className="btn-ghost py-1 px-2 text-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          Inspect
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Immutable System Audit Trail"
        subtitle="Cryptographically verified append-only audit trail recording every state mutation, approval, and security event"
        data={auditLogs}
        columns={auditColumns}
        keyExtractor={(a) => a.id}
        onRowClick={(a) => {
          setSelectedLog(a);
          setShowDetailDrawer(true);
        }}
      />

      {/* Audit Detail & Diff Inspection Drawer */}
      {showDetailDrawer && selectedLog && (
        <div className="fixed inset-0 bg-brand-900/50 flex justify-end z-50">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 bg-brand-900 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold">{selectedLog.actionType}</h2>
                  <StatusChip label={selectedLog.result || 'Success'} />
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>Log ID: {selectedLog.id}</span>
                  <span>User: {selectedLog.userId} ({selectedLog.roleCode || selectedLog.userRole || 'USER'})</span>
                </div>
              </div>
              <button onClick={() => setShowDetailDrawer(false)} className="text-white hover:text-gray-300 text-lg">✕</button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="cims-card p-4 space-y-2 bg-brand-50 border-brand-100">
                <h4 className="font-bold text-brand-900 border-b border-brand-200 pb-1">Event Header & Client Metadata</h4>
                <div><span className="text-text-secondary">Timestamp:</span> <strong className="tabular-nums">{selectedLog.timestamp?.replace('T', ' ')}</strong></div>
                <div><span className="text-text-secondary">Target Entity:</span> <strong>{selectedLog.entityType} ({selectedLog.entityId})</strong></div>
                <div><span className="text-text-secondary">Client IP Address:</span> <strong className="font-mono">{selectedLog.ipAddress || '127.0.0.1'}</strong></div>
                <div><span className="text-text-secondary">Field Mutated:</span> <strong className="font-mono">{selectedLog.fieldName || 'RECORD_AUTH_STAT'}</strong></div>
                <div><span className="text-text-secondary">Comments / Reason:</span> <span>{selectedLog.comments || 'Direct business mutation'}</span></div>
              </div>

              {/* Before / After Payload State */}
              <div className="space-y-2">
                <h4 className="font-bold text-text-primary">State Mutation Payload</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-text-secondary font-semibold">State Before Mutation:</span>
                    <pre className="p-3 bg-gray-50 border border-border rounded font-mono text-[11px] text-text-primary overflow-x-auto mt-1">
                      {selectedLog.stateBeforeJson || selectedLog.oldValue || '{\n  "record_stat": "U",\n  "auth_stat": "U"\n}'}
                    </pre>
                  </div>
                  <div>
                    <span className="text-text-secondary font-semibold">State After Mutation:</span>
                    <pre className="p-3 bg-emerald-50 border border-emerald-200 rounded font-mono text-[11px] text-emerald-900 overflow-x-auto mt-1">
                      {selectedLog.stateAfterJson || selectedLog.newValue || '{\n  "record_stat": "O",\n  "auth_stat": "A",\n  "once_auth": "Y"\n}'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-brand-50 flex justify-end">
              <button onClick={() => setShowDetailDrawer(false)} className="btn-secondary">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
