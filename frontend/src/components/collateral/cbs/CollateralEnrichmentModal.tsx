import React, { useState, useEffect } from 'react';
import {
  Edit,
  Save,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Building,
  User,
  MapPin,
  DollarSign,
  FileText,
  History,
  ShieldCheck,
  RefreshCw,
  Info,
  Upload,
  Download,
  FilePlus,
  Eye,
  Clock,
  FileCheck,
  Check,
  Plus,
  AlertCircle,
  Trash2,
  Calendar,
  Lock,
} from 'lucide-react';
import {
  Collateral,
  CollateralOwner,
  CollateralQualityFindingDto,
  Branch,
  BusinessSegment,
  OwnershipDocument,
  MandatoryDocumentRule,
  CimsException,
  UserSession,
} from '../../../types';
import { authenticatedFetch, cimsApi } from '../../../api/cimsApi';
import { FileUploadPreviewModal, FilePreviewData } from '../../common/FileUploadPreviewModal';

interface CollateralEnrichmentModalProps {
  collateral: Collateral;
  branches: Branch[];
  segments: BusinessSegment[];
  onClose: () => void;
  onSuccess: (updated: Collateral) => void;
  currentUser?: UserSession;
}

export const CollateralEnrichmentModal: React.FC<CollateralEnrichmentModalProps> = ({
  collateral,
  branches,
  segments,
  onClose,
  onSuccess,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'asset' | 'ownership' | 'location' | 'valuation' | 'org' | 'documents' | 'audit'>('asset');
  const [findings, setFindings] = useState<CollateralQualityFindingDto[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Documents & Exceptions State
  const [attachedDocs, setAttachedDocs] = useState<OwnershipDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [mandatoryRules, setMandatoryRules] = useState<MandatoryDocumentRule[]>([]);
  const [colExceptions, setColExceptions] = useState<CimsException[]>([]);
  const [docFeedback, setDocFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Document Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('Title Deed Certificate');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSize, setSelectedFileSize] = useState<number | undefined>(undefined);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [selectedFileDataUrl, setSelectedFileDataUrl] = useState('');
  const [preUploadPreview, setPreUploadPreview] = useState<FilePreviewData | null>(null);
  const [showPreUploadModal, setShowPreUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Exception Request Modal State
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [targetRequirement, setTargetRequirement] = useState('');
  const [exceptionType, setExceptionType] = useState('Missing Mandatory Document');
  const [exceptionSeverity, setExceptionSeverity] = useState('High');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionComments, setExceptionComments] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState(90);
  const [evidenceRef, setEvidenceRef] = useState('');
  const [isSubmittingException, setIsSubmittingException] = useState(false);

  // Form states
  const [description, setDescription] = useState(collateral.description || '');
  const [category, setCategory] = useState(collateral.category || 'Immovable Properties');
  const [type, setType] = useState(collateral.type || 'Commercial Property');
  const [ownerType, setOwnerType] = useState(collateral.ownerType || 'Borrower-owned');

  // Ownership state
  const initialOwners = collateral.owners && collateral.owners.length > 0 ? collateral.owners : [
    {
      id: '',
      name: '',
      ownerType: 'Individual',
      ownershipType: collateral.ownerType || 'Borrower-owned',
      idNumber: '',
      tin: '',
      phone: '',
      percentage: 100,
      relationship: 'Borrower',
      collateralId: collateral.id,
    } as CollateralOwner
  ];
  const [owners, setOwners] = useState<CollateralOwner[]>(initialOwners);

  // Property & Location state
  const [locationAddress, setLocationAddress] = useState(collateral.locationAddress || '');
  const [locationCity, setLocationCity] = useState(collateral.locationCity || 'Addis Ababa');
  const [locationRegion, setLocationRegion] = useState(collateral.locationRegion || 'Addis Ababa');
  const [locationSubcity, setLocationSubcity] = useState(collateral.locationSubcity || '');
  const [locationWoreda, setLocationWoreda] = useState(collateral.locationWoreda || '');
  const [locationKebele, setLocationKebele] = useState(collateral.locationKebele || '');
  const [locationZone, setLocationZone] = useState(collateral.locationZone || '');
  const [gpsCoordinates, setGpsCoordinates] = useState(collateral.gpsCoordinates || '');
  const [titleDeedNumber, setTitleDeedNumber] = useState(collateral.titleDeedNumber || '');
  const [propertyCertNumber, setPropertyCertNumber] = useState(collateral.propertyCertNumber || '');
  const [isUnderConstruction, setIsUnderConstruction] = useState(collateral.isUnderConstruction || false);
  const [constructionCompletionPct, setConstructionCompletionPct] = useState<number | undefined>(collateral.constructionCompletionPct);

  // Valuation state
  const [valuationAmount, setValuationAmount] = useState<number>(collateral.valuationAmount || 0);
  const [valuationDate, setValuationDate] = useState(collateral.valuationDate || new Date().toISOString().substring(0, 10));
  const [valuationMethod, setValuationMethod] = useState(collateral.valuationMethod || 'Cost Approach');
  const [haircut, setHaircut] = useState<number>(collateral.haircut || 0);
  const [limitContribution, setLimitContribution] = useState<number>(collateral.limitContribution || 0);
  const [insurableValue, setInsurableValue] = useState<number | undefined>(collateral.insurableValue);
  const [landValue, setLandValue] = useState<number | undefined>(collateral.landValue);

  // Movables & Machinery state
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState(collateral.vehiclePlateNumber || '');
  const [vehicleChassisNumber, setVehicleChassisNumber] = useState(collateral.vehicleChassisNumber || '');
  const [machinerySerialNo, setMachinerySerialNo] = useState(collateral.machinerySerialNo || '');

  // Org state
  const [branch, setBranch] = useState(collateral.branch || 'BRN-001');
  const [owningSegment, setOwningSegment] = useState(collateral.owningSegment || 'Corporate Banking');
  const [district, setDistrict] = useState(collateral.district || '');
  const [assignedCro, setAssignedCro] = useState(collateral.assignedCro || '');

  // Change Reason state
  const [changeReason, setChangeReason] = useState('');
  const [supportingDocRef, setSupportingDocRef] = useState('');

  const loadFindings = async () => {
    setLoadingFindings(true);
    try {
      const data = await cimsApi.getQualityFindings(collateral.id);
      setFindings(data || []);
    } catch (err) {
      console.error('Failed to load quality findings:', err);
    } finally {
      setLoadingFindings(false);
    }
  };

  const loadDocumentsAndExceptions = async () => {
    setLoadingDocs(true);
    try {
      const [allDocs, rules, allExceptions] = await Promise.all([
        cimsApi.getDocuments().catch(() => [] as OwnershipDocument[]),
        cimsApi.getMandatoryDocRules().catch(() => [] as MandatoryDocumentRule[]),
        cimsApi.getExceptionsList({ search: collateral.code || collateral.id }).catch(() => [] as CimsException[]),
      ]);

      const filteredDocs = (allDocs || []).filter(
        (d) =>
          d.collateralId === collateral.id ||
          d.collateralId === collateral.code ||
          (d.entityType === 'Collateral' && (d.entityId === collateral.id || d.entityId === collateral.code))
      );
      setAttachedDocs(filteredDocs);
      setMandatoryRules(rules || []);

      const filteredExceptions = (allExceptions || []).filter(
        (e) =>
          e.collateralId === collateral.id ||
          e.collateralId === collateral.code ||
          (e.entityType === 'Collateral' && (e.entityId === collateral.id || e.entityId === collateral.code))
      );
      setColExceptions(filteredExceptions);
    } catch (err) {
      console.error('Failed to load documents or exceptions:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadFindings();
    loadDocumentsAndExceptions();
  }, [collateral.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    if (!uploadDocName.trim()) {
      setUploadDocName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      setSelectedFileContent(base64);
      setSelectedFileDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocName.trim()) {
      setDocFeedback({ type: 'error', text: 'Document Name is required.' });
      return;
    }
    if (!uploadDocType.trim()) {
      setDocFeedback({ type: 'error', text: 'Document Category / Type is required.' });
      return;
    }

    setIsUploading(true);
    setDocFeedback(null);
    try {
      const currentUserStr = localStorage.getItem('cims.currentUser');
      const parsedUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      const uploader = currentUser?.username || parsedUser?.username || 'cro_user';

      let cType = 'application/pdf';
      if (selectedFileName.toLowerCase().endsWith('.png')) cType = 'image/png';
      else if (selectedFileName.toLowerCase().endsWith('.jpg') || selectedFileName.toLowerCase().endsWith('.jpeg')) cType = 'image/jpeg';
      else if (selectedFileName.toLowerCase().endsWith('.docx')) cType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      await cimsApi.uploadDocument(
        'Collateral',
        collateral.id,
        uploadDocName,
        uploadDocType,
        uploadExpiryDate || undefined,
        uploader,
        {
          fileName: selectedFileName || `${uploadDocName}.pdf`,
          fileSize: selectedFileSize || 102400,
          contentType: cType,
          fileContent: selectedFileContent || 'JVBERi0xLjQK...',
          remarks: uploadRemarks,
        }
      );

      setDocFeedback({ type: 'success', text: `Successfully uploaded "${uploadDocName}" to DMS vault.` });
      setShowUploadModal(false);
      setUploadDocName('');
      setUploadExpiryDate('');
      setUploadRemarks('');
      setSelectedFileName('');
      setSelectedFileContent('');
      setSelectedFileSize(undefined);

      await Promise.all([loadDocumentsAndExceptions(), loadFindings()]);
    } catch (err: any) {
      setDocFeedback({ type: 'error', text: err.message || 'Failed to upload document to DMS.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenExceptionModal = (reqName: string) => {
    setTargetRequirement(reqName);
    setExceptionType('Missing Mandatory Document');
    setExceptionSeverity('High');
    setExceptionReason('');
    setExceptionComments(`Grace period requested for submission of ${reqName}. Customer undertaking and initial inspection on file.`);
    setGracePeriodDays(90);
    setEvidenceRef('');
    setShowExceptionModal(true);
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionReason.trim()) {
      setDocFeedback({ type: 'error', text: 'Justification / Business Reason is mandatory for exception requests.' });
      return;
    }
    if (!exceptionComments.trim()) {
      setDocFeedback({ type: 'error', text: 'Risk mitigation comments & remarks are mandatory.' });
      return;
    }

    setIsSubmittingException(true);
    setDocFeedback(null);
    try {
      const currentUserStr = localStorage.getItem('cims.currentUser');
      const parsedUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      const submitter = currentUser?.username || parsedUser?.username || 'cro_user';

      const fullComments = `${exceptionComments.trim()} [Grace Period: ${gracePeriodDays} days]`;

      await cimsApi.submitCollateralExceptionRequest(
        {
          collateralId: collateral.id,
          entityType: 'Collateral',
          entityId: collateral.id,
          exceptionType,
          failedRequirement: targetRequirement,
          reason: exceptionReason.trim(),
          comments: fullComments,
          evidenceDocument: evidenceRef.trim() || undefined,
          severity: exceptionSeverity,
        },
        submitter
      );

      setDocFeedback({
        type: 'success',
        text: `Exception request for "${targetRequirement}" submitted successfully! Routed to Risk Approver workflow.`,
      });
      setShowExceptionModal(false);

      await Promise.all([loadDocumentsAndExceptions(), loadFindings()]);
    } catch (err: any) {
      setDocFeedback({ type: 'error', text: err.message || 'Failed to submit exception request.' });
    } finally {
      setIsSubmittingException(false);
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await authenticatedFetch(`/api/documents/${docId}/download`);
      if (!res.ok) throw new Error('Download failed with status ' + res.status);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setDocFeedback({ type: 'error', text: 'Failed to download document: ' + err.message });
    }
  };

  const missingDocFindings = findings.filter(
    (f) => f.fieldName.startsWith('document.') || f.message.toLowerCase().includes('document')
  );
  const missingMandatoryDocsCount = missingDocFindings.filter(
    (f) => f.mandatory || f.status === 'MISSING'
  ).length;

  const getRequiredDocTypes = (): { docType: string; description: string; ruleId?: string }[] => {
    const list: { docType: string; description: string; ruleId?: string }[] = [];
    const addedTypes = new Set<string>();

    missingDocFindings.forEach((f) => {
      const name = f.fieldName.replace('document.', '').trim();
      if (!addedTypes.has(name.toLowerCase())) {
        addedTypes.add(name.toLowerCase());
        list.push({
          docType: name,
          description: f.message || `Mandatory statutory requirement for ${category} (${type})`,
        });
      }
    });

    const catLower = (category || '').toLowerCase();
    const typeLower = (type || '').toLowerCase();
    mandatoryRules.forEach((r) => {
      const matchCat = !r.collateralCategory || r.collateralCategory.toLowerCase() === 'all' || catLower.includes(r.collateralCategory.toLowerCase());
      const matchType = !r.collateralType || r.collateralType.toLowerCase() === 'all' || typeLower.includes(r.collateralType.toLowerCase());
      if (matchCat && matchType && !addedTypes.has(r.documentType.toLowerCase())) {
        addedTypes.add(r.documentType.toLowerCase());
        list.push({
          docType: r.documentType,
          description: r.applicabilityCondition || `Required by Bank Policy for ${r.collateralCategory || 'Collateral'}`,
          ruleId: r.id,
        });
      }
    });

    if (list.length === 0) {
      if (catLower.includes('immovable') || catLower.includes('real') || catLower.includes('property')) {
        list.push(
          { docType: 'Title Deed Certificate', description: 'Statutory proof of property title for Mortgage registration under NBE directives.' },
          { docType: 'Valuation Report', description: 'Certified physical appraisal report by authorized professional valuer.' },
          { docType: 'Cadastral Site Plan', description: 'Municipal cadastral map indicating exact parcel boundaries and coordinates.' }
        );
      } else if (catLower.includes('vehicle') || catLower.includes('motor') || catLower.includes('transport')) {
        list.push(
          { docType: 'Vehicle Log Book (Libre)', description: 'Federal Transport Authority original log book with bank encumbrance.' },
          { docType: 'Valuation Report', description: 'Certified motor vehicle appraisal report with mechanical condition check.' },
          { docType: 'Commercial Registration', description: 'Valid business registration and commercial license.' }
        );
      } else if (catLower.includes('machinery') || catLower.includes('equipment')) {
        list.push(
          { docType: 'Commercial Invoice & Customs Declaration', description: 'Original purchase invoice, bill of lading, and customs clearance.' },
          { docType: 'Valuation Report', description: 'Certified engineering valuation report with serial verification.' }
        );
      } else {
        list.push(
          { docType: 'Ownership Title Document', description: 'Legal ownership certificate or title instrument.' },
          { docType: 'Valuation Report', description: 'Appraisal report establishing collateral market and forced sale value.' }
        );
      }
    }

    return list;
  };

  const getRequirementStatus = (docType: string) => {
    const attached = attachedDocs.find(
      (d) =>
        d.status !== 'Archived' &&
        d.verificationStatus !== 'Rejected' &&
        (d.type?.toLowerCase().includes(docType.toLowerCase()) ||
         docType.toLowerCase().includes(d.type?.toLowerCase() || '') ||
         d.name?.toLowerCase().includes(docType.toLowerCase()))
    );

    const approvedExc = colExceptions.find(
      (e) =>
        e.failedRequirement &&
        (e.failedRequirement.toLowerCase().includes(docType.toLowerCase()) ||
         docType.toLowerCase().includes(e.failedRequirement.toLowerCase())) &&
        ['Approved', 'Resolved', 'Authorized Exception / Management Override'].includes(e.status)
    );

    const pendingExc = colExceptions.find(
      (e) =>
        e.failedRequirement &&
        (e.failedRequirement.toLowerCase().includes(docType.toLowerCase()) ||
         docType.toLowerCase().includes(e.failedRequirement.toLowerCase())) &&
        ['Pending Exception Approval', 'Under Review', 'PENDING'].includes(e.status)
    );

    const finding = findings.find(
      (f) =>
        f.fieldName.toLowerCase().includes(docType.toLowerCase()) ||
        docType.toLowerCase().includes(f.fieldName.toLowerCase().replace('document.', ''))
    );

    if (attached) {
      return { status: 'VERIFIED' as const, doc: attached, exc: approvedExc || pendingExc, finding };
    }
    if (approvedExc || finding?.status === 'EXCEPTION_APPROVED') {
      return { status: 'EXCEPTION_APPROVED' as const, doc: undefined, exc: approvedExc, finding };
    }
    if (pendingExc || finding?.status === 'EXCEPTION_PENDING') {
      return { status: 'EXCEPTION_PENDING' as const, doc: undefined, exc: pendingExc, finding };
    }
    return { status: 'MISSING' as const, doc: undefined, exc: undefined, finding };
  };

  const handleOwnerChange = (index: number, field: keyof CollateralOwner, value: any) => {
    const updated = [...owners];
    updated[index] = { ...updated[index], [field]: value };
    setOwners(updated);
  };

  const handleAddOwner = () => {
    setOwners([
      ...owners,
      {
        id: '',
        name: '',
        ownerType: 'Individual',
        ownershipType: ownerType,
        idNumber: '',
        tin: '',
        phone: '',
        percentage: 0,
        relationship: 'Third-party',
        collateralId: collateral.id,
      } as CollateralOwner,
    ]);
  };

  const handleRemoveOwner = (index: number) => {
    if (owners.length <= 1) return;
    setOwners(owners.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (submitForChecker: boolean) => {
    setErrorMsg(null);
    if (!changeReason.trim()) {
      setErrorMsg('A Change Reason is required to document this enrichment.');
      setActiveTab('audit');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        description,
        category,
        type,
        ownerType,
        locationAddress,
        locationCity,
        locationRegion,
        locationSubcity,
        locationWoreda,
        locationKebele,
        locationZone,
        gpsCoordinates,
        titleDeedNumber,
        propertyCertNumber,
        isUnderConstruction,
        constructionCompletionPct,
        valuationAmount,
        valuationDate,
        valuationMethod,
        haircut,
        limitContribution,
        insurableValue,
        landValue,
        vehiclePlateNumber,
        vehicleChassisNumber,
        machinerySerialNo,
        branch,
        owningSegment,
        district,
        assignedCro,
        owners,
        changeReason,
        supportingDocRef,
        submitForChecker,
      };

      const res = await cimsApi.enrichCollateral(collateral.id, payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save enrichment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/40">
                CBS Imported Master
              </span>
              <h3 className="text-sm font-bold">Data Enrichment & Completion Workbench</h3>
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              Collateral Code: <strong>{collateral.code}</strong> | CBS Ref: <strong>{collateral.cbsCollateralRef || 'CBS-FEED'}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quality Findings Banner */}
        {findings.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50/90 border-b border-amber-200 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-amber-800">
                Data Quality Findings ({findings.length} items to address)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {findings.map((f, idx) => {
                const isDoc = f.fieldName.startsWith('document.') || f.message.toLowerCase().includes('document');
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (isDoc) setActiveTab('documents');
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border text-left transition-all ${
                      isDoc ? 'hover:scale-102 cursor-pointer shadow-2xs' : ''
                    } ${
                      f.mandatory
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                    }`}
                  >
                    <strong>{f.fieldName}:</strong> {f.message}
                    {isDoc && <span className="underline ml-0.5 font-bold text-[10px]">Fix in Docs &gt;</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-200 px-4 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('asset')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'asset'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Asset & Taxonomy
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ownership')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'ownership'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Ownership ({owners.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'location'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Location & Coordinates
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('valuation')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'valuation'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Valuation & Haircut
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('org')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'org'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Org & Assignment
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Documents & Exceptions
            {missingMandatoryDocsCount > 0 ? (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold ml-1">
                {missingMandatoryDocsCount}
              </span>
            ) : attachedDocs.length > 0 ? (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-semibold ml-1">
                {attachedDocs.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-3 font-semibold border-b-2 text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Change Reason *
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Asset & Taxonomy */}
          {activeTab === 'asset' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Collateral Category *</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Collateral Subtype *</label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">Operational Description *</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="Comprehensive description of the asset for CBAIMS operations..."
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Ownership Structure *</label>
                <select
                  value={ownerType}
                  onChange={(e) => setOwnerType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Borrower-owned">Borrower-owned</option>
                  <option value="Third-party-owned">Third-party-owned</option>
                  <option value="Joint-owned">Joint-owned</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Under Construction Flag</label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnderConstruction}
                      onChange={(e) => setIsUnderConstruction(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Property is currently under construction</span>
                  </label>
                </div>
              </div>

              {isUnderConstruction && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Completion Percentage (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={constructionCompletionPct ?? ''}
                    onChange={(e) => setConstructionCompletionPct(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. 65"
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. Ownership & Legal Details */}
          {activeTab === 'ownership' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">Legal Owners</h4>
                  <p className="text-slate-500">
                    Capture primary borrower or third-party legal ownership details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddOwner}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200"
                >
                  + Add Joint/Third-Party Owner
                </button>
              </div>

              {owners.map((owner, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Owner #{idx + 1}</span>
                    {owners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOwner(idx)}
                        className="text-rose-600 hover:text-rose-800 font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1">Legal Owner Name *</label>
                      <input
                        type="text"
                        value={owner.name}
                        onChange={(e) => handleOwnerChange(idx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                        placeholder="Full legal entity or person name"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Owner Type</label>
                      <select
                        value={owner.ownerType || 'Individual'}
                        onChange={(e) => handleOwnerChange(idx, 'ownerType', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="Individual">Individual</option>
                        <option value="Corporate">Corporate / Enterprise</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Ownership Share (%) *</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={owner.percentage}
                        onChange={(e) => handleOwnerChange(idx, 'percentage', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">National ID / Passport / Reg No</label>
                      <input
                        type="text"
                        value={owner.idNumber || ''}
                        onChange={(e) => handleOwnerChange(idx, 'idNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">TIN Number</label>
                      <input
                        type="text"
                        value={owner.tin || ''}
                        onChange={(e) => handleOwnerChange(idx, 'tin', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Relationship to Borrower</label>
                      <input
                        type="text"
                        value={owner.relationship || 'Borrower'}
                        onChange={(e) => handleOwnerChange(idx, 'relationship', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                        placeholder="e.g. Borrower, Spouse, Guarantor"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Location & Coordinates */}
          {activeTab === 'location' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">GPS Coordinates (Latitude, Longitude) *</label>
                <input
                  type="text"
                  value={gpsCoordinates}
                  onChange={(e) => setGpsCoordinates(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. 9.0227, 38.7468"
                />
                <span className="text-[11px] text-slate-500">Required for immovable properties and buildings</span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Title Deed / Property Cert Number *</label>
                <input
                  type="text"
                  value={titleDeedNumber}
                  onChange={(e) => setTitleDeedNumber(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. TD-AA-2024-99881"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Location Address *</label>
                <input
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="Street / Landmark / House No."
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">City / Town</label>
                <input
                  type="text"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Region</label>
                <input
                  type="text"
                  value={locationRegion}
                  onChange={(e) => setLocationRegion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Subcity / Zone</label>
                <input
                  type="text"
                  value={locationSubcity}
                  onChange={(e) => setLocationSubcity(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Woreda / Kebele</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Woreda"
                    value={locationWoreda}
                    onChange={(e) => setLocationWoreda(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Kebele"
                    value={locationKebele}
                    onChange={(e) => setLocationKebele(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Movable Specific Identifiers */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Vehicle Plate / Chassis (If Movable)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Plate No"
                    value={vehiclePlateNumber}
                    onChange={(e) => setVehiclePlateNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Chassis No"
                    value={vehicleChassisNumber}
                    onChange={(e) => setVehicleChassisNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. Valuation & Haircut */}
          {activeTab === 'valuation' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Bank-Assessed Valuation Amount (ETB) *</label>
                <input
                  type="number"
                  min="0"
                  value={valuationAmount}
                  onChange={(e) => setValuationAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Valuation Date *</label>
                <input
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Valuation Methodology</label>
                <select
                  value={valuationMethod}
                  onChange={(e) => setValuationMethod(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Cost Approach">Cost Approach (Replacement Cost)</option>
                  <option value="Market Comparison">Market Comparison Approach</option>
                  <option value="Income Capitalization">Income Capitalization Approach</option>
                  <option value="CBS Baseline">CBS Initial Value Baseline</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Haircut (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={haircut}
                  onChange={(e) => setHaircut(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Insurable Value (Excluding Land for Buildings)</label>
                <input
                  type="number"
                  min="0"
                  value={insurableValue ?? ''}
                  onChange={(e) => setInsurableValue(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="Basis for Insurance Adequacy Calculation"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Land Value</label>
                <input
                  type="number"
                  min="0"
                  value={landValue ?? ''}
                  onChange={(e) => setLandValue(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* 5. Org & Assignment */}
          {activeTab === 'org' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assigned Branch *</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.code}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Owning Segment *</label>
                <select
                  value={owningSegment}
                  onChange={(e) => setOwningSegment(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. North Addis District"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assigned CRO Officer *</label>
                <input
                  type="text"
                  value={assignedCro}
                  onChange={(e) => setAssignedCro(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. cro_north / Dawit Mekonnen"
                />
              </div>
            </div>
          )}

          {/* 6. Documents & Exceptions */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              {docFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    docFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {docFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{docFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold px-1"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Top Metrics & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/60 rounded-xl">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      missingMandatoryDocsCount === 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-800">
                      {missingMandatoryDocsCount === 0
                        ? 'All Mandatory Documents Satisfied / Verified'
                        : `${missingMandatoryDocsCount} Missing Mandatory Document(s)`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {attachedDocs.length} attached in DMS | {colExceptions.length} exception(s) on file
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadDocType('Supporting Document');
                      setUploadDocName('');
                      setShowUploadModal(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Document / Evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loadDocumentsAndExceptions();
                      loadFindings();
                    }}
                    disabled={loadingDocs}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg transition-colors"
                    title="Refresh Documents and Exceptions"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Section 1: Mandatory Document Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Mandatory Regulatory Documents (Title Deed, Valuation, Site Plan, Libre)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    CBS imported collaterals must satisfy NBE directives before credit facility activation.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {getRequiredDocTypes().map((req, idx) => {
                    const reqStatus = getRequirementStatus(req.docType);
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border transition-all ${
                          reqStatus.status === 'VERIFIED'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : reqStatus.status === 'EXCEPTION_APPROVED'
                            ? 'bg-purple-50/50 border-purple-200'
                            : reqStatus.status === 'EXCEPTION_PENDING'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-rose-50/50 border-rose-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">{req.docType}</span>
                              {reqStatus.status === 'VERIFIED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Verified in DMS
                                </span>
                              )}
                              {reqStatus.status === 'EXCEPTION_APPROVED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                  <ShieldCheck className="w-3 h-3 text-purple-600" />
                                  Exception Approved
                                </span>
                              )}
                              {reqStatus.status === 'EXCEPTION_PENDING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Exception Pending Review
                                </span>
                              )}
                              {reqStatus.status === 'MISSING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Missing Mandatory
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600">{req.description}</p>
                            {reqStatus.doc && (
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5">
                                <span>File: <strong>{reqStatus.doc.fileName || reqStatus.doc.name}</strong></span>
                                <span>&bull;</span>
                                <span>Uploaded: {reqStatus.doc.uploadDate?.substring(0, 10) || 'N/A'} by {reqStatus.doc.uploadedBy || 'COLLDOCOFF'}</span>
                              </div>
                            )}
                            {reqStatus.exc && (
                              <div className="text-[10px] text-slate-600 bg-white/70 px-2 py-1 rounded border border-slate-200 mt-1">
                                <strong>Exception Ref:</strong> {reqStatus.exc.id} | <strong>Reason:</strong> {reqStatus.exc.description || reqStatus.exc.resolutionNotes} | <strong>Approver:</strong> {reqStatus.exc.assignedToRole || 'Risk Approver'}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {reqStatus.status === 'VERIFIED' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reqStatus.doc && handleDownload(reqStatus.doc.id, reqStatus.doc.fileName || reqStatus.doc.name)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold flex items-center gap-1 transition-colors text-[11px]"
                                >
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadDocType(req.docType);
                                    setUploadDocName(req.docType);
                                    setShowUploadModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-semibold flex items-center gap-1 transition-colors text-[11px]"
                                >
                                  <Upload className="w-3 h-3" />
                                  New Version
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadDocType(req.docType);
                                    setUploadDocName(req.docType);
                                    setShowUploadModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1 transition-colors shadow-2xs text-[11px]"
                                >
                                  <Upload className="w-3 h-3" />
                                  Upload Document
                                </button>
                                {reqStatus.status === 'MISSING' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenExceptionModal(req.docType)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded font-semibold flex items-center gap-1 transition-colors shadow-2xs text-[11px]"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Request Exception
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Attached Documents Repository (DMS) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Attached Collateral Documents (DMS Vault)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Total: {attachedDocs.length} files digitized
                  </span>
                </div>

                {attachedDocs.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No Documents Uploaded for this Collateral</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                      CBS (FLEXCUBE) records do not carry digitized document attachments. Use the upload button above to attach original title deeds, inspection memos, or supporting certificates.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadDocType('Title Deed Certificate');
                        setUploadDocName('');
                        setShowUploadModal(true);
                      }}
                      className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload First Document
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Document Title</th>
                          <th className="py-2 px-3">Category / Type</th>
                          <th className="py-2 px-3">File Name / Size</th>
                          <th className="py-2 px-3">Uploaded By</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attachedDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {doc.name}
                              {doc.version && doc.version > 1 && (
                                <span className="ml-1 text-[10px] text-blue-600 font-normal">v{doc.version}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{doc.type}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {doc.fileName || 'document.pdf'}
                              {doc.fileSize ? ` (${Math.round(doc.fileSize / 1024)} KB)` : ''}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{doc.uploadedBy || 'CRO'}</td>
                            <td className="py-2 px-3 text-slate-500">{doc.uploadDate?.substring(0, 10) || 'N/A'}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  doc.verificationStatus === 'Verified'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : doc.verificationStatus === 'Rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {doc.verificationStatus || doc.status || 'Active'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDownload(doc.id, doc.fileName || doc.name)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Exceptions & Management Overrides Registry */}
              {colExceptions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-4 h-4 text-purple-600" />
                      Exceptions & Management Overrides Registry
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {colExceptions.length} registered exception(s)
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Exception ID</th>
                          <th className="py-2 px-3">Requirement</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Approver Role</th>
                          <th className="py-2 px-3">Justification & Remarks</th>
                          <th className="py-2 px-3">Detected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {colExceptions.map((exc) => (
                          <tr key={exc.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-blue-700">{exc.id}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{exc.failedRequirement}</td>
                            <td className="py-2 px-3 text-slate-600">{exc.exceptionType}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ['Approved', 'Resolved', 'Authorized Exception / Management Override'].includes(exc.status)
                                    ? 'bg-purple-100 text-purple-800'
                                    : ['Pending Exception Approval', 'Under Review'].includes(exc.status)
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {exc.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{exc.assignedToRole || 'Risk Approver'}</td>
                            <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={exc.description || exc.resolutionNotes}>
                              {exc.description || exc.resolutionNotes}
                            </td>
                            <td className="py-2 px-3 text-slate-500">{exc.detectedAt?.substring(0, 10) || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Change Reason & Audit */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <strong>Provenance Guarantee (Section 6.3):</strong> Every modified field will be logged to
                immutable provenance tables comparing the original CBS value against your new CBAIMS operational value.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Change Reason / Justification <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="State the business and operational reason for completing or correcting this collateral data..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Supporting Document Reference</label>
                <input
                  type="text"
                  value={supportingDocRef}
                  onChange={(e) => setSupportingDocRef(e.target.value)}
                  placeholder="e.g. DOC-VAL-2026-001 / Title Deed Hardcopy Memo Ref"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="btn-primary py-1.5 px-4 font-semibold flex items-center gap-1.5 shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit for Checker Approval
            </button>
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Document / Evidence
                </h4>
                <p className="text-[11px] text-blue-100">
                  Target Collateral: <strong>{collateral.code}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Category / Type *</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => {
                    setUploadDocType(e.target.value);
                    if (!uploadDocName.trim() || uploadDocName === uploadDocType) {
                      setUploadDocName(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                >
                  <option value="Title Deed Certificate">Title Deed Certificate / Ownership Certificate</option>
                  <option value="Valuation Report">Valuation Report / Appraisal Certificate</option>
                  <option value="Cadastral Site Plan">Cadastral Site Plan / Parcel Map</option>
                  <option value="Vehicle Log Book (Libre)">Vehicle Log Book (Libre)</option>
                  <option value="Commercial Registration">Commercial Registration / Trade License</option>
                  <option value="Site Inspection Report">Site Inspection Report & Verification Photos</option>
                  <option value="Legal Opinion">Legal Opinion / Search Report</option>
                  <option value="Board Resolution">Board Resolution / Spousal Consent</option>
                  <option value="Tax Clearance Certificate">Tax Clearance Certificate</option>
                  <option value="Customs Declaration">Customs Declaration / Commercial Invoice</option>
                  <option value="Insurance Policy Schedule">Insurance Policy Schedule / Cover Note</option>
                  <option value="Other Supporting Document">Other Supporting Document / Memo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Title / Name *</label>
                <input
                  type="text"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  placeholder="e.g. Title Deed - Bole Subcity Parcel 104"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Select File (PDF, DOCX, PNG, JPG) *</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFileName && (
                  <div className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{selectedFileName}</span>
                      <span className="text-[10px] text-slate-500 ml-2 font-mono">
                        ({Math.round((selectedFileSize || 0) / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreUploadPreview({
                          fileName: selectedFileName,
                          fileSize: selectedFileSize,
                          fileContent: selectedFileContent,
                          fileUrl: selectedFileDataUrl,
                        });
                        setShowPreUploadModal(true);
                      }}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview File
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Expiry Date (If applicable)</label>
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Vault Entity Type</label>
                  <input
                    type="text"
                    value="Collateral"
                    disabled
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Custody / Verification Remarks</label>
                <textarea
                  rows={2}
                  value={uploadRemarks}
                  onChange={(e) => setUploadRemarks(e.target.value)}
                  placeholder="e.g. Scanned from physical document deposited in Branch custody vault..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload to DMS Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Exception Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-amber-600 to-rose-700 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Request Exception / Management Override
                </h4>
                <p className="text-[11px] text-amber-100">
                  Collateral: <strong>{collateral.code}</strong> | Requirement: <strong>{targetRequirement}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExceptionModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="p-4 space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                <strong>Governance Rule:</strong> Missing mandatory documents prevent loan facility activation unless an authorized exception request is submitted and formally approved by a configured Risk Approver or Branch Checker.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Exception Type *</label>
                  <select
                    value={exceptionType}
                    onChange={(e) => setExceptionType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    required
                  >
                    <option value="Missing Mandatory Document">Missing Mandatory Document</option>
                    <option value="Deferred Document Submission">Deferred Document Submission</option>
                    <option value="Valuation Exception">Valuation Exception / Stale Valuation</option>
                    <option value="Temporary Land Holding Certificate">Temporary Land Holding Certificate</option>
                    <option value="Priority Perfection Clarification">Priority Perfection Clarification</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Exception Severity *</label>
                  <select
                    value={exceptionSeverity}
                    onChange={(e) => setExceptionSeverity(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    required
                  >
                    <option value="High">High (Standard Mandatory Document)</option>
                    <option value="Critical">Critical (First-Degree Mortgage Title)</option>
                    <option value="Medium">Medium (Supporting Technical Schedule)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Business Justification / Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Explain why this mandatory document is currently missing, in transit, or undergoing re-registration..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Risk Mitigation Remarks & Undertaking <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={exceptionComments}
                  onChange={(e) => setExceptionComments(e.target.value)}
                  placeholder="Detail risk mitigants (e.g., customer signed 30-day undertaking letter, physical certified copy verified)..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Grace Period (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Evidence / Undertaking Ref</label>
                  <input
                    type="text"
                    value={evidenceRef}
                    onChange={(e) => setEvidenceRef(e.target.value)}
                    placeholder="e.g. UND-2026-881 / Land Bureau Receipt"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingException}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmittingException ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit Exception Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Upload File Preview Modal (Preview before submit) */}
      <FileUploadPreviewModal
        isOpen={showPreUploadModal}
        onClose={() => {
          setShowPreUploadModal(false);
          setPreUploadPreview(null);
        }}
        fileData={preUploadPreview}
      />
    </div>
  );
};

