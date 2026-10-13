-- ==============================================================================
-- Migration V30: Module 3 — Collateral-Facility Relationship, Allocation & Cross-Collateral Engine
-- Database: cims_db_dev
-- ==============================================================================

-- 1. Enhance cims_loan_collateral_links with Module 3 authoritative fields
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS cbs_facility_ref VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS cbs_loan_account VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS cbs_collateral_ref VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS facility_coverage_pct NUMERIC(5,2);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS collateral_allocation_pct NUMERIC(5,2);

-- Update percentages on existing links if missing
UPDATE cims_loan_collateral_links
SET collateral_allocation_pct = COALESCE(linked_percentage, linked_percent, 0)
WHERE collateral_allocation_pct IS NULL;

UPDATE cims_loan_collateral_links l
SET facility_coverage_pct = CASE
    WHEN a.outstanding_balance > 0 THEN LEAST(ROUND(CAST((l.allocated_amount / a.outstanding_balance) * 100.0 AS NUMERIC), 2), 999.99)
    WHEN a.approved_limit > 0 THEN LEAST(ROUND(CAST((l.allocated_amount / a.approved_limit) * 100.0 AS NUMERIC), 2), 999.99)
    ELSE 100.00
END
FROM cims_loan_accounts a
WHERE (l.loan_account_id = a.id OR l.loan_account_id = a.loan_reference)
  AND l.facility_coverage_pct IS NULL;

-- 2. Create Authoritative Relationship History Table (BR-03 & Section 22)
CREATE TABLE IF NOT EXISTS cims_loan_collateral_link_history (
    id VARCHAR(64) PRIMARY KEY,
    link_id VARCHAR(64) NOT NULL,
    collateral_id VARCHAR(64) NOT NULL,
    loan_account_id VARCHAR(64) NOT NULL,
    facility_id VARCHAR(64),
    customer_id VARCHAR(100),
    previous_allocated_amount NUMERIC(18,2),
    new_allocated_amount NUMERIC(18,2),
    previous_linkage_type VARCHAR(50),
    new_linkage_type VARCHAR(50),
    previous_effective_date VARCHAR(50),
    new_effective_date VARCHAR(50),
    previous_end_date VARCHAR(50),
    new_end_date VARCHAR(50),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    action_type VARCHAR(50) NOT NULL, -- CREATED, UPDATED, ALLOCATION_CHANGED, ENDED, REINSTATED, CBS_SYNC
    change_reason TEXT,
    maker_id VARCHAR(64),
    maker_dt_stamp VARCHAR(50),
    checker_id VARCHAR(64),
    checker_dt_stamp VARCHAR(50),
    auth_stat VARCHAR(10) DEFAULT 'A'
);

CREATE INDEX IF NOT EXISTS idx_link_hist_link_id ON cims_loan_collateral_link_history (link_id);
CREATE INDEX IF NOT EXISTS idx_link_hist_col_id ON cims_loan_collateral_link_history (collateral_id);
CREATE INDEX IF NOT EXISTS idx_link_hist_loan_id ON cims_loan_collateral_link_history (loan_account_id);
CREATE INDEX IF NOT EXISTS idx_link_hist_created_at ON cims_loan_collateral_link_history (maker_dt_stamp);

-- Seed initial history records for existing active links
INSERT INTO cims_loan_collateral_link_history (
    id, link_id, collateral_id, loan_account_id, facility_id, customer_id,
    previous_allocated_amount, new_allocated_amount,
    previous_linkage_type, new_linkage_type,
    previous_effective_date, new_effective_date,
    previous_status, new_status,
    action_type, change_reason,
    maker_id, maker_dt_stamp, auth_stat
)
SELECT
    'hist-' || id, id, collateral_id, loan_account_id, facility_id, customer_id,
    0, allocated_amount,
    'None', linkage_type,
    NULL, effective_date,
    'None', status,
    'MIGRATION_INITIAL', 'Baseline relationship state recorded by Module 3 migration.',
    maker_id, CURRENT_TIMESTAMP::text, 'A'
FROM cims_loan_collateral_links
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Comprehensive Test Data for Scenarios 1-4 and Cases A-F (Section 27, 36, 37, 38)
-- Customer: Awash Agro-Industrial Conglomerate
INSERT INTO cims_customers (id, cif, name, segment, customer_type, national_id, phone, email, branch, risk_rating, status)
VALUES
    ('cust-m3-demo', 'CIF-M3-001', 'Awash Agro-Industrial Conglomerate', 'Corporate Banking', 'Corporate', 'REG-ETH-AAIC-2024', '+251-11-555-8899', 'info@awashagro.et', 'BRN-001', 'Low', 'Active'),
    ('cust-m3-borrower', 'CIF-M3-002', 'Bole Apex Transport & Logistics Plc', 'Commercial Banking', 'Corporate', 'REG-ETH-BATL-2024', '+251-11-555-4422', 'finance@boleapex.et', 'BRN-002', 'Medium', 'Active')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- Also sync customer into cbs_sim.customers
INSERT INTO cbs_sim.customers (id, cif, customer_type, full_name, national_id, phone, email, business_segment, branch, customer_status, risk_rating)
VALUES
    ('cust-m3-demo', 'CIF-M3-001', 'Corporate', 'Awash Agro-Industrial Conglomerate', 'REG-ETH-AAIC-2024', '+251-11-555-8899', 'info@awashagro.et', 'Corporate Banking', 'BRN-001', 'Active', 'Low'),
    ('cust-m3-borrower', 'CIF-M3-002', 'Corporate', 'Bole Apex Transport & Logistics Plc', 'REG-ETH-BATL-2024', '+251-11-555-4422', 'finance@boleapex.et', 'Commercial Banking', 'BRN-002', 'Active', 'Medium')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, customer_status = EXCLUDED.customer_status;

-- 4. Seed Facilities for Section 36 Calculation Scenario
-- Collateral COL-TEST-M3-01: MV 100M, Haircut 20%, NSV 80M
-- Loan A: 40M outstanding, Loan B: 25M outstanding, Loan C: 15M outstanding. Total exposure = 80M
INSERT INTO cims_loan_accounts (
    id, line_code, loan_reference, customer_id, facility_type, line_currency, revolving_line,
    line_start_date, line_expiry_date, approved_limit, outstanding_balance, available_amount,
    collateral_contribution, collateral_pct, segment, branch, rm_user_id, status, account_number, source
)
VALUES
    ('loan-m3-a', 'FAC-M3-EXP-A', 'LN-M3-EXP-001', 'cust-m3-demo', 'Commercial Term Loan', 'ETB', false, '2024-01-15', '2029-01-15', 50000000.00, 40000000.00, 10000000.00, 40000000.00, 80.00, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active', 'ACC-M3-001', 'CBS_SIM'),
    ('loan-m3-b', 'FAC-M3-EXP-B', 'LN-M3-EXP-002', 'cust-m3-demo', 'Working Capital Overdraft', 'ETB', true, '2024-03-01', '2025-03-01', 35000000.00, 25000000.00, 10000000.00, 25000000.00, 71.43, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active', 'ACC-M3-002', 'CBS_SIM'),
    ('loan-m3-c', 'FAC-M3-EXP-C', 'LN-M3-EXP-003', 'cust-m3-demo', 'Merchandise Loan Facility', 'ETB', false, '2024-06-01', '2026-06-01', 20000000.00, 15000000.00, 5000000.00, 15000000.00, 75.00, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active', 'ACC-M3-003', 'CBS_SIM'),
    -- Facilities for Scenario 3 (N:1) & Scenario 4 (N:N)
    ('loan-m3-multi-col', 'FAC-M3-MULTI', 'LN-M3-MULTI-001', 'cust-m3-demo', 'Syndicated Project Finance', 'ETB', false, '2024-02-01', '2030-02-01', 70000000.00, 60000000.00, 10000000.00, 60000000.00, 85.71, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active', 'ACC-M3-004', 'CBS_SIM'),
    -- Facility for Third-Party Collateral (Case E)
    ('loan-m3-tp-borrower', 'FAC-M3-TP-01', 'LN-M3-TP-001', 'cust-m3-borrower', 'Heavy Fleet Equipment Lease', 'ETB', false, '2024-04-10', '2028-04-10', 45000000.00, 35000000.00, 10000000.00, 35000000.00, 77.78, 'Commercial Banking', 'BRN-002', 'RM_ALEM', 'Active', 'ACC-M3-005', 'CBS_SIM')
ON CONFLICT (id) DO UPDATE SET
    approved_limit = EXCLUDED.approved_limit,
    outstanding_balance = EXCLUDED.outstanding_balance,
    collateral_contribution = EXCLUDED.collateral_contribution,
    status = EXCLUDED.status;

-- Sync facilities to cbs_sim.facilities
INSERT INTO cbs_sim.facilities (
    id, line_code, customer_cif, loan_ref_no, facility_type, line_currency, revolving_line,
    line_start_date, line_expiry_date, approved_limit, available_amount, outstanding_amount,
    collateral_contribution, collateral_pct, business_segment, branch, relationship_manager, limit_status
)
VALUES
    ('loan-m3-a', 'FAC-M3-EXP-A', 'CIF-M3-001', 'LN-M3-EXP-001', 'Commercial Term Loan', 'ETB', false, '2024-01-15', '2029-01-15', 50000000.00, 10000000.00, 40000000.00, 40000000.00, 80.00, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active'),
    ('loan-m3-b', 'FAC-M3-EXP-B', 'CIF-M3-001', 'LN-M3-EXP-002', 'Working Capital Overdraft', 'ETB', true, '2024-03-01', '2025-03-01', 35000000.00, 10000000.00, 25000000.00, 25000000.00, 71.43, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active'),
    ('loan-m3-c', 'FAC-M3-EXP-C', 'CIF-M3-001', 'LN-M3-EXP-003', 'Merchandise Loan Facility', 'ETB', false, '2024-06-01', '2026-06-01', 20000000.00, 5000000.00, 15000000.00, 15000000.00, 75.00, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active'),
    ('loan-m3-multi-col', 'FAC-M3-MULTI', 'CIF-M3-001', 'LN-M3-MULTI-001', 'Syndicated Project Finance', 'ETB', false, '2024-02-01', '2030-02-01', 70000000.00, 10000000.00, 60000000.00, 60000000.00, 85.71, 'Corporate Banking', 'BRN-001', 'RM_HABTU', 'Active'),
    ('loan-m3-tp-borrower', 'FAC-M3-TP-01', 'CIF-M3-002', 'LN-M3-TP-001', 'Heavy Fleet Equipment Lease', 'ETB', false, '2024-04-10', '2028-04-10', 45000000.00, 10000000.00, 35000000.00, 35000000.00, 77.78, 'Commercial Banking', 'BRN-002', 'RM_ALEM', 'Active')
ON CONFLICT (id) DO UPDATE SET
    approved_limit = EXCLUDED.approved_limit,
    outstanding_amount = EXCLUDED.outstanding_amount,
    limit_status = EXCLUDED.limit_status;

-- 5. Seed Collateral Assets for Scenarios 1-4
INSERT INTO cims_collaterals (
    id, code, customer_id, description, category, type, owner_type, currency,
    valuation_amount, haircut, nsv, current_allocation, utilization_percentage,
    insurance_status, status, charge_type, secured, owning_segment, branch, source
)
VALUES
    -- Scenario 2 / Section 36 Primary Test Asset: MV 100M, Haircut 20%, NSV 80M, Allocated 80M (Loan A: 40M, Loan B: 25M, Loan C: 15M)
    ('col-m3-cross-01', 'COL-M3-CROSS-01', 'cust-m3-demo', 'Awash Agro Modern Edible Oil Industrial Plant & Silos', 'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned', 'ETB', 100000000.00, 20.00, 80000000.00, 80000000.00, 100.00, 'Adequately Insured', 'Active', 'Mortgage', true, 'Corporate Banking', 'BRN-001', 'CBS_SIM'),
    -- Scenario 3 Asset 1: Commercial Headquarters
    ('col-m3-multi-01', 'COL-M3-HQ-01', 'cust-m3-demo', 'Awash Headquarter Commercial Office Tower', 'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned', 'ETB', 45000000.00, 20.00, 36000000.00, 30000000.00, 83.33, 'Adequately Insured', 'Active', 'Mortgage', true, 'Corporate Banking', 'BRN-001', 'CBS_SIM'),
    -- Scenario 3 Asset 2: Industrial Extraction Machinery
    ('col-m3-multi-02', 'COL-M3-MACH-02', 'cust-m3-demo', 'Heavy Solvent Extraction & Refining Unit', 'Movable Properties', 'Construction Machineries', 'Borrower-owned', 'ETB', 25000000.00, 25.00, 18750000.00, 18000000.00, 96.00, 'Adequately Insured', 'Active', 'Pledge', true, 'Corporate Banking', 'BRN-001', 'CBS_SIM'),
    -- Scenario 3 Asset 3: Fleet Delivery Trucks
    ('col-m3-multi-03', 'COL-M3-FLEET-03', 'cust-m3-demo', 'Commercial Distribution Truck Fleet (10 Units)', 'Movable Properties', 'Vehicles', 'Borrower-owned', 'ETB', 16000000.00, 25.00, 12000000.00, 12000000.00, 100.00, 'Adequately Insured', 'Active', 'Pledge', true, 'Corporate Banking', 'BRN-001', 'CBS_SIM'),
    -- Scenario 5: Third-Party Owned Collateral Asset (Pledged by Ato Girma Haile for Bole Apex Transport)
    ('col-m3-tp-01', 'COL-M3-TP-01', 'cust-m3-borrower', 'Prime Bole Commercial Warehouse Complex (Third-Party Pledged)', 'Immovable Properties', 'Buildings - Commercial', 'Third-party-owned', 'ETB', 50000000.00, 20.00, 40000000.00, 35000000.00, 87.50, 'Adequately Insured', 'Active', 'Mortgage', true, 'Commercial Banking', 'BRN-002', 'CBS_SIM')
ON CONFLICT (id) DO UPDATE SET
    valuation_amount = EXCLUDED.valuation_amount,
    haircut = EXCLUDED.haircut,
    nsv = EXCLUDED.nsv,
    current_allocation = EXCLUDED.current_allocation,
    status = EXCLUDED.status;

-- Sync collaterals into cbs_sim.collaterals
INSERT INTO cbs_sim.collaterals (
    id, collateral_code, customer_cif, description, category, collateral_type, ownership_type,
    currency, collateral_value, haircut, limit_contribution, start_date, business_segment, branch
)
VALUES
    ('col-m3-cross-01', 'COL-M3-CROSS-01', 'CIF-M3-001', 'Awash Agro Modern Edible Oil Industrial Plant & Silos', 'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned', 'ETB', 100000000.00, 20.00, 80000000.00, '2024-01-15', 'Corporate Banking', 'BRN-001'),
    ('col-m3-multi-01', 'COL-M3-HQ-01', 'CIF-M3-001', 'Awash Headquarter Commercial Office Tower', 'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned', 'ETB', 45000000.00, 20.00, 36000000.00, '2024-02-01', 'Corporate Banking', 'BRN-001'),
    ('col-m3-multi-02', 'COL-M3-MACH-02', 'CIF-M3-001', 'Heavy Solvent Extraction & Refining Unit', 'Movable Properties', 'Construction Machineries', 'Borrower-owned', 'ETB', 25000000.00, 25.00, 18750000.00, '2024-02-01', 'Corporate Banking', 'BRN-001'),
    ('col-m3-multi-03', 'COL-M3-FLEET-03', 'CIF-M3-001', 'Commercial Distribution Truck Fleet (10 Units)', 'Movable Properties', 'Vehicles', 'Borrower-owned', 'ETB', 16000000.00, 25.00, 12000000.00, '2024-02-01', 'Corporate Banking', 'BRN-001'),
    ('col-m3-tp-01', 'COL-M3-TP-01', 'CIF-M3-002', 'Prime Bole Commercial Warehouse Complex (Third-Party Pledged)', 'Immovable Properties', 'Buildings - Commercial', 'Third-party-owned', 'ETB', 50000000.00, 20.00, 40000000.00, '2024-04-10', 'Commercial Banking', 'BRN-002')
ON CONFLICT (id) DO UPDATE SET
    collateral_value = EXCLUDED.collateral_value,
    haircut = EXCLUDED.haircut,
    limit_contribution = EXCLUDED.limit_contribution;

-- Seed Third-Party Owner Record for col-m3-tp-01
INSERT INTO cims_collateral_owners (
    id, collateral_id, name, ownership_type, owner_type, id_number, tin, phone,
    percentage, relationship, relationship_to_borrower, consent_info, pledge_agreement_ref,
    verification_status, status, effective_from
)
VALUES
    ('own-m3-tp-01', 'col-m3-tp-01', 'Ato Girma Haile Gebre', 'Third-party-owned', 'Individual', 'NID-ETH-77291033', 'TIN-00998811', '+251-91-123-4567',
     100.00, 'Third-Party Pledgor / Corporate Guarantor', 'Shareholder & Pledgor', 'Formal Spousal & Board Consent Attached', 'PLG-AGR-2024-M3-01',
     'Verified', 'Active', '2024-04-10')
ON CONFLICT (id) DO UPDATE SET verification_status = EXCLUDED.verification_status, status = EXCLUDED.status;

-- 6. Seed Authoritative Collateral-Facility Links for Scenarios 1-4 & Cases A-F
-- Scenario 2 / Section 36: 1 Collateral -> 3 Facilities (40M, 25M, 15M)
INSERT INTO cims_loan_collateral_links (
    id, loan_account_id, collateral_id, facility_id, customer_id, allocated_amount, linked_amount,
    collateral_allocation_pct, facility_coverage_pct, linkage_type, status, relationship_status,
    release_status, effective_date, source, cbs_facility_ref, cbs_loan_account, cbs_collateral_ref,
    maker_id, auth_stat, mod_no
)
VALUES
    ('lnk-m3-cross-a', 'loan-m3-a', 'col-m3-cross-01', 'FAC-M3-EXP-A', 'cust-m3-demo', 40000000.00, 40000000.00, 50.00, 100.00, 'Cross-Collateral', 'Active', 'Active', 'Eligible', '2024-01-15', 'CBS_SIM', 'FAC-M3-EXP-A', 'ACC-M3-001', 'COL-M3-CROSS-01', 'M3_INIT', 'A', 1),
    ('lnk-m3-cross-b', 'loan-m3-b', 'col-m3-cross-01', 'FAC-M3-EXP-B', 'cust-m3-demo', 25000000.00, 25000000.00, 31.25, 100.00, 'Cross-Collateral', 'Active', 'Active', 'Eligible', '2024-03-01', 'CBS_SIM', 'FAC-M3-EXP-B', 'ACC-M3-002', 'COL-M3-CROSS-01', 'M3_INIT', 'A', 1),
    ('lnk-m3-cross-c', 'loan-m3-c', 'col-m3-cross-01', 'FAC-M3-EXP-C', 'cust-m3-demo', 15000000.00, 15000000.00, 18.75, 100.00, 'Cross-Collateral', 'Active', 'Active', 'Eligible', '2024-06-01', 'CBS_SIM', 'FAC-M3-EXP-C', 'ACC-M3-003', 'COL-M3-CROSS-01', 'M3_INIT', 'A', 1),
    -- Scenario 3: 3 Collaterals -> 1 Facility (loan-m3-multi-col secured by col-m3-multi-01, 02, 03)
    ('lnk-m3-multi-01', 'loan-m3-multi-col', 'col-m3-multi-01', 'FAC-M3-MULTI', 'cust-m3-demo', 30000000.00, 30000000.00, 83.33, 50.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-02-01', 'CBS_SIM', 'FAC-M3-MULTI', 'ACC-M3-004', 'COL-M3-HQ-01', 'M3_INIT', 'A', 1),
    ('lnk-m3-multi-02', 'loan-m3-multi-col', 'col-m3-multi-02', 'FAC-M3-MULTI', 'cust-m3-demo', 18000000.00, 18000000.00, 96.00, 30.00, 'Secondary', 'Active', 'Active', 'Eligible', '2024-02-01', 'CBS_SIM', 'FAC-M3-MULTI', 'ACC-M3-004', 'COL-M3-MACH-02', 'M3_INIT', 'A', 1),
    ('lnk-m3-multi-03', 'loan-m3-multi-col', 'col-m3-multi-03', 'FAC-M3-MULTI', 'cust-m3-demo', 12000000.00, 12000000.00, 100.00, 20.00, 'Secondary', 'Active', 'Active', 'Eligible', '2024-02-01', 'CBS_SIM', 'FAC-M3-MULTI', 'ACC-M3-004', 'COL-M3-FLEET-03', 'M3_INIT', 'A', 1),
    -- Scenario 5: Third-Party Collateral Link
    ('lnk-m3-tp-01', 'loan-m3-tp-borrower', 'col-m3-tp-01', 'FAC-M3-TP-01', 'cust-m3-borrower', 35000000.00, 35000000.00, 87.50, 100.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-04-10', 'CBS_SIM', 'FAC-M3-TP-01', 'ACC-M3-005', 'COL-M3-TP-01', 'M3_INIT', 'A', 1)
ON CONFLICT (id) DO UPDATE SET
    allocated_amount = EXCLUDED.allocated_amount,
    linked_amount = EXCLUDED.linked_amount,
    collateral_allocation_pct = EXCLUDED.collateral_allocation_pct,
    facility_coverage_pct = EXCLUDED.facility_coverage_pct,
    status = EXCLUDED.status;

-- Sync Links to cbs_sim.cltb_acc_coll_link_dtls
INSERT INTO cbs_sim.cltb_acc_coll_link_dtls (
    id, account_number, branch_code, linkage_type, linked_reference_no,
    linkage_currency, overall_amount, limit_amount, linked_amount,
    linked_percent_number, util_order, reinstate_order, util_amount, status
)
VALUES
    ('lnk-m3-cross-a', 'ACC-M3-001', 'BRN-001', 'Cross-Collateral', 'COL-M3-CROSS-01', 'ETB', 100000000.00, 50000000.00, 40000000.00, 50.00, 1, 1, 40000000.00, 'Active'),
    ('lnk-m3-cross-b', 'ACC-M3-002', 'BRN-001', 'Cross-Collateral', 'COL-M3-CROSS-01', 'ETB', 100000000.00, 35000000.00, 25000000.00, 31.25, 2, 2, 25000000.00, 'Active'),
    ('lnk-m3-cross-c', 'ACC-M3-003', 'BRN-001', 'Cross-Collateral', 'COL-M3-CROSS-01', 'ETB', 100000000.00, 20000000.00, 15000000.00, 18.75, 3, 3, 15000000.00, 'Active'),
    ('lnk-m3-multi-01', 'ACC-M3-004', 'BRN-001', 'Primary', 'COL-M3-HQ-01', 'ETB', 45000000.00, 70000000.00, 30000000.00, 83.33, 1, 1, 30000000.00, 'Active'),
    ('lnk-m3-multi-02', 'ACC-M3-004', 'BRN-001', 'Secondary', 'COL-M3-MACH-02', 'ETB', 25000000.00, 70000000.00, 18000000.00, 96.00, 2, 2, 18000000.00, 'Active'),
    ('lnk-m3-multi-03', 'ACC-M3-004', 'BRN-001', 'Secondary', 'COL-M3-FLEET-03', 'ETB', 16000000.00, 70000000.00, 12000000.00, 100.00, 3, 3, 12000000.00, 'Active'),
    ('lnk-m3-tp-01', 'ACC-M3-005', 'BRN-002', 'Primary', 'COL-M3-TP-01', 'ETB', 50000000.00, 45000000.00, 35000000.00, 87.50, 1, 1, 35000000.00, 'Active')
ON CONFLICT (id) DO UPDATE SET
    linked_amount = EXCLUDED.linked_amount,
    linked_percent_number = EXCLUDED.linked_percent_number,
    status = EXCLUDED.status;

-- 7. Seed Insurance Policy for Section 38 Insurance Test:
-- Collateral COL-M3-CROSS-01: Valid active policy of 90,000,000.00 ETB
INSERT INTO cims_insurance_policies (
    id, policy_number, insurer_name, collateral_id, insured_amount, premium,
    effective_date, expiry_date, status, coverage_type
)
VALUES
    ('pol-m3-01', 'POL-AWASH-M3-9901', 'Ethiopian Insurance Corporation (EIC)', 'col-m3-cross-01', 90000000.00, 245000.00,
     '2024-01-01', '2026-12-31', 'Active', 'Fire & Lightning'),
    ('pol-m3-02', 'POL-AWASH-M3-9902', 'Nyala Insurance S.C.', 'col-m3-multi-01', 45000000.00, 120000.00,
     '2024-02-01', '2026-12-31', 'Active', 'Fire & Lightning'),
    ('pol-m3-03', 'POL-AWASH-M3-9903', 'Awash Insurance S.C.', 'col-m3-multi-02', 25000000.00, 95000.00,
     '2024-02-01', '2026-12-31', 'Active', 'Contractor All-Risk / Machinery Breakdown'),
    ('pol-m3-04', 'POL-AWASH-M3-9904', 'United Insurance S.C.', 'col-m3-multi-03', 16000000.00, 80000.00,
     '2024-02-01', '2026-12-31', 'Active', 'Comprehensive Motor'),
    ('pol-m3-05', 'POL-BOLE-M3-9905', 'Nib Insurance S.C.', 'col-m3-tp-01', 50000000.00, 150000.00,
     '2024-04-10', '2026-12-31', 'Active', 'Fire & Lightning')
ON CONFLICT (id) DO UPDATE SET
    insured_amount = EXCLUDED.insured_amount,
    expiry_date = EXCLUDED.expiry_date,
    status = EXCLUDED.status;
