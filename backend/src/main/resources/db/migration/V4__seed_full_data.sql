-- V4__seed_full_data.sql
-- Seed Full 16 Roles, Pre-Configured Users, Permissions Matrix, Branches, Approval Hierarchies, and CBS Mock Data

-- 1. Seed 16 Standard App Users
INSERT INTO cims_users (id, username, password, full_name, email, phone, role, branch, segment, active, segment_ids) VALUES
('usr-exec', 'exec_user', 'password123', 'Dr. Mulatu Teshome', 'exec@bank.com', '+251911000001', 'EXEC', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-sysadmin', 'sysadmin', 'password123', 'Daniel Melaku', 'sysadmin@bank.com', '+251911000002', 'SYSADMIN', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-srmgmt', 'srmgmt_user', 'password123', 'Bethlehem Tilahun', 'srmgmt@bank.com', '+251911000003', 'SRMGMT', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-hodept', 'hodept_user', 'password123', 'Yonas Kebede', 'hodept@bank.com', '+251911000004', 'HODEPT', 'Head Office', 'Corporate Banking', true, '["Corporate Banking"]'),
('usr-distdir', 'distdir_user', 'password123', 'Solomon Bogale', 'distdir@bank.com', '+251911000005', 'DISTDIR', 'Addis Ababa East District', 'Corporate Banking', true, '["Corporate Banking"]'),
('usr-brmgr', 'brmgr_user', 'password123', 'Almaz Tefera', 'brmgr@bank.com', '+251911000006', 'BRMGR', 'Bole Special Branch', 'Corporate Banking', true, '["Corporate Banking"]'),
('usr-srm', 'srm_user', 'password123', 'Tewodros Kassahun', 'srm@bank.com', '+251911000007', 'SRM', 'Bole Special Branch', 'Corporate Banking', true, '["Corporate Banking"]'),
('usr-brm', 'brm_user', 'password123', 'Meron Getachew', 'brm@bank.com', '+251911000008', 'BRM', 'Merkato Branch', 'Retail Banking', true, '["Retail Banking"]'),
('usr-cro', 'cro_user', 'password123', 'Kidist Selasse', 'cro@bank.com', '+251911000009', 'CRO', 'Bole Special Branch', 'Corporate Banking', true, '["Corporate Banking"]'),
('usr-bro', 'bro_user', 'password123', 'Ermias Haile', 'bro@bank.com', '+251911000010', 'BRO', 'Merkato Branch', 'Retail Banking', true, '["Retail Banking"]'),
('usr-mgrcolldoc', 'mgrcolldoc_user', 'password123', 'Hanna Mulugeta', 'mgrcolldoc@bank.com', '+251911000011', 'MGRCOLLDOC', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking"]'),
('usr-colldocoff', 'colldocoff_user', 'password123', 'Dawit Girma', 'colldocoff@bank.com', '+251911000012', 'COLLDOCOFF', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking"]'),
('usr-compliance', 'compliance_user', 'password123', 'Rahel Zewde', 'compliance@bank.com', '+251911000013', 'COMPLIANCE', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-risk', 'risk_user', 'password123', 'Kassaye Alemu', 'risk@bank.com', '+251911000014', 'RISK', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-auditor', 'auditor_user', 'password123', 'Abebe Bikila', 'auditor@bank.com', '+251911000015', 'AUDITOR', 'Head Office', 'Corporate Banking', true, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]'),
('usr-rdonly', 'rdonly_user', 'password123', 'Tigest Abebe', 'rdonly@bank.com', '+251911000016', 'RDONLY', 'Head Office', 'Corporate Banking', true, '["Corporate Banking"]')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, segment_ids = EXCLUDED.segment_ids;

-- 2. Seed Role Screen Permissions Matrix
INSERT INTO cims_role_permissions (id, role_code, screen_name, can_view, can_create, can_edit, can_approve, can_delete) VALUES
('perm-1', 'EXEC', 'Dashboard', true, false, false, false, false),
('perm-2', 'EXEC', 'Customers', true, false, false, false, false),
('perm-3', 'EXEC', 'Facilities', true, false, false, false, false),
('perm-4', 'EXEC', 'Collateral', true, false, false, false, false),
('perm-5', 'EXEC', 'Insurance', true, false, false, false, false),
('perm-6', 'EXEC', 'Exceptions', true, false, false, false, false),
('perm-7', 'EXEC', 'Documents', true, false, false, false, false),
('perm-8', 'EXEC', 'Reports', true, false, false, false, false),
('perm-9', 'EXEC', 'Audit Trail', true, false, false, false, false),

('perm-10', 'SYSADMIN', 'Dashboard', true, true, true, true, true),
('perm-11', 'SYSADMIN', 'Administration', true, true, true, true, true),
('perm-12', 'SYSADMIN', 'CBS Simulator', true, true, true, true, true),
('perm-13', 'SYSADMIN', 'Notifications', true, true, true, true, true),
('perm-14', 'SYSADMIN', 'Audit Trail', true, false, false, false, false),
('perm-15', 'SYSADMIN', 'Reports', true, false, false, false, false),

('perm-16', 'BRMGR', 'Dashboard', true, false, false, false, false),
('perm-17', 'BRMGR', 'Customers', true, false, true, true, false),
('perm-18', 'BRMGR', 'Facilities', true, false, false, false, false),
('perm-19', 'BRMGR', 'Collateral', true, false, true, true, false),
('perm-20', 'BRMGR', 'Insurance', true, false, true, true, false),
('perm-21', 'BRMGR', 'Approvals', true, false, false, true, false),
('perm-22', 'BRMGR', 'Exceptions', true, false, true, true, false),
('perm-23', 'BRMGR', 'Documents', true, true, true, true, false),
('perm-24', 'BRMGR', 'Reports', true, false, false, false, false),

('perm-25', 'CRO', 'Dashboard', true, false, false, false, false),
('perm-26', 'CRO', 'Customers', true, true, true, false, false),
('perm-27', 'CRO', 'Facilities', true, false, false, false, false),
('perm-28', 'CRO', 'Collateral', true, true, true, false, false),
('perm-29', 'CRO', 'Insurance', true, true, true, false, false),
('perm-30', 'CRO', 'Exceptions', true, false, true, false, false),
('perm-31', 'CRO', 'Documents', true, true, true, false, false),
('perm-32', 'CRO', 'Reports', true, false, false, false, false)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Branches Hierarchy
INSERT INTO cims_branches (id, code, name, type, parent_district_id, segment_ids, is_active) VALUES
('brn-ho', 'BRN-HO', 'Head Office', 'HeadOffice', NULL, '["Corporate Banking","Retail Banking","MSME Banking","Interest-Free Banking (IFB)"]', true),
('brn-dist-east', 'DIST-AA-EAST', 'Addis Ababa East District', 'DistrictOffice', 'brn-ho', '["Corporate Banking","Retail Banking","MSME Banking"]', true),
('brn-dist-west', 'DIST-AA-WEST', 'Addis Ababa West District', 'DistrictOffice', 'brn-ho', '["Corporate Banking","Retail Banking","MSME Banking"]', true),
('brn-dist-north', 'DIST-NORTH', 'Bahir Dar District', 'DistrictOffice', 'brn-ho', '["Corporate Banking","Retail Banking","MSME Banking"]', true),
('brn-dist-south', 'DIST-SOUTH', 'Hawassa District', 'DistrictOffice', 'brn-ho', '["Corporate Banking","Retail Banking","MSME Banking"]', true),
('brn-bole', 'BRN-001', 'Bole Special Branch', 'CorporateCenter', 'brn-dist-east', '["Corporate Banking"]', true),
('brn-merkato', 'BRN-002', 'Merkato Branch', 'Branch', 'brn-dist-west', '["Retail Banking","MSME Banking"]', true),
('brn-kazanchis', 'BRN-003', 'Kazanchis Branch', 'Branch', 'brn-dist-east', '["Corporate Banking","Retail Banking"]', true),
('brn-tana', 'BRN-004', 'Lake Tana Branch', 'Branch', 'brn-dist-north', '["Corporate Banking","Retail Banking"]', true),
('brn-hawassa', 'BRN-005', 'Hawassa Main Branch', 'Branch', 'brn-dist-south', '["Corporate Banking","Retail Banking"]', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Approval Hierarchy Configs (13 Standard Processes)
INSERT INTO cims_approval_hierarchy_configs (id, transaction_type, approval_levels, level1_role, level2_role, bulk_approve_allowed, sla_hours, active) VALUES
('ah-1', 'PROC_CUSTOMER_REGISTRATION', 1, 'BRMGR', NULL, true, 24, true),
('ah-2', 'PROC_COLLATERAL_LINK_CHANGE', 1, 'BRMGR', 'DISTDIR', false, 24, true),
('ah-3', 'PROC_OWNERSHIP_REGISTRATION', 1, 'BRMGR', NULL, false, 24, true),
('ah-4', 'PROC_OWNERSHIP_CHANGE', 1, 'BRMGR', 'DISTDIR', false, 48, true),
('ah-5', 'PROC_POLICY_REGISTRATION', 1, 'BRMGR', NULL, true, 24, true),
('ah-6', 'PROC_POLICY_AMENDMENT', 1, 'BRMGR', NULL, true, 24, true),
('ah-7', 'PROC_POLICY_RENEWAL', 1, 'BRMGR', NULL, true, 24, true),
('ah-8', 'PROC_POLICY_REPLACEMENT', 1, 'BRMGR', 'DISTDIR', false, 24, true),
('ah-9', 'PROC_POLICY_CANCELLATION', 2, 'BRMGR', 'DISTDIR', false, 48, true),
('ah-10', 'PROC_POLICY_CLOSE_REOPEN', 1, 'BRMGR', 'HODEPT', false, 24, true),
('ah-11', 'PROC_COLLATERAL_RELEASE', 2, 'BRMGR', 'DISTDIR', false, 48, true),
('ah-12', 'PROC_OWNERSHIP_SEGMENT_TRANSFER', 2, 'BRMGR', 'HODEPT', false, 48, true),
('ah-13', 'PROC_EXCEPTION_OVERRIDE', 2, 'DISTDIR', 'HODEPT', false, 24, true)
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Reminder Schedules (US-09.2 default day-offsets: 90, 60, 30, 15, 7)
INSERT INTO cims_reminder_schedules (id, days_before_expiry, channels_json, recipient_roles_json, active) VALUES
('rem-90', 90, '["Email"]', '["CRO","BRO","SRM","BRM"]', true),
('rem-60', 60, '["Email","SMS"]', '["CRO","BRO","SRM","BRM"]', true),
('rem-30', 30, '["Email","SMS"]', '["CRO","BRO","SRM","BRM","BRMGR"]', true),
('rem-15', 15, '["Email","SMS"]', '["CRO","BRO","SRM","BRM","BRMGR"]', true),
('rem-7', 7, '["Email","SMS"]', '["CRO","BRO","SRM","BRM","BRMGR","DISTDIR"]', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Seed System Parameters
INSERT INTO cims_system_parameters (param_key, param_value, description) VALUES
('session_timeout_minutes', '15', 'User session inactivity timeout in minutes'),
('password_min_length', '8', 'Minimum password length'),
('password_require_special', 'true', 'Require special character in password'),
('max_login_failed_attempts', '5', 'Max failed attempts before account lockout'),
('cbs_sync_mode', 'Manual', 'CBS synchronization mode: Manual or Scheduled'),
('cbs_sync_interval_minutes', '60', 'Scheduled CBS sync interval in minutes'),
('dms_integration_mode', 'Local_Object_Store', 'Document storage backend abstraction (Local/Alfresco)'),
('min_coverage_adequacy_pct', '100', 'Mandatory collateral insurance coverage threshold percentage')
ON CONFLICT (param_key) DO UPDATE SET param_value = EXCLUDED.param_value;

-- 7. Seed Initial Mock Data into CBS Simulator
INSERT INTO cbs_sim.customers (id, cif, customer_type, full_name, national_id, business_reg_no, tax_id_no, dob_or_incorp, phone, email, address, business_segment, branch, customer_status, risk_rating, sync_status) VALUES
('cbs-cust-1', 'CIF-000101', 'Business', 'Horizon Agro Industries Ltd', NULL, 'REG-ET-2018-8891', 'TIN-00998877', '2018-05-12', '+251911223344', 'finance@horizonagro.com', 'Bole Subcity, Woreda 03, House 450, Addis Ababa', 'Corporate Banking', 'Bole Special Branch', 'Active', 'Medium', 'Synced'),
('cbs-cust-2', 'CIF-000102', 'Business', 'Abera Ketema Real Estate Dev Plc', NULL, 'REG-ET-2015-4421', 'TIN-00445566', '2015-09-20', '+251911445566', 'abera.k@gmail.com', 'Kirkos Subcity, Kazanchis, Addis Ababa', 'Corporate Banking', 'Bole Special Branch', 'Active', 'High', 'Synced'),
('cbs-cust-3', 'CIF-000103', 'Individual', 'Dr. Yohannes Tadesse Bekele', 'ID-ET-99441122', NULL, 'TIN-00112233', '1982-11-04', '+251911778899', 'dr.yohannes@gmail.com', 'Yeka Subcity, Woreda 07, Addis Ababa', 'Retail Banking', 'Merkato Branch', 'Active', 'Low', 'Synced'),
('cbs-cust-4', 'CIF-000104', 'Business', 'Ethio-Tannery Processing Enterprise', NULL, 'REG-ET-2019-1122', 'TIN-00334455', '2019-02-14', '+251911556677', 'info@ethiotannery.com', 'Akaki Kality Industrial Zone, Addis Ababa', 'MSME Banking', 'Merkato Branch', 'Active', 'Medium', 'Not Synced')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cbs_sim.facilities (id, line_code, customer_cif, loan_ref_no, facility_type, line_currency, revolving_line, line_start_date, line_expiry_date, approved_limit, available_amount, outstanding_amount, collateral_contribution, collateral_pct, business_segment, branch, relationship_manager, limit_status, next_review_date, sync_status) VALUES
('cbs-fac-1', 'FAC-CORP-001', 'CIF-000101', 'LN-CORP-2026-001', 'Term Loan', 'ETB', false, '2025-01-15', '2028-01-15', 15000000.00, 4500000.00, 10500000.00, 15000000.00, 100.00, 'Corporate Banking', 'Bole Special Branch', 'Tewodros Kassahun', 'Active', '2026-12-15', 'Synced'),
('cbs-fac-2', 'FAC-CORP-002', 'CIF-000102', 'LN-CORP-2026-002', 'Revolving Credit', 'ETB', true, '2025-06-01', '2027-06-01', 30000000.00, 12000000.00, 18000000.00, 30000000.00, 100.00, 'Corporate Banking', 'Bole Special Branch', 'Kidist Selasse', 'Active', '2026-11-01', 'Synced'),
('cbs-fac-3', 'FAC-RET-001', 'CIF-000103', 'LN-RET-2026-003', 'Mortgage', 'ETB', false, '2024-03-10', '2039-03-10', 8000000.00, 1200000.00, 6800000.00, 8000000.00, 100.00, 'Retail Banking', 'Merkato Branch', 'Meron Getachew', 'Active', '2027-03-10', 'Synced')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cbs_sim.collaterals (id, collateral_code, customer_cif, description, category, currency, collateral_value, haircut, limit_contribution, start_date, review_date, collateral_type, tangible, linked_loan_refs, linked_account_no, linkage_type, business_segment, branch, zip_code, sync_status) VALUES
('cbs-col-1', 'COL-2026-000101', 'CIF-000101', 'Commercial G+4 Agro Processing Facility & Warehouse', 'Immovable Properties', 'ETB', 25000000.00, 20.00, 20000000.00, '2025-01-10', '2027-01-10', 'Borrower-owned', true, 'LN-CORP-2026-001', 'ACC-10023412', 'Primary', 'Corporate Banking', 'Bole Special Branch', '1000', 'Synced'),
('cbs-col-2', 'COL-2026-000102', 'CIF-000102', 'Mixed-use Commercial Plaza on Bole Road', 'Immovable Properties', 'ETB', 45000000.00, 25.00, 33750000.00, '2025-05-20', '2027-05-20', 'Borrower-owned', true, 'LN-CORP-2026-002', 'ACC-10045678', 'Primary', 'Corporate Banking', 'Bole Special Branch', '1000', 'Synced'),
('cbs-col-3', 'COL-2026-000103', 'CIF-000103', 'Residential Villa in CMC Compound', 'Immovable Properties', 'ETB', 12000000.00, 20.00, 9600000.00, '2024-03-01', '2027-03-01', 'Borrower-owned', true, 'LN-RET-2026-003', 'ACC-10099881', 'Primary', 'Retail Banking', 'Merkato Branch', '1000', 'Synced')
ON CONFLICT (id) DO NOTHING;
