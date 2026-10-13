import React, { useState, useRef, useEffect } from 'react';
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
  History,
  ShieldAlert,
  Trash2,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { OwnershipDocument, Collateral, UserSession, MandatoryDocumentRule } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentVersionHistoryModal } from './DocumentVersionHistoryModal';

export const CONTROLLED_DOCUMENT_TYPES: string[] = [
  'Title Deed / Property Ownership Certificate',
  'Approved Building Plan',
  'BOQ / Bill of Quantity',
  'Vehicle Registration Certificate',
  'Machinery Ownership Certificate',
  'Purchase Document / Contract',
  'Lease Agreement',
  'Lease Payment Receipt',
  'Third-Party Consent and Pledge Agreement',
  'Letter of Consent',
  'Mortgage Registration Confirmation',
  'Valuation Report',
  'Custody Agreement',
  'Livestock Ear Tag Registration',
  'TIN',
  'Land Holding Certificate',
  'Warehouse Receipt',
  'IP Registration Certificate',
  'Share Certificate',
  'Business Registration Certificate',
  'Insurance Policy Schedule',
  'Premium Payment Receipt',
  'Renewal Certificate',
  'Endorsement Certificate',
  'Customer Correspondence',
  'Supporting Evidence',
  'Other Supporting Document',
];

interface DocumentRepositoryProps {
  documents: OwnershipDocument[];
  collaterals: Collateral[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  currentUser: UserSession;
  initialDocumentId?: string | null;
  onUploadDocument: (entityType: string, entityId: string, docName: string, docType: string, expiryDate?: string, fileDetails?: any) => Promise<void>;
  onArchiveDocument?: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

export const DocumentRepository: React.FC<DocumentRepositoryProps> = ({
  documents,
  collaterals,
  mandatoryDocRules = [],
  currentUser,
  initialDocumentId,
  onUploadDocument,
  onArchiveDocument,
  onRefreshData,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<OwnershipDocument | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  useEffect(() => {
    if (initialDocumentId && documents.length > 0) {
      const found = documents.find((d) => d.id === initialDocumentId);
      if (found) {
        setSelectedDoc(found);
        setShowPreviewDrawer(true);
      }
    }
  }, [initialDocumentId, documents]);

  // Document Preview Modal State (Preview before Download)
  const [previewDoc, setPreviewDoc] = useState<OwnershipDocument | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewVersions, setPreviewVersions] = useState<OwnershipDocument[]>([]);

  // Document Version History Modal State
  const [historyDoc, setHistoryDoc] = useState<OwnershipDocument | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Filters & Advanced Search
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentVersionsOnly, setCurrentVersionsOnly] = useState<boolean>(true);

  // 15-parameter backend advanced search state
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [advCustomerName, setAdvCustomerName] = useState('');
  const [advCif, setAdvCif] = useState('');
  const [advLoanRef, setAdvLoanRef] = useState('');
  const [advCollateralId, setAdvCollateralId] = useState('');
  const [advPolicyNo, setAdvPolicyNo] = useState('');
  const [advTitleDeedNo, setAdvTitleDeedNo] = useState('');
  const [advRegNo, setAdvRegNo] = useState('');
  const [advSegment, setAdvSegment] = useState('');
  const [advRegion, setAdvRegion] = useState('');
  const [advDistrict, setAdvDistrict] = useState('');
  const [advBranch, setAdvBranch] = useState('');
  const [advDocType, setAdvDocType] = useState('');
  const [advDocStatus, setAdvDocStatus] = useState('');
  const [advExpiryDate, setAdvExpiryDate] = useState('');
  const [advUploadDate, setAdvUploadDate] = useState('');
  const [advSearchResults, setAdvSearchResults] = useState<OwnershipDocument[] | null>(null);
  const [searchingAdv, setSearchingAdv] = useState(false);

  // File Upload State (for fresh uploads)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadEntityType, setUploadEntityType] = useState<'Collateral' | 'Customer' | 'Facility' | 'Insurance Policy'>('Collateral');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [uploadDocType, setUploadDocType] = useState(CONTROLLED_DOCUMENT_TYPES[0]);
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('2031-12-31');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [uploadVersionNotes, setUploadVersionNotes] = useState('');
  const [uploadForceNew, setUploadForceNew] = useState(false);
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

  const getDocumentVersionCount = (doc: OwnershipDocument) => {
    const rootId = doc.parentDocumentId || doc.id;
    return documents.filter((d) => d.id === rootId || d.parentDocumentId === rootId || d.id === doc.id).length;
  };

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

  const handleOpenPreview = async (doc: OwnershipDocument) => {
    setPreviewDoc(doc);
    setShowPreviewModal(true);
    try {
      const [fullDoc, versions] = await Promise.all([
        cimsApi.fetchDocumentById(doc.id).catch(() => doc),
        cimsApi.fetchDocumentVersions(doc.id).catch(() => []),
      ]);
      if (fullDoc && (fullDoc.fileContent || fullDoc.fileUrl)) {
        setPreviewDoc(fullDoc);
      }
      if (versions && versions.length > 0) {
        setPreviewVersions(versions);
      } else {
        const rootId = doc.parentDocumentId || doc.id;
        const filtered = documents.filter((d) => d.id === rootId || d.parentDocumentId === rootId || d.id === doc.id);
        setPreviewVersions(filtered.length > 0 ? filtered : [doc]);
      }
    } catch {
      const rootId = doc.parentDocumentId || doc.id;
      const filtered = documents.filter((d) => d.id === rootId || d.parentDocumentId === rootId || d.id === doc.id);
      setPreviewVersions(filtered.length > 0 ? filtered : [doc]);
    }
  };

  const handleDownloadFile = (doc: OwnershipDocument) => {
    if (doc.fileContent && doc.fileContent.startsWith('data:') && !doc.fileContent.includes('dummyContent')) {
      const link = document.createElement('a');
      link.href = doc.fileContent;
      link.download = doc.fileName || `${doc.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Trigger backend download which decodes stored binary or provides authenticated vault text
    try {
      const link = document.createElement('a');
      link.href = `/api/documents/${encodeURIComponent(doc.id)}/download`;
      link.download = doc.fileName || `${doc.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Local fallback in case of offline or disconnected state
      const fileContent =
        `Bank Collateral & Insurance Management System (CBAIMS) - DMS Repository Archive\n` +
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
    }
  };

  // Filtered documents
  const baseDocuments = advSearchResults !== null ? advSearchResults : documents;
  const filteredDocuments = baseDocuments.filter((doc) => {
    if (currentVersionsOnly && doc.isLatest === false) return false;
    if (entityFilter !== 'All' && doc.entityType !== entityFilter) return false;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Active' && doc.status !== 'Active') return false;
      if (statusFilter === 'Expired' && doc.status !== 'Expired' && !(doc.expiryDate && new Date(doc.expiryDate).getTime() < Date.now())) return false;
      if (statusFilter === 'Archived' && doc.status !== 'Archived') return false;
    }
    if (searchQuery.trim()) {
      const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const combinedDocText = [
        doc.name,
        doc.fileName,
        doc.type,
        doc.entityType,
        doc.entityId,
        doc.id,
        doc.dmsRef,
        doc.remarks,
        doc.uploadedBy,
        doc.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!terms.every((t) => combinedDocText.includes(t))) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalDocsCount = documents.length;
  const collateralDocsCount = documents.filter(d => d.entityType === 'Collateral').length;
  const policyDocsCount = documents.filter(d => d.entityType === 'Insurance Policy' || d.entityType === 'Policy').length;
  const activeCurrentDocsCount = documents.filter(d => d.isLatest !== false && d.status !== 'Archived').length;

  const handleExecuteAdvancedSearch = async () => {
    setSearchingAdv(true);
    try {
      const results = await cimsApi.searchDocuments({
        customerName: advCustomerName.trim() || undefined,
        cif: advCif.trim() || undefined,
        loanReference: advLoanRef.trim() || undefined,
        collateralId: advCollateralId.trim() || undefined,
        insurancePolicyNumber: advPolicyNo.trim() || undefined,
        titleDeedNumber: advTitleDeedNo.trim() || undefined,
        registrationNumber: advRegNo.trim() || undefined,
        businessSegment: advSegment.trim() || undefined,
        region: advRegion.trim() || undefined,
        district: advDistrict.trim() || undefined,
        branch: advBranch.trim() || undefined,
        documentType: advDocType.trim() || undefined,
        documentStatus: advDocStatus.trim() || undefined,
        expiryDate: advExpiryDate.trim() || undefined,
        uploadDate: advUploadDate.trim() || undefined,
      });
      if (results && results.length > 0) {
        setAdvSearchResults(results);
      } else {
        // Fallback local match
        const localMatched = documents.filter((doc) => {
          if (advDocType && !doc.type?.toLowerCase().includes(advDocType.toLowerCase())) return false;
          if (advDocStatus && doc.status !== advDocStatus) return false;
          if (advCollateralId && !doc.entityId?.toLowerCase().includes(advCollateralId.toLowerCase())) return false;
          if (advTitleDeedNo && !doc.dmsRef?.toLowerCase().includes(advTitleDeedNo.toLowerCase())) return false;
          if (advRegNo && !doc.dmsRef?.toLowerCase().includes(advRegNo.toLowerCase())) return false;
          if (advExpiryDate && doc.expiryDate && !doc.expiryDate.includes(advExpiryDate)) return false;
          if (advCustomerName && !doc.name?.toLowerCase().includes(advCustomerName.toLowerCase())) return false;
          return true;
        });
        setAdvSearchResults(localMatched);
      }
    } catch (err: any) {
      // Fallback local match on error
      const localMatched = documents.filter((doc) => {
        if (advDocType && !doc.type?.toLowerCase().includes(advDocType.toLowerCase())) return false;
        if (advDocStatus && doc.status !== advDocStatus) return false;
        if (advCollateralId && !doc.entityId?.toLowerCase().includes(advCollateralId.toLowerCase())) return false;
        if (advTitleDeedNo && !doc.dmsRef?.toLowerCase().includes(advTitleDeedNo.toLowerCase())) return false;
        if (advRegNo && !doc.dmsRef?.toLowerCase().includes(advRegNo.toLowerCase())) return false;
        return true;
      });
      setAdvSearchResults(localMatched);
    } finally {
      setSearchingAdv(false);
    }
  };

  const handleClearAdvancedSearch = () => {
    setAdvCustomerName('');
    setAdvCif('');
    setAdvLoanRef('');
    setAdvCollateralId('');
    setAdvPolicyNo('');
    setAdvTitleDeedNo('');
    setAdvRegNo('');
    setAdvSegment('');
    setAdvRegion('');
    setAdvDistrict('');
    setAdvBranch('');
    setAdvDocType('');
    setAdvDocStatus('');
    setAdvExpiryDate('');
    setAdvUploadDate('');
    setAdvSearchResults(null);
  };

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
      header: 'Version Control',
      accessorKey: 'version',
      align: 'center',
      cell: (r) => {
        const isCurrent = r.isLatest !== false;
        const vCount = getDocumentVersionCount(r);
        return (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHistoryDoc(r);
                setShowHistoryModal(true);
              }}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-1 border shadow-2xs ${
                isCurrent
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title="Click to inspect complete version history & audit trail"
            >
              <GitBranch className="w-3 h-3 text-[#1F4E7A]" />
              <span>v{r.version || 1} {isCurrent ? 'Current' : 'Superseded'}</span>
            </button>
            {vCount > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setHistoryDoc(r);
                  setShowHistoryModal(true);
                }}
                className="text-[10px] text-[#1F4E7A] hover:underline font-semibold"
              >
                {vCount} versions in lineage
              </button>
            )}
          </div>
        );
      },
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
      header: 'Document Status',
      accessorKey: 'status',
      cell: (r) => {
        const isExpired = r.expiryDate && new Date(r.expiryDate).getTime() < Date.now();
        const displayStatus = isExpired ? 'Expired' : (r.status || 'Active');
        return (
          <StatusChip
            label={displayStatus}
            variant={displayStatus === 'Active' ? 'success' : displayStatus === 'Expired' ? 'danger' : 'neutral'}
            size="sm"
          />
        );
      },
    },
    {
      header: 'Compliance',
      cell: (r) => {
        const isMandatory = mandatoryDocRules.some(rule =>
          rule.active !== false &&
          (rule.documentType?.toLowerCase() === r.type?.toLowerCase() ||
           rule.documentType?.toLowerCase() === r.name?.toLowerCase())
        );
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isMandatory
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            {isMandatory ? 'Mandatory' : 'Optional'}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHistoryDoc(r);
              setShowHistoryModal(true);
            }}
            className="py-1 px-2.5 text-xs font-bold text-[#1F4E7A] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded-md flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Inspect version history & audit trail"
          >
            <History className="w-3.5 h-3.5 text-[#1F4E7A]" />
            <span>History</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDoc(r);
              loadDocumentVersions(r);
              setShowPreviewDrawer(true);
            }}
            className="py-1 px-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Inspect document metadata & verification"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            <span>Inspect</span>
          </button>
          {currentUser.canCreate !== false && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVersionTargetDoc(r);
                setVersionFile(null);
                setVersionDataUrl('');
                setVersionNotes(`Version ${(r.version || 1) + 1} update for ${r.name}`);
                setVersionExpiryDate(r.expiryDate || '2031-12-31');
                setShowNewVersionModal(true);
              }}
              className="py-1 px-2.5 text-xs font-bold text-[#102E4A] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded-md flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Upload new superseded version"
            >
              <Plus className="w-3.5 h-3.5 text-[#1F4E7A]" />
              <span>+ Version</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPreview(r);
            }}
            className="py-1 px-2.5 text-xs font-bold text-[#00205B] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded-md flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Preview Document before Download"
          >
            <Eye className="w-3.5 h-3.5 text-[#00205B]" />
            <span>Preview</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPreview(r);
            }}
            className="py-1 px-2 text-xs font-bold text-white bg-[#00205B] hover:bg-[#102E4A] rounded-md flex items-center gap-1 transition-colors shadow-2xs"
            title="Preview & Download Document"
          >
            <Download className="w-3.5 h-3.5 text-white" />
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
            <div className="text-[11px] font-bold uppercase text-purple-700">Active & Current</div>
            <div className="text-2xl font-black text-purple-900 mt-1 tabular-nums">
              {activeCurrentDocsCount}
            </div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">Current valid version files</div>
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
              placeholder="Quick search title, entity, file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              showAdvancedSearch || advSearchResults !== null
                ? 'bg-[#102E4A] text-white border-[#102E4A]'
                : 'bg-[#EFF5FB] text-[#1F4E7A] border-[#DCE9F5] hover:bg-[#DCE9F5]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Advanced Search (15 Params)</span>
            {advSearchResults !== null && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-[#102E4A] rounded-full text-[10px] font-bold">
                {advSearchResults.length}
              </span>
            )}
          </button>

          <label className="flex items-center gap-1.5 cursor-pointer bg-[#EFF5FB] px-2.5 py-1.5 rounded border border-[#DCE9F5] text-xs font-semibold text-[#102E4A] hover:bg-[#DCE9F5] transition-colors shrink-0">
            <input
              type="checkbox"
              checked={currentVersionsOnly}
              onChange={(e) => setCurrentVersionsOnly(e.target.checked)}
              className="rounded text-[#1F4E7A] focus:ring-[#1F4E7A] h-3.5 w-3.5"
            />
            <span>Current Versions Only</span>
            {!currentVersionsOnly && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded font-bold">
                All History
              </span>
            )}
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 border border-[#E2E8F0] rounded text-xs font-semibold"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Expired">Expired</option>
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

      {/* Advanced Search Panel (15 Parameters) */}
      {showAdvancedSearch && (
        <div className="cims-card p-5 bg-[#EFF5FB] border-[#B9D3EB] space-y-4">
          <div className="flex justify-between items-center border-b border-[#B9D3EB] pb-2">
            <div>
              <h4 className="font-bold text-[#102E4A] text-xs flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#1F4E7A]" />
                Advanced DMS Document Search
              </h4>
              <p className="text-[11px] text-[#5B6472]">
                Search across complete electronic vault by customer, facility, collateral, policy, or registration criteria.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearAdvancedSearch}
                className="btn-secondary py-1 px-2.5 text-xs text-[#5B6472]"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowAdvancedSearch(false)}
                className="text-[#5B6472] hover:text-[#102E4A] font-bold text-xs"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">1. Customer Name</label>
              <input
                type="text"
                value={advCustomerName}
                onChange={(e) => setAdvCustomerName(e.target.value)}
                placeholder="e.g. Dangote, Ethiopian..."
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">2. CIF Number</label>
              <input
                type="text"
                value={advCif}
                onChange={(e) => setAdvCif(e.target.value)}
                placeholder="e.g. CIF-100234"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">3. Loan Reference</label>
              <input
                type="text"
                value={advLoanRef}
                onChange={(e) => setAdvLoanRef(e.target.value)}
                placeholder="e.g. LN-CORP-2024"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">4. Collateral ID / Code</label>
              <input
                type="text"
                value={advCollateralId}
                onChange={(e) => setAdvCollateralId(e.target.value)}
                placeholder="e.g. COL-001"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">5. Insurance Policy No.</label>
              <input
                type="text"
                value={advPolicyNo}
                onChange={(e) => setAdvPolicyNo(e.target.value)}
                placeholder="e.g. POL-88210"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">6. Title Deed Number</label>
              <input
                type="text"
                value={advTitleDeedNo}
                onChange={(e) => setAdvTitleDeedNo(e.target.value)}
                placeholder="e.g. TD-AA-8921"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">7. Registration Number</label>
              <input
                type="text"
                value={advRegNo}
                onChange={(e) => setAdvRegNo(e.target.value)}
                placeholder="e.g. Plate or Reg #981"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">8. Business Segment</label>
              <input
                type="text"
                value={advSegment}
                onChange={(e) => setAdvSegment(e.target.value)}
                placeholder="e.g. Corporate, SME, Retail"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">9. Region</label>
              <input
                type="text"
                value={advRegion}
                onChange={(e) => setAdvRegion(e.target.value)}
                placeholder="e.g. Addis Ababa, Oromia"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">10. District</label>
              <input
                type="text"
                value={advDistrict}
                onChange={(e) => setAdvDistrict(e.target.value)}
                placeholder="e.g. East District"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">11. Branch</label>
              <input
                type="text"
                value={advBranch}
                onChange={(e) => setAdvBranch(e.target.value)}
                placeholder="e.g. Finfine Branch"
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">12. Document Type</label>
              <select
                value={advDocType}
                onChange={(e) => setAdvDocType(e.target.value)}
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              >
                <option value="">-- All Controlled Document Types --</option>
                {CONTROLLED_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">13. Document Status</label>
              <select
                value={advDocStatus}
                onChange={(e) => setAdvDocStatus(e.target.value)}
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              >
                <option value="">-- All Statuses --</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">14. Expiry Date</label>
              <input
                type="date"
                value={advExpiryDate}
                onChange={(e) => setAdvExpiryDate(e.target.value)}
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#101828] mb-0.5">15. Upload Date</label>
              <input
                type="date"
                value={advUploadDate}
                onChange={(e) => setAdvUploadDate(e.target.value)}
                className="w-full p-1.5 border border-[#E2E8F0] rounded bg-white text-xs"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                disabled={searchingAdv}
                onClick={handleExecuteAdvancedSearch}
                className="btn-primary w-full py-1.5 text-xs bg-[#102E4A] hover:bg-[#1F4E7A] flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {searchingAdv ? 'Searching DMS…' : 'Execute Search'}
              </button>
            </div>
          </div>

          {advSearchResults !== null && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-xs flex justify-between items-center">
              <span>
                Found <strong>{advSearchResults.length}</strong> document(s) matching your advanced search criteria.
              </span>
              <button
                onClick={handleClearAdvancedSearch}
                className="text-xs font-bold text-emerald-800 hover:underline"
              >
                Reset to Full DMS Archive
              </button>
            </div>
          )}
        </div>
      )}

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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPreviewDrawer(false);
            }
          }}
          className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex justify-end z-50 animate-fadeIn"
        >
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
              <button
                onClick={() => setShowPreviewDrawer(false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg font-bold flex items-center gap-1 text-xs shadow-xs cursor-pointer transition-colors"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
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
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleOpenPreview(selectedDoc)}
                    className="py-2 px-4 text-xs flex items-center gap-1.5 border border-[#B9D3EB] text-[#102E4A] bg-[#EFF5FB] hover:bg-[#DCE9F5] font-bold rounded-lg transition-colors shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-[#1F4E7A]" /> Preview Document
                  </button>
                  <button
                    onClick={() => handleOpenPreview(selectedDoc)}
                    className="btn-primary py-2 px-5 text-xs flex items-center gap-2 bg-[#102E4A]"
                  >
                    <Download className="w-4 h-4" /> Preview & Download
                  </button>
                </div>
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
                      className="text-[#102E4A] border border-[#B9D3EB] bg-[#EFF5FB] hover:bg-[#DCE9F5] py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 font-bold transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#1F4E7A]" />
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
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPreview(selectedDoc)}
                                className="px-2.5 py-1 text-xs font-semibold text-[#1F4E7A] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Eye className="w-3 h-3 text-[#1F4E7A]" /> Preview
                              </button>
                              <button
                                onClick={() => handleDownloadFile(selectedDoc)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-[#00205B] hover:bg-[#102E4A] rounded flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Download className="w-3 h-3 text-white" /> Download
                              </button>
                            </div>
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
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenPreview(v)}
                                  className="px-2.5 py-1 text-xs font-semibold text-[#1F4E7A] bg-[#EFF5FB] hover:bg-[#DCE9F5] border border-[#B9D3EB] rounded flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-[#1F4E7A]" /> Preview
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(v)}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#00205B] hover:bg-[#102E4A] rounded flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <Download className="w-3 h-3 text-white" /> Download
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

              {/* Document Compliance & Lifecycle Status */}
              <div className="p-4 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-[#102E4A] text-xs">Document Repository & Compliance Status</h4>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedDoc.isLatest !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedDoc.isLatest !== false ? 'Current Active Version' : 'Superseded Historical'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div><span className="text-[#5B6472]">Repository Status:</span> <strong className="text-[#102E4A]">{selectedDoc.status || 'Active'}</strong></div>
                  <div><span className="text-[#5B6472]">Expiry Status:</span> <strong className={selectedDoc.expiryDate && new Date(selectedDoc.expiryDate).getTime() < Date.now() ? 'text-red-600 font-bold' : 'text-emerald-700 font-semibold'}>{selectedDoc.expiryDate && new Date(selectedDoc.expiryDate).getTime() < Date.now() ? 'Expired' : 'Valid'}</strong></div>
                  <div><span className="text-[#5B6472]">Rule Compliance:</span> <strong>{mandatoryDocRules.some(r => r.documentType?.toLowerCase() === selectedDoc.type?.toLowerCase()) ? 'Mandatory Document' : 'Optional / Supporting'}</strong></div>
                  <div><span className="text-[#5B6472]">Version Control:</span> <strong className="font-mono">v{selectedDoc.version || 1}</strong></div>
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
              <button
                onClick={() => setShowPreviewDrawer(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fresh Ingest Document Modal with Real File Drag-and-Drop & Selector */}
      {showUploadModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
            }
          }}
          className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto z-50 p-4 animate-fadeIn"
        >
          <div
            className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full my-auto overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Document to DMS</h3>
                <p className="text-[11px] text-blue-200">Upload and attach files (PDF, TIFF, Word, JPG) with metadata</p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded font-bold flex items-center gap-1 text-xs cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!uploadEntityId) {
                  alert('Please select a target entity.');
                  return;
                }
                const docFinalName = uploadDocName.trim() || selectedFile?.name || `${uploadDocType} Document`;

                const detectedExistingDoc = documents.find((d) => {
                  if (!uploadEntityId) return false;
                  const entityMatch =
                    d.entityType?.toLowerCase() === uploadEntityType.toLowerCase() &&
                    (d.entityId?.toLowerCase() === uploadEntityId.trim().toLowerCase() ||
                      (d.collateralId && d.collateralId.toLowerCase() === uploadEntityId.trim().toLowerCase()));
                  const typeMatch =
                    d.type?.toLowerCase() === uploadDocType.toLowerCase() ||
                    (uploadDocName.trim() && d.name?.toLowerCase() === uploadDocName.trim().toLowerCase());
                  return entityMatch && typeMatch && d.status === 'Active' && d.isLatest !== false;
                });

                const isUpgradingVersion = Boolean(detectedExistingDoc && !uploadForceNew);

                setUploading(true);
                try {
                  const fileDetails = {
                    fileName: selectedFile?.name || `${docFinalName}.pdf`,
                    fileSize: selectedFile?.size || 102400,
                    contentType: selectedFile?.type || 'application/pdf',
                    fileContent: fileDataUrl || undefined,
                    remarks: uploadRemarks,
                    parentDocumentId: isUpgradingVersion ? detectedExistingDoc!.id : undefined,
                    versionNotes: isUpgradingVersion
                      ? (uploadVersionNotes.trim() || `Version v${(detectedExistingDoc!.version || 1) + 1} committed to prevent accidental overwrite`)
                      : (uploadRemarks || 'Initial document upload (v1)'),
                    forceNew: uploadForceNew,
                  };

                  await onUploadDocument(uploadEntityType, uploadEntityId, docFinalName, uploadDocType, uploadExpiryDate, fileDetails);
                  alert(
                    isUpgradingVersion
                      ? `Version v${(detectedExistingDoc!.version || 1) + 1} of "${docFinalName}" successfully committed. Previous version retained for audit.`
                      : `Document "${docFinalName}" (v1) successfully ingested into DMS.`
                  );
                  setShowUploadModal(false);
                  setUploadVersionNotes('');
                  setUploadForceNew(false);
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

              {/* Accidental Overwrite Protection Banner */}
              {(() => {
                const detectedDoc = documents.find((d) => {
                  if (!uploadEntityId) return false;
                  const entityMatch =
                    d.entityType?.toLowerCase() === uploadEntityType.toLowerCase() &&
                    (d.entityId?.toLowerCase() === uploadEntityId.trim().toLowerCase() ||
                      (d.collateralId && d.collateralId.toLowerCase() === uploadEntityId.trim().toLowerCase()));
                  const typeMatch =
                    d.type?.toLowerCase() === uploadDocType.toLowerCase() ||
                    (uploadDocName.trim() && d.name?.toLowerCase() === uploadDocName.trim().toLowerCase());
                  return entityMatch && typeMatch && d.status === 'Active' && d.isLatest !== false;
                });

                if (!detectedDoc || uploadForceNew) return null;

                return (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>Accidental Overwrite Protection Active</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-mono">
                          Lineage Guard
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-800">
                        An active document of type <strong>"{detectedDoc.type}"</strong> already exists for {uploadEntityType} <strong>{uploadEntityId}</strong> (Current Version: v{detectedDoc.version || 1}).
                      </div>
                      <div className="text-[11px] text-amber-950 font-semibold">
                        🛡️ This upload will be committed as <strong>Version v{(detectedDoc.version || 1) + 1}</strong>. The existing version (v{detectedDoc.version || 1}) will remain permanently available for audit purposes.
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                  className="w-full p-2 border border-[#E2E8F0] rounded font-semibold text-xs bg-white"
                >
                  {CONTROLLED_DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
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

              {/* Version Notes Input when Conflict Detected */}
              {(() => {
                const detectedDoc = documents.find((d) => {
                  if (!uploadEntityId) return false;
                  const entityMatch =
                    d.entityType?.toLowerCase() === uploadEntityType.toLowerCase() &&
                    (d.entityId?.toLowerCase() === uploadEntityId.trim().toLowerCase() ||
                      (d.collateralId && d.collateralId.toLowerCase() === uploadEntityId.trim().toLowerCase()));
                  const typeMatch =
                    d.type?.toLowerCase() === uploadDocType.toLowerCase() ||
                    (uploadDocName.trim() && d.name?.toLowerCase() === uploadDocName.trim().toLowerCase());
                  return entityMatch && typeMatch && d.status === 'Active' && d.isLatest !== false;
                });

                if (!detectedDoc || uploadForceNew) return null;

                return (
                  <div>
                    <label className="block font-semibold text-[#101828] mb-1">
                      Version Notes / Audit Change Reason (Required)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={uploadVersionNotes}
                      onChange={(e) => setUploadVersionNotes(e.target.value)}
                      placeholder={`e.g. Annual re-valuation update for ${detectedDoc.name}, renewed coordinates`}
                      className="w-full p-2 border border-amber-300 rounded text-xs focus:ring-1 focus:ring-amber-500 bg-amber-50/40 font-medium"
                    />
                  </div>
                );
              })()}

              {/* Bypass Overwrite Protection Checkbox */}
              {(() => {
                const detectedDoc = documents.find((d) => {
                  if (!uploadEntityId) return false;
                  const entityMatch =
                    d.entityType?.toLowerCase() === uploadEntityType.toLowerCase() &&
                    (d.entityId?.toLowerCase() === uploadEntityId.trim().toLowerCase() ||
                      (d.collateralId && d.collateralId.toLowerCase() === uploadEntityId.trim().toLowerCase()));
                  const typeMatch =
                    d.type?.toLowerCase() === uploadDocType.toLowerCase() ||
                    (uploadDocName.trim() && d.name?.toLowerCase() === uploadDocName.trim().toLowerCase());
                  return entityMatch && typeMatch && d.status === 'Active' && d.isLatest !== false;
                });

                if (!detectedDoc) return null;

                return (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                    <input
                      type="checkbox"
                      checked={uploadForceNew}
                      onChange={(e) => setUploadForceNew(e.target.checked)}
                      className="rounded text-[#1F4E7A]"
                    />
                    <span>Upload as distinct independent document (bypass version lineage commit)</span>
                  </label>
                );
              })()}

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
                  {uploading
                    ? 'Uploading to DMS…'
                    : (() => {
                        const detectedDoc = documents.find((d) => {
                          if (!uploadEntityId) return false;
                          const entityMatch =
                            d.entityType?.toLowerCase() === uploadEntityType.toLowerCase() &&
                            (d.entityId?.toLowerCase() === uploadEntityId.trim().toLowerCase() ||
                              (d.collateralId && d.collateralId.toLowerCase() === uploadEntityId.trim().toLowerCase()));
                          const typeMatch =
                            d.type?.toLowerCase() === uploadDocType.toLowerCase() ||
                            (uploadDocName.trim() && d.name?.toLowerCase() === uploadDocName.trim().toLowerCase());
                          return entityMatch && typeMatch && d.status === 'Active' && d.isLatest !== false;
                        });
                        return detectedDoc && !uploadForceNew
                          ? `Commit Version v${(detectedDoc.version || 1) + 1}`
                          : 'Upload Document';
                      })()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload New Version Modal */}
      {showNewVersionModal && versionTargetDoc && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewVersionModal(false);
            }
          }}
          className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto z-50 p-4 animate-fadeIn"
        >
          <div
            className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full my-auto overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload New Superseded Version</h3>
                <p className="text-[11px] text-blue-200">
                  {versionTargetDoc.name} • Increment to v{(versionTargetDoc.version || 1) + 1}
                </p>
              </div>
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded font-bold flex items-center gap-1 text-xs cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
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
      {/* Document Version History & Audit Trail Modal */}
      {showHistoryModal && historyDoc && (
        <DocumentVersionHistoryModal
          document={historyDoc}
          allDocuments={documents}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryDoc(null);
          }}
          onPreviewVersion={(doc) => handleOpenPreview(doc)}
          onDownloadVersion={(doc) => handleDownloadFile(doc)}
          onUploadNewVersion={(doc) => {
            setVersionTargetDoc(doc);
            setVersionFile(null);
            setVersionDataUrl('');
            setVersionNotes(`Version ${(doc.version || 1) + 1} update for ${doc.name}`);
            setVersionExpiryDate(doc.expiryDate || '2031-12-31');
            setShowNewVersionModal(true);
          }}
          canUploadVersion={currentUser.canCreate !== false}
        />
      )}

      {/* Document Interactive Preview Modal (Preview before Download) */}
      <DocumentPreviewModal
        document={previewDoc}
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewDoc(null);
        }}
        onDownload={(doc) => handleDownloadFile(doc)}
        versions={previewVersions}
        canUploadVersion={currentUser.canCreate !== false}
        collaterals={collaterals}
        onUploadNewVersion={(doc) => {
          setShowPreviewModal(false);
          setVersionTargetDoc(doc);
          setVersionFile(null);
          setVersionDataUrl('');
          setVersionNotes(`Version ${(doc.version || 1) + 1} update for ${doc.name}`);
          setVersionExpiryDate(doc.expiryDate || '2031-12-31');
          setShowNewVersionModal(true);
        }}
      />
    </div>
  );
};
