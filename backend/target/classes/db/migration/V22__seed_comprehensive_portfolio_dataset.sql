-- V22__seed_comprehensive_portfolio_dataset.sql
-- Comprehensive multi-segment, multi-branch, multi-insurer portfolio seed data
-- Populates all 4 segments (Corporate, Retail, MSME, IFB) and 5 branches
-- Populates all 7 expiry pipeline buckets, 5 policy ageing brackets, collateral taxonomies, RM compliance, and documentation health

-- 1. Insert Additional Customers across All Segments & Branches
INSERT INTO cims_customers (id, cif, customer_type, name, business_reg_no, tax_id_no, dob_or_incorp, phone, email, address, segment, branch, status, risk_rating) VALUES
('cust-ifb-105', 'CIF-000105', 'Business', 'Al-Noor Import & Export Plc', 'REG-ET-2020-5511', 'TIN-00881122', '2020-04-10', '+251911334455', 'trade@alnoor.com', 'Bole Medhanialem, Kazanchis, Addis Ababa', 'Interest-Free Banking (IFB)', 'Kazanchis Branch', 'Active', 'Low'),
('cust-corp-106', 'CIF-000106', 'Business', 'Blue Nile Coffee Exporters Plc', 'REG-ET-2016-7788', 'TIN-00772233', '2016-08-15', '+251911448899', 'export@bluenile.com', 'Lake Shore Commercial Zone, Bahir Dar', 'Corporate Banking', 'Lake Tana Branch', 'Active', 'Medium'),
('cust-msme-107', 'CIF-000107', 'Business', 'Rift Valley Agro-Farming Enterprise', 'REG-ET-2021-3322', 'TIN-00663344', '2021-03-22', '+251911559900', 'agro@riftvalley.com', 'Hawassa Agro-Industrial Park, Hawassa', 'MSME Banking', 'Hawassa Main Branch', 'Active', 'Medium'),
('cust-ret-108', 'CIF-000108', 'Individual', 'Selamawit Desta Haile', NULL, 'TIN-00554411', '1989-07-19', '+251911661122', 'selam.desta@gmail.com', 'Kazanchis, Kirkos Subcity, Addis Ababa', 'Retail Banking', 'Kazanchis Branch', 'Active', 'Low'),
('cust-ifb-109', 'CIF-000109', 'Business', 'Zulfa Ahmed General Trading', 'REG-ET-2019-9944', 'TIN-00441188', '2019-11-05', '+251911772233', 'zulfa.trading@gmail.com', 'Merkato Commercial Center, Addis Ababa', 'Interest-Free Banking (IFB)', 'Merkato Branch', 'Active', 'Low')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, segment = EXCLUDED.segment, branch = EXCLUDED.branch;

-- 2. Insert Credit Facilities across All Segments & Branches
INSERT INTO cims_loan_accounts (id, loan_reference, customer_id, facility_type, approved_limit, outstanding_balance, status, line_code, segment, branch, rm_user_id, line_start_date, line_expiry_date) VALUES
('loan-ifb-005', 'LN-IFB-2026-005', 'cust-ifb-105', 'Murabaha Trade Line', 18000000.00, 14000000.00, 'Active', 'FAC-IFB-001', 'Interest-Free Banking (IFB)', 'Kazanchis Branch', 'Kidist Selasse', '2025-02-01', '2027-02-01'),
('loan-corp-006', 'LN-CORP-2026-006', 'cust-corp-106', 'Export Credit Facility', 28000000.00, 22000000.00, 'Active', 'FAC-CORP-003', 'Corporate Banking', 'Lake Tana Branch', 'Tewodros Kassahun', '2024-06-15', '2027-06-15'),
('loan-msme-007', 'LN-MSME-2026-007', 'cust-msme-107', 'Agro Term Loan', 12000000.00, 8500000.00, 'Active', 'FAC-MSME-002', 'MSME Banking', 'Hawassa Main Branch', 'Meron Getachew', '2025-01-10', '2028-01-10'),
('loan-ret-008', 'LN-RET-2026-008', 'cust-ret-108', 'Personal Auto Loan', 3500000.00, 2200000.00, 'Active', 'FAC-RET-002', 'Retail Banking', 'Kazanchis Branch', 'Ermias Haile', '2025-08-01', '2029-08-01'),
('loan-ifb-009', 'LN-IFB-2026-009', 'cust-ifb-109', 'Ijara Equipment Lease', 7000000.00, 5000000.00, 'Active', 'FAC-IFB-002', 'Interest-Free Banking (IFB)', 'Merkato Branch', 'Dawit Girma', '2025-04-15', '2028-04-15'),
('loan-msme-004', 'LN-MSME-2026-004', 'cust-1788155218663', 'Working Capital Line', 14000000.00, 9500000.00, 'Active', 'FAC-MSME-001', 'MSME Banking', 'Merkato Branch', 'Meron Getachew', '2024-11-01', '2027-11-01')
ON CONFLICT (id) DO UPDATE SET outstanding_balance = EXCLUDED.outstanding_balance, segment = EXCLUDED.segment, branch = EXCLUDED.branch;

-- 3. Insert Collaterals across All Segments, Categories, and Branches
INSERT INTO cims_collaterals (id, code, type, category, valuation_amount, current_allocation, limit_contribution, utilization_percentage, status, owner_type, owning_segment, branch, customer_id, haircut, description) VALUES
('col-ifb-105-a', 'COL-IFB-001', 'Commercial Buildings', 'Immovable Properties', 22000000.00, 14000000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Interest-Free Banking (IFB)', 'Kazanchis Branch', 'cust-ifb-105', 20.00, 'Commercial Office Building G+5 Kazanchis'),
('col-ifb-105-b', 'COL-IFB-002', 'Industrial Warehouses', 'Immovable Properties', 10000000.00, 0.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Interest-Free Banking (IFB)', 'Kazanchis Branch', 'cust-ifb-105', 25.00, 'Customs Bonded Warehouse Kaliti'),
('col-corp-106-a', 'COL-CORP-006', 'Industrial Warehouses', 'Immovable Properties', 32000000.00, 22000000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Corporate Banking', 'Lake Tana Branch', 'cust-corp-106', 20.00, 'Modern Coffee Processing Plant & Silos Bahir Dar'),
('col-corp-106-b', 'COL-CORP-007', 'Commercial Trucks', 'Movable Properties', 15000000.00, 0.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Corporate Banking', 'Lake Tana Branch', 'cust-corp-106', 30.00, 'Heavy Freight Transport Trucks Fleet (5 Units)'),
('col-msme-107-a', 'COL-MSME-001', 'Heavy Construction Machinery', 'Movable Properties', 14000000.00, 8500000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'MSME Banking', 'Hawassa Main Branch', 'cust-msme-107', 30.00, 'Caterpillar Excavators & Tractors Hawassa Farm'),
('col-msme-107-b', 'COL-MSME-002', 'Manufacturing Equipment', 'Business Mortgages', 8000000.00, 0.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'MSME Banking', 'Hawassa Main Branch', 'cust-msme-107', 25.00, 'Fruit Juice Bottling & Packaging Assembly Line'),
('col-ret-108-a', 'COL-RET-001', 'Fleet Vehicles', 'Movable Properties', 4000000.00, 2200000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Retail Banking', 'Kazanchis Branch', 'cust-ret-108', 25.00, 'Toyota Land Cruiser Prado TXL 2023'),
('col-ifb-109-a', 'COL-IFB-003', 'Manufacturing Equipment', 'Business Mortgages', 9000000.00, 5000000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Interest-Free Banking (IFB)', 'Merkato Branch', 'cust-ifb-109', 25.00, 'Printing & Packaging Machinery Unit Merkato'),
('col-msme-104-a', 'COL-MSME-003', 'Industrial Warehouses', 'Immovable Properties', 16000000.00, 9500000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'MSME Banking', 'Merkato Branch', 'cust-1788155218663', 20.00, 'Tannery Processing Factory & Warehouse Kaliti'),
('col-ret-103-a', 'COL-RET-002', 'Residential Properties', 'Immovable Properties', 15000000.00, 6800000.00, 0.00, 0.00, 'Active', 'Borrower-owned', 'Retail Banking', 'Merkato Branch', 'cust-1788161152835', 20.00, 'Two-Storey Residential Villa CMC Addis Ababa')
ON CONFLICT (id) DO UPDATE SET valuation_amount = EXCLUDED.valuation_amount, owning_segment = EXCLUDED.owning_segment, branch = EXCLUDED.branch;

UPDATE cims_collaterals SET limit_contribution = 0.0 WHERE limit_contribution IS NULL;
UPDATE cims_collaterals SET utilization_percentage = 0.0 WHERE utilization_percentage IS NULL;

-- 4. Insert Loan-Collateral Links
INSERT INTO cims_loan_collateral_links (id, loan_account_id, collateral_id, allocated_amount, linkage_type, status) VALUES
('link-ifb-005', 'loan-ifb-005', 'col-ifb-105-a', 14000000.00, 'Primary', 'Active'),
('link-corp-006', 'loan-corp-006', 'col-corp-106-a', 22000000.00, 'Primary', 'Active'),
('link-msme-007', 'loan-msme-007', 'col-msme-107-a', 8500000.00, 'Primary', 'Active'),
('link-ret-008', 'loan-ret-008', 'col-ret-108-a', 2200000.00, 'Primary', 'Active'),
('link-ifb-009', 'loan-ifb-009', 'col-ifb-109-a', 5000000.00, 'Primary', 'Active'),
('link-msme-004', 'loan-msme-004', 'col-msme-104-a', 9500000.00, 'Primary', 'Active'),
('link-ret-003', 'loan-1788171738579-285', 'col-ret-103-a', 6800000.00, 'Primary', 'Active'),
-- Cross-Segment Shared Collateral Linkage:
('link-shared-corp-ret', 'loan-1788171737122-466', 'col-ifb-105-b', 5000000.00, 'Secondary', 'Active')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Insurance Policies Spanning All 7 Expiry Pipeline Buckets and 5 Ageing Horizons
INSERT INTO cims_insurance_policies (id, policy_number, insurer_name, coverage_type, insured_amount, premium, effective_date, expiry_date, status, collateral_id, customer_id) VALUES
-- 1. Expired / Overdue (2 policies: expired in Aug & Sep 2026, aged > 1 year)
('pol-exp-01', 'POL-EXP-8811', 'The United Insurance Company', 'Fire & Allied Perils', 10000000.00, 45000.00, '2025-08-15', '2026-08-15', 'Expired', 'col-ifb-105-b', 'cust-ifb-105'),
('pol-exp-02', 'POL-EXP-9922', 'Nyala Insurance Company', 'Comprehensive Motor', 3000000.00, 25000.00, '2025-09-10', '2026-09-10', 'Expired', 'col-corp-106-b', 'cust-corp-106'),

-- 2. Due Within 0-7 Days (2 policies: expiring 2026-09-29 and 2026-10-02, aged ~1 year)
('pol-due-01', 'POL-DUE7-101', 'Ethiopian Insurance Corporation', 'Fire, Lightning & Burglary', 14000000.00, 62000.00, '2025-09-29', '2026-09-29', 'Active', 'col-ifb-105-a', 'cust-ifb-105'),
('pol-due-02', 'POL-DUE7-102', 'Africa Insurance Company', 'Commercial Vehicle Fleet', 2500000.00, 18000.00, '2025-10-02', '2026-10-02', 'Active', 'col-ret-108-a', 'cust-ret-108'),

-- 3. Due Within 8-15 Days (2 policies: expiring 2026-10-08 and 2026-10-14, aged ~1 year)
('pol-due-03', 'POL-DUE15-201', 'Awash Insurance Company', 'Machinery Breakdown', 8500000.00, 38000.00, '2025-10-08', '2026-10-08', 'Active', 'col-msme-107-a', 'cust-msme-107'),
('pol-due-04', 'POL-DUE15-202', 'Nib Insurance Company', 'Industrial All-Risk', 6000000.00, 29000.00, '2025-10-14', '2026-10-14', 'Active', 'col-ifb-109-a', 'cust-ifb-109'),

-- 4. Due Within 16-30 Days (2 policies: expiring 2026-10-22 and 2026-10-27, aged ~6 months)
('pol-due-05', 'POL-DUE30-301', 'Global Insurance Company', 'Fire & Allied Perils', 16000000.00, 75000.00, '2026-04-22', '2026-10-22', 'Active', 'col-msme-104-a', 'cust-1788155218663'),
('pol-due-06', 'POL-DUE30-302', 'Abay Insurance Company', 'Comprehensive Property', 15000000.00, 68000.00, '2026-04-27', '2026-10-27', 'Active', 'col-ret-103-a', 'cust-1788161152835'),

-- 5. Due Within 31-60 Days (3 policies: expiring in Nov 2026, aged < 90 days and 90-180 days)
('pol-due-07', 'POL-DUE60-401', 'Nile Insurance Company', 'Industrial Machinery', 8000000.00, 36000.00, '2026-05-15', '2026-11-15', 'Active', 'col-msme-107-b', 'cust-msme-107'),
('pol-due-08', 'POL-DUE60-402', 'Hibret Insurance Company', 'Commercial Fire & Special Perils', 32000000.00, 145000.00, '2026-05-20', '2026-11-20', 'Active', 'col-corp-106-a', 'cust-corp-106'),
('pol-due-09', 'POL-DUE60-403', 'Ethiopian Insurance Corporation', 'Motor Comprehensive', 12000000.00, 54000.00, '2026-05-28', '2026-11-28', 'Active', 'col-corp-106-b', 'cust-corp-106'),

-- 6. Due Within 61-90 Days (3 policies: expiring in Dec 2026, aged < 90 days)
('pol-due-10', 'POL-DUE90-501', 'Awash Insurance Company', 'Fire & Allied Perils', 22000000.00, 98000.00, '2026-07-10', '2026-12-10', 'Active', 'col-ifb-105-a', 'cust-ifb-105'),
('pol-due-11', 'POL-DUE90-502', 'Nyala Insurance Company', 'Commercial Vehicle', 4000000.00, 22000.00, '2026-07-15', '2026-12-15', 'Active', 'col-ret-108-a', 'cust-ret-108'),
('pol-due-12', 'POL-DUE90-503', 'The United Insurance Company', 'Electronic Equipment & Machinery', 9000000.00, 42000.00, '2026-07-22', '2026-12-22', 'Active', 'col-ifb-109-a', 'cust-ifb-109'),

-- 7. Policies Aged > 2 Years (incepted in 2024, expiring in 2027)
('pol-age-01', 'POL-AGE-2024', 'Ethiopian Insurance Corporation', 'Fire & Special Perils', 25000000.00, 110000.00, '2024-03-10', '2027-03-10', 'Active', 'col-corp-106-a', 'cust-corp-106')
ON CONFLICT (id) DO UPDATE SET insured_amount = EXCLUDED.insured_amount, status = EXCLUDED.status, expiry_date = EXCLUDED.expiry_date;

-- 6. Insert Ownership Documents to Populate Documentation Health (Complete, Expired, Expiring Soon, Missing)
INSERT INTO cims_ownership_documents (id, name, type, verification_status, collateral_id, upload_date, expiry_date, status) VALUES
('doc-ifb-01', 'Commercial Building Title Deed', 'Title Deed', 'Verified', 'col-ifb-105-a', '2025-02-15', '2035-02-15', 'Active'),
('doc-ifb-02', 'Independent Valuation Certificate 2026', 'Valuation Report', 'Verified', 'col-ifb-105-a', '2026-02-20', '2027-02-20', 'Active'),
('doc-ifb-03', 'Fire Insurance Cover Note', 'Insurance Policy Certificate', 'Verified', 'col-ifb-105-a', '2025-09-29', '2026-09-29', 'Active'),

('doc-corp-01', 'Coffee Factory Title Deed', 'Title Deed', 'Verified', 'col-corp-106-a', '2024-06-20', '2034-06-20', 'Active'),
('doc-corp-02', 'Commercial Valuation Certificate 2025', 'Valuation Report', 'Verified', 'col-corp-106-a', '2025-06-25', '2026-06-25', 'Active'), -- Expired valuation!
('doc-corp-03', 'Fire & Special Perils Policy Certificate', 'Insurance Policy Certificate', 'Verified', 'col-corp-106-a', '2026-05-20', '2026-11-20', 'Active'),

('doc-msme-01', 'Tannery Title Deed Kaliti', 'Title Deed', 'Verified', 'col-msme-104-a', '2024-11-10', '2034-11-10', 'Active'),
('doc-msme-02', 'Annual Machinery Valuation Certificate', 'Valuation Report', 'Verified', 'col-msme-104-a', '2025-10-15', '2026-10-15', 'Active'), -- Expiring soon (18 days)!
('doc-msme-03', 'Tannery All-Risk Policy Document', 'Insurance Policy Certificate', 'Verified', 'col-msme-104-a', '2026-04-22', '2026-10-22', 'Active'),

('doc-ret-01', 'Vehicle Logbook (Libre) Prado 2023', 'Vehicle Logbook (Libre)', 'Verified', 'col-ret-108-a', '2025-08-05', '2030-08-05', 'Active'),
('doc-ret-02', 'Annual Roadworthiness Technical Inspection', 'Valuation Report', 'Verified', 'col-ret-108-a', '2025-09-15', '2026-09-15', 'Active'), -- Expired!
('doc-ret-03', 'Comprehensive Motor Insurance Certificate', 'Insurance Policy Certificate', 'Verified', 'col-ret-108-a', '2025-10-02', '2026-10-02', 'Active') -- Expiring within 5 days!
ON CONFLICT (id) DO UPDATE SET verification_status = EXCLUDED.verification_status, expiry_date = EXCLUDED.expiry_date;
