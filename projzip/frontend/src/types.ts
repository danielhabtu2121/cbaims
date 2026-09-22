// CIMS Full TypeScript Data Definitions

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
  revolvingLine: boolean;
  lineStartDate: string;
  lineExpiryDate: string;
  approvedLimit: number;
  outstandingBalance: number;
  availableAmount: number;
  collateralContribution?: number;
  collateralPct?: number;
  segment: BusinessSegmentName;
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
  relationship: string;
  relationshipToBorrower?: 'Shareholder' | 'Parent Company' | 'Director' | 'Guarantor' | 'Spouse' | 'Family Member' | 'Business Partner' | 'Other' | string;
  consentInfo?: string;
  pledgeAgreementRef?: string;
  verificationStatus: 'Recorded' | 'Pending Verification' | 'Not Verified' | string;
  verificationDate?: string;
  verifyingOfficer?: string;
  remarks?: string;
  gpsX?: number;
  gpsY?: number;
  supersededDate?: string;
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
  utilOrder?: number;
  reinstateOrder?: number;
  utilAmount?: number;
  status?: string;
  takenOver?: string;
  effectiveDate?: string;
  endDate?: string;
  changeReason?: string;
  collateralId: string;
  allocatedAmount: number;
  linkageType?: 'Primary' | 'Secondary' | 'Cross-Collateral' | string;
  utilizationPct?: number;
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
  limitContribution?: number;
  startDate?: string;
  reviewDate?: string;
  currentAllocation?: number;
  utilizationPercentage?: number;
  status: 'Pending Approval' | 'Active' | 'Insured' | 'Under-Insured' | 'Uninsured' | 'Draft' | 'Release Pending' | 'Released' | string;
  ownerType: 'Borrower-owned' | 'Third-party-owned' | string;
  tangible?: boolean;
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
  status: 'Open' | 'In Progress' | 'Resolved' | 'Escalated' | string;
  slaDueDate?: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  correctiveAction?: string;
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
  roleCode?: string;
  ipAddress?: string;
  actionType: string;
  entityType?: string;
  entityId: string;
  result?: string;
  stateBeforeJson?: string;
  stateAfterJson?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  comments?: string;
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
}

export interface ReminderSchedule {
  id: string;
  daysBeforeExpiry: number;
  channelsJson: string;
  recipientRolesJson: string;
  active: boolean;
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
}

export interface MandatoryDocumentRule {
  id: string;
  collateralCategory: string;
  documentType: string;
  mandatory: boolean;
}

export interface HolidayCalendar {
  id: string;
  holidayDate: string;
  description: string;
}

export interface SystemParameter {
  paramKey: string;
  paramValue: string;
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
  result: string;
  errorMessage?: string;
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
  authorizedBranchesCount?: number;
  scopedBranchesCount?: number;
  scopeBoundaryDescription?: string;
}

export interface DashboardSummary {
  scopeBanner: ScopeBannerData;
  totalOutstandingExposure: number;
  totalCollateralMarketValue: number;
  totalNetSecurityValue: number;
  totalInsuranceRequired: number;
  totalValidActiveInsurance: number;
  totalInsuranceGap: number;
  insuranceCoveragePct: number;
  expiredPoliciesCount: number;
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
  underinsuredCollateralsCount?: number;
  adequatelyInsuredCollateralsCount?: number;
  returnedTasksCount: number;
  overrideCount: number;
  insurerConcentrationMaxPct: number;
  systemDate: string;
  lastRefreshTimestamp: string;
}

export interface DashboardChartData {
  complianceDonut: Array<{ name: string; value: number; color: string }>;
  exposureVsProtection: Array<{ segment: string; collateralValue: number; insuranceRequired: number; insuredCoverage: number; gap: number }>;
  districtRanking: Array<{ district: string; exposure: number; insuranceGap: number; compliancePct: number }>;
  branchRanking: Array<{ branch: string; collateralValue: number; insuranceRequired: number; insuredAmount: number; insuranceGap: number; compliancePct: number }>;
  expiryPipeline: Array<{ bucket: string; count: number; color: string }>;
  collateralCategoryDistribution: Array<{ category: string; count: number; value: number; insuranceGap: number }>;
  topInsuranceGaps: Array<{ collateralCode: string; customerName: string; cif: string; branch: string; requiredInsurance: number; activeInsurance: number; insuranceGap: number }>;
  workflowFunnel: Array<{ status: string; count: number }>;
  documentationHealth: Array<{ name: string; value: number; color: string }>;
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

