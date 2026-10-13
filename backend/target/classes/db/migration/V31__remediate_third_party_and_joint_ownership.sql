-- ==============================================================================
-- Migration V31: Authoritative Remediation for Third-Party & Joint Collateral Ownership,
-- Mandatory Consent/Pledge Documents, and Cross-Module Consistency
-- Database: cims_db_dev
-- ==============================================================================

-- 1. Seed Mandatory Document Rules for Third-Party Collateral
INSERT INTO cims_mandatory_document_rules (
    id, collateral_category, collateral_type, document_type,
    ownership_condition, applicability_condition, mandatory, active
)
VALUES
    ('doc-rule-tp-pledge', 'All', NULL, 'Third-Party Consent and Pledge Agreement',
     'Third-party-owned', 'Applicable to all third-party owned collateral assets', true, true),
    ('doc-rule-tp-letter', 'All', NULL, 'Letter of Consent',
     'Third-party-owned', 'Applicable to all third-party owned collateral assets', true, true)
ON CONFLICT (id) DO UPDATE SET
    collateral_category = EXCLUDED.collateral_category,
    document_type = EXCLUDED.document_type,
    ownership_condition = EXCLUDED.ownership_condition,
    mandatory = EXCLUDED.mandatory,
    active = EXCLUDED.active;

-- 2. Seed Test Customers for Verification Scenarios
INSERT INTO cims_customers (
    id, cif, name, customer_type, national_id, tax_id_no,
    phone, email, address, segment, branch, risk_rating, status, source
)
VALUES
    ('cust-test-borrower-1', 'CIF-TEST-BORR-01', 'Almaz Bekele Trading PLC', 'Corporate',
     NULL, 'TIN-10020030', '+251-91-111-2233', 'almaz@trading.et', 'Bole Sub-City, Woreda 03, Addis Ababa',
     'Corporate Banking', 'Bole Special Branch', 'Low', 'Active', 'CBS_SIM'),
    ('cust-test-borrower-2', 'CIF-TEST-BORR-02', 'Tadesse Transport Services', 'Corporate',
     NULL, 'TIN-40050060', '+251-91-222-3344', 'info@tadesse-trans.et', 'Kirkos Sub-City, Addis Ababa',
     'Commercial Banking', 'Bole Special Branch', 'Medium', 'Active', 'CBS_SIM'),
    ('cust-test-borrower-3', 'CIF-TEST-BORR-03', 'Mekonnen Manufacturing Industries', 'Corporate',
     NULL, 'TIN-70080090', '+251-91-333-4455', 'contact@mekonnen-mfg.et', 'Akaki Kality, Addis Ababa',
     'Corporate Banking', 'Bole Special Branch', 'Low', 'Active', 'CBS_SIM'),
    ('cust-test-owner-b', 'CIF-TEST-OWNER-B', 'Ato Girma Haile Gebre', 'Individual',
     'NID-ETH-77291033', 'TIN-00998811', '+251-91-123-4567', 'girma.haile@gmail.com', 'Bole Atlas, Addis Ababa',
     'Retail Banking', 'Bole Special Branch', 'Low', 'Active', 'CBS_SIM')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    cif = EXCLUDED.cif,
    segment = EXCLUDED.segment,
    branch = EXCLUDED.branch;

-- 3. Seed Test Facilities
INSERT INTO cims_loan_accounts (
    id, loan_reference, line_code, customer_id, account_number, facility_type,
    approved_limit, outstanding_balance, available_amount, line_currency, status,
    segment, branch, rm_user_id, source
)
VALUES
    ('loan-test-fac-1', 'LN-TEST-001', 'FAC-TEST-001', 'cust-test-borrower-1', 'ACC-TEST-001', 'Term Loan',
     25000000.00, 20000000.00, 5000000.00, 'ETB', 'Active', 'Corporate Banking', 'Bole Special Branch', 'RM001', 'CBS_SIM'),
    ('loan-test-fac-2', 'LN-TEST-002', 'FAC-TEST-002', 'cust-test-borrower-2', 'ACC-TEST-002', 'Overdraft Facility',
     35000000.00, 30000000.00, 5000000.00, 'ETB', 'Active', 'Commercial Banking', 'Bole Special Branch', 'RM002', 'CBS_SIM'),
    ('loan-test-fac-3a', 'LN-TEST-003A', 'FAC-TEST-003A', 'cust-test-borrower-3', 'ACC-TEST-003A', 'Term Loan',
     25000000.00, 20000000.00, 5000000.00, 'ETB', 'Active', 'Corporate Banking', 'Bole Special Branch', 'RM001', 'CBS_SIM'),
    ('loan-test-fac-3b', 'LN-TEST-003B', 'FAC-TEST-003B', 'cust-test-borrower-3', 'ACC-TEST-003B', 'Letters of Credit Facility',
     20000000.00, 15000000.00, 5000000.00, 'ETB', 'Active', 'Corporate Banking', 'Bole Special Branch', 'RM001', 'CBS_SIM'),
    ('loan-test-fac-11a', 'LN-TEST-011A', 'FAC-TEST-011A', 'cust-test-borrower-1', 'ACC-TEST-011A', 'Short-Term Loan',
     10000000.00, 0.00, 10000000.00, 'ETB', 'Closed', 'Corporate Banking', 'Bole Special Branch', 'RM001', 'CBS_SIM'),
    ('loan-test-fac-11b', 'LN-TEST-011B', 'FAC-TEST-011B', 'cust-test-borrower-1', 'ACC-TEST-011B', 'Revolving Credit Line',
     20000000.00, 15000000.00, 5000000.00, 'ETB', 'Active', 'Corporate Banking', 'Bole Special Branch', 'RM001', 'CBS_SIM')
ON CONFLICT (id) DO UPDATE SET
    outstanding_balance = EXCLUDED.outstanding_balance,
    status = EXCLUDED.status;

-- 4. Seed Test Collaterals
INSERT INTO cims_collaterals (
    id, code, customer_id, description, category, type, owner_type,
    currency, valuation_amount, haircut, nsv, current_allocation,
    utilization_percentage, insurance_status, status, charge_type, secured,
    owning_segment, branch, source
)
VALUES
    -- Test 1: Borrower-owned collateral
    ('col-test-borr-1', 'COL-TEST-BORR-01', 'cust-test-borrower-1', 'Commercial Office Building - Bole Road',
     'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned',
     'ETB', 30000000.00, 20.00, 24000000.00, 20000000.00, 83.33, 'Adequately Insured', 'Active', 'Mortgage', true,
     'Corporate Banking', 'Bole Special Branch', 'CBS_SIM'),

    -- Test 2: Third-party-owned collateral
    ('col-test-tp-2', 'COL-TEST-TP-02', 'cust-test-borrower-2', 'Pledged Industrial Warehouse & Storage Facility',
     'Immovable Properties', 'Buildings - Commercial', 'Third-party-owned',
     'ETB', 50000000.00, 20.00, 40000000.00, 30000000.00, 75.00, 'Adequately Insured', 'Active', 'Mortgage', true,
     'Commercial Banking', 'Bole Special Branch', 'CBS_SIM'),

    -- Test 3: Third-party collateral securing multiple facilities
    ('col-test-tp-3', 'COL-TEST-TP-03', 'cust-test-borrower-3', 'Heavy Equipment Fleet & Maintenance Depot',
     'Immovable Properties', 'Buildings - Commercial', 'Third-party-owned',
     'ETB', 60000000.00, 20.00, 48000000.00, 35000000.00, 72.92, 'Adequately Insured', 'Active', 'Mortgage', true,
     'Corporate Banking', 'Bole Special Branch', 'CBS_SIM'),

    -- Test 4: Jointly-owned collateral (60% + 40% = 100%)
    ('col-test-joint-4', 'COL-TEST-JOINT-04', 'cust-test-borrower-1', 'Mixed-Use Commercial Plaza (Co-Owned)',
     'Immovable Properties', 'Buildings - Mixed-use', 'Jointly-owned',
     'ETB', 40000000.00, 20.00, 32000000.00, 0.00, 0.00, 'Not Required', 'Active', 'Mortgage', true,
     'Corporate Banking', 'Bole Special Branch', 'CBS_SIM'),

    -- Test 11: Collateral linked to 1 closed + 1 active facility
    ('col-test-rel-11', 'COL-TEST-REL-11', 'cust-test-borrower-1', 'Commercial G+4 Building - Kirkos',
     'Immovable Properties', 'Buildings - Commercial', 'Borrower-owned',
     'ETB', 50000000.00, 20.00, 40000000.00, 15000000.00, 37.50, 'Adequately Insured', 'Active', 'Mortgage', true,
     'Corporate Banking', 'Bole Special Branch', 'CBS_SIM')
ON CONFLICT (id) DO UPDATE SET
    valuation_amount = EXCLUDED.valuation_amount,
    nsv = EXCLUDED.nsv,
    status = EXCLUDED.status;

-- 5. Seed Collateral Owners
INSERT INTO cims_collateral_owners (
    id, collateral_id, name, ownership_type, owner_type, id_number, tin, phone,
    percentage, relationship, relationship_to_borrower, consent_info, pledge_agreement_ref,
    verification_status, status, effective_from
)
VALUES
    -- Test 1: Sole Borrower Owner
    ('own-test-borr-1', 'col-test-borr-1', 'Almaz Bekele Trading PLC', 'Borrower-owned', 'Corporate',
     'REG-CORP-9921', 'TIN-10020030', '+251-91-111-2233', 100.00, 'Borrower', 'Self',
     NULL, NULL, 'Verified', 'Active', '2024-01-10'),

    -- Test 2: Third-Party Owner with Documented Relationship & Consent
    ('own-test-tp-2', 'col-test-tp-2', 'Ato Kebede Kassahun', 'Third-party-owned', 'Individual',
     'NID-ETH-99221144', 'TIN-11223344', '+251-91-122-3344', 100.00, 'Third-Party Pledgor', 'Parent Company',
     'Formal Spousal and Board Consent Attached', 'PLG-AGR-TEST-002', 'Verified', 'Active', '2024-02-15'),

    -- Test 3: Third-Party Owner securing multiple facilities
    ('own-test-tp-3', 'col-test-tp-3', 'W/ro Aster Hailu', 'Third-party-owned', 'Individual',
     'NID-ETH-55443322', 'TIN-55667788', '+251-91-133-4455', 100.00, 'Third-Party Guarantor', 'Guarantor',
     'Unconditional Corporate Guarantee & Third-Party Pledge Agreement', 'PLG-AGR-TEST-003', 'Verified', 'Active', '2024-03-01'),

    -- Test 4: Joint Ownership (60% + 40% = 100%)
    ('own-test-joint-4a', 'col-test-joint-4', 'Ato Daniel Tesfaye', 'Jointly-owned', 'Individual',
     'NID-ETH-11112222', 'TIN-11112222', '+251-91-144-5566', 60.00, 'Primary Co-Owner', 'Director',
     'Co-Owner Pledge Consent', 'PLG-CO-01', 'Verified', 'Active', '2024-01-20'),
    ('own-test-joint-4b', 'col-test-joint-4', 'W/ro Tigist Abebe', 'Jointly-owned', 'Individual',
     'NID-ETH-33334444', 'TIN-33334444', '+251-91-155-6677', 40.00, 'Secondary Co-Owner', 'Shareholder',
     'Co-Owner Pledge Consent', 'PLG-CO-02', 'Verified', 'Active', '2024-01-20'),

    -- Test 11 Owner
    ('own-test-rel-11', 'col-test-rel-11', 'Almaz Bekele Trading PLC', 'Borrower-owned', 'Corporate',
     'REG-CORP-9921', 'TIN-10020030', '+251-91-111-2233', 100.00, 'Borrower', 'Self',
     NULL, NULL, 'Verified', 'Active', '2024-01-10')
ON CONFLICT (id) DO UPDATE SET
    percentage = EXCLUDED.percentage,
    relationship_to_borrower = EXCLUDED.relationship_to_borrower,
    status = EXCLUDED.status;

-- 6. Seed Mandatory Third-Party Documents for col-test-tp-2 & col-test-tp-3 & col-m3-tp-01
INSERT INTO cims_ownership_documents (
    id, entity_type, entity_id, collateral_id, name, type,
    file_name, file_size, content_type, file_content, verification_status,
    status, version, is_latest, uploaded_by, upload_date, expiry_date, remarks
)
VALUES
    -- col-m3-tp-01 Mandatory Docs
    ('doc-m3-tp-pledge', 'Collateral', 'col-m3-tp-01', 'col-m3-tp-01',
     'Third-Party Consent and Pledge Agreement', 'Third-Party Consent and Pledge Agreement',
     'Girma_Haile_Pledge_Agreement.pdf', 102400, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-04-10', '2028-12-31', 'Executed Third-Party Pledge Agreement'),
    ('doc-m3-tp-letter', 'Collateral', 'col-m3-tp-01', 'col-m3-tp-01',
     'Letter of Consent', 'Letter of Consent',
     'Girma_Haile_Consent_Letter.pdf', 84000, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-04-10', '2028-12-31', 'Formal Letter of Consent from Legal Owner'),
    ('doc-m3-tp-title', 'Collateral', 'col-m3-tp-01', 'col-m3-tp-01',
     'Title Deed / Property Ownership Certificate', 'Title Deed / Property Ownership Certificate',
     'Title_Deed_COL_M3_TP_01.pdf', 204800, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-04-10', '2030-12-31', 'Original Title Deed Certificate'),
    ('doc-m3-tp-val', 'Collateral', 'col-m3-tp-01', 'col-m3-tp-01',
     'Valuation Report', 'Valuation Report',
     'Valuation_Report_COL_M3_TP_01.pdf', 153600, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'VALUATION_OFFICER', '2024-04-10', '2026-12-31', 'Independent Valuation Report'),

    -- col-test-tp-2 Mandatory Docs
    ('doc-test-tp2-pledge', 'Collateral', 'col-test-tp-2', 'col-test-tp-2',
     'Third-Party Consent and Pledge Agreement', 'Third-Party Consent and Pledge Agreement',
     'Kebede_Kassahun_Pledge_Agreement.pdf', 102400, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-02-15', '2028-12-31', 'Executed Third-Party Pledge Agreement'),
    ('doc-test-tp2-letter', 'Collateral', 'col-test-tp-2', 'col-test-tp-2',
     'Letter of Consent', 'Letter of Consent',
     'Kebede_Kassahun_Consent_Letter.pdf', 84000, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-02-15', '2028-12-31', 'Formal Letter of Consent from Legal Owner'),
    ('doc-test-tp2-title', 'Collateral', 'col-test-tp-2', 'col-test-tp-2',
     'Title Deed / Property Ownership Certificate', 'Title Deed / Property Ownership Certificate',
     'Title_Deed_Warehouse_COL_TEST_TP_02.pdf', 204800, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-02-15', '2030-12-31', 'Original Title Deed Certificate'),
    ('doc-test-tp2-val', 'Collateral', 'col-test-tp-2', 'col-test-tp-2',
     'Valuation Report', 'Valuation Report',
     'Valuation_Report_Warehouse_COL_TEST_TP_02.pdf', 153600, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'VALUATION_OFFICER', '2024-02-15', '2026-12-31', 'Professional Valuation Report'),

    -- col-test-tp-3 Mandatory Docs
    ('doc-test-tp3-pledge', 'Collateral', 'col-test-tp-3', 'col-test-tp-3',
     'Third-Party Consent and Pledge Agreement', 'Third-Party Consent and Pledge Agreement',
     'Aster_Hailu_Pledge_Agreement.pdf', 102400, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-03-01', '2028-12-31', 'Executed Third-Party Pledge Agreement'),
    ('doc-test-tp3-letter', 'Collateral', 'col-test-tp-3', 'col-test-tp-3',
     'Letter of Consent', 'Letter of Consent',
     'Aster_Hailu_Consent_Letter.pdf', 84000, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-03-01', '2028-12-31', 'Formal Letter of Consent from Legal Owner'),
    ('doc-test-tp3-title', 'Collateral', 'col-test-tp-3', 'col-test-tp-3',
     'Title Deed / Property Ownership Certificate', 'Title Deed / Property Ownership Certificate',
     'Title_Deed_Depot_COL_TEST_TP_03.pdf', 204800, 'application/pdf',
     'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag==',
     'Verified', 'Active', 1, true, 'LEGAL_OFFICER', '2024-03-01', '2030-12-31', 'Original Title Deed Certificate')
ON CONFLICT (id) DO UPDATE SET
    verification_status = EXCLUDED.verification_status,
    status = EXCLUDED.status;

-- 7. Seed Links for Scenarios
INSERT INTO cims_loan_collateral_links (
    id, loan_account_id, collateral_id, facility_id, customer_id, allocated_amount, linked_amount,
    collateral_allocation_pct, facility_coverage_pct, linkage_type, status, relationship_status,
    release_status, effective_date, source, maker_id, auth_stat, mod_no
)
VALUES
    -- Test 1 Link: col-test-borr-1 -> loan-test-fac-1 (Allocated 20M, NSV 24M)
    ('lnk-test-borr-1', 'loan-test-fac-1', 'col-test-borr-1', 'FAC-TEST-001', 'cust-test-borrower-1',
     20000000.00, 20000000.00, 83.33, 100.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-01-10', 'CBS_SIM', 'TEST_INIT', 'A', 1),

    -- Test 2 Link: col-test-tp-2 -> loan-test-fac-2 (Allocated 30M, NSV 40M)
    ('lnk-test-tp-2', 'loan-test-fac-2', 'col-test-tp-2', 'FAC-TEST-002', 'cust-test-borrower-2',
     30000000.00, 30000000.00, 75.00, 100.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-02-15', 'CBS_SIM', 'TEST_INIT', 'A', 1),

    -- Test 3 Links: col-test-tp-3 -> loan-test-fac-3a (20M) & loan-test-fac-3b (15M) (Total 35M <= NSV 48M)
    ('lnk-test-tp-3a', 'loan-test-fac-3a', 'col-test-tp-3', 'FAC-TEST-003A', 'cust-test-borrower-3',
     20000000.00, 20000000.00, 41.67, 100.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-03-01', 'CBS_SIM', 'TEST_INIT', 'A', 1),
    ('lnk-test-tp-3b', 'loan-test-fac-3b', 'col-test-tp-3', 'FAC-TEST-003B', 'cust-test-borrower-3',
     15000000.00, 15000000.00, 31.25, 100.00, 'Secondary', 'Active', 'Active', 'Eligible', '2024-03-01', 'CBS_SIM', 'TEST_INIT', 'A', 1),

    -- Test 11 Links: col-test-rel-11 -> loan-test-fac-11a (Closed, 0 balance) & loan-test-fac-11b (Active, 15M balance)
    ('lnk-test-rel-11a', 'loan-test-fac-11a', 'col-test-rel-11', 'FAC-TEST-011A', 'cust-test-borrower-1',
     10000000.00, 10000000.00, 25.00, 100.00, 'Primary', 'Active', 'Active', 'Eligible', '2024-01-10', 'CBS_SIM', 'TEST_INIT', 'A', 1),
    ('lnk-test-rel-11b', 'loan-test-fac-11b', 'col-test-rel-11', 'FAC-TEST-011B', 'cust-test-borrower-1',
     15000000.00, 15000000.00, 37.50, 100.00, 'Secondary', 'Active', 'Active', 'Eligible', '2024-01-10', 'CBS_SIM', 'TEST_INIT', 'A', 1)
ON CONFLICT (id) DO UPDATE SET
    allocated_amount = EXCLUDED.allocated_amount,
    status = EXCLUDED.status;

-- 8. Seed Policies for Verification
INSERT INTO cims_insurance_policies (
    id, policy_number, insurer_name, collateral_id, customer_id, insured_amount, premium,
    effective_date, expiry_date, status, coverage_type
)
VALUES
    -- Test 1 policy (Active valid)
    ('pol-test-01', 'POL-TEST-BORR-001', 'Ethiopian Insurance Corporation (EIC)', 'col-test-borr-1', 'cust-test-borrower-1',
     30000000.00, 95000.00, '2024-01-10', '2026-12-31', 'Active', 'Fire & Lightning'),

    -- Test 2 policy (Active valid)
    ('pol-test-02', 'POL-TEST-TP-002', 'Nyala Insurance S.C.', 'col-test-tp-2', 'cust-test-borrower-2',
     50000000.00, 150000.00, '2024-02-15', '2026-12-31', 'Active', 'Fire & Lightning'),

    -- Test 3 policy (Active valid)
    ('pol-test-03', 'POL-TEST-TP-003', 'Awash Insurance S.C.', 'col-test-tp-3', 'cust-test-borrower-3',
     60000000.00, 180000.00, '2024-03-01', '2026-12-31', 'Active', 'Fire & Lightning'),

    -- Test 12 policy: Expired policy (expiry in past)
    ('pol-test-exp-12', 'POL-TEST-EXPIRED-012', 'United Insurance S.C.', 'col-test-borr-1', 'cust-test-borrower-1',
     25000000.00, 80000.00, '2022-01-01', '2023-01-01', 'Expired', 'Fire & Lightning')
ON CONFLICT (id) DO UPDATE SET
    insured_amount = EXCLUDED.insured_amount,
    expiry_date = EXCLUDED.expiry_date,
    status = EXCLUDED.status;
