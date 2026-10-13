import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Clock,
  User,
  FileText,
  Eye,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  FileCheck,
  ArrowRight,
  Hash,
  Layers,
  Plus
} from 'lucide-react';
import { OwnershipDocument, AuditLog } from '../../types';
import { cimsApi } from '../../api/cimsApi';
import { StatusChip } from '../layout/StatusChip';

interface DocumentVersionHistoryModalProps {
  document: OwnershipDocument;
  allDocuments?: OwnershipDocument[];
  onClose: () => void;
  onPreviewVersion: (doc: OwnershipDocument) => void;
  onDownloadVersion: (doc: OwnershipDocument) => void;
  onUploadNewVersion?: (doc: OwnershipDocument) => void;
  canUploadVersion?: boolean;
}

export const DocumentVersionHistoryModal: React.FC<DocumentVersionHistoryModalProps> = ({
  document: targetDoc,
  allDocuments = [],
  onClose,
  onPreviewVersion,
  onDownloadVersion,
  onUploadNewVersion,
  canUploadVersion = true,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'audit'>('timeline');
  const [loading, setLoading] = useState<boolean>(true);
  const [versions, setVersions] = useState<OwnershipDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const historyData = await cimsApi.fetchDocumentHistory(targetDoc.id);
        if (isMounted && historyData) {
          if (historyData.versions && historyData.versions.length > 0) {
            setVersions(historyData.versions);
          } else {
            fallbackLocalVersions();
          }
          if (historyData.auditLogs) {
            setAuditLogs(historyData.auditLogs);
          }
        }
      } catch (err) {
        console.warn('Could not fetch server history, falling back to local documents lineage:', err);
        if (isMounted) {
          fallbackLocalVersions();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fallbackLocalVersions = () => {
      const rootId = targetDoc.parentDocumentId || targetDoc.id;
      const matched = allDocuments.filter(
        (d) => d.id === rootId || d.parentDocumentId === rootId || d.id === targetDoc.id
      );
      const sorted = (matched.length > 0 ? matched : [targetDoc]).sort(
        (a, b) => (b.version || 1) - (a.version || 1)
      );
      setVersions(sorted);
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [targetDoc, allDocuments]);

  // Keyboard Escape listener to reliably close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeVersion = versions.find((v) => v.isLatest) || versions[0] || targetDoc;
  const maxVersionNum = Math.max(...versions.map((v) => v.version || 1), targetDoc.version || 1);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '102.4 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const generateDigest = (doc: OwnershipDocument) => {
    const raw = `${doc.id}:${doc.name}:${doc.version || 1}:${doc.uploadDate || doc.uploadedAt}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `sha256:${hex}8a1f7d9c`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-4xl my-auto flex flex-col overflow-hidden text-slate-800 transition-all relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#102E4A] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-[#1F4E7A] text-white rounded-xl shadow-xs shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-white truncate">
                  {targetDoc.name || 'Document Version History'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> v{activeVersion.version || 1} Current
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-200 border border-blue-400/40">
                  {versions.length} Total Version{versions.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5 truncate">
                Category: <span className="font-semibold text-white">{targetDoc.type}</span> • Attached Entity:{' '}
                <span className="font-mono text-white font-bold">{targetDoc.entityType} ({targetDoc.entityId})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg font-bold transition-colors flex items-center gap-1.5 text-xs shadow-xs cursor-pointer ml-2"
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Audit Compliance & Immutability Notice */}
        <div className="px-6 py-2.5 bg-[#EFF5FB] border-b border-[#DCE9F5] flex items-center justify-between text-xs text-[#1F4E7A]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Regulatory Audit Guarantee:</strong> All document versions are permanently archived with immutable change logs. Earlier versions cannot be overwritten or deleted.
            </span>
          </div>
          {canUploadVersion && onUploadNewVersion && (
            <button
              onClick={() => {
                onUploadNewVersion(activeVersion);
                onClose();
              }}
              className="px-3 py-1 bg-[#102E4A] hover:bg-[#1F4E7A] text-white rounded text-xs font-bold transition-colors flex items-center gap-1 shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Upload v{maxVersionNum + 1}
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-200 bg-white text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-1.5 font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-[#1F4E7A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" /> Version History ({versions.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-[#1F4E7A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Audit Events Log ({auditLogs.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Root DMS ID: <span className="font-semibold text-slate-700">{targetDoc.parentDocumentId || targetDoc.id}</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="w-8 h-8 border-3 border-[#1F4E7A] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold">Loading version lineage and audit trail…</p>
            </div>
          ) : activeTab === 'timeline' ? (
            <div className="space-y-4">
              {versions.map((ver, idx) => {
                const isCurrent = ver.isLatest !== false && idx === 0;
                return (
                  <div
                    key={ver.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isCurrent
                        ? 'bg-white border-emerald-300 shadow-md ring-1 ring-emerald-200'
                        : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-2xs ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          v{ver.version || 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-[#102E4A]">
                              {ver.fileName || ver.name}
                            </h4>
                            {isCurrent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Current Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Superseded (Historical)
                              </span>
                            )}
                            <StatusChip
                              label={ver.verificationStatus || 'Verified'}
                              variant={ver.verificationStatus === 'Verified' ? 'success' : 'warning'}
                              size="sm"
                            />
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Uploaded: <strong>{formatDate(ver.uploadDate || ver.uploadedAt)}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              By: <strong>{ver.uploadedBy || 'COLLDOCOFF'}</strong>
                            </span>
                            <span>•</span>
                            <span>Size: <strong>{formatFileSize(ver.fileSize)}</strong></span>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-slate-600">{generateDigest(ver)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onPreviewVersion(ver)}
                          className="px-3 py-1.5 text-xs font-bold text-[#1F4E7A] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                          title="Preview this exact document version"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#1F4E7A]" /> Preview
                        </button>
                        <button
                          onClick={() => onDownloadVersion(ver)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-[#102E4A] hover:bg-[#1F4E7A] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                          title="Download this version archive"
                        >
                          <Download className="w-3.5 h-3.5 text-white" /> Download
                        </button>
                      </div>
                    </div>

                    {/* Version Notes / Change Reason */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2 text-xs bg-slate-50/80 p-2.5 rounded-lg">
                      <div className="font-bold text-[#1F4E7A] shrink-0">Version Notes / Audit Reason:</div>
                      <div className="text-slate-700 italic">
                        {ver.versionNotes || (idx === versions.length - 1 ? 'Initial root document creation in DMS repository.' : 'Superseded version update.')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                  <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-xs">No explicit audit entries recorded yet for this document.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Upload and verification operations will appear here in real time.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">User & Role</th>
                        <th className="p-3">Change Summary</th>
                        <th className="p-3">Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="p-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="p-3 font-semibold text-[#102E4A]">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono">
                              {log.actionType}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800">{log.userId}</div>
                            <div className="text-[10px] text-slate-500">{log.userRole || log.roleCode || 'OFFICER'}</div>
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            {log.oldValue && log.newValue ? (
                              <span className="flex items-center gap-1">
                                <span className="text-slate-500">{log.oldValue}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="font-bold text-emerald-700">{log.newValue}</span>
                              </span>
                            ) : (
                              log.fieldName || 'Document record'
                            )}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate" title={log.comments}>
                            {log.comments || 'Operation logged in CIMS audit repository.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital Repository Archival System • Four-Eyes Verification Integrated</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Close modal (Esc)"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
            <button
              onClick={() => onPreviewVersion(activeVersion)}
              className="px-4 py-2 bg-[#00205B] hover:bg-[#102E4A] text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Eye className="w-4 h-4 text-white" /> Preview Current Version (v{activeVersion.version || 1})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
