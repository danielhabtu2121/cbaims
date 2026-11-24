import { formatEtbNumber } from '../../../utils/format.ts';
import React, { useState, useEffect } from 'react';
import {
  Layers,
  AlertTriangle,
  Building,
  Link as LinkIcon,
  Copy,
  History,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Eye,
  Edit,
  ShieldCheck,
  FileCheck,
  HelpCircle,
} from 'lucide-react';
import {
  Collateral,
  CbsUnresolvedLinkage,
  CbsCollateralDuplicateReview,
  CbsImportBatch,
  CbsImportPreviewDto,
  LoanAccount,
  UserSession,
} from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface DataQualityWorkbenchProps {
  currentUser: UserSession;
  facilities: LoanAccount[];
  onOpenDetail: (col: Collateral) => void;
  onOpenEnrichment: (col: Collateral) => void;
  onRefreshData?: () => void;
}

export const DataQualityWorkbench: React.FC<DataQualityWorkbenchProps> = ({
  currentUser,
  facilities,
  onOpenDetail,
  onOpenEnrichment,
  onRefreshData,
}) => {
  const [activeQueue, setActiveQueue] = useState<'incomplete' | 'org' | 'taxonomy' | 'unresolvedLinks' | 'duplicates' | 'importHistory'>('incomplete');

  // Work-queue data states
  const [incompleteList, setIncompleteList] = useState<Collateral[]>([]);
  const [orgQueue, setOrgQueue] = useState<Collateral[]>([]);
  const [taxonomyQueue, setTaxonomyQueue] = useState<Collateral[]>([]);
  const [unresolvedLinks, setUnresolvedLinks] = useState<CbsUnresolvedLinkage[]>([]);
  const [duplicateQueue, setDuplicateQueue] = useState<CbsCollateralDuplicateReview[]>([]);
  const [importBatches, setImportBatches] = useState<CbsImportBatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Resolution modal states
  const [resolvingLink, setResolvingLink] = useState<CbsUnresolvedLinkage | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [resolvingDuplicate, setResolvingDuplicate] = useState<CbsCollateralDuplicateReview | null>(null);
  const [duplicateDecision, setDuplicateDecision] = useState<'CONFIRMED_SAME' | 'CONFIRMED_DIFFERENT'>('CONFIRMED_SAME');
  const [duplicateNotes, setDuplicateNotes] = useState('');

  // Import Runner states
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [runningImport, setRunningImport] = useState(false);
  const [importBatchRef, setImportBatchRef] = useState('');
  const [importChunkSize, setImportChunkSize] = useState(50);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Oracle 3-View Connection & Schema Status
  const [cbsHealth, setCbsHealth] = useState<{ mode: string; status: string; message: string; timestamp?: string } | null>(null);
  const [schemaReport, setSchemaReport] = useState<{ status: string; message: string; totalColumnsVerified?: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [checkingSchema, setCheckingSchema] = useState(false);

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    try {
      const h = await cimsApi.getCbsHealth();
      setCbsHealth(h);
    } catch (err: any) {
      setCbsHealth({ mode: 'UNKNOWN', status: 'ERROR', message: err.message });
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleValidateSchema = async () => {
    setCheckingSchema(true);
    try {
      const s = await cimsApi.validateCbsSchema();
      setSchemaReport(s);
    } catch (err: any) {
      setSchemaReport({ status: 'ERROR', message: err.message });
    } finally {
      setCheckingSchema(false);
    }
  };

  const loadActiveQueueData = async () => {
    setLoading(true);
    try {
      if (activeQueue === 'incomplete') {
        const resp = await cimsApi.getCbsSyncedCollaterals({ dataQualityStatus: 'INCOMPLETE', size: 100 });
        setIncompleteList(resp.content || []);
      } else if (activeQueue === 'org') {
        const resp = await cimsApi.getCbsSyncedCollaterals({ dataQualityStatus: 'ORGANIZATIONAL_MAPPING_REQUIRED', size: 100 });
        setOrgQueue(resp.content || []);
      } else if (activeQueue === 'taxonomy') {
        const resp = await cimsApi.getCbsSyncedCollaterals({ dataQualityStatus: 'CLASSIFICATION_REVIEW', size: 100 });
        setTaxonomyQueue(resp.content || []);
      } else if (activeQueue === 'unresolvedLinks') {
        const links = await cimsApi.getCbsUnresolvedLinks('UNRESOLVED');
        setUnresolvedLinks(links || []);
      } else if (activeQueue === 'duplicates') {
        const dups = await cimsApi.getCbsDuplicateQueue('PENDING_REVIEW');
        setDuplicateQueue(dups || []);
      } else if (activeQueue === 'importHistory') {
        const batches = await cimsApi.getCbsImportBatches();
        setImportBatches(batches || []);
      }
    } catch (err) {
      console.error('Failed to load queue data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveQueueData();
  }, [activeQueue]);

  const handlePreviewImport = async () => {
    setLoadingPreview(true);
    setImportMessage(null);
    try {
      // Primary: 3-view preview
      const preview = await cimsApi.previewCbsThreeViews().catch(() => cimsApi.previewCbsImport());
      setPreviewData(preview);
    } catch (err: any) {
      setImportMessage(`Error generating preview: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!window.confirm('Execute production CBS three-view initial import (Customer, Facility, Collateral)? CBAIMS will become the operational master post-import.')) {
      return;
    }
    setRunningImport(true);
    setImportMessage(null);
    try {
      const res = await cimsApi.executeCbsThreeViewsImport(importBatchRef || undefined, importChunkSize)
        .catch(() => cimsApi.runCbsImport(importBatchRef || undefined, importChunkSize));
      setImportMessage(res.message || `Three-view import completed successfully (Batch: ${res.batchReference || res.batchId})`);
      setPreviewData(null);
      loadActiveQueueData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setImportMessage(`Import failed: ${err.message}`);
    } finally {
      setRunningImport(false);
    }
  };

  const handleResolveLink = async () => {
    if (!resolvingLink || !selectedLoanId) return;
    try {
      await cimsApi.resolveCbsUnresolvedLink({
        linkId: resolvingLink.id,
        loanId: selectedLoanId,
      });
      setResolvingLink(null);
      setSelectedLoanId('');
      loadActiveQueueData();
    } catch (err: any) {
      alert(`Failed to resolve link: ${err.message}`);
    }
  };

  const handleResolveDuplicate = async () => {
    if (!resolvingDuplicate) return;
    try {
      await cimsApi.resolveCbsDuplicate({
        queueId: resolvingDuplicate.id,
        decision: duplicateDecision,
        notes: duplicateNotes,
      });
      setResolvingDuplicate(null);
      setDuplicateNotes('');
      loadActiveQueueData();
    } catch (err: any) {
      alert(`Failed to resolve duplicate collision: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveQueue('incomplete')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'incomplete'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Incomplete Records
        </button>

        <button
          type="button"
          onClick={() => setActiveQueue('org')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'org'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4 text-purple-600" />
          Organizational Mapping Queue
        </button>

        <button
          type="button"
          onClick={() => setActiveQueue('taxonomy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'taxonomy'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-rose-600" />
          Classification Review
        </button>

        <button
          type="button"
          onClick={() => setActiveQueue('unresolvedLinks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'unresolvedLinks'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LinkIcon className="w-4 h-4 text-blue-600" />
          Unresolved Facility Links
        </button>

        <button
          type="button"
          onClick={() => setActiveQueue('duplicates')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'duplicates'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Copy className="w-4 h-4 text-emerald-600" />
          Duplicate Collision Queue
        </button>

        <button
          type="button"
          onClick={() => setActiveQueue('importHistory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            activeQueue === 'importHistory'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Play className="w-4 h-4 text-indigo-600" />
          CBS Import Runner & Batches
        </button>
      </div>

      {/* Queue Content Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading workbench queue items...
          </div>
        ) : (
          <>
            {/* 1. Incomplete Records Queue */}
            {activeQueue === 'incomplete' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Incomplete CBS-Imported Records</h3>
                    <p className="text-xs text-slate-500">
                      Collaterals requiring CRO data enrichment (Title Deeds, GPS coordinates, Valuation reports, Ownership documents).
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                    {incompleteList.length} Incomplete
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3">Collateral Code</th>
                        <th className="py-2.5 px-3">Category / Type</th>
                        <th className="py-2.5 px-3">Branch / Segment</th>
                        <th className="py-2.5 px-3">Valuation</th>
                        <th className="py-2.5 px-3">Quality Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incompleteList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            🎉 No incomplete collateral records found! All active CBS records are fully enriched.
                          </td>
                        </tr>
                      ) : (
                        incompleteList.map((col) => (
                          <tr key={col.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{col.code}</td>
                            <td className="py-2.5 px-3">{col.type || col.category}</td>
                            <td className="py-2.5 px-3">{col.branch} ({col.owningSegment})</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {col.currency || 'ETB'} {formatEtbNumber(col.valuationAmount)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Incomplete
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => onOpenDetail(col)}
                                  className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 text-xs flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  360
                                </button>
                                <button
                                  onClick={() => onOpenEnrichment(col)}
                                  className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-xs font-medium flex items-center gap-1 shadow-2xs"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Complete Data
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Organizational Assignment Queue */}
            {activeQueue === 'org' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Organizational Mapping Required</h3>
                    <p className="text-xs text-slate-500">
                      Imported records where Branch Code was unmapped or District/CRO has not been designated.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                    {orgQueue.length} Pending Org Resolution
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3">Collateral Code</th>
                        <th className="py-2.5 px-3">Raw CBS Branch</th>
                        <th className="py-2.5 px-3">Owning Segment</th>
                        <th className="py-2.5 px-3">Assigned CRO</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orgQueue.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No records pending organizational mapping. All branches and segments are assigned.
                          </td>
                        </tr>
                      ) : (
                        orgQueue.map((col) => (
                          <tr key={col.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{col.code}</td>
                            <td className="py-2.5 px-3 font-medium text-purple-700">{col.branch || 'MISSING'}</td>
                            <td className="py-2.5 px-3">{col.owningSegment || 'Corporate'}</td>
                            <td className="py-2.5 px-3 text-slate-500">{col.assignedCro || 'Unassigned'}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => onOpenEnrichment(col)}
                                className="px-3 py-1 bg-purple-600 text-white hover:bg-purple-700 rounded-md text-xs font-medium"
                              >
                                Assign Org
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Taxonomy Review Queue */}
            {activeQueue === 'taxonomy' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Collateral Classification Review</h3>
                    <p className="text-xs text-slate-500">
                      CBS records with category codes that do not map to approved CBAIMS collateral taxonomy.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200">
                    {taxonomyQueue.length} Unmapped Taxonomy
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3">Collateral Code</th>
                        <th className="py-2.5 px-3">Raw CBS Category</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {taxonomyQueue.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            All imported collateral records match approved CBAIMS taxonomy.
                          </td>
                        </tr>
                      ) : (
                        taxonomyQueue.map((col) => (
                          <tr key={col.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{col.code}</td>
                            <td className="py-2.5 px-3 font-semibold text-rose-700">{col.category}</td>
                            <td className="py-2.5 px-3 text-slate-600">{col.description}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => onOpenEnrichment(col)}
                                className="px-3 py-1 bg-rose-600 text-white hover:bg-rose-700 rounded-md text-xs font-medium"
                              >
                                Re-classify
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Unresolved Linkages Queue */}
            {activeQueue === 'unresolvedLinks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Unresolved CBS Facility-to-Collateral Linkages</h3>
                    <p className="text-xs text-slate-500">
                      Preserved linkage rows from CLTB_ACC_COLL_LINK_DTLS where the facility reference could not be matched automatically.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                    {unresolvedLinks.length} Unresolved
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3">CBS Collateral Ref</th>
                        <th className="py-2.5 px-3">Account Number</th>
                        <th className="py-2.5 px-3">Branch</th>
                        <th className="py-2.5 px-3">Linked Amount</th>
                        <th className="py-2.5 px-3">Notes</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unresolvedLinks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No unresolved CBS facility linkages. All relationships are mapped.
                          </td>
                        </tr>
                      ) : (
                        unresolvedLinks.map((link) => (
                          <tr key={link.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{link.cbsCollateralRef}</td>
                            <td className="py-2.5 px-3 font-mono text-blue-700">{link.accountNumber || '—'}</td>
                            <td className="py-2.5 px-3">{link.branchCode || '—'}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              ETB {formatEtbNumber(link.linkedAmount ?? 0)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[200px] truncate">{link.notes}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setResolvingLink(link)}
                                className="px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-xs font-medium"
                              >
                                Match Facility
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Duplicate Collision Queue */}
            {activeQueue === 'duplicates' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Duplicate Collision Review Queue</h3>
                    <p className="text-xs text-slate-500">
                      CBS records that match existing CBAIMS Registered assets. Quarantined to prevent overwriting approved data.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                    {duplicateQueue.length} In Review
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3">CBS Collateral Ref</th>
                        <th className="py-2.5 px-3">CBAIMS Registered Match</th>
                        <th className="py-2.5 px-3">Match Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {duplicateQueue.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No duplicate collisions detected with CBAIMS Registered collateral.
                          </td>
                        </tr>
                      ) : (
                        duplicateQueue.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{item.cbsCollateralRef}</td>
                            <td className="py-2.5 px-3 font-mono text-purple-700">{item.potentialCbaimsCollateralId}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.matchReason}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setResolvingDuplicate(item)}
                                className="px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-md text-xs font-medium"
                              >
                                Review Collision
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. CBS Import Runner & Batches */}
            {activeQueue === 'importHistory' && (
              <div className="space-y-6">
                {/* Importer Controls */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  {/* Oracle Production Connectivity & Schema Check Header */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                        ORA
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-slate-900 text-xs">CBS Oracle 3-View Gateway</h5>
                          {cbsHealth && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              cbsHealth.status === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : cbsHealth.status === 'NOT_CONFIGURED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {cbsHealth.mode}: {cbsHealth.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Target: 10.41.31.114:1521/FCUBUAT (Schema: FCUBSLIVE) | Egress: 172.22.11.55
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCheckHealth}
                        disabled={checkingHealth}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 flex items-center gap-1"
                      >
                        {checkingHealth ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                        Test Connection
                      </button>

                      <button
                        type="button"
                        onClick={handleValidateSchema}
                        disabled={checkingSchema}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 flex items-center gap-1"
                      >
                        {checkingSchema ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3 text-blue-600" />}
                        Verify 3 Views (62 Cols)
                      </button>
                    </div>
                  </div>

                  {cbsHealth && (
                    <div className={`p-2.5 rounded-lg text-xs border ${
                      cbsHealth.status === 'AVAILABLE'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50/70 border-amber-200 text-amber-800'
                    }`}>
                      <strong>Status:</strong> {cbsHealth.message}
                    </div>
                  )}

                  {schemaReport && (
                    <div className={`p-2.5 rounded-lg text-xs border ${
                      schemaReport.status === 'AVAILABLE' || schemaReport.status === 'VALID'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50/70 border-rose-200 text-rose-800'
                    }`}>
                      <strong>Schema Validation:</strong> {schemaReport.message} (Columns: {schemaReport.totalColumnsVerified || 62}/62)
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Production CBS Initial Import Runner
                      </h4>
                      <p className="text-xs text-slate-500">
                        Strictly read-only towards CBS. Imports into CBAIMS Common Master (Customer -&gt; Facility -&gt; Collateral -&gt; Relationships).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePreviewImport}
                        disabled={loadingPreview || runningImport}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        {loadingPreview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                        Preview 3-View Scope
                      </button>

                      <button
                        onClick={handleExecuteImport}
                        disabled={runningImport}
                        className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        {runningImport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Run 3-View Import
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Batch Reference (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. CBS-MIG-2026-01"
                        value={importBatchRef}
                        onChange={(e) => setImportBatchRef(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-md w-48 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Chunk Size</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={importChunkSize}
                        onChange={(e) => setImportChunkSize(Number(e.target.value))}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-md w-24 text-xs"
                      />
                    </div>
                  </div>

                  {importMessage && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{importMessage}</span>
                    </div>
                  )}

                  {/* Preview Metrics Card (Enhanced for Three Views) */}
                  {previewData && (
                    <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-slate-900 text-xs">
                          CBS Three-View Import Pre-Validation Scope
                        </h5>
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          Mode: {previewData.cbsMode || 'SIMULATOR'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200">
                          <span className="text-blue-700 font-semibold block text-[11px]">CUSTOMERS</span>
                          <span className="text-slate-600">Rows: <strong>{previewData.totalCustomerRows ?? previewData.totalSourceRows}</strong></span>
                          <span className="text-emerald-700 block text-[11px]">Valid: {previewData.validCustomers ?? '—'}</span>
                          {previewData.customerCollisionsWithCbaims > 0 && (
                            <span className="text-amber-700 block text-[11px]">Collisions: {previewData.customerCollisionsWithCbaims}</span>
                          )}
                        </div>

                        <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-200">
                          <span className="text-indigo-700 font-semibold block text-[11px]">FACILITIES / LOANS</span>
                          <span className="text-slate-600">Rows: <strong>{previewData.totalFacilityRows ?? '—'}</strong></span>
                          <span className="text-emerald-700 block text-[11px]">Valid: {previewData.validFacilities ?? '—'}</span>
                          {previewData.unmatchedFacilityCustomers > 0 && (
                            <span className="text-rose-700 block text-[11px]">Unmatched Cust: {previewData.unmatchedFacilityCustomers}</span>
                          )}
                        </div>

                        <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 font-semibold block text-[11px]">COLLATERAL MASTERS</span>
                          <span className="text-slate-600">Rows: <strong>{previewData.totalCollateralRows ?? previewData.totalSourceRows}</strong></span>
                          <span className="text-emerald-700 block text-[11px]">Eligible: {previewData.validCollaterals ?? previewData.eligibleForImport}</span>
                          {previewData.repeatedCollateralCodes > 0 && (
                            <span className="text-purple-700 block text-[11px]">Multi-Link Assets: {previewData.repeatedCollateralCodes}</span>
                          )}
                        </div>

                        <div className="p-2.5 bg-purple-50/60 rounded-lg border border-purple-200">
                          <span className="text-purple-700 font-semibold block text-[11px]">EMBEDDED LINKAGES</span>
                          <span className="text-slate-600">Links: <strong>{previewData.totalLinkageRows ?? '—'}</strong></span>
                          <span className="text-emerald-700 block text-[11px]">Matched: {previewData.validLinkages ?? '—'}</span>
                          {previewData.unmatchedFacilityLinkages > 0 && (
                            <span className="text-rose-700 block text-[11px]">Unmatched: {previewData.unmatchedFacilityLinkages}</span>
                          )}
                        </div>
                      </div>

                      {previewData.issuesDetected && previewData.issuesDetected.length > 0 && (
                        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-1">
                          <span className="font-semibold text-amber-900 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Validation Findings Detected ({previewData.issuesDetected.length})
                          </span>
                          <ul className="list-disc list-inside text-amber-800 text-[11px] max-h-32 overflow-y-auto">
                            {previewData.issuesDetected.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Import Batch History Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Past Import Batches & Checkpoints
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                          <th className="py-2.5 px-3">Batch Reference</th>
                          <th className="py-2.5 px-3">Start Time</th>
                          <th className="py-2.5 px-3">Total / Imported</th>
                          <th className="py-2.5 px-3">Dups / Unresolved</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importBatches.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">
                              No previous CBS import batches registered.
                            </td>
                          </tr>
                        ) : (
                          importBatches.map((batch) => (
                            <tr key={batch.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{batch.batchReference}</td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">{batch.startTime}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-emerald-700">{batch.importedCount}</span> / {batch.totalRows}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                Dups: {batch.potentialDuplicatesCount} | Unres: {batch.unresolvedLinksCount}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                    batch.status === 'COMPLETED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {batch.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{batch.createdBy}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Resolve Unresolved Linkage */}
      {resolvingLink && (
        <div className="fixed inset-0 bg-[#00205B]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Resolve CBS Facility Linkage</h3>
            <p className="text-slate-500">
              Link CBS Collateral <strong>{resolvingLink.cbsCollateralRef}</strong> to an existing CBAIMS Loan Facility.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Select Active Loan Account</label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">-- Choose Loan Account --</option>
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.loanReference} — {fac.facilityType || fac.lineCode} (Bal: ETB {formatEtbNumber(fac.outstandingBalance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResolvingLink(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveLink}
                disabled={!selectedLoanId}
                className="btn-primary py-1.5 px-4 font-semibold disabled:opacity-50"
              >
                Confirm Linkage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resolve Duplicate Collision */}
      {resolvingDuplicate && (
        <div className="fixed inset-0 bg-[#00205B]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Resolve Duplicate Collision</h3>
            <p className="text-slate-500">
              Compare CBS reference <strong>{resolvingDuplicate.cbsCollateralRef}</strong> with registered asset{' '}
              <strong>{resolvingDuplicate.potentialCbaimsCollateralId}</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Collision Decision</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="decision"
                      value="CONFIRMED_SAME"
                      checked={duplicateDecision === 'CONFIRMED_SAME'}
                      onChange={() => setDuplicateDecision('CONFIRMED_SAME')}
                    />
                    <div>
                      <span className="font-semibold text-slate-800">Confirmed Same Asset</span>
                      <p className="text-[11px] text-slate-500">
                        Associate the CBS source identity with existing CBAIMS master without overwriting CBAIMS values.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="decision"
                      value="CONFIRMED_DIFFERENT"
                      checked={duplicateDecision === 'CONFIRMED_DIFFERENT'}
                      onChange={() => setDuplicateDecision('CONFIRMED_DIFFERENT')}
                    />
                    <div>
                      <span className="font-semibold text-slate-800">Confirmed Different Physical Asset</span>
                      <p className="text-[11px] text-slate-500">
                        Maintain both records as distinct assets in the portfolio.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Review Notes & Justification</label>
                <textarea
                  rows={2}
                  placeholder="Record verification notes, comparison results, or legal confirmation..."
                  value={duplicateNotes}
                  onChange={(e) => setDuplicateNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResolvingDuplicate(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveDuplicate}
                className="btn-primary py-1.5 px-4 font-semibold"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
