import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowRight,
  UserCheck,
  Eye,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { WorkflowTask, ApprovalHistory, Delegation, UserSession } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';

interface MakerCheckerInboxProps {
  tasks: WorkflowTask[];
  delegations: Delegation[];
  allUsers: UserSession[];
  currentUser: UserSession;
  onApproveTask: (taskId: string, comments: string) => Promise<void>;
  onRejectTask: (taskId: string, comments: string) => Promise<void>;
  onReturnTask: (taskId: string, correctionNote: string) => Promise<void>;
  onResubmitTask: (taskId: string) => Promise<void>;
  onBulkApprove: (taskIds: string[], comments: string) => Promise<void>;
  onCreateDelegation: (delegation: Partial<Delegation>) => Promise<void>;
  onRevokeDelegation: (id: string) => Promise<void>;
}

export const MakerCheckerInbox: React.FC<MakerCheckerInboxProps> = ({
  tasks,
  delegations,
  allUsers,
  currentUser,
  onApproveTask,
  onRejectTask,
  onReturnTask,
  onResubmitTask,
  onBulkApprove,
  onCreateDelegation,
  onRevokeDelegation,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'my-submissions' | 'delegations'>('pending');
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  // Checker action state
  const [checkerRemarks, setCheckerRemarks] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Delegation form state
  const [delegateUserId, setDelegateUserId] = useState(allUsers[0]?.userId || '');
  const [delegationStart, setDelegationStart] = useState('2026-08-18');
  const [delegationEnd, setDelegationEnd] = useState('2026-08-25');
  const [delegationReason, setDelegationReason] = useState('Annual leave delegation');

  // Active delegation banner
  const activeDelegation = delegations.find(
    (d) => (d.delegatorId === currentUser.userId || d.delegateId === currentUser.userId) && d.status === 'Active'
  );

  const pendingTasks = tasks.filter((t) => t.status === 'Pending');
  const mySubmissions = tasks.filter((t) => t.makerId === currentUser.userId || t.makerId === currentUser.username);

  const pendingColumns: ColumnDef<WorkflowTask>[] = [
    {
      header: 'Select',
      cell: (r) => (
        <input
          type="checkbox"
          checked={selectedTaskIds.includes(r.id)}
          onChange={(e) => {
            if (e.target.checked) setSelectedTaskIds([...selectedTaskIds, r.id]);
            else setSelectedTaskIds(selectedTaskIds.filter((id) => id !== r.id));
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded text-brand-900 focus:ring-brand-500"
        />
      ),
      align: 'center',
    },
    { header: 'Task ID', accessorKey: 'id', sortable: true },
    { header: 'Action Type', accessorKey: 'actionType', sortable: true },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity ID', accessorKey: 'entityId' },
    { header: 'Submitted By', accessorKey: 'makerId' },
    {
      header: 'Submitted At',
      accessorKey: 'submittedAt',
      cell: (r) => r.submittedAt?.replace('T', ' ').substring(0, 16),
      sortable: true,
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (r) => <StatusChip label={r.priority || 'Medium'} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(r);
              setCheckerRemarks('');
              setShowReviewDrawer(true);
            }}
            className="btn-primary py-1 px-2.5 text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            Review Diff
          </button>
        </div>
      ),
    },
  ];

  const submissionColumns: ColumnDef<WorkflowTask>[] = [
    { header: 'Task ID', accessorKey: 'id', sortable: true },
    { header: 'Action Type', accessorKey: 'actionType', sortable: true },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity ID', accessorKey: 'entityId' },
    { header: 'Current Step', accessorKey: 'currentStep' },
    { header: 'Candidate Role', accessorKey: 'candidateRole' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => <StatusChip label={r.status} />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (r) => r.status === 'Returned' && (r.makerId?.toLowerCase() === currentUser.username?.toLowerCase() || r.makerId?.toLowerCase() === currentUser.userId?.toLowerCase()) ? (
        <button onClick={(e) => { e.stopPropagation(); onResubmitTask(r.id); }} className="btn-primary py-1 px-2.5 text-xs">
          Resubmit for Approval
        </button>
      ) : null,
    },
    {
      header: 'Submitted At',
      accessorKey: 'submittedAt',
      cell: (r) => r.submittedAt?.replace('T', ' ').substring(0, 16),
    },
  ];

  const handleApprove = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      await onApproveTask(selectedTask.id, checkerRemarks || 'Approved by Checker');
      setShowReviewDrawer(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    if (!checkerRemarks.trim()) {
      alert('Mandatory checker remarks required for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      await onRejectTask(selectedTask.id, checkerRemarks);
      setShowReviewDrawer(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedTask) return;
    if (!checkerRemarks.trim()) {
      alert('Mandatory correction note required to return to maker.');
      return;
    }
    setActionLoading(true);
    try {
      await onReturnTask(selectedTask.id, checkerRemarks);
      setShowReviewDrawer(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulk = async () => {
    if (selectedTaskIds.length === 0) return;
    if (confirm(`Approve all ${selectedTaskIds.length} selected tasks?`)) {
      setActionLoading(true);
      try {
        await onBulkApprove(selectedTaskIds, 'Bulk approved by checker');
        setSelectedTaskIds([]);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const isMakerOfTask = Boolean(
    selectedTask && (
      selectedTask.makerId?.toLowerCase() === currentUser.username?.toLowerCase() ||
      selectedTask.makerId?.toLowerCase() === currentUser.userId?.toLowerCase() ||
      (selectedTask.makerId?.toLowerCase() + '_user') === currentUser.username?.toLowerCase() ||
      (currentUser.username?.toLowerCase() + '_user') === selectedTask.makerId?.toLowerCase()
    )
  );

  return (
    <div className="p-6 space-y-6">
      {/* Active Delegation Banner */}
      {activeDelegation && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-blue-900 text-xs">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-brand-700 flex-shrink-0" />
            <div>
              <strong>Active Approval Authority Delegation:</strong>{' '}
              {activeDelegation.delegatorId === currentUser.userId
                ? `You have delegated approval powers to user ${activeDelegation.delegateId} until ${activeDelegation.endDate}.`
                : `You are acting with delegated approval authority from user ${activeDelegation.delegatorId} until ${activeDelegation.endDate}.`}
            </div>
          </div>
          {activeDelegation.delegatorId === currentUser.userId && (
            <button
              onClick={() => onRevokeDelegation(activeDelegation.id)}
              className="text-xs text-red-700 font-bold hover:underline"
            >
              Revoke Authority
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-white px-4 pt-3 rounded-t-lg justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'pending' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending My Action ({pendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('my-submissions')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'my-submissions' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            My Submissions ({mySubmissions.length})
          </button>
          <button
            onClick={() => setActiveTab('delegations')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 ${
              activeTab === 'delegations' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Approval Delegations ({delegations.length})
          </button>
        </div>

        {/* Bulk Action Controls */}
        {activeTab === 'pending' && selectedTaskIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{selectedTaskIds.length} tasks selected</span>
            <button
              onClick={() => {
                onBulkApprove(selectedTaskIds, 'Bulk authorized by checker');
                setSelectedTaskIds([]);
              }}
              disabled={currentUser.canApprove === false}
              title={currentUser.canApprove === false ? 'Bulk authorization restricted by System Administration Role Matrix (§2.1)' : 'Bulk Authorize Selected'}
              className="btn-primary py-1 px-3 text-xs bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {currentUser.canApprove === false ? 'Bulk Auth Restricted' : `Bulk Authorize (${selectedTaskIds.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab === 'pending' && (
        <DataGrid
          title="Dual-Control Authorization Inbox"
          subtitle="Segregation of Duties: Review maker submissions, verify before/after JSON diffs, and authorize transactions"
          data={pendingTasks}
          columns={pendingColumns}
          keyExtractor={(t) => t.id}
          onRowClick={(t) => {
            setSelectedTask(t);
            setCheckerRemarks('');
            setShowReviewDrawer(true);
          }}
        />
      )}

      {activeTab === 'my-submissions' && (
        <DataGrid
          title="My Maker Submissions"
          subtitle="Track lifecycle statuses of your submitted registrations, amendments, and releases"
          data={mySubmissions}
          columns={submissionColumns}
          keyExtractor={(t) => t.id}
        />
      )}

      {activeTab === 'delegations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-brand-900">Approval Authority Delegations</h3>
              <p className="text-xs text-text-secondary">Temporarily assign dual-control approval rights to another branch/department officer</p>
            </div>
            <button onClick={() => setShowDelegateModal(true)} className="btn-primary py-1.5 px-3 text-xs">
              + Delegate Approval Authority
            </button>
          </div>

          <div className="cims-card p-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 text-text-secondary font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Delegator</th>
                  <th className="p-3">Delegate Officer</th>
                  <th className="p-3">Start Date</th>
                  <th className="p-3">End Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {delegations.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3 font-semibold text-brand-900">{d.delegatorId}</td>
                    <td className="p-3">{d.delegateId}</td>
                    <td className="p-3">{d.startDate}</td>
                    <td className="p-3">{d.endDate}</td>
                    <td className="p-3"><StatusChip label={d.status} /></td>
                    <td className="p-3 text-text-secondary">{d.reason}</td>
                    <td className="p-3 text-right">
                      {d.status === 'Active' && d.delegatorId === currentUser.userId && (
                        <button
                          onClick={() => onRevokeDelegation(d.id)}
                          className="btn-secondary py-0.5 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Diff & Authorization Drawer */}
      {showReviewDrawer && selectedTask && (
        <div className="fixed inset-0 bg-brand-900/50 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Drawer Header */}
            <div className="p-5 bg-brand-900 text-white flex justify-between items-start">
              <div className="flex items-start gap-4">
                <div
                  className="approval-stamp flex-shrink-0"
                  style={{
                    color: selectedTask.status === 'Approved' ? '#5FBE8A' : selectedTask.status === 'Rejected' ? '#E38C88' : '#E0BD79',
                  }}
                >
                  {selectedTask.status === 'Approved' ? 'Authorized' : selectedTask.status === 'Rejected' ? 'Rejected' : 'Awaiting Seal'}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold">{selectedTask.actionType}</h2>
                    <StatusChip label={selectedTask.status} />
                  </div>
                  <div className="text-xs text-blue-200 mt-1 flex gap-4">
                    <span>Entity: {selectedTask.entityType} ({selectedTask.entityId})</span>
                    <span>Maker: {selectedTask.makerId}</span>
                    <span>Submitted: {selectedTask.submittedAt?.replace('T', ' ').substring(0, 16)}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowReviewDrawer(false)} className="text-white hover:text-gray-300 text-lg">✕</button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Segregation of Duties Warning (If user is the Maker) */}
              {isMakerOfTask && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wider text-amber-800">
                      Segregation of Duties Enforced (Four-Eyes Principle)
                    </div>
                    <p className="text-[11px] mt-1 leading-relaxed text-amber-900">
                      You submitted this transaction as <strong>Maker ({selectedTask.makerId})</strong>. Banking compliance regulations strictly prohibit self-authorization. An independent <strong>Checker (e.g. Branch Manager BRMGR)</strong> must authorize or reject this task.
                    </p>
                  </div>
                </div>
              )}

              {/* Maker Remarks */}
              <div className="cims-card p-4 bg-brand-50 border-brand-100 space-y-1">
                <div className="text-[11px] font-bold uppercase text-brand-700 tracking-wider">Maker Remarks / Business Intent</div>
                <div className="text-text-primary text-xs">{selectedTask.remarks || 'No remarks provided by maker.'}</div>
              </div>

              {/* Side-by-Side Before / After Diff */}
              <div className="space-y-2">
                <h4 className="font-bold text-text-primary text-xs">Transaction Data Comparison (Diff)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="cims-card p-3 space-y-2 bg-gray-50">
                    <div className="font-bold text-text-secondary border-b border-border pb-1">Current State</div>
                    <div className="text-text-secondary">Record Status: <span className="font-mono text-text-primary">Unauthorized</span></div>
                    <div className="text-text-secondary">Auth Status: <span className="font-mono text-text-primary">Unauthorized</span></div>
                    <div className="text-text-secondary">Active Lifecycle: <span className="font-mono text-text-primary">Draft / Pending</span></div>
                  </div>
                  <div className="cims-card p-3 space-y-2 bg-emerald-50 border-emerald-200">
                    <div className="font-bold text-emerald-800 border-b border-emerald-200 pb-1">Proposed Authorization State</div>
                    <div className="text-emerald-900">Record Status: <span className="font-mono font-bold text-emerald-700">O (Open/Authorized)</span></div>
                    <div className="text-emerald-900">Auth Status: <span className="font-mono font-bold text-emerald-700">A (Authorized)</span></div>
                    <div className="text-emerald-900">Active Lifecycle: <span className="font-mono font-bold text-emerald-700">Active</span></div>
                  </div>
                </div>
              </div>

              {/* Checker Decision Box */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block font-bold text-text-primary">
                  Checker Comments / Audit Notes (M for Reject/Return)
                </label>
                <textarea
                  rows={3}
                  disabled={isMakerOfTask}
                  placeholder={isMakerOfTask ? 'Self-authorization disabled for Maker.' : 'Enter approval comments, return feedback, or rejection rationale...'}
                  value={checkerRemarks}
                  onChange={(e) => setCheckerRemarks(e.target.value)}
                  className={`w-full p-2.5 border rounded text-xs ${isMakerOfTask ? 'bg-gray-100 cursor-not-allowed border-gray-300' : 'border-border'}`}
                />
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-border bg-brand-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={isMakerOfTask || actionLoading || currentUser.canApprove === false}
                className="btn-destructive py-2 px-4 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                title={isMakerOfTask ? 'Maker cannot reject their own submission.' : currentUser.canApprove === false ? 'Action restricted by Role Matrix' : 'Reject Transaction'}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={isMakerOfTask || actionLoading || currentUser.canApprove === false}
                  className="btn-secondary py-2 px-4 text-xs bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isMakerOfTask ? 'Maker cannot return their own submission.' : currentUser.canApprove === false ? 'Action restricted by Role Matrix' : 'Return to Maker for Correction'}
                >
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  Return to Maker
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isMakerOfTask || actionLoading || currentUser.canApprove === false}
                  className="btn-primary py-2 px-5 text-xs bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isMakerOfTask ? 'Maker cannot authorize their own submission (Segregation of Duties).' : currentUser.canApprove === false ? 'Approval restricted for your role in the System Administration Role Matrix (§2.1).' : 'Authorize Transaction'}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isMakerOfTask ? 'Self-Approval Prohibited' : currentUser.canApprove === false ? 'Approval Restricted' : 'Approve Transaction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {showDelegateModal && (
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Delegate Approval Authority</h3>
              <button onClick={() => setShowDelegateModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onCreateDelegation({
                  delegatorId: currentUser.userId,
                  delegateId: delegateUserId,
                  startDate: delegationStart,
                  endDate: delegationEnd,
                  reason: delegationReason,
                });
                setShowDelegateModal(false);
              }}
              className="p-5 space-y-3"
            >
              <div>
                <label className="block font-semibold text-text-primary mb-1">Delegate To (Officer) (M)</label>
                <select
                  value={delegateUserId}
                  onChange={(e) => setDelegateUserId(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                >
                  {allUsers
                    .filter((u) => u.userId !== currentUser.userId)
                    .map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name} ({u.role} — {u.branch})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Start Date (M)</label>
                  <input
                    type="date"
                    required
                    value={delegationStart}
                    onChange={(e) => setDelegationStart(e.target.value)}
                    className="w-full p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-primary mb-1">End Date (M)</label>
                  <input
                    type="date"
                    required
                    value={delegationEnd}
                    onChange={(e) => setDelegationEnd(e.target.value)}
                    className="w-full p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-primary mb-1">Delegation Reason (M)</label>
                <textarea
                  required
                  rows={2}
                  value={delegationReason}
                  onChange={(e) => setDelegationReason(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowDelegateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
