import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  UserCheck,
  Eye,
  AlertCircle,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Paperclip,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  FileCheck,
  Calendar,
  Building,
  DollarSign,
  Layers,
  CheckCircle2,
  History,
  AlertOctagon,
  ChevronDown,
  Info,
  ArrowRight,
  ExternalLink,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  WorkflowTask,
  ApprovalHistory,
  Delegation,
  UserSession,
  Customer,
  LoanAccount,
  Collateral,
  InsurancePolicy,
  OwnershipDocument,
  LoanCollateralLink,
  CimsException,
  Branch,
  ApprovedInsurer,
} from '../../types';
import { StatusChip } from '../layout/StatusChip';
import { DocumentPreviewModal } from '../documents/DocumentPreviewModal';
import { cimsApi } from '../../api/cimsApi';

interface MakerCheckerInboxProps {
  tasks: WorkflowTask[];
  delegations: Delegation[];
  allUsers: UserSession[];
  currentUser: UserSession;
  customers?: Customer[];
  facilities?: LoanAccount[];
  collaterals?: Collateral[];
  policies?: InsurancePolicy[];
  documents?: OwnershipDocument[];
  links?: LoanCollateralLink[];
  exceptions?: CimsException[];
  branches?: Branch[];
  insurers?: ApprovedInsurer[];
  onApproveTask: (taskId: string, comments: string) => Promise<void>;
  onRejectTask: (taskId: string, comments: string) => Promise<void>;
  onReturnTask: (taskId: string, correctionNote: string) => Promise<void>;
  onResubmitTask: (taskId: string) => Promise<void>;
  onBulkApprove: (taskIds: string[], comments: string) => Promise<void>;
  onCreateDelegation: (delegation: Partial<Delegation>) => Promise<void>;
  onRevokeDelegation: (id: string) => Promise<void>;
  onReload?: () => Promise<void>;
}

// 4-Part Validation Result Model (§Requirement 5)
interface UnderstandableValidation {
  title: string;
  category: 'Coverage' | 'Tenor' | 'Governance' | 'Documentation' | 'Exposure' | 'Allocation' | 'Third-Party';
  checked: string;
  found: string;
  result: 'PASSED' | 'WARNING' | 'FAILED' | 'NOT_EVALUATED';
  nextStep: string;
}

export const MakerCheckerInbox: React.FC<MakerCheckerInboxProps> = ({
  tasks,
  delegations,
  allUsers,
  currentUser,
  customers = [],
  facilities = [],
  collaterals = [],
  policies = [],
  documents = [],
  links = [],
  exceptions = [],
  branches = [],
  insurers = [],
  onApproveTask,
  onRejectTask,
  onReturnTask,
  onResubmitTask,
  onBulkApprove,
  onCreateDelegation,
  onRevokeDelegation,
  onReload,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'pending' | 'my-submissions' | 'delegations'>('pending');

  // Selected Task & Detail View
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [showDetailScreen, setShowDetailScreen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');

  // Multi-selection for bulk action
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Checker Decision & Comments
  const [checkerRemarks, setCheckerRemarks] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'Approve' | 'Reject' | 'Return' | null>(null);
  const [persistedOutcome, setPersistedOutcome] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Approval History for Selected Task
  const [taskHistory, setTaskHistory] = useState<ApprovalHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<OwnershipDocument | null>(null);

  // Delegation Modal
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateUserId, setDelegateUserId] = useState(allUsers[0]?.userId || '');
  const [delegationStart, setDelegationStart] = useState(new Date().toISOString().substring(0, 10));
  const [delegationEnd, setDelegationEnd] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10)
  );
  const [delegationReason, setDelegationReason] = useState('Annual leave delegation');

  // Load Task History when selected task changes
  useEffect(() => {
    if (selectedTask?.id) {
      setHistoryLoading(true);
      cimsApi
        .getTaskHistory(selectedTask.id)
        .then((hist) => setTaskHistory(hist || []))
        .catch(() => setTaskHistory([]))
        .finally(() => setHistoryLoading(false));
    } else {
      setTaskHistory([]);
    }
  }, [selectedTask?.id]);

  // Active delegation banner
  const activeDelegation = delegations.find(
    (d) => (d.delegatorId === currentUser.userId || d.delegateId === currentUser.userId) && d.status === 'Active'
  );

  // Helper: Calculate Waiting Time and SLA Status
  const getWaitingTimeInfo = (submittedAt?: string) => {
    if (!submittedAt) return { text: 'N/A', hours: 0, isOverdue: false, badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
    const date = new Date(submittedAt);
    if (isNaN(date.getTime())) return { text: 'N/A', hours: 0, isOverdue: false, badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
    const now = Date.now();
    const diffMs = Math.max(0, now - date.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = totalMinutes / 60;
    const days = Math.floor(hours / 24);
    const remHours = Math.floor(hours % 24);
    const remMins = totalMinutes % 60;

    let text = '';
    if (days > 0) {
      text = `${days}d ${remHours}h`;
    } else if (remHours > 0) {
      text = `${remHours}h ${remMins}m`;
    } else {
      text = `${remMins}m`;
    }

    if (hours > 24) {
      return { text, hours, isOverdue: true, badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold' };
    }
    if (hours >= 4) {
      return { text, hours, isOverdue: false, badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-medium' };
    }
    return { text, hours, isOverdue: false, badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  // Helper: Friendly Action Type Label
  const formatActionType = (actionType?: string) => {
    if (!actionType) return 'Standard Review';
    switch (actionType) {
      case 'APPROVE_EXCEPTION':
        return 'Exception Override';
      case 'POLICY_RENEWAL':
      case 'RENEW_POLICY':
        return 'Policy Renewal';
      case 'NEW_POLICY':
      case 'REGISTER_POLICY':
        return 'New Policy Registration';
      case 'AMEND_POLICY':
      case 'POLICY_AMENDMENT':
        return 'Policy Amendment';
      case 'CLOSE_POLICY':
      case 'POLICY_CLOSURE':
        return 'Policy Closure';
      case 'COLLATERAL_REGISTRATION':
      case 'REGISTER_COLLATERAL':
        return 'Collateral Registration';
      case 'COLLATERAL_AMENDMENT':
      case 'AMEND_COLLATERAL':
        return 'Collateral Amendment';
      case 'COLLATERAL_LINK':
      case 'LINK_COLLATERAL':
        return 'Collateral-to-Loan Link';
      case 'RELEASE_COLLATERAL':
      case 'COLLATERAL_RELEASE':
        return 'Collateral Release';
      default:
        return actionType.replace(/_/g, ' ');
    }
  };

  // Helper: Resolve Comprehensive Context for a Task
  const resolveTaskContext = (task: WorkflowTask) => {
    let payload: any = {};
    if (task.payloadDiffJson) {
      try {
        payload = JSON.parse(task.payloadDiffJson);
      } catch {
        payload = {};
      }
    }

    // Match Exception if entity is exception
    let exception: CimsException | undefined = exceptions.find(
      (e) =>
        e.id === task.entityId ||
        e.id === payload.exceptionId ||
        e.id === payload.id
    );

    // Match Link if entity is link
    let activeLink: LoanCollateralLink | undefined = links.find(
      (l) =>
        l.id === task.entityId ||
        l.id === payload.linkId ||
        l.id === payload.id
    );
    if (!activeLink && payload.collateralId && payload.loanAccountId) {
      activeLink = links.find(
        (l) =>
          l.collateralId === payload.collateralId &&
          (l.loanAccountId === payload.loanAccountId || (l as any).facilityId === payload.loanAccountId)
      );
    }

    // Match Collateral
    let collateral: Collateral | undefined = collaterals.find(
      (c) =>
        c.id === task.entityId ||
        c.id === payload.collateralId ||
        c.id === payload.id ||
        c.code === task.entityId ||
        c.registrationNumber === task.entityId ||
        (activeLink && c.id === activeLink.collateralId) ||
        (exception && (exception.entityType === 'Collateral' || (exception as any).entityType === 'Collateral Asset') &&
          (c.id === exception.entityId || c.code === exception.entityId))
    );

    // Match Policy
    let policy: InsurancePolicy | undefined = policies.find(
      (p) =>
        p.id === task.entityId ||
        p.policyNumber === task.entityId ||
        p.id === payload.policyId ||
        p.policyNumber === payload.policyNumber ||
        (exception && (exception.entityType === 'Insurance Policy' || exception.entityType === 'Policy') &&
          (p.id === exception.entityId || p.policyNumber === exception.entityId))
    );

    // If collateral wasn't matched directly, check if policy points to one
    if (!collateral && policy?.collateralId) {
      collateral = collaterals.find((c) => c.id === policy?.collateralId || c.code === policy?.collateralId);
    }
    // If policy wasn't matched directly, check if collateral has one
    if (!policy && collateral) {
      policy = policies.find((p) => p.collateralId === collateral?.id || p.collateralId === collateral?.code);
    }

    // Match Preceding Policy for Renewals
    let previousPolicy: InsurancePolicy | undefined = undefined;
    if (policy?.renewedFromPolicyId) {
      previousPolicy = policies.find((p) => p.id === policy?.renewedFromPolicyId || p.policyNumber === policy?.renewedFromPolicyId);
    } else if (payload.renewedFromPolicyId) {
      previousPolicy = policies.find((p) => p.id === payload.renewedFromPolicyId || p.policyNumber === payload.renewedFromPolicyId);
    }

    // Match Customer
    let customer: Customer | undefined = customers.find(
      (c) =>
        c.id === task.entityId ||
        c.cif === task.entityId ||
        c.id === payload.customerId ||
        c.cif === payload.customerId ||
        c.id === collateral?.customerId ||
        c.cif === collateral?.customerId ||
        c.id === policy?.customerId ||
        c.cif === policy?.customerId
    );

    // Match Facility / Linked Loans
    const taskFacilities: LoanAccount[] = facilities.filter((f) => {
      if (
        f.id === task.entityId ||
        f.id === payload.facilityId ||
        f.id === payload.loanAccountId ||
        f.loanReference === task.entityId ||
        f.lineCode === task.entityId
      )
        return true;
      if (activeLink && (f.id === activeLink.loanAccountId || (activeLink as any).facilityId === f.id || f.lineCode === activeLink.loanAccountId))
        return true;
      if (collateral) {
        const hasLink = links.some(
          (l) =>
            (l.collateralId === collateral?.id || l.collateralId === collateral?.code) &&
            (l.loanAccountId === f.id || (l as any).facilityId === f.id || l.loanAccountId === f.lineCode)
        );
        if (hasLink) return true;
      }
      if (customer && (f.customerId === customer.id || f.customerId === customer.cif)) return true;
      return false;
    });

    // If customer wasn't matched directly, inherit from linked facility
    if (!customer && taskFacilities.length > 0) {
      customer = customers.find((c) => c.id === taskFacilities[0].customerId || c.cif === taskFacilities[0].customerId);
    }

    // Match Existing Links
    const relevantLinks = links.filter(
      (l) =>
        (collateral && (l.collateralId === collateral.id || l.collateralId === collateral.code)) ||
        (customer && (l.customerId === customer.id || (l as any).borrowerCif === customer.cif))
    );

    // Match Documents
    const relevantDocs = documents.filter((d) => {
      if (collateral && (d.entityId === collateral.id || d.entityId === collateral.code)) return true;
      if (policy && (d.entityId === policy.id || d.entityId === policy.policyNumber)) return true;
      if (customer && (d.entityId === customer.id || d.entityId === customer.cif)) return true;
      if (activeLink && (d.entityId === activeLink.id || d.entityId === activeLink.collateralId)) return true;
      if (exception && (d.entityId === exception.id || (exception.evidenceDocument && d.name?.includes(exception.evidenceDocument)))) return true;
      if (payload.documentId && d.id === payload.documentId) return true;
      if (payload.documentIds && Array.isArray(payload.documentIds) && payload.documentIds.includes(d.id)) return true;
      if (payload.evidenceDocument && (d.name?.includes(payload.evidenceDocument) || d.type?.includes(payload.evidenceDocument))) return true;
      return false;
    });

    // Submitting Branch
    const makerUser = allUsers.find((u) => u.userId === task.makerId || u.username === task.makerId);
    const branchName =
      makerUser?.branch ||
      customer?.branch ||
      collateral?.branch ||
      branches.find((b) => b.code === customer?.branch || b.name === customer?.branch)?.name ||
      'Main Corporate Branch';

    return {
      payload,
      customer,
      collateral,
      policy,
      previousPolicy,
      exception,
      activeLink,
      taskFacilities,
      relevantLinks,
      relevantDocs,
      makerUser,
      branchName,
    };
  };

  // Helper: Evaluate Understandable 4-Part Validations (§Requirement 5)
  const evaluateUnderstandableValidations = (task: WorkflowTask): UnderstandableValidation[] => {
    const ctx = resolveTaskContext(task);
    const checks: UnderstandableValidation[] = [];

    // 1. Maker-Checker Segregation of Duties (Four-Eyes Principle)
    const isMakerSelf = Boolean(
      task.makerId?.toLowerCase() === currentUser.username?.toLowerCase() ||
      task.makerId?.toLowerCase() === currentUser.userId?.toLowerCase() ||
      (task.makerId?.toLowerCase() + '_user') === currentUser.username?.toLowerCase() ||
      (currentUser.username?.toLowerCase() + '_user') === task.makerId?.toLowerCase()
    );

    checks.push({
      title: 'Maker-Checker Segregation of Duties',
      category: 'Governance',
      checked: 'Segregation of duties check enforcing the Four-Eyes Principle (§2.1 Dual Control Matrix). Maker cannot self-authorize.',
      found: `Maker ID: ${task.makerId || 'Unknown'} | Current Reviewer: ${currentUser.username} (${currentUser.role}).`,
      result: isMakerSelf ? 'FAILED' : 'PASSED',
      nextStep: isMakerSelf
        ? 'Hard-Stop: Self-approval is strictly prohibited by regulatory dual-control guidelines. Another independent checker must authorize this request.'
        : 'Requirement satisfied. Independent checker verification permitted to proceed.',
    });

    // 2. Insurance Sum Insured vs Collateral Value / Exposure Check
    const sumInsured = Number(ctx.policy?.insuredAmount || (ctx.policy as any)?.sumInsured || ctx.payload?.sumInsured || ctx.payload?.insuredAmount || 0);
    const collateralValue = Number(ctx.collateral?.valuationAmount || (ctx.collateral as any)?.marketValue || ctx.payload?.marketValue || ctx.payload?.collateralValue || 0);
    const outstandingExposure = ctx.taskFacilities.reduce((acc, f) => acc + Number(f.outstandingBalance || 0), 0);

    if (sumInsured > 0 || collateralValue > 0) {
      const benchmarkValue = collateralValue > 0 ? collateralValue : outstandingExposure;
      const shortfallOrSurplus = sumInsured - benchmarkValue;
      const coverageRatio = benchmarkValue > 0 ? Math.round((sumInsured / benchmarkValue) * 100) : 100;

      if (shortfallOrSurplus < 0) {
        checks.push({
          title: 'Insurance Coverage Sufficiency Check',
          category: 'Coverage',
          checked: 'Policy Sum Insured evaluated against the collateral valuation / outstanding credit requirement.',
          found: `Sum Insured: ETB ${sumInsured.toLocaleString()} vs Benchmark Requirement: ETB ${benchmarkValue.toLocaleString()}. Shortfall: ETB ${Math.abs(shortfallOrSurplus).toLocaleString()} (Coverage: ${coverageRatio}%).`,
          result: coverageRatio < 80 ? 'FAILED' : 'WARNING',
          nextStep:
            coverageRatio < 80
              ? 'Hard-Stop: Severe collateral under-insurance detected (<80%). Return to maker to obtain an insurance endorsement increasing the sum insured, or attach a Board/Credit Committee approved exception memo.'
              : 'Warning: Policy coverage is below 100% of collateral value. Review risk acceptance rationale or confirm if approved second-loss co-insurance is in place before approving.',
        });
      } else {
        checks.push({
          title: 'Insurance Coverage Sufficiency Check',
          category: 'Coverage',
          checked: 'Policy Sum Insured evaluated against collateral market value requirement.',
          found: `Sum Insured: ETB ${sumInsured.toLocaleString()} vs Collateral Value: ETB ${benchmarkValue.toLocaleString()}. Surplus: +ETB ${shortfallOrSurplus.toLocaleString()} (Coverage: ${coverageRatio}%).`,
          result: 'PASSED',
          nextStep: 'Adequate coverage verified. Meets prudential collateral security guidelines.',
        });
      }
    }

    // 3. Policy Tenor & Expiry Validity Check
    const expiryDateStr = ctx.policy?.expiryDate || ctx.payload?.expiryDate || ctx.payload?.newExpiryDate;
    if (expiryDateStr) {
      const expiry = new Date(expiryDateStr);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysUntilExpiry <= 0) {
        checks.push({
          title: 'Policy Validity & Expiry Timeline',
          category: 'Tenor',
          checked: 'Insurance policy effective validity period and expiration horizon.',
          found: `Policy expiration date is ${expiryDateStr} (${Math.abs(daysUntilExpiry)} days past expiration).`,
          result: 'FAILED',
          nextStep: 'Hard-Stop: The submitted policy has already expired. Return to maker to attach current valid renewal schedule and premium receipt.',
        });
      } else if (daysUntilExpiry < 30) {
        checks.push({
          title: 'Policy Validity & Expiry Timeline',
          category: 'Tenor',
          checked: 'Insurance policy effective validity period and expiration horizon.',
          found: `Policy expiration date is ${expiryDateStr} (${daysUntilExpiry} days remaining before lapse).`,
          result: 'WARNING',
          nextStep: 'Warning: Policy expires in less than 30 days. Recommend issuing renewal reminder notice to borrower.',
        });
      } else {
        checks.push({
          title: 'Policy Validity & Expiry Timeline',
          category: 'Tenor',
          checked: 'Insurance policy effective validity period and expiration horizon.',
          found: `Policy is active and valid until ${expiryDateStr} (${daysUntilExpiry} days remaining).`,
          result: 'PASSED',
          nextStep: 'Valid policy horizon confirmed.',
        });
      }
    }

    // 4. Renewal Continuous Coverage Gap Check (For Renewal Requests)
    if (task.actionType?.includes('RENEW') || ctx.payload?.previousExpiryDate) {
      const prevExpiry = ctx.payload?.previousExpiryDate || ctx.previousPolicy?.expiryDate || ctx.policy?.expiryDate;
      const newStart = ctx.payload?.startDate || ctx.payload?.newStartDate || ctx.policy?.effectiveDate;
      if (prevExpiry && newStart) {
        const gapDays = Math.ceil(
          (new Date(newStart).getTime() - new Date(prevExpiry).getTime()) / (1000 * 3600 * 24)
        );
        if (gapDays > 1) {
          checks.push({
            title: 'Insurance Continuity Gap Analysis',
            category: 'Coverage',
            checked: 'Continuity between preceding policy expiration and proposed renewal commencement.',
            found: `Prior Expiry: ${prevExpiry} | Renewal Start: ${newStart} | Coverage Gap: ${gapDays} days without insurance protection.`,
            result: 'WARNING',
            nextStep: 'Investigate lapse gap: Confirm borrower had no uninsured casualty loss or claim occurrence during the lapse window.',
          });
        } else {
          checks.push({
            title: 'Insurance Continuity Gap Analysis',
            category: 'Coverage',
            checked: 'Continuity between preceding policy expiration and proposed renewal commencement.',
            found: `Seamless transition: Prior Expiry: ${prevExpiry} matches Renewal Start: ${newStart}. Gap: 0 days.`,
            result: 'PASSED',
            nextStep: 'Continuous protection verified.',
          });
        }
      }
    }

    // 5. Documentation & Evidence Verification Check
    const hasDocs = ctx.relevantDocs.length > 0;
    const verifiedDocs = ctx.relevantDocs.filter((d) => d.verificationStatus === 'Verified' || d.status === 'Active');

    checks.push({
      title: 'Mandatory Supporting Documentation',
      category: 'Documentation',
      checked: 'Verification of mandatory source documents in DMS (Policy Schedule, Valuation Report, Title Deed).',
      found: `${ctx.relevantDocs.length} associated documents identified (${verifiedDocs.length} verified in DMS).`,
      result: hasDocs ? 'PASSED' : 'WARNING',
      nextStep: hasDocs
        ? 'Preview submitted documents in the Documents panel below before decision confirmation.'
        : 'Warning: No digital files attached to this request. Verify if paper files are in dual-control custody or request electronic upload from maker.',
    });

    // 6. Outstanding Loan Exposure (For Release or Closure Requests)
    if (task.actionType?.includes('RELEASE') || task.actionType?.includes('CLOSE')) {
      if (outstandingExposure > 0) {
        checks.push({
          title: 'Secured Obligations Discharge Check',
          category: 'Exposure',
          checked: 'Verification that all secured loan obligations and contingent facilities are fully liquidated prior to release/closure.',
          found: `Total outstanding balance across ${ctx.taskFacilities.length} linked facility account(s): ETB ${outstandingExposure.toLocaleString()}.`,
          result: 'FAILED',
          nextStep: 'Hard-Stop: Collateral/Policy cannot be released or closed while credit facilities maintain an outstanding active balance unless a substitution has been sanctioned.',
        });
      } else {
        checks.push({
          title: 'Secured Obligations Discharge Check',
          category: 'Exposure',
          checked: 'Verification of zero outstanding obligations for collateral release.',
          found: 'All linked loan accounts report zero outstanding principal and interest balances (ETB 0.00).',
          result: 'PASSED',
          nextStep: 'Zero loan balance confirmed. Authorized to release collateral/policy.',
        });
      }
    }

    // 7. Collateral Capacity & Allocation Overflow Check (For Links / Allocations)
    if (
      task.actionType?.includes('LINK') ||
      task.entityType?.includes('Link') ||
      task.actionType?.includes('ALLOCATION') ||
      ctx.activeLink ||
      ctx.payload?.allocatedAmount
    ) {
      const colNsv = Number(
        ctx.collateral?.nsv ||
        (ctx.collateral?.valuationAmount ? ctx.collateral.valuationAmount * (1 - (ctx.collateral.haircut || 0) / 100) : 0)
      );
      const proposedAlloc = Number(
        ctx.activeLink?.allocatedAmount ||
        ctx.payload?.allocatedAmount ||
        ctx.payload?.amount ||
        0
      );
      // Existing allocations on this collateral excluding this link
      const existingAllocations = links
        .filter(
          (l) =>
            (l.collateralId === ctx.collateral?.id || l.collateralId === ctx.collateral?.code) &&
            l.id !== ctx.activeLink?.id &&
            (l.status === 'Active' || (l as any).relationshipStatus === 'Active')
        )
        .reduce((sum, l) => sum + Number(l.allocatedAmount || 0), 0);

      const totalProposed = existingAllocations + proposedAlloc;
      const isOverflow = colNsv > 0 && totalProposed > colNsv + 0.01;

      if (isOverflow) {
        checks.push({
          title: 'Collateral Allocation & Capacity Check',
          category: 'Allocation',
          checked: 'Verification that total allocated security does not exceed Net Collateral Value (NSV).',
          found: `Total allocations (ETB ${totalProposed.toLocaleString()}) exceed Net Security Value (ETB ${colNsv.toLocaleString()}) by ETB ${(totalProposed - colNsv).toLocaleString()}.`,
          result: 'FAILED',
          nextStep: 'Hard-Stop: Proposed allocation exceeds collateral available unallocated capacity. Re-balance allocations or link supplementary collateral.',
        });
      } else {
        checks.push({
          title: 'Collateral Allocation & Capacity Check',
          category: 'Allocation',
          checked: 'Verification that total allocated security remains within Net Collateral Value (NSV).',
          found: `Net Collateral Value: ETB ${colNsv.toLocaleString()} | Active Allocations: ETB ${existingAllocations.toLocaleString()} | Proposed: ETB ${proposedAlloc.toLocaleString()} | Remaining Capacity: ETB ${Math.max(0, colNsv - totalProposed).toLocaleString()}.`,
          result: 'PASSED',
          nextStep: 'Adequate unallocated collateral capacity verified. Allocation permitted.',
        });
      }
    }

    // 8. Third-Party Legal Prerequisite Check (When owner is third party or owner != borrower)
    const isThirdPartyCol =
      ctx.collateral?.ownerType === 'Third-party-owned' ||
      Boolean(
        ctx.collateral?.customerId &&
        ctx.taskFacilities[0]?.customerId &&
        ctx.collateral.customerId.trim().toLowerCase() !== ctx.taskFacilities[0].customerId.trim().toLowerCase()
      );

    if (isThirdPartyCol) {
      const primaryOwner = ctx.collateral?.owners?.[0];
      const hasAgreement = Boolean(
        primaryOwner?.pledgeAgreementRef ||
        ctx.collateral?.registrationNumber ||
        ctx.payload?.pledgeAgreementRef
      );

      if (!hasAgreement) {
        checks.push({
          title: 'Third-Party Pledge Agreement Verification',
          category: 'Third-Party',
          checked: 'Verification of registered third-party pledge agreement and contract reference.',
          found: `No registered pledge agreement reference found for legal owner (${primaryOwner?.name || 'Third-Party Pledgor'}).`,
          result: 'FAILED',
          nextStep: 'Hard-Stop: Third-party collateral requires an authenticated, registered pledge agreement before credit facility authorization.',
        });
      } else {
        checks.push({
          title: 'Third-Party Pledge Agreement Verification',
          category: 'Third-Party',
          checked: 'Verification of registered third-party pledge agreement and contract reference.',
          found: `Registered contract reference: ${primaryOwner?.pledgeAgreementRef || ctx.payload?.pledgeAgreementRef || 'Verified On-File'}. Legal relationship: ${primaryOwner?.relationshipToBorrower || 'Verified Pledgor'}.`,
          result: 'PASSED',
          nextStep: 'Third-party legal pledge prerequisites verified.',
        });
      }
    }

    return checks;
  };

  // Filter Tasks based on user input
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Pending' && t.status !== 'Pending') return false;
        if (statusFilter === 'Returned' && t.status !== 'Returned') return false;
        if (statusFilter === 'Approved' && t.status !== 'Approved') return false;
        if (statusFilter === 'Rejected' && t.status !== 'Rejected') return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      // Type Filter
      if (typeFilter !== 'ALL') {
        const typeNorm = formatActionType(t.actionType).toLowerCase();
        if (!typeNorm.includes(typeFilter.toLowerCase())) return false;
      }

      // Branch Filter
      if (branchFilter !== 'ALL') {
        const ctx = resolveTaskContext(t);
        if (ctx.branchName !== branchFilter) return false;
      }

      // SLA Filter
      if (slaFilter !== 'ALL') {
        const wait = getWaitingTimeInfo(t.submittedAt);
        if (slaFilter === 'OVERDUE' && !wait.isOverdue) return false;
        if (slaFilter === 'NORMAL' && wait.isOverdue) return false;
      }

      // Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const ctx = resolveTaskContext(t);
        const matchId = t.id?.toLowerCase().includes(query);
        const matchEntity = t.entityId?.toLowerCase().includes(query);
        const matchMaker = t.makerId?.toLowerCase().includes(query);
        const matchCustName = ctx.customer?.name?.toLowerCase().includes(query);
        const matchCif = ctx.customer?.cif?.toLowerCase().includes(query);
        const matchCollatId = ctx.collateral?.id?.toLowerCase().includes(query);
        const matchPolicyNo = ctx.policy?.policyNumber?.toLowerCase().includes(query);
        const matchAction = t.actionType?.toLowerCase().includes(query);

        if (!matchId && !matchEntity && !matchMaker && !matchCustName && !matchCif && !matchCollatId && !matchPolicyNo && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, statusFilter, priorityFilter, typeFilter, branchFilter, slaFilter, searchQuery]);

  // Submissions by Current User (Maker view)
  const mySubmissions = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.makerId?.toLowerCase() === currentUser.username?.toLowerCase() ||
        t.makerId?.toLowerCase() === currentUser.userId?.toLowerCase()
    );
  }, [tasks, currentUser]);

  // High-level KPI counts
  const kpis = useMemo(() => {
    const pendingTotal = tasks.filter((t) => t.status === 'Pending').length;
    const highPriority = tasks.filter((t) => t.status === 'Pending' && t.priority === 'High').length;
    const overdueTotal = tasks.filter((t) => {
      if (t.status !== 'Pending') return false;
      const wait = getWaitingTimeInfo(t.submittedAt);
      return wait.isOverdue;
    }).length;
    const returnedTotal = tasks.filter((t) => t.status === 'Returned').length;

    return { pendingTotal, highPriority, overdueTotal, returnedTotal };
  }, [tasks]);

  // Segregation of Duties Check for currently selected task
  const isSelectedTaskMakerSelf = useMemo(() => {
    if (!selectedTask) return false;
    return Boolean(
      selectedTask.makerId?.toLowerCase() === currentUser.username?.toLowerCase() ||
      selectedTask.makerId?.toLowerCase() === currentUser.userId?.toLowerCase() ||
      (selectedTask.makerId?.toLowerCase() + '_user') === currentUser.username?.toLowerCase() ||
      (currentUser.username?.toLowerCase() + '_user') === selectedTask.makerId?.toLowerCase()
    );
  }, [selectedTask, currentUser]);

  // Context for Selected Task
  const selectedContext = useMemo(() => {
    if (!selectedTask) return null;
    return resolveTaskContext(selectedTask);
  }, [selectedTask, collaterals, customers, facilities, policies, documents, links, branches, allUsers, exceptions]);

  // Validations for Selected Task
  const selectedValidations = useMemo(() => {
    if (!selectedTask) return [];
    return evaluateUnderstandableValidations(selectedTask);
  }, [selectedTask, selectedContext, currentUser]);

  // Execution Handlers
  const handleInitiateDecision = (action: 'Approve' | 'Reject' | 'Return') => {
    setDecisionError(null);
    if ((action === 'Reject' || action === 'Return') && !checkerRemarks.trim()) {
      setDecisionError(`Mandatory checker comments / justification required to ${action.toLowerCase()} this transaction.`);
      return;
    }
    setConfirmationAction(action);
  };

  const handleConfirmDecision = async () => {
    if (!selectedTask || !confirmationAction) return;
    setActionLoading(true);
    setDecisionError(null);
    try {
      if (confirmationAction === 'Approve') {
        await onApproveTask(selectedTask.id, checkerRemarks.trim() || 'Approved by Checker');
        setPersistedOutcome({
          type: 'success',
          message: `Request ${selectedTask.id} successfully APPROVED and recorded in immutable dual-control audit ledger.`,
        });
      } else if (confirmationAction === 'Reject') {
        await onRejectTask(selectedTask.id, checkerRemarks.trim());
        setPersistedOutcome({
          type: 'success',
          message: `Request ${selectedTask.id} REJECTED with recorded justification.`,
        });
      } else if (confirmationAction === 'Return') {
        await onReturnTask(selectedTask.id, checkerRemarks.trim());
        setPersistedOutcome({
          type: 'success',
          message: `Request ${selectedTask.id} RETURNED to maker for correction with instructions.`,
        });
      }
      setConfirmationAction(null);
      // Refresh task history
      const updatedHistory = await cimsApi.getTaskHistory(selectedTask.id);
      setTaskHistory(updatedHistory);
      if (onReload) await onReload();
    } catch (err: any) {
      setDecisionError(err?.message || 'Dual-control action failed to persist.');
      setPersistedOutcome({
        type: 'error',
        message: `Decision error: ${err?.message || 'Unable to complete action.'}`,
      });
      setConfirmationAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDecision = async () => {
    if (selectedTaskIds.length === 0) return;
    if (!bulkRemarks.trim()) {
      setBulkError('Mandatory audit rationale required for bulk authorization.');
      return;
    }
    setBulkError(null);
    setActionLoading(true);
    try {
      await onBulkApprove(selectedTaskIds, bulkRemarks.trim());
      setSelectedTaskIds([]);
      setShowBulkModal(false);
      setBulkRemarks('');
      if (onReload) await onReload();
    } catch (err: any) {
      setBulkError(err?.message || 'Bulk authorization failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentDownload = (doc: OwnershipDocument) => {
    const rawData = (doc as any).fileDetails?.base64 || doc.fileContent || doc.fileUrl;
    if (rawData) {
      const a = document.createElement('a');
      a.href = rawData;
      a.download = doc.name || 'document.pdf';
      a.click();
    } else {
      alert(`Download requested for document: ${doc.name}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Active Delegation Banner */}
      {activeDelegation && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[#102E4A]">Active Approval Authority Delegation</div>
              <p className="text-slate-600 mt-0.5">
                {activeDelegation.delegatorId === currentUser.userId
                  ? `You have delegated dual-control approval authority to ${activeDelegation.delegateId} until ${activeDelegation.endDate}.`
                  : `You are exercising delegated dual-control approval authority from ${activeDelegation.delegatorId} until ${activeDelegation.endDate}.`}
              </p>
            </div>
          </div>
          {activeDelegation.delegatorId === currentUser.userId && (
            <button
              onClick={() => onRevokeDelegation(activeDelegation.id)}
              className="text-xs font-semibold px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100 transition"
            >
              Revoke Authority
            </button>
          )}
        </div>
      )}

      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#102E4A] flex items-center justify-center text-white shadow-sm">
              <CheckSquare className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#102E4A]">Checker Approval Work Queue</h1>
              <p className="text-xs text-slate-500">
                Four-Eyes Dual Control: Independent verification, automated rule checks, and audit trails
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReload && (
            <button
              onClick={() => onReload()}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 border-slate-200 hover:bg-slate-50"
              title="Refresh Approval Work Queue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Queue</span>
            </button>
          )}
          <button
            onClick={() => setShowDelegateModal(true)}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 border-slate-200 hover:bg-slate-50"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Delegate Authority</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => { setStatusFilter('Pending'); setActiveTab('pending'); }}
          className="cims-card p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Action</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#102E4A] mt-2">{kpis.pendingTotal}</div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting Checker Seal</div>
        </div>

        <div
          onClick={() => { setStatusFilter('Pending'); setPriorityFilter('High'); setActiveTab('pending'); }}
          className="cims-card p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-400 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">High Priority</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{kpis.highPriority}</div>
          <div className="text-[11px] text-amber-800/80 mt-1">Expedited Processing</div>
        </div>

        <div
          onClick={() => { setStatusFilter('Pending'); setSlaFilter('OVERDUE'); setActiveTab('pending'); }}
          className="cims-card p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-rose-400 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue (&gt;24h)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{kpis.overdueTotal}</div>
          <div className="text-[11px] text-rose-800/80 mt-1">Exceeded SLA Horizon</div>
        </div>

        <div
          onClick={() => { setStatusFilter('Returned'); setActiveTab('pending'); }}
          className="cims-card p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-purple-400 transition shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Returned to Maker</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">{kpis.returnedTotal}</div>
          <div className="text-[11px] text-purple-800/80 mt-1">Correction Required</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200 bg-white px-5 pt-3 rounded-t-xl justify-between items-center shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'pending'
                ? 'border-[#102E4A] text-[#102E4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Approval Work Queue ({filteredTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('my-submissions')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'my-submissions'
                ? 'border-[#102E4A] text-[#102E4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            My Submissions ({mySubmissions.length})
          </button>
          <button
            onClick={() => setActiveTab('delegations')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'delegations'
                ? 'border-[#102E4A] text-[#102E4A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Delegated Powers ({delegations.length})
          </button>
        </div>

        {/* Bulk Action Controls */}
        {activeTab === 'pending' && selectedTaskIds.length > 0 && (
          <div className="flex items-center gap-2.5 pb-2">
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {selectedTaskIds.length} tasks selected
            </span>
            <button
              onClick={() => {
                setBulkError(null);
                setBulkRemarks('');
                setShowBulkModal(true);
              }}
              disabled={currentUser.canApprove === false}
              title={
                currentUser.canApprove === false
                  ? 'Bulk authorization restricted by System Administration Matrix'
                  : 'Bulk Authorize Selected Tasks'
              }
              className="btn-primary py-1.5 px-3.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm disabled:opacity-40"
            >
              Bulk Authorize ({selectedTaskIds.length})
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {/* Filtering and Search Controls (§Requirement 2) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              {/* Search Bar */}
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Ref, Customer, CIF, Loan, Collateral, Maker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#102E4A]"
                />
              </div>

              {/* Request Type Filter */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#102E4A] bg-white"
                >
                  <option value="ALL">All Request Types</option>
                  <option value="Policy Renewal">Policy Renewal</option>
                  <option value="New Policy">New Policy Registration</option>
                  <option value="Policy Amendment">Policy Amendment</option>
                  <option value="Policy Closure">Policy Closure</option>
                  <option value="Collateral Registration">Collateral Registration</option>
                  <option value="Collateral Amendment">Collateral Amendment</option>
                  <option value="Collateral-to-Loan Link">Collateral Link</option>
                  <option value="Collateral Release">Collateral Release</option>
                  <option value="Exception Override">Exception Override</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#102E4A] bg-white"
                >
                  <option value="Pending">Pending My Approval</option>
                  <option value="Returned">Returned to Maker</option>
                  <option value="Approved">Approved / Historical</option>
                  <option value="Rejected">Rejected</option>
                  <option value="ALL">All Workflow Statuses</option>
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#102E4A] bg-white"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.code} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & SLA */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#102E4A] bg-white"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <span>
                  Showing <strong>{filteredTasks.length}</strong> of <strong>{tasks.length}</strong> requests
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Normal (&lt;4h)
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ml-2"></span> Approaching SLA (4-24h)
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-2"></span> Overdue (&gt;24h)
                </span>
              </div>
              {(searchQuery || typeFilter !== 'ALL' || statusFilter !== 'Pending' || priorityFilter !== 'ALL' || branchFilter !== 'ALL' || slaFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('ALL');
                    setStatusFilter('Pending');
                    setPriorityFilter('ALL');
                    setBranchFilter('ALL');
                    setSlaFilter('ALL');
                  }}
                  className="text-blue-700 font-semibold hover:underline"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>

          {/* Work Queue Table (§Requirement 2) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredTasks.length > 0 && selectedTaskIds.length === filteredTasks.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTaskIds(filteredTasks.map((t) => t.id));
                          else setSelectedTaskIds([]);
                        }}
                        className="rounded text-[#102E4A] focus:ring-[#3E7AB0]"
                      />
                    </th>
                    <th className="p-3">Request Number</th>
                    <th className="p-3">Request Type</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Loan / Facility</th>
                    <th className="p-3">Collateral</th>
                    <th className="p-3">Maker</th>
                    <th className="p-3">Submitted Date</th>
                    <th className="p-3">Waiting Time</th>
                    <th className="p-3">Risk / Validation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-500">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700">No requests in approval queue</div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          There are currently no maker submissions matching your role or search filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t) => {
                      const ctx = resolveTaskContext(t);
                      const wait = getWaitingTimeInfo(t.submittedAt);
                      const validations = evaluateUnderstandableValidations(t);
                      const failedCount = validations.filter((v) => v.result === 'FAILED').length;
                      const warnCount = validations.filter((v) => v.result === 'WARNING').length;

                      const isSelected = selectedTaskIds.includes(t.id);

                      return (
                        <tr
                          key={t.id}
                          onClick={() => {
                            setSelectedTask(t);
                            setCheckerRemarks('');
                            setDecisionError(null);
                            setPersistedOutcome(null);
                            setShowDetailScreen(true);
                          }}
                          className={`hover:bg-blue-50/40 cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedTaskIds([...selectedTaskIds, t.id]);
                                else setSelectedTaskIds(selectedTaskIds.filter((id) => id !== t.id));
                              }}
                              className="rounded text-[#102E4A] focus:ring-[#3E7AB0]"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-[#102E4A]">
                            <div className="flex items-center gap-1.5">
                              {t.priority === 'High' && (
                                <span className="w-2 h-2 rounded-full bg-rose-500" title="High Priority" />
                              )}
                              <span>{t.id}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800">
                              {formatActionType(t.actionType)}
                            </span>
                            <div className="text-[10px] text-slate-500">{t.entityType}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-[#102E4A]">
                              {ctx.customer?.name || ctx.payload?.customerName || 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              CIF: {ctx.customer?.cif || ctx.payload?.customerId || '000000'}
                            </div>
                          </td>
                          <td className="p-3">
                            {ctx.taskFacilities.length > 0 ? (
                              <div>
                                <div className="font-mono text-[#102E4A] font-semibold">
                                  {ctx.taskFacilities[0].loanReference || ctx.taskFacilities[0].lineCode || ctx.taskFacilities[0].id}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  ETB {Number(ctx.taskFacilities[0].outstandingBalance || 0).toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">Unlinked</span>
                            )}
                          </td>
                          <td className="p-3">
                            {ctx.collateral ? (
                              <div>
                                <div className="font-mono text-[#102E4A] font-semibold">
                                  {ctx.collateral.id}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {ctx.collateral.type}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-slate-800">{ctx.makerUser?.name || t.makerId}</div>
                            <div className="text-[10px] text-slate-500">{ctx.branchName}</div>
                          </td>
                          <td className="p-3 text-slate-600">
                            {t.submittedAt?.replace('T', ' ').substring(0, 16)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${wait.badgeClass}`}
                            >
                              <Clock className="w-3 h-3" />
                              {wait.text}
                            </span>
                          </td>
                          <td className="p-3">
                            {failedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                {failedCount} Failed
                              </span>
                            ) : warnCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {warnCount} Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Passed ({validations.length}/{validations.length})
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <StatusChip label={t.status} />
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedTask(t);
                                setCheckerRemarks('');
                                setDecisionError(null);
                                setPersistedOutcome(null);
                                setShowDetailScreen(true);
                              }}
                              className="btn-primary py-1 px-2.5 text-xs bg-[#102E4A] hover:bg-[#1a446c] text-white flex items-center gap-1.5 ml-auto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Review & Decide</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* My Submissions Tab */}
      {activeTab === 'my-submissions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-[#102E4A]">My Submitted Transactions</h2>
              <p className="text-xs text-slate-500">
                Track dual-control review progress, checker feedback notes, and resubmit returned requests.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Task ID</th>
                  <th className="p-3">Request Type</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Candidate Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mySubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No transactions submitted by your user account.
                    </td>
                  </tr>
                ) : (
                  mySubmissions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-[#102E4A]">{t.id}</td>
                      <td className="p-3 font-semibold">{formatActionType(t.actionType)}</td>
                      <td className="p-3 font-mono text-slate-600">
                        {t.entityType}: {t.entityId}
                      </td>
                      <td className="p-3 text-slate-700">{t.candidateRole}</td>
                      <td className="p-3">
                        <StatusChip label={t.status} />
                      </td>
                      <td className="p-3 text-slate-500">
                        {t.submittedAt?.replace('T', ' ').substring(0, 16)}
                      </td>
                      <td className="p-3 text-right">
                        {t.status === 'Returned' && (
                          <button
                            onClick={async () => {
                              await onResubmitTask(t.id);
                              if (onReload) await onReload();
                            }}
                            className="btn-primary py-1 px-3 text-xs bg-amber-600 hover:bg-amber-700"
                          >
                            Resubmit to Checker
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delegations Tab */}
      {activeTab === 'delegations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-[#102E4A]">Approval Authority Delegations</h2>
              <p className="text-xs text-slate-500">
                Temporarily assign dual-control approval rights to another branch/department officer
              </p>
            </div>
            <button
              onClick={() => setShowDelegateModal(true)}
              className="btn-primary py-1.5 px-3 text-xs bg-[#102E4A] text-white"
            >
              + Delegate Approval Authority
            </button>
          </div>

          <div className="cims-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-200">
                {delegations.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3 font-semibold text-[#102E4A]">{d.delegatorId}</td>
                    <td className="p-3 font-semibold">{d.delegateId}</td>
                    <td className="p-3 text-slate-600">{d.startDate}</td>
                    <td className="p-3 text-slate-600">{d.endDate}</td>
                    <td className="p-3">
                      <StatusChip label={d.status} />
                    </td>
                    <td className="p-3 text-slate-600">{d.reason}</td>
                    <td className="p-3 text-right">
                      {d.status === 'Active' && d.delegatorId === currentUser.userId && (
                        <button
                          onClick={() => onRevokeDelegation(d.id)}
                          className="btn-secondary py-0.5 px-2 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
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

      {/* ============================================================== */}
      {/* APPROVAL DETAIL SCREEN (§Requirement 1, 3, 4, 5, 6)           */}
      {/* ============================================================== */}
      {showDetailScreen && selectedTask && selectedContext && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 text-xs my-auto animate-in fade-in zoom-in duration-150">
            {/* Top Detail Header Bar (§Requirement 1) */}
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start shrink-0 border-b border-blue-900">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-900/60 border border-blue-400/30 flex items-center justify-center text-white shrink-0">
                  <ShieldCheck className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-bold bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-800 text-blue-200">
                      {selectedTask.id}
                    </span>
                    <h2 className="text-base font-bold text-white">
                      {formatActionType(selectedTask.actionType)}
                    </h2>
                    <StatusChip label={selectedTask.status} />
                    {selectedTask.priority === 'High' && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500 text-[10px] font-bold">
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-blue-200 mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    <span>
                      Customer:{' '}
                      <strong className="text-white">
                        {selectedContext.customer?.name || selectedContext.payload?.customerName || 'N/A'}
                      </strong>{' '}
                      (CIF: {selectedContext.customer?.cif || selectedContext.payload?.customerId || 'N/A'})
                    </span>
                    <span>
                      Branch: <strong className="text-white">{selectedContext.branchName}</strong>
                    </span>
                    <span>
                      Maker:{' '}
                      <strong className="text-white">
                        {selectedContext.makerUser?.name || selectedTask.makerId}
                      </strong>
                    </span>
                    <span>
                      Submitted:{' '}
                      <strong className="text-white">
                        {selectedTask.submittedAt?.replace('T', ' ').substring(0, 16)}
                      </strong>
                    </span>
                    <span>
                      Waiting:{' '}
                      <strong className="text-amber-300">
                        {getWaitingTimeInfo(selectedTask.submittedAt).text}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDetailScreen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                title="Close Screen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Dossier Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
              {/* Persisted Outcome Alert */}
              {persistedOutcome && (
                <div
                  className={`p-4 rounded-xl border flex items-center gap-3 ${
                    persistedOutcome.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {persistedOutcome.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div className="flex-1 font-semibold">{persistedOutcome.message}</div>
                </div>
              )}

              {/* Segregation of Duties Warning (If Maker == Checker) */}
              {isSelectedTaskMakerSelf && (
                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl text-amber-900 flex items-start gap-3 shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wider text-amber-900">
                      Four-Eyes Segregation of Duties Enforced (§2.1 Dual Control Matrix)
                    </div>
                    <p className="text-xs mt-1 text-amber-800 leading-relaxed">
                      You initiated this request as <strong>Maker ({selectedTask.makerId})</strong>. Under banking dual-control regulations and NBE compliance directives, you are strictly prohibited from self-authorizing your own transactions. An independent checker (such as a Branch Manager or Collateral Checker) must review and authorize this submission.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 1: Customer, Loan, and Collateral Dossier (§Requirement 1 & 4) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer Details Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-[#102E4A] font-bold pb-2 border-b border-slate-100">
                    <Building className="w-4 h-4 text-blue-700" />
                    <span>Customer Details</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-500">Legal Name:</span>{' '}
                      <span className="font-bold text-slate-800">
                        {selectedContext.customer?.name || selectedContext.payload?.customerName || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">CIF / ID:</span>{' '}
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedContext.customer?.cif || selectedContext.payload?.customerId || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Segment:</span>{' '}
                      <span className="text-slate-700">
                        {selectedContext.customer?.segment || 'Retail & Commercial'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk Category:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedContext.customer?.riskRating || 'Standard'}
                      </span>
                    </div>
                    {/* Third-Party Legal Owner Badge if applicable */}
                    {selectedContext.collateral?.ownerType === 'Third-party-owned' && selectedContext.collateral?.owners?.[0] && (
                      <div className="pt-1.5 border-t border-slate-100 text-[11px]">
                        <span className="text-amber-800 font-semibold">Third-Party Legal Pledgor:</span>{' '}
                        <span className="font-bold text-slate-900">{selectedContext.collateral.owners[0].name}</span>
                        <div className="text-slate-500">
                          Relationship: {selectedContext.collateral.owners[0].relationshipToBorrower || 'Guarantor'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loan & Facility Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-[#102E4A] font-bold">
                      <DollarSign className="w-4 h-4 text-emerald-700" />
                      <span>Linked Credit Facility</span>
                    </div>
                    {selectedContext.taskFacilities.length > 1 && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                        {selectedContext.taskFacilities.length} Linked Facilities
                      </span>
                    )}
                  </div>
                  {selectedContext.taskFacilities.length > 0 ? (
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-500">Facility ID:</span>{' '}
                        <span className="font-mono font-bold text-slate-800">
                          {selectedContext.taskFacilities[0].loanReference || selectedContext.taskFacilities[0].lineCode || selectedContext.taskFacilities[0].id}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Facility Type:</span>{' '}
                        <span className="text-slate-700">
                          {selectedContext.taskFacilities[0].facilityType || 'Term Loan'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Sanctioned Limit:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          ETB {Number(selectedContext.taskFacilities[0].approvedLimit || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Outstanding Balance:</span>{' '}
                        <span className="font-bold text-rose-700">
                          ETB {Number(selectedContext.taskFacilities[0].outstandingBalance || 0).toLocaleString()}
                        </span>
                      </div>
                      {selectedContext.taskFacilities.length > 1 && (
                        <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                          Total Aggregate Exposure: <strong className="text-rose-700">ETB {selectedContext.taskFacilities.reduce((sum, f) => sum + Number(f.outstandingBalance || 0), 0).toLocaleString()}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 py-2">No linked credit facilities for this asset.</div>
                  )}
                </div>

                {/* Collateral Asset Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-[#102E4A] font-bold">
                      <Layers className="w-4 h-4 text-indigo-700" />
                      <span>Collateral Security</span>
                    </div>
                    {selectedContext.collateral && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        selectedContext.collateral.ownerType === 'Third-party-owned'
                          ? 'bg-amber-100 text-amber-800'
                          : selectedContext.collateral.ownerType === 'Jointly-owned'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedContext.collateral.ownerType || 'Borrower-owned'}
                      </span>
                    )}
                  </div>
                  {selectedContext.collateral ? (
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-500">Collateral ID:</span>{' '}
                        <span className="font-mono font-bold text-slate-800">
                          {selectedContext.collateral.code || selectedContext.collateral.id}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Asset Type:</span>{' '}
                        <span className="text-slate-700">
                          {selectedContext.collateral.category} - {selectedContext.collateral.type}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Market Value / NSV:</span>{' '}
                        <span className="font-bold text-[#102E4A]">
                          ETB {Number(selectedContext.collateral.valuationAmount || (selectedContext.collateral as any).marketValue || 0).toLocaleString()}
                        </span>
                        <span className="text-slate-500 text-[11px] block">
                          Net Security Value: <strong className="text-emerald-700">ETB {Number(selectedContext.collateral.nsv || (selectedContext.collateral.valuationAmount ? selectedContext.collateral.valuationAmount * (1 - (selectedContext.collateral.haircut || 0)/100) : 0)).toLocaleString()}</strong> (Haircut: {selectedContext.collateral.haircut || 0}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Legal Owner:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {(selectedContext.collateral.owners && selectedContext.collateral.owners.length > 0 && selectedContext.collateral.owners.map(o => o.name).join(', ')) ||
                            (selectedContext.collateral as any).legalOwnerNames ||
                            selectedContext.customer?.name ||
                            'Borrower'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 py-2">No collateral asset mapped directly.</div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Dynamic Information According to Request Type (§Requirement 4) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#102E4A] border-b border-slate-100 pb-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                  <span>Request Specific Information & Changes</span>
                </div>

                {/* Case A: Policy Renewal */}
                {(selectedTask.actionType?.includes('RENEW') || selectedContext.payload?.previousExpiryDate) && (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        <strong>Policy Renewal Comparison:</strong> Review proposed renewal terms versus expiring policy schedule.
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold">
                          <tr>
                            <th className="p-2.5">Attribute</th>
                            <th className="p-2.5">Expiring / Preceding Policy</th>
                            <th className="p-2.5">Proposed Renewal Policy</th>
                            <th className="p-2.5">Variance / Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Policy Expiration Date</td>
                            <td className="p-2.5 font-mono text-slate-700">
                              {selectedContext.payload?.previousExpiryDate || selectedContext.previousPolicy?.expiryDate || selectedContext.policy?.expiryDate || 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              {selectedContext.payload?.newExpiryDate || selectedContext.payload?.expiryDate || selectedContext.policy?.expiryDate || 'N/A'}
                            </td>
                            <td className="p-2.5 text-emerald-700 font-semibold">
                              {selectedContext.payload?.newExpiryDate && (selectedContext.payload?.previousExpiryDate || selectedContext.previousPolicy?.expiryDate)
                                ? 'Tenor Extended'
                                : 'Scheduled Renewal'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Sum Insured</td>
                            <td className="p-2.5 font-semibold text-slate-700">
                              ETB {Number(selectedContext.payload?.previousSumInsured || selectedContext.previousPolicy?.insuredAmount || selectedContext.policy?.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-bold text-[#102E4A]">
                              ETB {Number(selectedContext.payload?.newSumInsured || selectedContext.payload?.sumInsured || selectedContext.policy?.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {Number(selectedContext.payload?.newSumInsured || selectedContext.payload?.sumInsured || selectedContext.policy?.insuredAmount || 0) >=
                              Number(selectedContext.payload?.previousSumInsured || selectedContext.previousPolicy?.insuredAmount || selectedContext.policy?.insuredAmount || 0)
                                ? 'Maintained / Enhanced'
                                : 'Reduced Coverage'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Annual Premium</td>
                            <td className="p-2.5 text-slate-700">
                              ETB {Number(selectedContext.payload?.previousPremium || selectedContext.previousPolicy?.premium || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-bold text-[#102E4A]">
                              ETB {Number(selectedContext.payload?.newPremium || selectedContext.payload?.premium || selectedContext.policy?.premium || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-slate-700">Standard Scheduled</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Underwriting Insurer</td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.previousInsurer || selectedContext.previousPolicy?.insurerName || selectedContext.policy?.insurerName || 'N/A'}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-900">
                              {selectedContext.payload?.newInsurer || selectedContext.policy?.insurerName || 'N/A'}
                            </td>
                            <td className="p-2.5 text-emerald-700 font-semibold">Approved Insurer</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Case B: Policy Amendment (Before vs After Diff) */}
                {(selectedTask.actionType?.includes('AMEND') || selectedTask.actionType?.includes('DIFF')) &&
                  !selectedTask.actionType?.includes('COLLATERAL') && (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          <strong>Policy Amendment Diff:</strong> Maker submitted modifications for policy {selectedContext.policy?.policyNumber || selectedTask.entityId}.
                        </span>
                      </div>
                      <span className="font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">
                        Version v{(selectedContext.policy?.version || 2) - 1} &rarr; v{selectedContext.policy?.version || 2}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-[#EFF5FB] text-[#102E4A] font-bold">
                          <tr>
                            <th className="p-2.5">Policy Attribute</th>
                            <th className="p-2.5">Preceding Baseline (Authorized)</th>
                            <th className="p-2.5">Proposed Amendment</th>
                            <th className="p-2.5">Variance Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Sum Insured</td>
                            <td className="p-2.5 font-mono text-slate-700">
                              ETB {Number(selectedContext.payload?.oldSumInsured || selectedContext.policy?.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              ETB {Number(selectedContext.payload?.newSumInsured || selectedContext.payload?.sumInsured || selectedContext.policy?.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-slate-700 font-semibold">
                              {Number(selectedContext.payload?.newSumInsured || selectedContext.policy?.insuredAmount || 0) !== Number(selectedContext.payload?.oldSumInsured || selectedContext.policy?.insuredAmount || 0) ? 'Modified' : 'Unchanged'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Underwriting Insurer</td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.oldInsurer || selectedContext.policy?.insurerName || 'N/A'}
                            </td>
                            <td className="p-2.5 font-bold text-[#102E4A]">
                              {selectedContext.payload?.newInsurer || selectedContext.policy?.insurerName || 'N/A'}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.newInsurer && selectedContext.payload?.oldInsurer && selectedContext.payload?.newInsurer !== selectedContext.payload?.oldInsurer ? 'Insurer Changed' : 'Unchanged'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Coverage Type</td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.oldCoverageType || selectedContext.policy?.coverageType || 'N/A'}
                            </td>
                            <td className="p-2.5 font-bold text-[#102E4A]">
                              {selectedContext.payload?.newCoverageType || selectedContext.policy?.coverageType || 'N/A'}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.newCoverageType && selectedContext.payload?.oldCoverageType && selectedContext.payload?.newCoverageType !== selectedContext.payload?.oldCoverageType ? 'Scope Amended' : 'Unchanged'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Annual Premium</td>
                            <td className="p-2.5 font-mono text-slate-700">
                              ETB {Number(selectedContext.payload?.oldPremium || selectedContext.policy?.premium || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              ETB {Number(selectedContext.payload?.newPremium || selectedContext.payload?.premium || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {Number(selectedContext.payload?.newPremium || selectedContext.payload?.premium || 0) !== Number(selectedContext.payload?.oldPremium || selectedContext.policy?.premium || 0) ? 'Premium Adjusted' : 'Unchanged'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-slate-600">Policy Expiration</td>
                            <td className="p-2.5 font-mono text-slate-700">
                              {selectedContext.payload?.oldExpiry || selectedContext.policy?.expiryDate || 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              {selectedContext.payload?.newExpiry || selectedContext.policy?.expiryDate || 'N/A'}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {selectedContext.payload?.newExpiry && selectedContext.payload?.oldExpiry && selectedContext.payload?.newExpiry !== selectedContext.payload?.oldExpiry ? 'Horizon Adjusted' : 'Unchanged'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Case C: Exception Override Request */}
                {selectedTask.actionType === 'APPROVE_EXCEPTION' && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 text-amber-700" />
                          <span>Credit Validation Override Request: {selectedContext.exception?.exceptionType || selectedContext.payload?.exceptionType || 'Policy Exception'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                          Severity: {selectedContext.exception?.severity || selectedContext.payload?.severity || 'HIGH'}
                        </span>
                      </div>
                      <div className="text-xs text-amber-950 font-medium">
                        Failed Requirement: <span className="font-bold text-rose-700">{selectedContext.exception?.failedRequirement || selectedContext.payload?.failedRequirement || 'Mandatory Validation Rule'}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-[#102E4A]">Maker RO Justification & Mitigating Factors:</div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 italic">
                        "{selectedContext.exception?.reason || selectedContext.payload?.reason || selectedTask.remarks || 'No justification provided.'}"
                      </div>
                      {(selectedContext.exception?.comments || selectedContext.payload?.comments) && (
                        <div className="text-slate-600 mt-1">
                          <strong>Additional Notes:</strong> {selectedContext.exception?.comments || selectedContext.payload?.comments}
                        </div>
                      )}
                      {(selectedContext.exception?.evidenceDocument || selectedContext.payload?.evidenceDocument) && (
                        <div className="text-slate-600 mt-1 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                          <span>Attached Memo / Approval Evidence: <strong>{selectedContext.exception?.evidenceDocument || selectedContext.payload?.evidenceDocument}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Case D: Collateral-to-Loan Link / Allocation */}
                {(selectedTask.actionType?.includes('LINK') ||
                  selectedTask.entityType?.includes('Link') ||
                  selectedTask.actionType?.includes('ALLOCATION') ||
                  Boolean(selectedContext.activeLink)) && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        <strong>Facility Collateral Allocation Proposal:</strong> Review proposed security pledge against collateral capacity and borrower line.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Proposed Allocation</div>
                        <div className="font-bold text-[#102E4A] mt-1 text-sm">
                          ETB {Number(selectedContext.activeLink?.allocatedAmount || selectedContext.payload?.allocatedAmount || selectedContext.payload?.amount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Linkage Type</div>
                        <div className="font-bold text-slate-800 mt-1">
                          {selectedContext.activeLink?.linkageType || selectedContext.payload?.linkageType || 'Primary'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Collateral Net Security Value</div>
                        <div className="font-bold text-slate-800 mt-1">
                          ETB {Number(selectedContext.collateral?.nsv || (selectedContext.collateral?.valuationAmount ? selectedContext.collateral.valuationAmount * (1 - (selectedContext.collateral.haircut || 0)/100) : 0)).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Target Credit Facility</div>
                        <div className="font-mono font-bold text-slate-800 mt-1">
                          {selectedContext.taskFacilities[0]?.loanReference || selectedContext.taskFacilities[0]?.lineCode || selectedContext.payload?.facilityId || 'Facility'}
                        </div>
                      </div>
                    </div>

                    {/* Third-Party Collateral Pledge Context */}
                    {(selectedContext.collateral?.ownerType === 'Third-party-owned' ||
                      (selectedContext.collateral?.customerId && selectedContext.taskFacilities[0]?.customerId && selectedContext.collateral.customerId !== selectedContext.taskFacilities[0].customerId)) && (
                      <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-amber-900">
                          <ShieldAlert className="w-4 h-4 text-amber-700" />
                          <span>Third-Party Collateral Pledge Underwriting Context</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-lg border border-amber-200">
                          <div>
                            <span className="text-slate-500 text-[11px] block">Legal Owner (Pledgor)</span>
                            <span className="font-bold text-slate-900">
                              {selectedContext.collateral?.owners?.[0]?.name || (selectedContext.collateral as any)?.legalOwnerNames || 'Third-Party Pledgor'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px] block">Borrower Legal Entity</span>
                            <span className="font-bold text-slate-900">
                              {selectedContext.customer?.name || selectedContext.payload?.borrowerName || 'Borrower'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px] block">Relationship to Borrower</span>
                            <span className="font-semibold text-emerald-800">
                              {selectedContext.collateral?.owners?.[0]?.relationshipToBorrower || selectedContext.payload?.relationshipToBorrower || 'Verified Guarantor'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Case E: Collateral Release */}
                {selectedTask.actionType?.includes('RELEASE') && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-900 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        <span>Collateral Legal Release & Lien Discharge Request</span>
                      </div>
                      <div className="text-slate-800">
                        Collateral Asset: <strong className="text-[#102E4A]">{selectedContext.collateral?.code || selectedContext.collateral?.id}</strong> ({selectedContext.collateral?.type}) | Valuation: ETB {Number(selectedContext.collateral?.valuationAmount || 0).toLocaleString()}
                      </div>
                      <div className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-amber-200">
                        Maker Release Reason: "{selectedContext.payload?.reason || selectedTask.remarks || 'Full liquidation of facilities'}"
                      </div>
                    </div>
                  </div>
                )}

                {/* Case F: Collateral Registration / Amendment */}
                {(selectedTask.actionType?.includes('COLLATERAL_REGISTRATION') ||
                  selectedTask.actionType?.includes('COLLATERAL_AMENDMENT') ||
                  (selectedTask.entityType === 'Collateral' &&
                    !selectedTask.actionType?.includes('RELEASE') &&
                    !selectedTask.actionType?.includes('LINK'))) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Asset Category & Type</div>
                        <div className="font-bold text-slate-800 mt-1">
                          {selectedContext.collateral?.category || 'Collateral'} - {selectedContext.collateral?.type || 'Asset'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Market Valuation</div>
                        <div className="font-bold text-[#102E4A] mt-1 text-sm">
                          ETB {Number(selectedContext.collateral?.valuationAmount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Haircut %</div>
                        <div className="font-bold text-slate-800 mt-1">
                          {Number(selectedContext.collateral?.haircut || 0)}%
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Net Security Value (NSV)</div>
                        <div className="font-bold text-emerald-700 mt-1 text-sm">
                          ETB {Number(selectedContext.collateral?.nsv || (selectedContext.collateral?.valuationAmount ? selectedContext.collateral.valuationAmount * (1 - (selectedContext.collateral.haircut || 0)/100) : 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Legal Ownership Structure */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                        <span className="font-bold text-[#102E4A]">Legal Ownership Structure</span>
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-blue-100 text-blue-800">
                          {selectedContext.collateral?.ownerType || 'Borrower-owned'}
                        </span>
                      </div>
                      {selectedContext.collateral?.owners && selectedContext.collateral.owners.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedContext.collateral.owners.map((owner, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                              <div>
                                <span className="font-bold text-slate-800">{owner.name}</span>
                                <span className="text-slate-500 ml-2">({owner.relationshipToBorrower || 'Primary Owner'})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-semibold text-slate-700">{owner.ownershipPercentage || 100}%</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${owner.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {owner.verificationStatus || 'Pending'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-600">
                          Owner: <strong>{selectedContext.customer?.name || 'Borrower'}</strong> (100% Sole Ownership)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Case G: Policy Closure / Cancellation */}
                {(selectedTask.actionType?.includes('CLOSE') || selectedTask.actionType?.includes('CANCEL')) && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-rose-900 font-bold">
                        <XCircle className="w-4 h-4 text-rose-700" />
                        <span>{selectedTask.actionType?.includes('CANCEL') ? 'Policy Cancellation Request' : 'Policy Closure Request'}</span>
                      </div>
                      <div className="text-slate-800">
                        Policy: <strong className="text-[#102E4A]">{selectedContext.policy?.policyNumber || selectedTask.entityId}</strong> ({selectedContext.policy?.coverageType}) | Insurer: {selectedContext.policy?.insurerName}
                      </div>
                      <div className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-rose-200">
                        Maker Rationale: "{selectedContext.payload?.reason || selectedContext.policy?.closureReason || selectedContext.policy?.cancellationReason || selectedTask.remarks || 'No reason provided'}"
                      </div>
                    </div>
                  </div>
                )}

                {/* Case H: Policy Endorsement */}
                {selectedTask.actionType?.includes('ENDORSE') && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-blue-900 font-bold">
                        <FileText className="w-4 h-4 text-blue-700" />
                        <span>Policy Endorsement Schedule</span>
                      </div>
                      <div className="text-slate-800">
                        Endorsement Ref: <strong className="font-mono text-[#102E4A]">{selectedContext.payload?.endorsementNo || 'END-Pending'}</strong> | Effective: {selectedContext.payload?.effectiveDate || selectedContext.policy?.effectiveDate || 'Immediate'}
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-blue-200 text-slate-800">
                        Clauses & Modifications: {selectedContext.payload?.description || selectedTask.remarks || 'Endorsement clauses schedule updated.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Case I: Standard Policy Registration (when not renewal, amend, close, endorse, or collateral) */}
                {!selectedTask.actionType?.includes('RENEW') &&
                  !selectedTask.actionType?.includes('AMEND') &&
                  !selectedTask.actionType?.includes('DIFF') &&
                  selectedTask.actionType !== 'APPROVE_EXCEPTION' &&
                  !selectedTask.actionType?.includes('LINK') &&
                  !selectedTask.entityType?.includes('Link') &&
                  !selectedTask.actionType?.includes('ALLOCATION') &&
                  !selectedContext.activeLink &&
                  !selectedTask.actionType?.includes('RELEASE') &&
                  !selectedTask.actionType?.includes('COLLATERAL') &&
                  selectedTask.entityType !== 'Collateral' &&
                  !selectedTask.actionType?.includes('CLOSE') &&
                  !selectedTask.actionType?.includes('CANCEL') &&
                  !selectedTask.actionType?.includes('ENDORSE') && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Underwriting Insurer</div>
                        <div className="font-bold text-slate-800 mt-1">
                          {selectedContext.policy?.insurerName || selectedContext.payload?.insurerName || 'Approved Insurer'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Policy Number</div>
                        <div className="font-mono font-bold text-slate-800 mt-1">
                          {selectedContext.policy?.policyNumber || selectedContext.payload?.policyNumber || 'POL-Draft'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Sum Insured</div>
                        <div className="font-bold text-[#102E4A] mt-1 text-sm">
                          ETB {Number(selectedContext.policy?.insuredAmount || selectedContext.payload?.sumInsured || selectedContext.payload?.insuredAmount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500">Coverage Type</div>
                        <div className="font-bold text-slate-800 mt-1">
                          {selectedContext.policy?.coverageType || selectedContext.payload?.coverageType || 'Comprehensive Fire & Perils'}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Maker Business Remarks */}
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
                  <span className="text-[11px] font-bold uppercase text-[#102E4A] tracking-wider">
                    Maker Remarks / Submission Rationale
                  </span>
                  <p className="text-slate-700 text-xs">
                    {selectedTask.remarks || selectedContext.payload?.reason || 'No specific remarks entered by maker.'}
                  </p>
                </div>
              </div>

              {/* SECTION 3: Understandable 4-Part Validation Results (§Requirement 5) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#102E4A]">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Underwriting & Dual-Control Rule Validations</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    4-Point Verification: What was checked, what was found, result, and next action.
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedValidations.map((v, i) => {
                    const isPassed = v.result === 'PASSED';
                    const isFailed = v.result === 'FAILED';
                    const isWarn = v.result === 'WARNING';

                    return (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border transition ${
                          isFailed
                            ? 'bg-rose-50/60 border-rose-300'
                            : isWarn
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-emerald-50/40 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {isFailed ? (
                              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            ) : isWarn ? (
                              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            )}
                            <h4 className="font-bold text-xs text-slate-900">{v.title}</h4>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-600">
                              {v.category}
                            </span>
                          </div>

                          <div>
                            {isFailed && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800 border border-rose-300">
                                FAILED
                              </span>
                            )}
                            {isWarn && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                WARNING
                              </span>
                            )}
                            {isPassed && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 border border-emerald-300">
                                PASSED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 4-Item Breakdown (§Requirement 5) */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs bg-white/80 p-3 rounded-lg border border-slate-200/80">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              1. What was checked?
                            </span>
                            <span className="text-slate-800">{v.checked}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              2. What was found?
                            </span>
                            <span className="font-semibold text-slate-900">{v.found}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              3. What must happen next?
                            </span>
                            <span
                              className={`font-medium ${
                                isFailed ? 'text-rose-700' : isWarn ? 'text-amber-800' : 'text-emerald-700'
                              }`}
                            >
                              {v.nextStep}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: Attached Documents & Document Review Integration (§Requirement 1 & 3) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#102E4A]">
                    <Paperclip className="w-4 h-4 text-blue-700" />
                    <span>Supporting Verification Documents ({selectedContext.relevantDocs.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Click 'Preview Document' to inspect high-resolution electronic records.
                  </span>
                </div>

                {selectedContext.relevantDocs.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500">
                    No electronic documents uploaded in DMS for this entity.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedContext.relevantDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between hover:border-blue-300 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{doc.name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Type: {doc.type}</span>
                              {doc.expiryDate && <span>Expires: {doc.expiryDate}</span>}
                              <span
                                className={`font-semibold ${
                                  doc.verificationStatus === 'Verified' ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {doc.verificationStatus || 'Pending Verification'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 border-blue-200 text-blue-800 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 5: Approval Audit Trail & Decision History (§Requirement 1 & 6) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#102E4A] border-b border-slate-100 pb-2">
                  <History className="w-4 h-4 text-purple-700" />
                  <span>Dual-Control Audit Trail & Prior Decision Timeline</span>
                </div>

                {historyLoading ? (
                  <div className="p-4 text-center text-slate-400">Loading audit history...</div>
                ) : taskHistory.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-xs">
                    Initial maker submission. No prior checker rejections or returns recorded for this task.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {taskHistory.map((hist) => (
                      <div
                        key={hist.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              hist.decision === 'Approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : hist.decision === 'Returned'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {hist.decision === 'Approved' ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : hist.decision === 'Returned' ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {hist.decision} by <strong className="text-[#102E4A]">{hist.actorId}</strong>{' '}
                              ({hist.actorRole})
                            </div>
                            <div className="text-slate-600 mt-1 italic bg-white p-2 rounded border border-slate-100">
                              "{hist.comments || 'No comment recorded.'}"
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono shrink-0">
                          {hist.decidedAt?.replace('T', ' ').substring(0, 16)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 6: Checker Decision Comments Input Box */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <label className="block font-bold text-slate-900 text-xs">
                  Checker Decision Remarks / Audit Notes{' '}
                  <span className="text-rose-600 font-semibold">* (Mandatory for Reject & Return)</span>
                </label>
                {decisionError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{decisionError}</span>
                  </div>
                )}
                <textarea
                  rows={3}
                  disabled={isSelectedTaskMakerSelf || selectedTask.status !== 'Pending'}
                  placeholder={
                    isSelectedTaskMakerSelf
                      ? 'Self-authorization disabled for maker under Four-Eyes Principle.'
                      : selectedTask.status !== 'Pending'
                      ? 'Task has already concluded its workflow lifecycle.'
                      : 'Enter checker approval audit notes, return correction feedback, or rejection rationale...'
                  }
                  value={checkerRemarks}
                  onChange={(e) => {
                    setCheckerRemarks(e.target.value);
                    if (e.target.value.trim()) setDecisionError(null);
                  }}
                  className={`w-full p-3 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#102E4A] ${
                    isSelectedTaskMakerSelf || selectedTask.status !== 'Pending'
                      ? 'bg-slate-100 cursor-not-allowed border-slate-200'
                      : 'border-slate-300'
                  }`}
                />
              </div>
            </div>

            {/* Bottom Actions Bar (§Requirement 1 & 6) */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailScreen(false)}
                className="btn-secondary py-2 px-4 text-xs border-slate-200 hover:bg-slate-50"
              >
                Close & Return to Queue
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInitiateDecision('Reject')}
                  disabled={
                    isSelectedTaskMakerSelf ||
                    selectedTask.status !== 'Pending' ||
                    actionLoading ||
                    currentUser.canApprove === false
                  }
                  className="btn-destructive py-2 px-4 text-xs bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold disabled:opacity-40"
                  title={
                    isSelectedTaskMakerSelf
                      ? 'Maker cannot reject their own submission.'
                      : 'Reject this request'
                  }
                >
                  <XCircle className="w-4 h-4 inline mr-1" />
                  Reject Request
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateDecision('Return')}
                  disabled={
                    isSelectedTaskMakerSelf ||
                    selectedTask.status !== 'Pending' ||
                    actionLoading ||
                    currentUser.canApprove === false
                  }
                  className="btn-secondary py-2 px-4 text-xs bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg font-semibold disabled:opacity-40"
                  title="Return to Maker for specific correction"
                >
                  <RotateCcw className="w-4 h-4 inline mr-1 text-amber-700" />
                  Return for Correction
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateDecision('Approve')}
                  disabled={
                    isSelectedTaskMakerSelf ||
                    selectedTask.status !== 'Pending' ||
                    actionLoading ||
                    currentUser.canApprove === false
                  }
                  className="btn-primary py-2 px-5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-sm disabled:opacity-40"
                  title={
                    isSelectedTaskMakerSelf
                      ? 'Self-approval prohibited (Four-Eyes Principle)'
                      : 'Authorize and seal transaction'
                  }
                >
                  <CheckCircle className="w-4 h-4 inline mr-1.5" />
                  {isSelectedTaskMakerSelf
                    ? 'Self-Approval Prohibited'
                    : currentUser.canApprove === false
                    ? 'Authorization Restricted'
                    : 'Approve & Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Confirmation Modal (§Requirement 6) */}
      {confirmationAction && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-xs p-5 space-y-4 animate-in fade-in zoom-in duration-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmationAction === 'Approve'
                    ? 'bg-emerald-100 text-emerald-700'
                    : confirmationAction === 'Return'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {confirmationAction === 'Approve' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : confirmationAction === 'Return' ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#102E4A]">
                  Confirm {confirmationAction} Decision
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Immutable dual-control action for Request {selectedTask.id}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">Request Type:</span>{' '}
                <strong className="text-slate-800">{formatActionType(selectedTask.actionType)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Authorized Checker:</span>{' '}
                <strong className="text-slate-800">{currentUser.name} ({currentUser.role})</strong>
              </div>
              <div>
                <span className="text-slate-500">Recorded Comments:</span>{' '}
                <span className="italic text-slate-700">
                  "{checkerRemarks.trim() || (confirmationAction === 'Approve' ? 'Approved by Checker' : 'N/A')}"
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              This action will be stamped permanently into the regulatory dual-control audit ledger and notify the submitting maker.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmationAction(null)}
                disabled={actionLoading}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={actionLoading}
                className={`btn-primary py-1.5 px-4 text-xs font-semibold text-white rounded-lg ${
                  confirmationAction === 'Approve'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : confirmationAction === 'Return'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {actionLoading ? 'Persisting Decision...' : `Confirm ${confirmationAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approval Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs space-y-4 p-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#102E4A]">
                Authorize {selectedTaskIds.length} Selected Tasks
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            {bulkError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Bulk Authorization Comments / Audit Rationale *
              </label>
              <textarea
                rows={3}
                required
                value={bulkRemarks}
                onChange={(e) => {
                  setBulkRemarks(e.target.value);
                  if (e.target.value.trim()) setBulkError(null);
                }}
                placeholder="Enter mandatory dual-control verification comments covering all selected tasks..."
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#102E4A]"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Comments are recorded immutably in each transaction's dual-control audit trail.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="btn-secondary py-1.5 px-3"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDecision}
                disabled={actionLoading || !bulkRemarks.trim()}
                className="btn-primary py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40"
              >
                {actionLoading ? 'Authorizing...' : `Authorize (${selectedTaskIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Authority Modal */}
      {showDelegateModal && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Delegate Approval Authority</h3>
              <button onClick={() => setShowDelegateModal(false)} className="text-white hover:text-slate-300">
                ✕
              </button>
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
                <label className="block font-semibold text-slate-800 mb-1">Delegate To (Officer) (M)</label>
                <select
                  value={delegateUserId}
                  onChange={(e) => setDelegateUserId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
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
                  <label className="block font-semibold text-slate-800 mb-1">Start Date (M)</label>
                  <input
                    type="date"
                    required
                    value={delegationStart}
                    onChange={(e) => setDelegationStart(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">End Date (M)</label>
                  <input
                    type="date"
                    required
                    value={delegationEnd}
                    onChange={(e) => setDelegationEnd(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Delegation Reason (M)</label>
                <textarea
                  required
                  rows={2}
                  value={delegationReason}
                  onChange={(e) => setDelegationReason(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowDelegateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary bg-[#102E4A] text-white">
                  Confirm Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal Integration */}
      <DocumentPreviewModal
        isOpen={previewDoc !== null}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={handleDocumentDownload}
        collaterals={collaterals}
      />
    </div>
  );
};
