import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCw,
  Eye,
  CheckCircle,
  ArrowUpRight,
  Clock,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { CimsException, UserSession } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';

interface ExceptionManagerProps {
  exceptions: CimsException[];
  currentUser: UserSession;
  onResolveException: (id: string, correctiveAction: string, resolutionNotes: string) => Promise<void>;
  onEscalateException: (id: string, escalationRole: string) => Promise<void>;
  onScanNow: () => Promise<void>;
}

export const ExceptionManager: React.FC<ExceptionManagerProps> = ({
  exceptions,
  currentUser,
  onResolveException,
  onEscalateException,
  onScanNow,
}) => {
  const [selectedExc, setSelectedExc] = useState<CimsException | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [correctiveAction, setCorrectiveAction] = useState('Renew Policy');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [escalationRole, setEscalationRole] = useState('DISTDIR');
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      await onScanNow();
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedExc) return;
    setActionLoading(true);
    try {
      await onResolveException(selectedExc.id, correctiveAction, resolutionNotes || 'Resolved per compliance SOP.');
      setShowDetailDrawer(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedExc) return;
    setActionLoading(true);
    try {
      await onEscalateException(selectedExc.id, escalationRole);
      setShowDetailDrawer(false);
    } finally {
      setActionLoading(false);
    }
  };

  const exceptionColumns: ColumnDef<CimsException>[] = [
    {
      header: 'Severity',
      accessorKey: 'severity',
      cell: (r) => <StatusChip label={r.severity} />,
      sortable: true,
    },
    { header: 'Exception Type', accessorKey: 'exceptionType', sortable: true },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity ID / Code', accessorKey: 'entityId' },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Assigned Role', accessorKey: 'assignedToRole' },
    {
      header: 'Detected Date',
      accessorKey: 'detectedAt',
      cell: (r) => r.detectedAt?.substring(0, 10),
      sortable: true,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => <StatusChip label={r.status} />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedExc(r);
            setCorrectiveAction('Renew Policy');
            setResolutionNotes('');
            setShowDetailDrawer(true);
          }}
          className="btn-ghost py-1 px-2 text-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          Investigate
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Exceptions & Policy Breach Management"
        subtitle="Automated detection of expired policies, underinsured collateral, missing mandatory documents, and SLA breaches"
        data={exceptions}
        columns={exceptionColumns}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => {
          setSelectedExc(e);
          setCorrectiveAction('Renew Policy');
          setResolutionNotes('');
          setShowDetailDrawer(true);
        }}
        actions={
          <button onClick={handleScan} disabled={scanning} className="btn-primary py-1.5 px-3 text-xs">
            <RotateCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning Portfolio...' : 'Trigger Automated Scan Now'}
          </button>
        }
      />

      {/* Exception Investigation Drawer */}
      {showDetailDrawer && selectedExc && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex justify-end z-50">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold">{selectedExc.exceptionType}</h2>
                  <StatusChip label={selectedExc.severity} />
                  <StatusChip label={selectedExc.status} />
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>Target: {selectedExc.entityType} ({selectedExc.entityId})</span>
                  <span>Assigned: {selectedExc.assignedToRole}</span>
                </div>
              </div>
              <button onClick={() => setShowDetailDrawer(false)} className="text-white hover:text-gray-300 text-lg">✕</button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="cims-card p-4 bg-[#EFF5FB] border-[#DCE9F5] space-y-1">
                <div className="text-[11px] font-bold uppercase text-[#1F4E7A] tracking-wider">Exception Description</div>
                <div className="text-[#101828] text-xs leading-relaxed">{selectedExc.description}</div>
              </div>

              {selectedExc.status !== 'Resolved' ? (
                <>
                  <div className="space-y-2">
                    <label className="block font-bold text-[#101828]">Corrective Action Taken (M)</label>
                    <select
                      value={correctiveAction}
                      onChange={(e) => setCorrectiveAction(e.target.value)}
                      className="w-full p-2.5 border border-[#E2E8F0] rounded text-xs"
                    >
                      <option value="Renew Policy">Renew Policy with Insurer</option>
                      <option value="Increase Insured Amount">Increase Insured Coverage Amount</option>
                      <option value="Upload Mandatory Document">Upload Verified Mandatory Document</option>
                      <option value="Replace Insurer">Switch to Approved Insurer</option>
                      <option value="Obtain Customer Endorsement">Obtain Customer Endorsement</option>
                      <option value="Executive Override Approved">Executive Exception Override</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-bold text-[#101828]">Investigation & Resolution Notes (M)</label>
                    <textarea
                      rows={4}
                      placeholder="Detail corrective measures taken, document reference, or officer justification..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full p-2.5 border border-[#E2E8F0] rounded text-xs"
                    />
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
                    <label className="block font-bold text-[#101828]">Escalate Exception To Hierarchy</label>
                    <div className="flex gap-2">
                      <select
                        value={escalationRole}
                        onChange={(e) => setEscalationRole(e.target.value)}
                        className="flex-1 p-2 border border-[#E2E8F0] rounded text-xs"
                      >
                        <option value="DISTDIR">District Director (DISTDIR)</option>
                        <option value="HODEPT">Head Office Department (HODEPT)</option>
                        <option value="COMPLIANCE">Compliance Department (COMPLIANCE)</option>
                        <option value="RISK">Risk Management (RISK)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleEscalate}
                        disabled={actionLoading}
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Escalate
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="cims-card p-4 bg-emerald-50 border-emerald-200 space-y-2 text-emerald-900">
                  <div className="font-bold">Resolution Recorded:</div>
                  <div>Action: {selectedExc.correctiveAction}</div>
                  <div>Notes: {selectedExc.resolutionNotes}</div>
                  <div className="text-[10px] text-emerald-700">Resolved at: {selectedExc.resolvedAt} by {selectedExc.resolvedBy}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedExc.status !== 'Resolved' && (
              <div className="p-4 border-t border-[#E2E8F0] bg-[#EFF5FB] flex justify-between items-center">
                <button type="button" onClick={() => setShowDetailDrawer(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={actionLoading}
                  className="btn-primary py-2 px-5 text-xs bg-emerald-700 hover:bg-emerald-800"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Exception Resolved
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
