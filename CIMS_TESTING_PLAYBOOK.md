# CIMS — End-to-End Testing & Verification Playbook
## Complete Click-by-Click Guide for Happy Paths & Exception Scenarios

This guide provides an exact, step-by-step testing script for the entire **Collateral Insurance Management System (CIMS)**. Follow these 8 comprehensive scenarios to test all user personas, core banking simulator sync, maker-checker dual control, policy wizards, exception management, collateral releases, and administration configurables.

---

### Test Environment Prerequisites
- **Frontend URL**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Persona Switcher**: Located in the **top-right header** (instant role switching without logout).

---

## Scenario 1: Core Banking (CBS) Mock Ingestion & Sync
**Goal**: Create simulated customer, facility, and collateral data in CBS, synchronize them, and verify automatic ingestion into CIMS.

### Steps:
1. **Switch Persona** (top-right header) to **`SYSADMIN`** (*System Administrator*).
2. On the left sidebar, click **`CBS Core Simulator`**.
3. **Add Mock CBS Customer**:
   - In the "Simulated Customers" card, click **`+ New Mock Customer`**.
   - Enter:
     - **CIF**: `ET-CUST-7701`
     - **Customer Name**: `Awash Agro Processing PLC`
     - **Customer Type**: `Corporate`
     - **Business Segment**: `Corporate Banking`
     - **Branch**: `Main Branch`
     - **Phone**: `+251911223344`
     - **Email**: `finance@awashagro.et`
     - **Risk Rating**: `Low`
   - Click **`Save Mock Customer`**.
4. **Add Mock CBS Facility (Loan Line)**:
   - In the "Simulated Facilities" card, click **`+ New Mock Facility`**.
   - Enter:
     - **Loan Ref / Line Code**: `LN-CORP-2026-7701`
     - **Customer CIF**: `ET-CUST-7701`
     - **Facility Type**: `Term Loan`
     - **Approved Limit**: `25,000,000`
     - **Outstanding Balance**: `20,000,000`
     - **Segment**: `Corporate Banking`
     - **Branch**: `Main Branch`
   - Click **`Save Mock Facility`**.
5. **Add Mock CBS Collateral**:
   - In the "Simulated Collaterals" card, click **`+ New Mock Collateral`**.
   - Enter:
     - **Collateral Code**: `COL-AGRO-7701`
     - **Description**: `Commercial Warehouse & Processing Plant`
     - **Customer CIF**: `ET-CUST-7701`
     - **Linked Loan Ref**: `LN-CORP-2026-7701`
     - **Category**: `Building / Commercial Property`
     - **Valuation Amount**: `30,000,000`
     - **Haircut %**: `20`
     - **Branch**: `Main Branch`
   - Click **`Save Mock Collateral`**.
6. **Execute Batch Synchronization**:
   - At the top of the CBS Simulator screen, click the prominent **`Sync All Pending`** button.
   - **Expected Outcome**:
     - Notification displays: *"Batch sync completed: 1 Customers, 1 Facilities, 1 Collaterals"*.
     - Sync Status column updates from `Pending` to green **`Synced`**.
     - An immutable sync record is added to the "CBS Sync Audit Stream" at the bottom of the page.
7. **Verify Ingestion**:
   - Navigate to **`Customer 360`** -> search for `Awash Agro Processing PLC`.
   - Navigate to **`Facility Manager`** -> verify `LN-CORP-2026-7701` is visible.
   - Navigate to **`Collateral Manager`** -> verify `COL-AGRO-7701` is visible with `30,000,000 ETB` valuation.

---

## Scenario 2: Maker-Checker Dual-Control Collateral Registration & DMS
**Goal**: Register a manual collateral as a Maker (`CRO`), upload a Title Deed, and approve as a Checker (`BRMGR`).

### Steps:
1. **Switch Persona** to **`CRO`** (*Corporate Relationship Officer / Maker*).
2. Navigate to **`Collateral Manager`** and click **`+ Register Collateral`**.
3. Fill out the registration form:
   - **Collateral Code**: `COL-VEH-8802`
   - **Asset Description**: `Mercedes Actros Heavy Commercial Truck 2024`
   - **Borrower Customer**: Select `Midroc Investment Group` or `Awash Agro`
   - **Category**: `Motor Vehicle / Heavy Machinery`
   - **Valuation Amount**: `8,500,000`
   - **Haircut %**: `25`
   - **Owning Segment**: `Corporate Banking`
   - **Branch**: `Main Branch`
4. Click **`Submit for Checker Approval`**.
   - **Expected Outcome**: Collateral is saved with status `Pending Authorization` (`record_stat = 'U'`).
5. **Upload Mandatory Document (DMS)**:
   - On the left sidebar, click **`Documents & DMS`**.
   - Click **`+ Upload Document`**.
   - Select:
     - **Collateral Asset**: `COL-VEH-8802`
     - **Document Type**: `Vehicle Registration / Logbook`
     - **Document Reference**: `LOGBOOK-ET-8802-V1`
     - **Expiry Date**: `2028-12-31`
     - **Choose File**: Select any sample `.pdf` or `.png` file.
   - Click **`Upload & Register Document`**.
   - **Expected Outcome**: Document is registered in the DMS repository with status `Verified`.
6. **Verify Segregation of Duties (Negative Test)**:
   - While still logged in as **`CRO`** (*Maker*), navigate to **`Maker-Checker Inbox`**.
   - Note the amber badge: **`You (Maker)`** next to the submitted task.
   - Click the task to open the **Review Diff Drawer**.
   - **Expected Outcome**:
     - A prominent warning displays: *"Segregation of Duties Enforced (Four-Eyes Principle) — You submitted this transaction as Maker. Banking regulations strictly prohibit self-authorization."*
     - The **`Approve`**, **`Reject`**, and **`Return`** buttons are disabled with button label **`Self-Approval Prohibited`**.
7. **Checker Authorization (Positive Test)**:
   - **Switch Persona** (top-right header) to **`BRMGR`** (*Branch Manager / Independent Checker*).
   - Navigate to **`Maker-Checker Inbox`** (or view pending tasks from the Branch Manager Dashboard).
   - Locate the task for `COL-VEH-8802` with Action Type `Register Collateral`.
   - Click the row to open the **Before/After JSON Diff Drawer**.
   - Review maker details and click **`Approve Transaction`** with comment *"Approved after verifying physical vehicle inspection report"*.
   - **Expected Outcome**:
     - Task status transitions to `Approved`.
     - Collateral status transitions to `Active` (`record_stat = 'O'`, `auth_stat = 'A'`).
     - Live Outbound Email and SMS notifications are dispatched to Maker informing them of approval.

---

## Scenario 3: 4-Step Insurance Policy Registration Wizard (Happy Path)
**Goal**: Register an insurance policy for a collateral asset using the 4-step guided wizard and verify automated adequacy calculation.

### Steps:
1. **Switch Persona** to **`CRO`** (*Relationship Officer*).
2. On the left sidebar, click **`Insurance Policies`**.
3. Click **`+ Register Policy (Wizard)`** at the top right.
4. **Step 1: Pledged Collateral Selection**:
   - Select `COL-AGRO-7701` (*Commercial Warehouse & Processing Plant*).
   - Verify that the borrower name and linked credit facility (`LN-CORP-2026-7701`) auto-populate.
   - Click **`Next: Policy & Underwriter Details ->`**.
5. **Step 2: Policy & Underwriter Details**:
   - **Approved Insurer**: Select `Nyala Insurance S.C.`
   - **Policy Number**: `POL-NYL-2026-0099`
   - **Policy Type**: `Fire & Lightning / Commercial Property`
   - **Sum Insured (ETB)**: `25,000,000` (Equal to or greater than facility exposure)
   - **Premium Amount (ETB)**: `125,000`
   - **Policy Start Date**: `2026-08-18`
   - **Policy Expiry Date**: `2027-08-18`
   - Click **`Next: Adequacy Evaluation ->`**.
6. **Step 3: Coverage Adequacy & Solvency Check**:
   - Verify the automated calculation widgets:
     - **Facility Exposure**: `20,000,000 ETB`
     - **Total Insured Amount**: `25,000,000 ETB`
     - **Coverage Adequacy Ratio**: `125.0%` (Displayed in **GREEN** badge: *Sufficient Coverage*)
     - **Insurer Market Share**: Displays active portfolio share.
   - Click **`Next: DMS Document & Submission ->`**.
7. **Step 4: Certificate Attachment & Maker-Checker Dispatch**:
   - Upload policy certificate (or choose sample PDF).
   - Enter Maker Remarks: *"Standard 1-year fire policy covering warehouse and plant machinery"*.
   - Click **`Submit to Dual-Control Approval`**.
8. **Checker Approval**:
   - **Switch Persona** to **`BRMGR`** (*Branch Manager*).
   - Go to **`Maker-Checker Inbox`** -> click task `POL-NYL-2026-0099`.
   - Click **`Approve Policy`**.
   - **Expected Outcome**:
     - Policy status changes to **`Active`**.
     - Navigate to **`Collateral Manager`** -> `COL-AGRO-7701` now shows **`Net Coverage: 100.0%`** with green status chip **`Fully Insured`**.

---

## Scenario 4: Exception Management, Breach Detection & Escalation (Exception Path)
**Goal**: Run portfolio scans, investigate underinsured assets or expired policies, and escalate to District Directorate.

### Steps:
1. **Switch Persona** to **`COMPLIANCE`** (*Compliance Officer*) or **`RISK`** (*Risk Management*).
2. On the left sidebar, click **`Exception Center`**.
3. Click the **`⚡ Trigger Portfolio Scan Now`** button.
   - **Expected Outcome**: The system scans all collaterals and policies, detecting any policy expirations, underinsurance gaps ($<100\%$), or missing mandatory documents.
4. Review the Exception Register:
   - Filter by **Severity: High / Critical**.
   - Click **`Investigate`** on an exception (e.g. *Underinsured Collateral Breach*).
5. **Exception Resolution Drawer**:
   - **Test Resolution**: Enter Corrective Action: *"Borrower submitted top-up endorsement certificate"*, click **`Resolve Exception`** -> Exception moves to `Resolved`.
   - **Test Escalation (Exception Path)**: Click **`Escalate to District Director`**. Enter escalation note: *"30-day cure period expired without borrower remediation. Initiating penal interest"*. Click **`Escalate`**.
   - **Expected Outcome**:
     - Exception status updates to **`Escalated`**.
     - **Switch Persona** to **`DISTDIR`** (*District Director*) -> Exception appears in the District Director's escalated governance queue.

---

## Scenario 5: 4-Point Collateral Release Checklist & Branch Manager Override
**Goal**: Validate the automated 4-point release gatekeeper checklist and execute a Branch Manager Override when credit criteria are met.

### Steps:
1. **Switch Persona** to **`CRO`** (*Relationship Officer*).
2. Navigate to **`Collateral Manager`**.
3. On any active collateral (e.g. `COL-CORP-001`), click the **`Action`** menu -> select **`Request Release`**.
4. **4-Point Gatekeeper Validation Modal**:
   - The checklist automatically evaluates:
     1. **Facility Balance Check**: Must be `0.00 ETB` (Fully settled).
     2. **Active Insurance Check**: No active claim disputes.
     3. **Compliance Breaches Check**: Zero open regulatory exceptions.
     4. **Physical DMS Custody**: Title deed custody accounted for.
5. **Exception Path (Loan Balance > 0)**:
   - If the loan balance is $>0\text{ ETB}$, Rule #1 shows **RED (Failed)** and the standard *"Submit Release"* button is disabled.
6. **Authorized Branch Manager Override Path**:
   - **Switch Persona** to **`BRMGR`** (*Branch Manager*).
   - Reopen the Release Modal for the collateral.
   - Check the box: **`Apply Authorized Branch Manager Override`**.
   - Enter Mandatory Justification: *"Borrower substituted collateral with cash margin deposit under reference CD-2026-991"*.
   - Click **`Authorize & Submit Collateral Release`**.
   - **Expected Outcome**: Collateral status updates to **`Released`** with full audit log entry.

---

## Scenario 6: Administration & Reference Data Configuration
**Goal**: Verify live editing and persistence across the 11 administrative configuration sub-views.

### Steps:
1. **Switch Persona** to **`SYSADMIN`** (*System Administrator*).
2. On the left sidebar, click **`System Administration`**.
3. **Test 1: Role-Permission Matrix ($16 \times 11$)**:
   - In the Permission Matrix tab, select **Role Filter**: `CRO` (*Corporate Relationship Officer*).
   - Toggle the **Delete** permission checkbox for `Insurance Policies`.
   - Click the prominent **`💾 Save Permissions Matrix`** button at the top right.
   - **Expected Outcome**: Notification displays *"Role permissions updated successfully"*. Database persists changes immediately.
4. **Test 2: Business Segments**:
   - Click the **`Business Segments`** sub-tab.
   - Click **`+ Add Business Segment`**.
   - Enter: Code `AGRI`, Name `Agribusiness & Rural Financing`, Risk Profile `Medium`.
   - Click **`Save Business Segment`**.
   - Click the **Active Toggle** on any existing segment to deactivate/reactivate.
5. **Test 3: Approved Insurers Master**:
   - Click the **`Approved Insurers`** sub-tab.
   - Click **`+ Add Approved Insurer`**.
   - Enter Insurer Name: `Oromia Insurance Company S.C.`, Rating: `A-`, License: `NIC-LIC-2026-019`.
   - Click **`Save Insurer`**.
   - Toggle the **Approve / Suspend** switch to verify live state mutation.
6. **Test 4: Bank Holiday Calendar**:
   - Click the **`Holiday Calendar`** sub-tab.
   - Click **`+ Add Bank Holiday`**.
   - Enter: Date `2026-11-20`, Description `National Banking System Maintenance Day`.
   - Click **`Save Holiday`** -> Verify it appears in the active 2026 calendar list.

---

## Scenario 7: Standard Reports, Export Engine & Automated Scheduling
**Goal**: Run reports, filter by branch/segment, export to PDF/Excel, and configure automated cron schedules.

### Steps:
1. **Switch Persona** to **`EXEC`**, **`AUDITOR`**, or **`SRMGMT`**.
2. On the left sidebar, click **`Standard Reports`**.
3. **Run a Report**:
   - Select report: **`Collateral Coverage Adequacy Summary`** or **`30-Day Expiring Policies Register`**.
   - Set filters: Segment: `All Segments`, Branch: `Main Branch`.
   - Click **`Generate Report`**.
4. **Export Multi-Format**:
   - Click **`Export to PDF`** -> Generates structured PDF document with headers, timestamps, and styled data tables.
   - Click **`Export to Excel (XLSX)`** -> Downloads standard spreadsheet.
   - Click **`Export to CSV`** -> Downloads raw tabular data.
5. **Configure Automated Report Scheduler**:
   - Click the **`Scheduled Reports`** tab.
   - Click **`+ Schedule New Report`**.
   - Select Report: `Underinsured Portfolio Summary`, Frequency: `Monthly (1st of month at 08:00)`, Format: `PDF`, Recipients: `risk-committee@bank.com`.
   - Click **`Save Schedule`** -> Schedule is registered in `cims_scheduled_reports`.

---

## Scenario 8: Role-Based Dynamic Dashboards (§12)
**Goal**: Switch through key user personas and verify that each persona receives their dedicated dashboard view and specialized KPIs.

### Persona Verification Matrix:

| Persona | How to Switch | What to Verify on the Dashboard |
| :--- | :--- | :--- |
| **`EXEC`** | Top-right header -> `EXEC` | Total Bank Exposure (ETB M), Net Coverage Gauge ($93.8\%$), Insurer Concentration Donut (Nyala $34\%$ breach warning), Segment Exposure Bar Chart, **Top 5 Unhedged Large Exposures**. |
| **`BRMGR`** | Top-right header -> `BRMGR` | Branch Loan Exposure, Branch Insured Value, 30-Day Expiries, and **Direct Dual-Control Action Center** (with 1-click Approve / Reject buttons). |
| **`CRO`** | Top-right header -> `CRO` | My Managed Portfolio Exposure, Expiring Policies Countdown ($<30\text{d}$), Maker Returned Corrections, Quick Action buttons (`+ Register Policy`, `+ Register Collateral`). |
| **`COMPLIANCE`** | Top-right header -> `COMPLIANCE` | Open Regulatory Breaches, Underinsured Collaterals, Expired Active Policies, and **Breach Investigation Queue**. |
| **`AUDITOR`** | Top-right header -> `AUDITOR` | 24h State Mutation Velocity, Maker-Checker Dual-Control Compliance ($100\%$), Unauthorized Mutation Attempts ($0$), and **Audit Activity Stream**. |
| **`COLLDOCOFF`** | Top-right header -> `COLLDOCOFF` | DMS Document Completeness $\%$, Missing Title Deeds Register, Expired Valuations ($>3\text{ years}$), and **Document Verification Queue**. |

---

### Quick Troubleshooting & Reset
- **Restart Dev Servers**: Run `start-all.bat` from `cims proj` root.
- **Inspect Live REST State**: Open `http://localhost:8080/api/state` in your browser.
- **Backend Logs**: Check Spring Boot console logs on Port 8080.
