// CBAIMS Full TypeScript Data Definitions

export type RoleCode =
  | 'EXEC'
  | 'SYSADMIN'
  | 'SRMGMT'
  | 'HODEPT'
  | 'DISTDIR'
  | 'BRMGR'
  | 'SRM'
  | 'BRM'
  | 'CRO'
  | 'BRO'
  | 'MGRCOLLDOC'
  | 'COLLDOCOFF'
  | 'COMPLIANCE'
  | 'RISK'
  | 'AUDITOR'
  | 'RDONLY';

export interface UserSession {
  userId: string;
  username: string;
  name: string;
  role: RoleCode;
  roleName: string;
  branch: string;
  branchCode?: string;
  district?: string;
  segment: string;
  segmentIds: string[];
  canApprove: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  token?: string;
}

export type BusinessSegmentName =
  | 'Corporate Banking'
  | 'Retail Banking'
  | 'MSME Banking'
  | 'Interest-Free Banking (IFB)'
  | string;

export interface BusinessSegment {
  id: string;
  name: BusinessSegmentName;
  description: string;
  riskProfile?: 'Low' | 'Medium' | 'High' | string;
  active: boolean;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  type: 'HeadOffice' | 'DistrictOffice' | 'CorporateCenter' | 'Branch' | string;
  parentDistrictId?: string;
  areaOffice?: string;
  segmentIds?: string;
  active: boolean;
}

export interface RolePermission {
  id: string;
  roleCode: RoleCode | string;
  screenName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
}

export interface Customer {
  id: string;
  cif: string;
  customerType: 'Individual' | 'Business' | 'Government';
  name: string;
  nationalId?: string;
  businessRegNo?: string;
  taxIdNo?: string;
  dobOrIncorp?: string;
  gender?: string;
  phone: string;
  email?: string;
  address?: string;
  segment: BusinessSegmentName;
  district?: string;
  branch: string;
  status: 'Active' | 'Dormant' | 'Closed';
  riskRating?: 'Low' | 'Medium' | 'High' | string;
  responsibleRm?: string;
  responsibleRo?: string;
  source: 'CBS_SIM' | 'Manual' | string;
  cbsSyncStatus?: string;
  cbsSyncedAt?: string;
  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  recordStat?: 'U' | 'O' | 'R' | string;
  authStat?: 'U' | 'A' | 'R' | string;
}

export interface LoanAccount {
  id: string;
  lineCode: string;
  loanReference: string;
  takedownAccountNumber?: string;
  customerId: string;
  facilityType: 'Term Loan' | 'Overdraft' | 'Revolving Credit' | 'Trade Finance' | 'Mortgage' | 'Working Capital' | string;
  lineCurrency: string;
  currency?: string;
  productCode?: string;
  revolvingLine: boolean;
  lineStartDate: string;
  lineExpiryDate: string;
  sanctionDate?: string;
  approvalDate?: string;
  maturityDate?: string;
  expiryDate?: string;
  approvedLimit: number;
  outstandingBalance: number;
  availableAmount: number;
  collateralContribution?: number;
  collateralPct?: number;
  segment: BusinessSegmentName;
  businessSegment?: string;
  branch: string;
  rmUserId?: string;
  status: 'Active' | 'Frozen' | 'Closed' | 'Matured' | 'Default' | string;
  nextReviewDueDate?: string;
  source: 'CBS_SIM' | 'Manual' | string;
  recordStat?: string;
  authStat?: string;
}

export interface CollateralOwner {
  id?: string;
  collateralId?: string;
  name: string;
  ownershipType: 'Borrower-owned' | 'Third-party-owned' | string;
  ownerType: 'Individual' | 'Business' | 'Government' | 'Corporate' | 'Other' | string;
  idNumber?: string;
  tin?: string;
  phone?: string;
  contactInfo?: string;
  percentage: number;
  ownershipPercentage?: number;
  relationship: string;
  relationshipToBorrower?: 'Shareholder' | 'Parent Company' | 'Director' | 'Guarantor' | 'Spouse' | 'Family Member' | 'Business Partner' | 'Other' | string;
  verificationStatus?: 'Recorded' | 'Pending Verification' | 'Verified' | 'Rejected' | string;
  consentInfo?: string;
  pledgeAgreementRef?: string;
  verificationDate?: string;
  verifyingOfficer?: string;
  remarks?: string;
  gpsX?: number;
  gpsY?: number;
  supersededDate?: string;
  businessRegNo?: string;
  status?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  transferReason?: string;
  supportingDocRef?: string;
}

export interface OwnershipDocument {
  id: string;
  entityType: 'Customer' | 'Facility' | 'Collateral' | 'Insurance Policy' | string;
  entityId: string;
  collateralId?: string;
  name: string;
  type: string;
  fileName?: string;
  fileContent?: string;
  parentDocumentId?: string;
  versionNotes?: string;
  isLatest?: boolean;
  verificationStatus?: 'Recorded' | 'Pending Verification' | 'Uploaded' | 'Rejected' | string;
  uploadDate: string;
  uploadedBy?: string;
  uploadedAt?: string;
  expiryDate?: string;
  dmsRef?: string;
  status: 'Active' | 'Expiring' | 'Expired' | 'Archived' | string;
  version: number;
  fileSize?: number;
  contentType?: string;
  fileUrl?: string;
  remarks?: string;
  retentionPolicy?: string;
}

export interface LoanCollateralLink {
  id: string;
  loanAccountId: string;
  facilityId?: string;
  customerId?: string;
  accountNumber?: string;
  branchCode?: string;
  linkedReferenceNo?: string;
  description?: string;
  linkageCurrency?: string;
  overallAmount?: number;
  collateralCategory?: string;
  haircut?: number;
  limitAmount?: number;
  linkedAmount?: number;
  linkedPercent?: number;
  linkedPercentage?: number;
  utilOrder?: number;
  reinstateOrder?: number;
  utilAmount?: number;
  status?: string;
  relationshipStatus?: string;
  releaseStatus?: string;
  takenOver?: string;
  effectiveDate?: string;
  endDate?: string;
  changeReason?: string;
  collateralId: string;
  allocatedAmount: number;
  linkageType?: 'Primary' | 'Secondary' | 'Cross-Collateral' | string;
  utilizationPct?: number;
  utilizationPercentage?: number;
  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  recordStat?: string;
  authStat?: string;
}

export interface Collateral {
  id: string;
  code: string;
  description?: string;
  customerId?: string;
  type?: string;
  category: string;
  currency?: string;
  valuationAmount: number;
  haircut?: number;
  nsv?: number;
  limitContribution?: number;
  startDate?: string;
  reviewDate?: string;
  currentAllocation?: number;
  utilizationPercentage?: number;
  status: 'Pending Approval' | 'Active' | 'Insured' | 'Under-Insured' | 'Uninsured' | 'Draft' | 'Release Pending' | 'Released' | string;
  ownerType: 'Borrower-owned' | 'Third-party-owned' | string;
  tangible?: boolean;
  secured?: boolean;
  chargeType?: string;
  cbsLastUpdated?: string;
  owningSegment: BusinessSegmentName;
  registrationNumber?: string;
  titleDeedNumber?: string;
  tinNumber?: string;
  gpsCoordinates?: string;
  gpsX?: number;
  gpsY?: number;
  location?: string;
  valuationDate?: string;
  valuationMethod?: string;
  engineNumber?: string;
  chassisNumber?: string;
  machinerySerialNo?: string;
  machineryPurchaseDate?: string;
  financialInstrumentRef?: string;
  issuingEntity?: string;
  branch: string;
  zipCode?: string;
  insuredAmount: number;
  netInsuranceCoveragePct: number;
  insuranceStatus: 'Uninsured' | 'Underinsured' | 'Adequately Insured' | 'Fully Insured' | string;
  verificationStatus?: 'Recorded' | 'Pending Verification' | 'Not Verified' | string;
  source?: string;
  sourceSystem?: string;
  createdBy?: string;
  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  recordStat?: 'U' | 'O' | 'R' | string;
  authStat?: 'U' | 'A' | 'R' | string;
  owners?: CollateralOwner[];
  documents?: OwnershipDocument[];
}

export interface LinkedFacilityDetailDto {
  linkId: string;
  loanAccountId: string;
  facilityId?: string;
  customerId?: string;
  currency?: string;
  status?: string;
  lineCode?: string;
  loanReference: string;
  facilityType: string;
  approvedLimit: number;
  outstandingBalance: number;
  availableAmount: number;
  lineCurrency: string;
  allocatedAmount: number;
  linkedPercentage?: number;
  linkageType?: string;
  relationshipStatus: string;
  releaseStatus: string;
  effectiveDate?: string;
  endDate?: string;
  loanStatus: string;
  customerCif?: string;
  customerName?: string;
  branch?: string;
  businessSegment?: string;
  relationshipManager?: string;
}

export interface DocumentChecklistItemDto {
  documentType: string;
  mandatory: boolean;
  attached: boolean;
  satisfied?: boolean;
  notes?: string;
  matchingDocumentNames?: string[];
  documentId?: string;
  documentName?: string;
  verificationStatus: string;
  ruleStatus: 'SATISFIED' | 'MISSING' | 'OPTIONAL' | string;
}

export interface Collateral360Dto {
  collateral: Collateral;
  customer?: Customer;
  activeOwners: CollateralOwner[];
  historicalOwners: CollateralOwner[];
  linkedFacilities: LinkedFacilityDetailDto[];
  insurancePolicies: InsurancePolicy[];
  workflowTasks: WorkflowTask[];
  documentChecklist: DocumentChecklistItemDto[];
  auditHistory: AuditLog[];
  netCollateralValue: number;
  totalAllocatedAmount: number;
  unallocatedAmount: number;
  remainingCollateralCapacity?: number;
  totalSecuredExposure: number;
  utilizationPercentage: number;
  crossCollateralized: boolean;
}

export interface PolicyEndorsement {
  id: string;
  policyId: string;
  endorsementNo: string;
  description: string;
  effectiveDate: string;
  documentId?: string;
  makerId?: string;
  makerDtStamp?: string;
  recordStat?: string;
}

export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  collateralId: string;
  customerId?: string;
  insurerId?: string;
  insurerName: string;
  coverageType: string;
  insuredAmount: number;
  premium: number;
  effectiveDate: string;
  expiryDate: string;
  status: 'Draft' | 'Pending Approval' | 'Active' | 'Expiring' | 'Expired' | 'Cancelled' | 'Closed' | 'Replaced' | 'Renewed' | string;
  replacesPolicyId?: string;
  renewedFromPolicyId?: string;
  cancellationReason?: string;
  closureReason?: string;
  reopeningReason?: string;
  amendmentReason?: string;
  loanAccountId?: string;
  endorsementCount?: number;
  version: number;
  historyJson?: string;
  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  recordStat?: 'U' | 'O' | 'R' | string;
  authStat?: 'U' | 'A' | 'R' | string;
}

export interface InsuranceComplianceDto {
  insuranceRequired: boolean;
  requiredCoverageType?: string;
  collateralCategory?: string;
  collateralType?: string;
  collateralValue: number;
  haircut: number;
  netSecurityValue: number;
  outstandingExposure: number;
  requiredInsuranceAmount: number;
  insuredAmount: number;
  coveragePercentage: number;
  coverageGap: number;
  coverageExcess: number;
  coverageStatus: 'NOT_REQUIRED' | 'UNINSURED' | 'UNDERINSURED' | 'ADEQUATELY_INSURED' | 'EXCESS_INSURANCE' | string;
  policyValidityStatus: 'VALID' | 'EXPIRED' | 'INSUFFICIENT_TERM' | 'INVALID_RANGE' | 'MISSING_DATES' | string;
  approvedInsurerStatus: 'APPROVED' | 'UNAPPROVED' | 'INACTIVE' | 'RESTRICTED' | 'MISSING' | string;
  mandatoryDocumentStatus: 'SATISFIED' | 'MISSING_DOCUMENTS' | 'NOT_REQUIRED' | string;
  duplicateStatus: 'UNIQUE' | 'DUPLICATE_POLICY_NUMBER' | 'DUPLICATE_ACTIVE_POLICY' | string;
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | string;
  overallCompliant?: boolean;
  validationErrors: string[];
  missingDocuments: string[];
  warnings: string[];
}

export interface StructuredPolicyHistoryItem {
  id: string;
  policyId: string;
  eventType: string;
  previousStatus?: string;
  newStatus?: string;
  version: number;
  userId: string;
  userRole?: string;
  timestamp: string;
  reason?: string;
  workflowTaskId?: string;
  snapshotJson?: string;
}

export interface WorkflowTask {
  id: string;
  processInstanceId?: string;
  entityType: string;
  entityId: string;
  actionType: string;
  payloadDiffJson?: string;
  remarks?: string;
  makerId: string;
  currentStep: string;
  candidateRole: string;
  candidateUserId?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | string;
  priority?: 'High' | 'Medium' | 'Low' | string;
  submittedAt: string;
  completedAt?: string;
  slaDueAt?: string;
  isEscalated?: boolean;
}

export interface ApprovalHistory {
  id: string;
  workflowTaskId: string;
  actorId: string;
  actorRole: string;
  stepName: string;
  decision: 'Approved' | 'Rejected' | 'Returned' | 'Delegated' | string;
  comments?: string;
  decidedAt: string;
}

export interface Delegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Active' | 'Revoked' | 'Expired' | string;
  createdAt?: string;
}

export interface CimsException {
  id: string;
  exceptionType: string;
  entityType: string;
  entityId: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  description: string;
  assignedToRole?: string;
  assignedToUserId?: string;
  assignedToUser?: string;
  assignedAt?: string;
  assignedBy?: string;
  evidenceDocument?: string;
  affectedCollateralId?: string;
  affectedPolicyId?: string;
  customerId?: string;
  customerCif?: string;
  facilityId?: string;
  loanReference?: string;
  collateralId?: string;
  policyId?: string;
  branch?: string;
  district?: string;
  businessSegment?: string;
  relationshipManagerId?: string;
  relationshipOfficerId?: string;
  detectionSource?: string;
  escalationLevel?: number;
  lastEscalationDate?: string;
  nextEscalationDue?: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Escalated' | string;
  slaDueDate?: string;
  slaStatus?: 'Within SLA' | 'Due Soon' | 'Overdue' | 'Unconfigured' | string;
  daysOpen?: number;
  daysOverdue?: number;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  correctiveAction?: string;
  failedRequirement?: string;
  reason?: string;
  comments?: string;
}

export interface CimsExceptionInvestigationNote {
  id: string;
  exceptionId: string;
  authorId: string;
  authorName: string;
  noteText: string;
  createdAt: string;
}

export interface CimsExceptionEscalationHistory {
  id: string;
  exceptionId: string;
  previousStatus?: string;
  newStatus?: string;
  previousRole?: string;
  previousUserId?: string;
  newRole?: string;
  newUserId?: string;
  escalationLevel: number;
  escalatedBy: string;
  escalatedAt: string;
  reason?: string;
  notificationReference?: string;
}

export interface CimsExceptionAssignmentHistory {
  id: string;
  exceptionId: string;
  previousRole?: string;
  previousUserId?: string;
  newRole?: string;
  newUserId?: string;
  assignedBy: string;
  assignedAt: string;
  reason?: string;
}

export interface ExceptionSummaryDto {
  totalOpen: number;
  critical: number;
  high: number;
  dueSoon: number;
  overdue: number;
  escalated: number;
  resolvedToday: number;
  unassigned: number;
}

export interface ScanResultDto {
  scanStartedAt: string;
  scanCompletedAt?: string;
  policiesEvaluated: number;
  collateralsEvaluated: number;
  documentsEvaluated: number;
  exceptionsCreated: number;
  exceptionsUpdated: number;
  exceptionsAutoResolved: number;
  errorsEncountered: number;
  errorMessages: string[];
}

export interface NotificationItem {
  id: string;
  channel: 'SMS' | 'Email';
  templateCode?: string;
  recipient: string;
  recipientName?: string;
  subject?: string;
  messageBody: string;
  entityType?: string;
  entityId?: string;
  status: 'Sent' | 'Failed' | 'Queued' | string;
  sentAt: string;
  errorMessage?: string;
  retryCount?: number;
}

export interface NotificationTemplate {
  id: string;
  code?: string;
  name: string;
  type?: string;
  eventType?: string;
  channel: 'SMS' | 'Email';
  triggerDaysBefore?: number;
  subject?: string;
  body: string;
  active?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole?: string;
  userName?: string;
  username?: string;
  roleCode?: string;
  ipAddress?: string;
  actionType: string;
  action?: string;
  entityType?: string;
  entityId: string;
  result?: string;
  stateBeforeJson?: string;
  stateAfterJson?: string;
  fieldName?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  comments?: string;
  reason?: string;
}

export interface ApprovalHierarchyConfig {
  id: string;
  transactionType: string;
  approvalLevels: number;
  level1Role: string;
  level2Role?: string;
  bulkApproveAllowed: boolean;
  slaHours: number;
  active: boolean;
  hierarchyLevel?: string;
  branchCode?: string;
  districtName?: string;
  hoDepartment?: string;
  exceptionType?: string;
  makerRole?: string;
}

export interface ReminderSchedule {
  id: string;
  daysBeforeExpiry: number;
  channelsJson: string;
  recipientRolesJson: string;
  active: boolean;
  audience?: 'Staff' | 'Customer' | string;
  triggerBasis?: 'Before Expiry' | 'After Expiry' | string;
  offsetDays?: number;
  dayType?: 'Working Day' | 'Calendar Day' | string;
  recurrence?: 'One-time' | 'Every N Working Days' | 'Every N Calendar Days' | string;
  continueUntil?: 'Renewed' | 'Resolved' | 'Other' | string;
}

export interface ScheduledReport {
  id: string;
  reportName?: string;
  reportType?: string;
  cronSchedule?: string;
  frequency?: 'Daily' | 'Weekly' | 'Monthly';
  recipients?: string;
  recipientsJson?: string;
  format?: 'PDF' | 'Excel' | 'CSV';
  parametersJson?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  active?: boolean;
  status?: 'Active' | 'Paused';
  createdBy?: string;
  createdAt?: string;
}

export interface ApprovedInsurer {
  id: string;
  name: string;
  licenseNo?: string;
  rating?: string;
  contactInfo?: string;
  status?: string;
  active: boolean;
  concentrationCapPct?: number;
}

export interface CollateralTaxonomy {
  id: string;
  category: string;
  subCategory?: string;
  subType?: string;
  defaultHaircut?: number;
  valuationFrequencyMonths?: number;
  status?: string;
  insuranceMandatory?: boolean;
  mandatoryCoverageType?: string;
  active?: boolean;
}

export interface MandatoryDocumentRule {
  id: string;
  collateralCategory: string;
  collateralType?: string;
  documentType: string;
  ownershipCondition?: string;
  applicabilityCondition?: string;
  mandatory: boolean;
  active?: boolean;
}

export interface HolidayCalendar {
  id: string;
  holidayDate: string;
  description: string;
}

export interface SystemParameter {
  paramKey: string;
  paramValue: string;
  paramType?: string;
  description?: string;
}

// CBS Simulator Models
export interface CbsCustomer {
  id: string;
  cif: string;
  customerType: 'Individual' | 'Business' | 'Government';
  fullName: string;
  nationalId?: string;
  businessRegNo?: string;
  taxIdNo?: string;
  dobOrIncorp?: string;
  gender?: string;
  phone: string;
  email?: string;
  address?: string;
  businessSegment: string;
  branch: string;
  customerStatus: 'Active' | 'Dormant' | 'Closed' | string;
  riskRating?: string;
  syncedAt?: string;
  syncStatus: 'Synced' | 'Not Synced' | 'Pending' | 'Failed' | string;
}

export interface CbsFacility {
  id: string;
  lineCode: string;
  customerCif: string;
  loanRefNo: string;
  facilityType: string;
  lineCurrency: string;
  revolvingLine: boolean;
  lineStartDate: string;
  lineExpiryDate: string;
  approvedLimit: number;
  availableAmount: number;
  outstandingAmount: number;
  collateralContribution: number;
  collateralPct: number;
  businessSegment: string;
  branch: string;
  relationshipManager?: string;
  limitStatus: string;
  nextReviewDate?: string;
  syncedAt?: string;
  syncStatus: 'Synced' | 'Not Synced' | 'Pending' | 'Failed' | string;
}

export interface CbsCollateral {
  id: string;
  collateralCode: string;
  customerCif: string;
  description: string;
  category: string;
  currency: string;
  collateralValue: number;
  haircut: number;
  limitContribution: number;
  startDate: string;
  reviewDate?: string;
  collateralType: string;
  ownershipType?: 'Borrower-owned' | 'Third-party-owned' | string;
  tangible: boolean;
  linkedLoanRefs?: string;
  linkedAccountNo?: string;
  linkageType: string;
  businessSegment: string;
  branch: string;
  zipCode?: string;
  syncedAt?: string;
  syncStatus: 'Synced' | 'Not Synced' | 'Pending' | 'Failed' | string;
}

export interface CbsSyncLog {
  id: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  direction: string;
  sourceSystem?: string;
  result: string;
  errorMessage?: string;
  startTime?: string;
  completionTime?: string;
  recordsProcessed?: number;
  recordsSucceeded?: number;
  recordsFailed?: number;
  customerCount?: number;
  facilityCount?: number;
  collateralCount?: number;
  relationshipCount?: number;
  syncBatchId?: string;
  payloadJson?: string;
}

export interface CbsSyncStatus {
  cbsMode: 'SIMULATOR' | 'REAL';
  connectionStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  connectionMessage: string;
  cbsConnected: boolean;
  lastSyncTimestamp?: string | null;
  lastSuccessfulSync?: string | null;
  lastFailedSync?: string | null;
  lastResult?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'NONE' | string;
  syncedCustomersCount: number;
  syncedLoansCount: number;
  syncedCollateralsCount: number;
  syncedLinksCount: number;
  syncMode?: string;
  syncIntervalMinutes?: number;
}

export interface CbsAccCollLinkDtls {
  id: string;
  accountNumber: string;
  branchCode: string;
  linkageType: string;
  linkedReferenceNo: string;
  description?: string;
  linkageBranch?: string;
  linkageCurrency: string;
  overallAmount: number;
  collateralCategory?: string;
  haircut: number;
  limitAmount: number;
  linkedAmount: number;
  linkedPercentNumber: number;
  utilOrder: number;
  reinstateOrder: number;
  utilAmount: number;
  commitmentProduct?: string;
  status: string;
  takenOver: string;
  syncedAt?: string;
  syncStatus: 'Synced' | 'Not Synced' | string;
  createdAt?: string;
}

export interface ExposureAdequacySummary {
  collateralId: string;
  collateralCode: string;
  customerId: string;
  totalFacilityLimit: number;
  totalOutstandingExposure: number;
  collateralMarketValue: number;
  haircutPercentage: number;
  netCollateralValue: number;
  totalAllocatedSecurity: number;
  unallocatedSecurity: number;
  requiredInsurancePercentage: number;
  requiredInsuranceAmount: number;
  currentInsuredAmount: number;
  insuranceGap: number;
  adequacyStatus: 'ADEQUATE' | 'UNDERINSURED' | 'EXCESS' | 'NOT REQUIRED' | 'EXPIRED' | 'NON_COMPLIANT' | string;
  calculationExplanation: string;
  facilityBreakdowns: Array<{
    linkId: string;
    facilityId: string;
    loanReference?: string;
    facilityType?: string;
    approvedLimit?: number;
    outstandingBalance?: number;
    allocatedAmount: number;
    linkageType?: string;
  }>;
}

export interface Customer360 {
  customer: Customer;
  facilities: LoanAccount[];
  collaterals: Collateral[];
  collateralFacilityLinks: LoanCollateralLink[];
  insurancePolicies: InsurancePolicy[];
  documents: OwnershipDocument[];
  pendingApprovals: WorkflowTask[];
  exceptions: any[];
  auditHistory: any[];
  exposureSummary?: ExposureAdequacySummary;
}

export interface ScopeBannerData {
  displayScope: string;
  scopeLevel: 'BANK_WIDE' | 'SEGMENT' | 'DISTRICT' | 'BRANCH' | 'PORTFOLIO' | string;
  authorizedRole: string;
  segment: string;
  availableSegments: string[];
  district: string;
  availableDistricts?: string[];
  branch: string;
  availableBranches?: string[];
  portfolioOwner?: string;
  lockedSegment: boolean;
  lockedDistrict: boolean;
  lockedBranch: boolean;
  serverDate: string;
  lastRefresh: string;
  asOfDate?: string;
  cbsSyncStatus?: string;
  cbsLastSyncedAt?: string;
  cbsFreshnessMessage?: string;
  authorizedBranchesCount?: number;
  scopedBranchesCount?: number;
  scopeBoundaryDescription?: string;
}

export interface DashboardSummary {
  scopeBanner: ScopeBannerData;
  totalOutstandingExposure: number;
  totalAllocatedSecuredExposure?: number;
  totalCollateralMarketValue: number;
  totalNetSecurityValue: number;
  totalInsuranceRequired: number;
  totalValidActiveInsurance: number;
  totalInsuranceGap: number;
  insuranceCoveragePct: number;
  insuranceComplianceRate?: number;
  insuranceRequiredCollateralsCount?: number;
  minimumCoverageAdequacyPct?: number;
  expiredPoliciesCount: number;
  policiesDueWithin7DaysCount?: number;
  policiesExpiringWithin30Days: number;
  openExceptionsCount: number;
  pendingApprovalsCount: number;
  activeCollateralsCount: number;
  totalCollateralsCount?: number;
  totalCustomersCount: number;
  totalFacilitiesCount: number;
  totalBranchesCount: number;
  authorizedBranchesCount?: number;
  scopedBranchesCount?: number;
  missingDocumentsCount: number;
  pendingDocumentVerificationsCount: number;
  mandatoryDocumentsCompleteCount?: number;
  missingMandatoryDocumentsCount?: number;
  expiredDocumentsCount?: number;
  expiringDocumentsCount?: number;
  uninsuredCollateralsCount?: number;
  uninsuredCollateralsMarketValue?: number;
  underinsuredCollateralsCount?: number;
  underinsuredCollateralsGap?: number;
  adequatelyInsuredCollateralsCount?: number;
  renewalsInProgressCount?: number;
  returnedTasksCount: number;
  overrideCount: number;
  insurerConcentrationMaxPct: number;
  actualTopInsurerExposurePct?: number;
  actualTopInsurerName?: string;
  configuredInsurerConcentrationLimitPct?: number;
  systemDate: string;
  lastRefreshTimestamp: string;
}

export interface DashboardChartData {
  complianceDonut: Array<{ name: string; value: number; color: string; count?: number; marketValue?: number }>;
  exposureVsProtection: Array<{ segment: string; collateralValue: number; exposure?: number; insuranceRequired: number; insuredCoverage: number; activeInsurance?: number; gap: number; insuranceGap?: number; coveragePct?: number }>;
  districtRanking: Array<{ district: string; districtName?: string; exposure: number; insuranceRequired?: number; activeInsurance?: number; insuranceGap: number; compliancePct: number; collateralCount?: number }>;
  branchRanking: Array<{ branch: string; collateralValue: number; exposure?: number; insuranceRequired: number; insuredAmount: number; activeInsurance?: number; insuranceGap: number; compliancePct: number }>;
  expiryPipeline: Array<{ bucket: string; count: number; color: string; insuredAmount?: number; policyCount?: number }>;
  collateralCategoryDistribution: Array<{ category: string; count: number; value: number; insuranceGap: number; exposure?: number; insuranceRequired?: number; activeInsurance?: number }>;
  collateralTypeExposure?: Array<{ type: string; collateralType: string; count: number; value: number; exposure: number; insuranceRequired: number; activeInsurance: number; insuranceGap: number; coveragePct: number }>;
  topInsuranceGaps: Array<{ collateralCode: string; customerName: string; cif: string; branch: string; requiredInsurance: number; activeInsurance: number; insuranceGap: number }>;
  insurerExposure?: Array<{ insurer: string; insurerName: string; activeInsurance: number; portfolioSharePct: number; policyCount: number; expiringPolicyCount: number; configuredLimit: number; isConcentrationRisk: boolean }>;
  policyAgeing?: Array<{ ageBucket: string; policyCount: number; insuredAmount: number; averageAgeDays: number; oldestPolicyDays: number }>;
  rmCompliance?: Array<{ rmName: string; officer: string; collateralCount: number; customerCount: number; collateralValue: number; exposure: number; insuranceRequired: number; activeInsurance: number; insuranceGap: number; coveragePct: number }>;
  organizationalComparison?: Array<any>;
  workflowFunnel: Array<{ status: string; count: number }>;
  documentationHealth: Array<{ name: string; value: number; color: string; count?: number }>;
  ownershipDistribution: Array<{ ownershipType: string; count: number }>;
  historicalSnapshots?: any[];
  historicalDataMessage?: string;
}

export interface DashboardPortfolioRow {
  customerId: string;
  customerName: string;
  cif: string;
  segment: string;
  district: string;
  branch: string;
  rmName: string;
  roName: string;
  facilityId: string;
  facilityRef: string;
  facilityType: string;
  facilityOutstandingExposure?: number;
  allocatedExposure?: number;
  outstandingExposure: number;
  collateralId: string;
  collateralCode: string;
  collateralDescription: string;
  collateralCategory: string;
  collateralType: string;
  ownershipType: string;
  marketValue: number;
  haircut: number;
  netSecurity: number;
  allocatedSecurity: number;
  insuranceRequired: number;
  insuredAmount: number;
  insuranceGap: number;
  coveragePct: number;
  adequacyStatus?: string;
  policyId?: string;
  policyNumber?: string;
  insurerName?: string;
  policyStatus: string;
  expiryDate?: string;
  daysToExpiry?: number;
  documentStatus: string;
  workflowStatus: string;
  exceptionStatus: string;
  priority: string;
}

export interface KpiExplanation {
  kpiKey: string;
  kpiTitle: string;
  formula: string;
  definition: string;
  scope: string;
  asOfDate: string;
  subUnitContributions: Array<{
    name: string;
    exposure: number;
    insuranceRequired: number;
    activeInsurance: number;
    gap: number;
    coveragePct: number;
    collateralCount: number;
  }>;
  topRiskContributors: Array<{
    id: string;
    code: string;
    name: string;
    entityType: string;
    branch: string;
    segment: string;
    borrowerName: string;
    amount: number;
    gap: number;
    issue: string;
    actionLabel: string;
    routeTarget: string;
  }>;
  recommendedActions: string[];
}

export interface DashboardSnapshot {
  id: string;
  snapshotDate: string;
  asOfDate: string;
  capturedAt: string;
  scopeLevel: string;
  scopeId: string;
  totalExposure: number;
  collateralValue: number;
  netSecurityValue: number;
  requiredInsurance: number;
  activeInsurance: number;
  insuranceGap: number;
  coveragePercentage: number;
  uninsuredCollateralsCount: number;
  underinsuredCollateralsCount: number;
  expiredPoliciesCount: number;
  openExceptionsCount: number;
  totalFacilitiesCount: number;
  totalCustomersCount: number;
  totalCollateralsCount: number;
}

export interface PaginatedPortfolioResponse {
  content: DashboardPortfolioRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface DashboardWorkQueueItem {
  id: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  category: string;
  customerName: string;
  customerCif: string;
  facilityRef?: string;
  collateralCode?: string;
  policyNumber?: string;
  issueDescription: string;
  daysRemainingOrOverdue: number;
  requiredAction: string;
  status: string;
  assignedOfficer: string;
  branch: string;
  segment: string;
  exposureAmount?: number;
  gapAmount?: number;
  targetModule?: string;
  targetEntityId?: string;
}

// --- High-Volume Enterprise Dashboard Types ---

export interface SearchCustomerItem {
  id: string;
  cif: string;
  name: string;
  customerType: string;
  segment: string;
  branch: string;
  status: string;
  totalExposure: number;
  totalCollateralValue: number;
}

export interface SearchFacilityItem {
  id: string;
  loanReference: string;
  accountNumber?: string;
  customerId: string;
  customerName?: string;
  facilityType: string;
  approvedAmount: number;
  currentBalance: number;
  outstandingBalance: number;
  segment: string;
  branch: string;
  status: string;
}

export interface SearchCollateralItem {
  id: string;
  code: string;
  description: string;
  category: string;
  type: string;
  customerId: string;
  customerName?: string;
  marketValue: number;
  netValue: number;
  owningSegment: string;
  branch: string;
  status: string;
}

export interface EnterpriseSearchResponse {
  customers: SearchCustomerItem[];
  facilities: SearchFacilityItem[];
  collaterals: SearchCollateralItem[];
  totalMatches: number;
}

export interface TopDebtor {
  cif: string;
  customerName: string;
  customerType: string;
  segment: string;
  branch: string;
  facilityCount: number;
  collateralCount: number;
  totalExposure: number;
  collateralMarketValue: number;
  netSecurityValue: number;
  effectiveLtvPct: number;
  coveragePct: number;
  insuranceStatus: string;
  riskRating: string;
}

export interface TopDeficitFacility {
  facilityId: string;
  loanReference: string;
  accountNumber?: string;
  cif: string;
  customerName: string;
  facilityType: string;
  approvedLimit: number;
  outstandingBalance: number;
  pledgedCollateralValue: number;
  shortfallAmount: number;
  ltvRatio: number;
  branch: string;
  segment: string;
  actionRequired: string;
}

export interface SharedCollateralPool {
  collateralId: string;
  collateralCode: string;
  description: string;
  category: string;
  marketValue: number;
  netSecurityValue: number;
  linkedFacilitiesCount: number;
  totalLinkedExposure: number;
  totalAllocationPct: number;
  overCommitted: boolean;
  ownerName: string;
  branch: string;
  linkedFacilityRefs: string[];
}

export interface CriticalExpiringCollateral {
  collateralId: string;
  collateralCode: string;
  description: string;
  category: string;
  customerName: string;
  cif: string;
  marketValue: number;
  exposedLoanAmount: number;
  issueType: string;
  policyNumber?: string;
  expiryDate?: string;
  daysPastOrToExpiry: number;
  branch: string;
}

export interface EnterpriseRiskConcentration {
  totalCreditExposure: number;
  grossCollateralMarketValue: number;
  singleCountedPledgedValue: number;
  netRealizableSecurityValue: number;
  portfolioWeightedLtvPct: number;
  portfolioCoveragePct: number;
  netUncoveredDeficit: number;
  multiPledgedCollateralCount: number;
  topDebtors: TopDebtor[];
  topDeficitFacilities: TopDeficitFacility[];
  sharedCollaterals: SharedCollateralPool[];
  criticalExpiringCollaterals: CriticalExpiringCollateral[];
}

export interface ValidationCheckItemDto {
  category: string;
  ruleName?: string;
  checkName?: string;
  passed: boolean;
  message: string;
  overrideable: boolean;
  exceptionType?: string;
  failedRequirement?: string;
  code?: string;
  ruleKey?: string;
  severity?: 'INFO' | 'WARNING' | 'HARD_STOP' | string;
}

export interface PolicyPreValidationResultDto {
  valid: boolean;
  hasHardBlock: boolean;
  canSubmitAsException: boolean;
  summaryMessage: string;
  checks: ValidationCheckItemDto[];
}

export interface EntryTimeExceptionRequest {
  policy?: Partial<InsurancePolicy>;
  collateral?: Partial<Collateral>;
  allocations?: any[];
  exceptionType: string;
  failedRequirement: string;
  reason: string;
  comments: string;
  evidenceDocument?: string;
  documents?: any[];
  entityType?: string;
  entityId?: string;
  collateralId?: string;
  customerId?: string;
  severity?: string;
}

// ==========================================
// Module 3: Relationship & Allocation Types
// ==========================================

export interface CollateralCandidateDto {
  id: string;
  code: string;
  description?: string;
  category: string;
  type?: string;
  customerId?: string;
  customerName?: string;
  customerCif?: string;
  ownershipType: 'Borrower-owned' | 'Third-party-owned' | 'Jointly-owned' | string;
  legalOwnerNames?: string;
  ownerRelationship?: string;
  valuationAmount: number;
  haircut: number;
  netCollateralValue: number;
  currentAllocation: number;
  availableCapacity: number;
  utilizationPct: number;
  alreadyLinked: boolean;
  existingAllocationToThisFacility?: number;
  satisfiesNormalOwnership: boolean;
  thirdParty: boolean;
  thirdPartyValid: boolean;
  eligible: boolean;
  ineligibilityReason?: string;
  legalOwners?: string[];
}

export interface CollateralFacilityLinkDto {
  id: string;
  collateralId: string;
  collateralCode?: string;
  collateralDescription?: string;
  collateralCategory?: string;
  collateralType?: string;
  collateralOwnerType?: string;
  collateralValuation: number;
  collateralHaircut: number;
  netCollateralValue: number;
  collateralUnallocatedSecurity: number;

  facilityId?: string;
  loanAccountId: string;
  loanReference?: string;
  accountNumber?: string;
  cbsFacilityRef?: string;
  cbsLoanAccount?: string;
  cbsCollateralRef?: string;
  source?: string;
  sourceRecordId?: string;

  customerId?: string;
  customerCif?: string;
  customerName?: string;
  borrowerCustomerId?: string;
  borrowerCif?: string;
  borrowerName?: string;

  collateralOwnerCustomerId?: string;
  collateralOwnerCif?: string;
  legalOwnerNames?: string;
  thirdParty?: boolean;
  relationshipToBorrower?: string;
  ownershipPercentage?: number;
  ownershipVerificationStatus?: string;
  pledgeAgreementRef?: string;
  consentInfo?: string;

  facilityType?: string;
  facilityCurrency?: string;
  approvedLimit: number;
  outstandingBalance: number;
  availableAmount: number;
  businessSegment?: string;
  branch?: string;
  relationshipManager?: string;
  facilityStatus?: string;

  allocatedAmount: number;
  linkedAmount?: number;
  collateralAllocationPct: number; // % of Collateral Allocated
  facilityCoveragePct: number;    // % of Facility Covered by Allocation
  utilAmount?: number;
  utilizationPct?: number;
  linkageType: 'Primary' | 'Secondary' | 'Cross-Collateral' | string;
  utilOrder?: number;
  reinstateOrder?: number;
  effectiveDate?: string;
  endDate?: string;
  relationshipStatus: string;
  releaseStatus?: string;

  activeInsuranceAmount: number;
  requiredInsuranceAmount: number;
  insuranceGap: number;
  insuranceStatus?: string;
  linkedPolicyCount: number;

  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  recordStat?: string;
  authStat?: string;
  modNo?: number;
  changeReason?: string;
}

export interface CollateralSecuredFacilitiesSummaryDto {
  collateralId: string;
  collateralCode: string;
  description: string;
  category: string;
  type: string;
  ownerType: string;
  currency: string;
  marketValuation: number;
  haircut: number;
  netCollateralValue: number;
  totalAllocatedSecurity: number;
  unallocatedSecurity: number;
  utilizationPct: number;

  linkedFacilityCount: number;
  aggregateSecuredExposure: number;
  totalFacilityApprovedLimit: number;

  currentInsuredAmount: number;
  requiredInsuranceAmount: number;
  insuranceGap: number;
  adequacyStatus: string;
  coveragePercentage: number;
  calculationExplanation?: string;

  securedFacilities: CollateralFacilityLinkDto[];
}

export interface FacilityCollateralSummaryDto {
  facilityId: string;
  loanAccountId: string;
  loanReference: string;
  lineCode?: string;
  accountNumber?: string;
  customerId: string;
  customerName: string;
  customerCif: string;
  facilityType: string;
  currency: string;
  approvedLimit: number;
  outstandingBalance: number;
  availableAmount: number;
  businessSegment: string;
  branch: string;
  status: string;

  linkedCollateralCount: number;
  totalAllocatedCollateral: number;
  totalNetCollateralValue: number;
  totalMarketValuation: number;
  collateralCoveragePct: number;

  totalRecognizedInsurance: number;
  insuranceRequirement: number;
  insuranceGap: number;
  adequacyStatus: string;
  insuranceCoveragePct: number;

  securingCollaterals: CollateralFacilityLinkDto[];
}

export interface RelationshipRequestDto {
  id?: string;
  collateralId: string;
  loanAccountId: string;
  facilityId?: string;
  allocatedAmount: number;
  linkageType?: string;
  utilOrder?: number;
  reinstateOrder?: number;
  effectiveDate?: string;
  endDate?: string;
  changeReason?: string;
  source?: string;
  sourceRecordId?: string;
  borrowerCustomerId?: string;
  relationshipToBorrower?: string;
  pledgeAgreementRef?: string;
  consentInfo?: string;
  thirdPartyPledge?: boolean;
}

export interface RelationshipValidationResultDto {
  valid: boolean;
  canProceed: boolean;
  summaryMessage: string;
  netCollateralValue: number;
  requestedAllocationAmount: number;
  currentActiveAllocations: number;
  projectedTotalAllocation: number;
  remainingUnallocatedSecurity: number;
  excessAllocationAmount?: number;
  collateralAllocationPct: number;
  facilityCoveragePct: number;
  facilityOutstandingBalance: number;
  facilityApprovedLimit: number;

  collateralId?: string;
  collateralCode?: string;
  collateralDescription?: string;
  collateralStatus?: string;
  collateralCurrency?: string;

  facilityId?: string;
  loanReference?: string;
  accountNumber?: string;
  facilityStatus?: string;
  facilityCurrency?: string;
  currencyMatched?: boolean;

  legalOwnerName?: string;
  legalOwnerCustomerId?: string;
  legalOwnerCif?: string;
  ownerType?: string;
  ownershipPercentage?: number;
  ownerVerificationStatus?: string;
  relationshipToBorrower?: string;

  borrowerName?: string;
  borrowerCustomerId?: string;
  borrowerCif?: string;

  ownerBorrowerMatch?: boolean;
  thirdParty?: boolean;
  consentStatus?: string;
  pledgeAgreementRef?: string;
  hasRequiredPledgeEvidence?: boolean;

  overallDecision?: 'CAN_PROCEED' | 'REQUIRES_CORRECTION' | 'BLOCKED' | string;
  warningMessages?: string[];
  blockingMessages?: string[];

  checks: ValidationCheckItemDto[];
}

export interface LoanCollateralLinkHistoryDto {
  id: string;
  linkId: string;
  collateralId: string;
  loanAccountId: string;
  facilityId?: string;
  customerId?: string;
  previousAllocatedAmount: number;
  newAllocatedAmount: number;
  previousLinkageType?: string;
  newLinkageType?: string;
  previousEffectiveDate?: string;
  newEffectiveDate?: string;
  previousEndDate?: string;
  newEndDate?: string;
  previousStatus?: string;
  newStatus?: string;
  actionType: string;
  changeReason?: string;
  makerId?: string;
  makerDtStamp?: string;
  checkerId?: string;
  checkerDtStamp?: string;
  authStat?: string;
}

export interface CbsRelationshipReconciliationItem {
  linkId?: string;
  loanAccountId: string;
  collateralId: string;
  status: 'MATCHING' | 'CBS_ONLY' | 'CIMS_ONLY' | 'CHANGED_IN_CBS' | 'INCONSISTENT';
  cbsLinkedAmount: number;
  cimsAllocatedAmount: number;
  cbsLinkageType?: string;
  cimsLinkageType?: string;
  cbsStatus?: string;
  cimsStatus?: string;
  differenceSummary?: string;
}

export interface CbsRelationshipReconciliationDto {
  totalCbsRelationships: number;
  totalCimsRelationships: number;
  matchingCount: number;
  cbsOnlyCount: number;
  cimsOnlyCount: number;
  changedCount: number;
  inconsistentCount: number;
  reconciliationTimestamp: string;
  items: CbsRelationshipReconciliationItem[];
}




