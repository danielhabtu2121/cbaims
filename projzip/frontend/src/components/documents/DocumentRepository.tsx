import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  Eye,
  Download,
  Archive,
  FileText,
  Clock,
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  File,
  X,
  CheckCircle,
  HardDrive,
  FileCheck,
  GitBranch,
  Layers,
  Search,
  Check,
  XCircle,
  RefreshCw,
  Paperclip,
  Trash2,
  Filter,
} from 'lucide-react';
import { OwnershipDocument, Collateral, UserSession, MandatoryDocumentRule } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';

interface DocumentRepositoryProps {
  documents: OwnershipDocument[];
  collaterals: Collateral[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  currentUser: UserSession;
  onUploadDocument: (entityType: string, entityId: string, docName: string, docType: string, expiryDate?: string, fileDetails?: any) => Promise<void>;
  onArchiveDocument?: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

export const DocumentRepository: React.FC<DocumentRepositoryProps> = ({
  documents,
  collaterals,
  mandatoryDocRules = [],
  currentUser,
  onUploadDocument,
  onArchiveDocument,
  onRefreshData,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<OwnershipDocument | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  // Filters
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // File Upload State (for fresh uploads)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadEntityType, setUploadEntityType] = useState<'Collateral' | 'Customer' | 'Facility' | 'Insurance Policy'>('Collateral');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [uploadDocType, setUploadDocType] = useState('Title Deed / Property Ownership Certificate');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('2031-12-31');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [uploading, setUploading] = useState(false);

  // New Version State
  const versionFileInputRef = useRef<HTMLInputElement>(null);
  const [versionTargetDoc, setVersionTargetDoc] = useState<OwnershipDocument | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionDataUrl, setVersionDataUrl] = useState<string>('');
  const [versionNotes, setVersionNotes] = useState('Updated version with renewed certification');
  const [versionExpiryDate, setVersionExpiryDate] = useState('2031-12-31');
  const [submittingVersion, setSubmittingVersion] = useState(false);

  // Document chain version list
  const [docVersions, setDocVersions] = useState<OwnershipDocument[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '1.2 MB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!uploadDocName) {
        setUploadDocName(file.name.replace(/\.[^/.]+$/, ''));
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setFileDataUrl(dataUrl);
      } catch (err) {
        console.error('File read error:', err);
      }
    }
  };

  const handleVersionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVersionFile(file);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setVersionDataUrl(dataUrl);
      } catch (err) {
        console.error('File read error:', err);
      }
    }
  };

  const loadDocumentVersions = async (doc: OwnershipDocument) => {
    setLoadingVersions(true);
    try {
      const versions = await cimsApi.fetchDocumentVersions(doc.id);
      setDocVersions(versions);
    } catch (err) {
      console.error('Failed to load document versions:', err);
      // Fallback: filter from local state
      const rootId = doc.parentDocumentId || doc.id;
      const filtered = documents.filter(d => d.id === rootId || d.parentDocumentId === rootId || d.id === doc.id);
      setDocVersions(filtered);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleDownloadFile = (doc: OwnershipDocument) => {
    if (doc.fileContent && doc.fileContent.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = doc.fileContent;
      link.download = doc.fileName || `${doc.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const fileContent =
      `Bank Collateral Insurance Management System (CIMS) - DMS Repository Archive\n` +
      `=========================================================================\n` +
      `Document Reference: ${doc.name}\n` +
      `Document File Name: ${doc.fileName || doc.name}\n` +
      `Document Category: ${doc.type}\n` +
      `Target Entity: ${doc.entityType} (${doc.entityId})\n` +
      `DMS Archive Reference: ${doc.id}\n` +
      `Version: v${doc.version || 1} ${doc.isLatest ? '(Current Active Version)' : '(Superseded/Historical)'}\n` +
      `Verification Status: ${doc.verificationStatus || 'Verified'}\n` +
      `Upload Date: ${doc.uploadDate || doc.uploadedAt}\n` +
      `Expiry Date: ${doc.expiryDate || 'N/A'}\n` +
      `Uploaded By: ${doc.uploadedBy || 'COLLDOCOFF'}\n` +
      `Remarks: ${doc.remarks || 'Standard repository document'}\n\n` +
      `[OFFICIAL BANK DMS REPOSITORY ARCHIVE SEAL - DIGITALLY VERIFIED]\n`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName ? `${doc.fileName}.txt` : `${doc.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (entityFilter !== 'All' && doc.entityType !== entityFilter) return false;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Verified' && doc.verificationStatus !== 'Verified') return false;
      if (statusFilter === 'Pending' && doc.verificationStatus === 'Verified') return false;
      if (statusFilter === 'Archived' && doc.status !== 'Archived') return false;
      if (statusFilter === 'Active' && doc.status !== 'Active') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = doc.name?.toLowerCase().includes(q);
      const matchType = doc.type?.toLowerCase().includes(q);
      const matchEntity = doc.entityId?.toLowerCase().includes(q);
      const matchId = doc.id?.toLowerCase().includes(q);
      const matchFile = doc.fileName?.toLowerCase().includes(q);
      if (!matchName && !matchType && !matchEntity && !matchId && !matchFile) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalDocsCount = documents.length;
  const collateralDocsCount = documents.filter(d => d.entityType === 'Collateral').length;
  const policyDocsCount = documents.filter(d => d.entityType === 'Insurance Policy' || d.entityType === 'Policy').length;
  const verifiedDocsCount = documents.filter(d => d.verificationStatus === 'Verified').length;

  const documentColumns: ColumnDef<OwnershipDocument>[] = [
    {
      header: 'Document Title & File Details',
      accessorKey: 'name',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#EFF5FB] border border-[#DCE9F5] flex items-center justify-center text-[#173F63] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#102E4A] truncate">{r.name}</div>
            <div className="text-[11px] text-[#5B6472] flex items-center gap-2">
              <span className="font-mono">{r.fileName || 'document.pdf'}</span>
              <span>•</span>
              <span>{formatFileSize(r.fileSize)}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category / Document Type',
      accessorKey: 'type',
      sortable: true,
      cell: (r) => <div className="font-semibold text-[#101828] text-xs">{r.type}</div>,
    },
    {
      header: 'Linked Entity',
      accessorKey: 'entityType',
      cell: (r) => {
        const col = collaterals.find(c => c.id === r.entityId || c.code === r.entityId);
        return (
          <div>
            <span className="font-bold text-[#102E4A] text-xs">{r.entityType || 'Collateral'}: </span>
            <span className="font-mono text-[#1F4E7A] text-xs font-semibold">{col?.code || r.entityId}</span>
          </div>
        );
      },
    },
    {
      header: 'Version',
      accessorKey: 'version',
      align: 'center',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDoc(r);
            loadDocumentVersions(r);
            setShowPreviewDrawer(true);
          }}
          className="px-2 py-0.5 rounded text-xs font-bold bg-[#DCE9F5] text-[#102E4A] hover:bg-[#B9D3EB] transition-colors flex items-center gap-1 mx-auto"
          title="Click to view full version history"
        >
          <GitBranch className="w-3 h-3 text-[#1F4E7A]" />
          <span>v{r.version || 1}</span>
        </button>
      ),
    },
    {
      header: 'Upload Date',
      accessorKey: 'uploadDate',
      cell: (r) => (
        <div>
          <div className="font-semibold text-[#101828]">{r.uploadDate?.substring(0, 10) || r.uploadedAt?.substring(0, 10)}</div>
          <div className="text-[10px] text-[#5B6472]">By: {r.uploadedBy || 'COLLDOCOFF'}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Expiry Date',
      accessorKey: 'expiryDate',
      cell: (r) => {
        const isExpired = r.expiryDate && new Date(r.expiryDate).getTime() < Date.now();
        return (
          <div className={`font-semibold ${isExpired ? 'text-red-600' : 'text-[#101828]'}`}>
            {r.expiryDate || 'N/A'}
          </div>
        );
      },
    },
    {
      header: 'Verification',
      accessorKey: 'verificationStatus',
      cell: (r) => (
        <StatusChip
          label={r.verificationStatus || 'Verified'}
          variant={r.verificationStatus === 'Verified' ? 'success' : r.verificationStatus === 'Rejected' ? 'danger' : 'warning'}
          size="sm"
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDoc(r);
              loadDocumentVersions(r);
              setShowPreviewDrawer(true);
            }}
            className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
            title="Inspect document & view version history"
          >
            <Eye className="w-3.5 h-3.5" />
            Inspect
          </button>
          {currentUser.canCreate !== false && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVersionTargetDoc(r);
                setVersionFile(null);
                setVersionDataUrl('');
                setVersionNotes(`Version ${ (r.version || 1) + 1 } update for ${r.name}`);
                setVersionExpiryDate(r.expiryDate || '2031-12-31');
                setShowNewVersionModal(true);
              }}
              className="btn-ghost py-1 px-2 text-xs text-[#102E4A] border border-[#B9D3EB] rounded flex items-center gap-1 hover:bg-[#EFF5FB]"
              title="Upload new superseded version"
            >
              <GitBranch className="w-3.5 h-3.5" />
              + Version
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadFile(r);
            }}
            className="btn-primary py-1 px-2 text-xs bg-[#102E4A]"
            title="Download Document"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="cims-card p-4 bg-[#EFF5FB] border-[#DCE9F5] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-[#1F4E7A]">Total DMS Documents</div>
            <div className="text-2xl font-black text-[#102E4A] mt-1 tabular-nums">{totalDocsCount}</div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">Secure Document Archive</div>
          </div>
          <FolderOpen className="w-8 h-8 text-[#2C6295]" />
        </div>

        <div className="cims-card p-4 bg-emerald-50 border-emerald-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-emerald-700">Collateral Deeds</div>
            <div className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">{collateralDocsCount}</div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">Title deeds & ownership files</div>
          </div>
          <FileCheck className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="cims-card p-4 bg-blue-50 border-blue-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-blue-700">Insurance Policies</div>
            <div className="text-2xl font-black text-blue-900 mt-1 tabular-nums">{policyDocsCount}</div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">Schedules & premium receipts</div>
          </div>
          <ShieldCheck className="w-8 h-8 text-blue-600" />
        </div>

        <div className="cims-card p-4 bg-purple-50 border-purple-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-purple-700">Verified Rate</div>
            <div className="text-2xl font-black text-purple-900 mt-1 tabular-nums">
              {totalDocsCount > 0 ? Math.round((verifiedDocsCount / totalDocsCount) * 100) : 100}%
            </div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">{verifiedDocsCount} Verified documents</div>
          </div>
          <CheckCircle className="w-8 h-8 text-purple-600" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="cims-card p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#5B6472] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Entity:
          </span>
          {['All', 'Collateral', 'Insurance Policy', 'Customer'].map((t) => (
            <button
              key={t}
              onClick={() => setEntityFilter(t)}
              className={`py-1 px-2.5 rounded text-xs font-semibold transition-colors ${
                entityFilter === t
                  ? 'bg-[#102E4A] text-white'
                  : 'bg-[#EFF5FB] text-[#5B6472] hover:bg-[#DCE9F5]'
              }`}
            >
              {t === 'All' ? 'All Entities' : t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents, entities, files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 border border-[#E2E8F0] rounded text-xs font-semibold"
          >
            <option value="All">All Statuses</option>
            <option value="Verified">Verified Only</option>
            <option value="Pending">Pending Verification</option>
            <option value="Active">Active Only</option>
            <option value="Archived">Archived</option>
          </select>

          {currentUser.canCreate !== false && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setFileDataUrl('');
                setUploadDocName('');
                setUploadEntityId('');
                setShowUploadModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              + Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Main Documents Grid */}
      <DataGrid
        title="Document Repository (DMS Master)"
        subtitle="Auditable Multi-Version Document Storage & Digital Vault for Title Deeds, Logbooks, Policies, and Certificates"
        data={filteredDocuments}
        columns={documentColumns}
        keyExtractor={(d) => d.id}
        onRowClick={(d) => {
          setSelectedDoc(d);
          loadDocumentVersions(d);
          setShowPreviewDrawer(true);
        }}
      />

      {/* Document Preview & Version History Drawer */}
      {showPreviewDrawer && selectedDoc && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Drawer Header */}
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold">{selectedDoc.name}</h2>
                  <StatusChip
                    label={selectedDoc.verificationStatus || 'Verified'}
                    variant={selectedDoc.verificationStatus === 'Verified' ? 'success' : 'warning'}
                    size="sm"
                  />
                  <span className="text-xs px-2 py-0.5 rounded bg-[#1F4E7A] text-white font-mono font-bold">
                    v{selectedDoc.version || 1}
                  </span>
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>Type: {selectedDoc.type}</span>
                  <span>Target: {selectedDoc.entityType} ({selectedDoc.entityId})</span>
                </div>
              </div>
              <button onClick={() => setShowPreviewDrawer(false)} className="text-white hover:text-gray-300 text-lg">✕</button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Repository Metadata */}
              <div className="cims-card p-4 space-y-2 bg-[#EFF5FB] border-[#DCE9F5]">
                <h4 className="font-bold text-[#102E4A] uppercase text-[11px] tracking-wider border-b border-[#B9D3EB] pb-1">
                  DMS Repository Metadata
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-[#5B6472]">DMS System ID:</span> <strong className="font-mono">{selectedDoc.id}</strong></div>
                  <div><span className="text-[#5B6472]">File Name:</span> <strong className="font-mono">{selectedDoc.fileName || selectedDoc.name}</strong></div>
                  <div><span className="text-[#5B6472]">Document Category:</span> <strong>{selectedDoc.type}</strong></div>
                  <div><span className="text-[#5B6472]">Attached Entity:</span> <strong className="font-mono">{selectedDoc.entityType} → {selectedDoc.entityId}</strong></div>
                  <div><span className="text-[#5B6472]">Verification Status:</span> <strong className="text-emerald-700">{selectedDoc.verificationStatus || 'Verified'}</strong></div>
                  <div><span className="text-[#5B6472]">Uploaded By:</span> <strong>{selectedDoc.uploadedBy || 'COLLDOCOFF'}</strong></div>
                  <div><span className="text-[#5B6472]">Upload Date:</span> <strong>{selectedDoc.uploadDate || selectedDoc.uploadedAt}</strong></div>
                  <div><span className="text-[#5B6472]">Expiry Date:</span> <strong>{selectedDoc.expiryDate || 'N/A'}</strong></div>
                  <div><span className="text-[#5B6472]">File Size:</span> <strong>{formatFileSize(selectedDoc.fileSize)}</strong></div>
                  <div><span className="text-[#5B6472]">MIME Content Type:</span> <strong>{selectedDoc.contentType || 'application/pdf'}</strong></div>
                </div>
                {selectedDoc.remarks && (
                  <div className="pt-1 border-t border-[#B9D3EB]">
                    <span className="text-[#5B6472]">Remarks:</span> <em>{selectedDoc.remarks}</em>
                  </div>
                )}
              </div>

              {/* Realistic Document Preview Card */}
              <div className="border border-[#E2E8F0] rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-[#DCE9F5] text-[#102E4A] flex items-center justify-center">
                  <FileCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#102E4A]">{selectedDoc.fileName || selectedDoc.name}</h3>
                  <p className="text-xs text-[#5B6472] mt-0.5">Encrypted Digital Document Repository Vault</p>
                </div>
                <div className="p-3 bg-white border border-[#E2E8F0] rounded text-xs text-left w-full space-y-1 font-mono text-gray-700">
                  <div>[ORIGINAL BANK SECURITY WATERMARK - VERIFIED]</div>
                  <div>Document Type: {selectedDoc.type}</div>
                  <div>Target Asset / Entity: {selectedDoc.entityId}</div>
                  <div>Version: v{selectedDoc.version || 1} • SHA-256 Checksum: 9a3f2e...41b0</div>
                </div>
                <button
                  onClick={() => handleDownloadFile(selectedDoc)}
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-2 bg-[#102E4A]"
                >
                  <Download className="w-4 h-4" /> Download Official File ({selectedDoc.fileName || selectedDoc.name})
                </button>
              </div>

              {/* Version History Tree */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-[#102E4A] text-xs flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-[#1F4E7A]" />
                    Version Control History ({docVersions.length > 0 ? docVersions.length : 1})
                  </h4>
                  {currentUser.canCreate !== false && (
                    <button
                      onClick={() => {
                        setVersionTargetDoc(selectedDoc);
                        setVersionFile(null);
                        setVersionDataUrl('');
                        setVersionNotes(`Version ${ (selectedDoc.version || 1) + 1 } update for ${selectedDoc.name}`);
                        setVersionExpiryDate(selectedDoc.expiryDate || '2031-12-31');
                        setShowNewVersionModal(true);
                      }}
                      className="btn-ghost text-[#102E4A] border border-[#B9D3EB] py-1 px-2.5 rounded text-xs flex items-center gap-1 font-semibold hover:bg-[#EFF5FB]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Upload New Version (v{(selectedDoc.version || 1) + 1})
                    </button>
                  )}
                </div>

                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2">Version</th>
                        <th className="p-2">File Name</th>
                        <th className="p-2">Uploaded Date</th>
                        <th className="p-2">Author</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {docVersions.length === 0 ? (
                        <tr className="bg-emerald-50/50">
                          <td className="p-2 font-bold font-mono text-emerald-800">v{selectedDoc.version || 1}</td>
                          <td className="p-2 font-semibold">{selectedDoc.fileName || selectedDoc.name}</td>
                          <td className="p-2">{selectedDoc.uploadDate?.substring(0, 10)}</td>
                          <td className="p-2">{selectedDoc.uploadedBy || 'COLLDOCOFF'}</td>
                          <td className="p-2"><StatusChip label="Active / Current" variant="success" size="sm" /></td>
                          <td className="p-2 text-right">
                            <button onClick={() => handleDownloadFile(selectedDoc)} className="text-[#1F4E7A] hover:underline">
                              Download
                            </button>
                          </td>
                        </tr>
                      ) : (
                        docVersions.map((v) => (
                          <tr key={v.id} className={v.isLatest !== false ? 'bg-emerald-50/40' : 'hover:bg-[#EFF5FB]'}>
                            <td className="p-2 font-bold font-mono text-[#102E4A]">
                              v{v.version || 1} {v.isLatest !== false && <span className="text-[10px] text-emerald-700 font-normal">(Current)</span>}
                            </td>
                            <td className="p-2 font-semibold">{v.fileName || v.name}</td>
                            <td className="p-2">{v.uploadDate?.substring(0, 10)}</td>
                            <td className="p-2">{v.uploadedBy || 'COLLDOCOFF'}</td>
                            <td className="p-2">
                              <StatusChip
                                label={v.isLatest !== false ? 'Active' : 'Superseded'}
                                variant={v.isLatest !== false ? 'success' : 'neutral'}
                                size="sm"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button onClick={() => handleDownloadFile(v)} className="text-[#1F4E7A] hover:underline">
                                Download
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Verification Actions */}
              <div className="p-4 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                <h4 className="font-bold text-[#102E4A] text-xs">Four-Eyes Verification Status</h4>
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6472]">Current Status: <strong>{selectedDoc.verificationStatus || 'Verified'}</strong></span>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await cimsApi.verifyDocument(selectedDoc.id, 'Verified', 'Verified by Collateral Officer', currentUser.username);
                          alert('Document marked as Verified.');
                          if (onRefreshData) await onRefreshData();
                          else window.location.reload();
                        } catch (e: any) {
                          alert(`Verification failed: ${e.message || e}`);
                        }
                      }}
                      className="btn-primary py-1 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark as Verified
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt('Specify reason for document rejection:');
                        if (!reason) return;
                        try {
                          await cimsApi.verifyDocument(selectedDoc.id, 'Rejected', reason, currentUser.username);
                          alert('Document marked as Rejected.');
                          if (onRefreshData) await onRefreshData();
                          else window.location.reload();
                        } catch (e: any) {
                          alert(`Rejection failed: ${e.message || e}`);
                        }
                      }}
                      className="btn-secondary py-1 px-2.5 text-xs text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Document
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#EFF5FB] flex justify-between items-center">
              <button
                onClick={async () => {
                  if (confirm(`Archive document ${selectedDoc.name}?`)) {
                    if (onArchiveDocument) await onArchiveDocument(selectedDoc.id);
                    else await cimsApi.archiveDocument(selectedDoc.id, currentUser.username);
                    alert('Document archived.');
                    setShowPreviewDrawer(false);
                    if (onRefreshData) await onRefreshData();
                    else window.location.reload();
                  }
                }}
                className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 text-xs flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" /> Archive Document
              </button>
              <button onClick={() => setShowPreviewDrawer(false)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fresh Ingest Document Modal with Real File Drag-and-Drop & Selector */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Document to DMS</h3>
                <p className="text-[11px] text-blue-200">Upload and attach files (PDF, TIFF, Word, JPG) with metadata</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!uploadEntityId) {
                  alert('Please select a target entity.');
                  return;
                }
                const docFinalName = uploadDocName.trim() || selectedFile?.name || `${uploadDocType} Document`;

                setUploading(true);
                try {
                  const fileDetails = {
                    fileName: selectedFile?.name || `${docFinalName}.pdf`,
                    fileSize: selectedFile?.size || 102400,
                    contentType: selectedFile?.type || 'application/pdf',
                    fileContent: fileDataUrl || undefined,
                    remarks: uploadRemarks,
                  };

                  await onUploadDocument(uploadEntityType, uploadEntityId, docFinalName, uploadDocType, uploadExpiryDate, fileDetails);
                  alert(`Document "${docFinalName}" successfully ingested into DMS.`);
                  setShowUploadModal(false);
                  if (onRefreshData) await onRefreshData();
                  else window.location.reload();
                } catch (err: any) {
                  alert(`Upload failed: ${err.message || err}`);
                } finally {
                  setUploading(false);
                }
              }}
              className="p-5 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              {/* Drag-and-Drop File Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    setSelectedFile(file);
                    if (!uploadDocName) setUploadDocName(file.name.replace(/\.[^/.]+$/, ''));
                    const url = await readFileAsDataUrl(file);
                    setFileDataUrl(url);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-[#2C6295] bg-[#EFF5FB]' : 'border-[#E2E8F0] hover:border-[#5F97C7] bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-bold text-[#101828]">{selectedFile.name}</div>
                      <div className="text-[11px] text-[#5B6472]">{formatFileSize(selectedFile.size)} • {selectedFile.type || 'Document'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="w-8 h-8 text-[#1F4E7A] mx-auto" />
                    <div className="font-bold text-[#102E4A]">Click to browse or drag file here</div>
                    <div className="text-[10px] text-[#5B6472]">PDF, TIFF, Word, JPG up to 25MB</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Target Entity Type (M)</label>
                  <select
                    value={uploadEntityType}
                    onChange={(e) => setUploadEntityType(e.target.value as any)}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-semibold text-xs"
                  >
                    <option value="Collateral">Collateral Asset</option>
                    <option value="Insurance Policy">Insurance Policy</option>
                    <option value="Customer">Customer Portfolio</option>
                    <option value="Facility">Credit Facility</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Target Entity ID / Code (M)</label>
                  <input
                    type="text"
                    value={uploadEntityId}
                    onChange={(e) => setUploadEntityId(e.target.value)}
                    placeholder="e.g. COL-001, POL-990"
                    className="w-full p-2 border border-[#E2E8F0] rounded font-semibold font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Document Category / Type (M)</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-semibold text-xs"
                >
                  <option value="Title Deed / Property Ownership Certificate">Title Deed / Property Ownership Certificate</option>
                  <option value="Approved Building Plan">Approved Building Plan</option>
                  <option value="Valuation Report">Valuation Report</option>
                  <option value="Vehicle Registration / Logbook">Vehicle Registration / Logbook</option>
                  <option value="Commercial Registration & Business License">Commercial Registration & Business License</option>
                  <option value="Machinery Invoice / Purchase Contract">Machinery Invoice / Purchase Contract</option>
                  <option value="Insurance Policy Schedule">Insurance Policy Schedule</option>
                  <option value="Premium Payment Receipt">Premium Payment Receipt</option>
                  <option value="Personal / Corporate Guarantee Deed">Personal / Corporate Guarantee Deed</option>
                  <option value="Other Ownership Document">Other Ownership Document</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Document Title (M)</label>
                  <input
                    type="text"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    placeholder="e.g. Title Deed Certificate #9901"
                    className="w-full p-2 border border-[#E2E8F0] rounded font-semibold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Remarks & Ingestion Notes</label>
                <textarea
                  rows={2}
                  value={uploadRemarks}
                  onChange={(e) => setUploadRemarks(e.target.value)}
                  placeholder="Optional audit remarks..."
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary bg-[#102E4A] disabled:opacity-60 flex items-center gap-1"
                >
                  {uploading ? 'Uploading to DMS…' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload New Version Modal */}
      {showNewVersionModal && versionTargetDoc && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload New Superseded Version</h3>
                <p className="text-[11px] text-blue-200">
                  {versionTargetDoc.name} • Increment to v{(versionTargetDoc.version || 1) + 1}
                </p>
              </div>
              <button onClick={() => setShowNewVersionModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmittingVersion(true);
                try {
                  const payload = {
                    fileName: versionFile?.name || `${versionTargetDoc.name}_v${(versionTargetDoc.version || 1) + 1}.pdf`,
                    fileSize: versionFile?.size || versionTargetDoc.fileSize,
                    contentType: versionFile?.type || versionTargetDoc.contentType || 'application/pdf',
                    fileContent: versionDataUrl || versionTargetDoc.fileContent,
                    versionNotes,
                    expiryDate: versionExpiryDate,
                    uploadedBy: currentUser.username || 'COLLDOCOFF',
                  };

                  await cimsApi.uploadDocumentVersion(versionTargetDoc.id, payload);
                  alert(`New version v${(versionTargetDoc.version || 1) + 1} uploaded successfully.`);
                  setShowNewVersionModal(false);
                  setShowPreviewDrawer(false);
                  if (onRefreshData) await onRefreshData();
                  else window.location.reload();
                } catch (err: any) {
                  alert(`Version upload failed: ${err.message || err}`);
                } finally {
                  setSubmittingVersion(false);
                }
              }}
              className="p-5 space-y-4"
            >
              {/* File Drop for New Version */}
              <div
                onClick={() => versionFileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer border-[#E2E8F0] hover:border-[#5F97C7] bg-gray-50"
              >
                <input
                  type="file"
                  ref={versionFileInputRef}
                  onChange={handleVersionFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
                />
                {versionFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-bold text-[#101828]">{versionFile.name}</div>
                      <div className="text-[11px] text-[#5B6472]">{formatFileSize(versionFile.size)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="w-6 h-6 text-[#1F4E7A] mx-auto" />
                    <div className="font-bold text-[#102E4A]">Select replacement file for v{(versionTargetDoc.version || 1) + 1}</div>
                    <div className="text-[10px] text-[#5B6472]">Click to browse file</div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Reason / Version Notes (M)</label>
                <textarea
                  rows={2}
                  required
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="e.g. Updated 2026 valuation report after re-assessment"
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Updated Expiry Date</label>
                <input
                  type="date"
                  value={versionExpiryDate}
                  onChange={(e) => setVersionExpiryDate(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowNewVersionModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVersion}
                  className="btn-primary bg-[#102E4A] disabled:opacity-60"
                >
                  {submittingVersion ? 'Uploading Version…' : `Commit Version v${(versionTargetDoc.version || 1) + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
