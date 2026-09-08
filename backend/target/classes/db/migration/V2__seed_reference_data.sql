-- V2__seed_reference_data.sql: Seeding reference data for 17 Insurers, 6 Taxonomies, Document Rules, Districts, Parameters

-- 1. Seed 17 Ethiopian Approved Insurers
INSERT INTO cims_approved_insurers (id, name, active) VALUES
('ins-01', 'Ethiopian Insurance Corporation', true),
('ins-02', 'Awash Insurance Company', true),
('ins-03', 'Abay Insurance Company', true),
('ins-04', 'Africa Insurance Company', true),
('ins-05', 'Bunna Insurance Company', true),
('ins-06', 'Ethio Life and General Insurance', true),
('ins-07', 'Global Insurance Company', true),
('ins-08', 'Hibret Insurance Company', true),
('ins-09', 'Lion Insurance Company', true),
('ins-10', 'Berhan Insurance Company', true),
('ins-11', 'Lucy Insurance Company', true),
('ins-12', 'Nile Insurance Company', true),
('ins-13', 'Nib Insurance Company', true),
('ins-14', 'Nyala Insurance Company', true),
('ins-15', 'Oromia Insurance Company', true),
('ins-16', 'The United Insurance Company', true),
('ins-17', 'Tsehay Insurance Company', true),
('ins-18', 'Zemen Insurance Company', true);

-- 2. Seed 6 Official Collateral Taxonomies
INSERT INTO cims_collateral_taxonomies (id, category, sub_category, insurance_mandatory, mandatory_coverage_type) VALUES
('tax-1', 'Immovable Properties', 'Commercial/Residential/Mixed-use Buildings', true, 'Fire & Lightning'),
('tax-2', 'Movable Properties', 'Vehicles & Construction Machinery', true, 'Comprehensive Motor / All-Risk'),
('tax-3', 'Business Mortgages', 'Industrial/Office Machinery & Furniture', true, 'Fire, Lightning & Burglary'),
('tax-4', 'Financial Assets', 'Marketable Shares, Bills, Cash', false, 'None'),
('tax-5', 'Agricultural/Other', 'Livestock, Farm Products, Warehouse Receipts', true, 'Fire, Theft & Combustion'),
('tax-6', 'Guarantees', 'Personal / Corporate Guarantee', false, 'None');

-- 3. Seed Mandatory Document Rules
INSERT INTO cims_mandatory_document_rules (id, collateral_category, document_type, mandatory) VALUES
('doc-r1', 'Immovable Properties', 'Title Deed / Property Ownership Certificate', true),
('doc-r2', 'Immovable Properties', 'Approved Building Plan', true),
('doc-r3', 'Immovable Properties', 'Valuation Report', true),
('doc-r4', 'Movable Properties', 'Vehicle Registration Certificate', true),
('doc-r5', 'Business Mortgages', 'Machinery Ownership Certificate', true),
('doc-r6', 'Guarantees', 'Guarantee Contract / Agreement', true);

-- 4. Seed Notification Templates
INSERT INTO cims_notification_templates (id, name, type, trigger_days_before, subject, body, active) VALUES
('tmpl-1', '30-Day Pre-Expiry Reminder', 'Email', 30, 'Action Required: Insurance Expiry in 30 Days', 'Dear {Customer Name}, your policy {Policy Number} for collateral {Collateral ID} expires on {Expiry Date}. Please renew immediately.', true),
('tmpl-2', '10-Day Pre-Expiry Urgent SMS', 'SMS', 10, NULL, 'URGENT: Policy {Policy Number} expires in 10 days on {Expiry Date}. Contact your RM {RM Name} at {RM Phone}.', true),
('tmpl-3', 'Post-Expiry Escalation Alert', 'Email', 0, 'CRITICAL ALERT: Policy Expired - Underinsurance Risk', 'Policy {Policy Number} has expired on {Expiry Date}. Account {Loan Account Number} is under-insured.', true);

-- 5. Seed System Parameters
INSERT INTO cims_system_parameters (param_key, param_value, description) VALUES
('reminder_intervals_working_days', '30,25,20', 'Pre-expiry reminder working days intervals'),
('max_staff_notifications_per_day', '2', 'Max staff notifications per day'),
('customer_notification_frequency_days', '5', 'Customer notification frequency in days'),
('escalation_level_1_days', '10', 'Level 1 escalation days before expiry'),
('coverage_threshold_percentage', '100', 'Mandatory coverage threshold percentage'),
('min_policy_validity_term_loan_years', '1', 'Minimum policy validity period for term loans');

-- 6. Seed Districts
INSERT INTO cims_district_hierarchies (id, district_name, area_office, branch_name) VALUES
('dist-1', 'Addis Ababa West District', 'Merkato Area Office', 'Merkato Branch'),
('dist-2', 'Addis Ababa East District', 'Bole Area Office', 'Bole Special Branch'),
('dist-3', 'Bahir Dar District', 'Bahir Dar Area Office', 'Lake Tana Branch'),
('dist-4', 'Hawassa District', 'Hawassa Area Office', 'Hawassa Main Branch');

-- 7. Seed Default Business Segments
INSERT INTO cims_business_segments (id, name, description, risk_profile, active) VALUES
('seg-1', 'Corporate Banking', 'Large corporate & commercial lending operations', 'High', true),
('seg-2', 'Retail Banking', 'Individual mortgage, personal auto loans', 'Low', true),
('seg-3', 'MSME Banking', 'Micro, small & medium enterprise development', 'Medium', true),
('seg-4', 'Interest-Free Banking (IFB)', 'Sharia-compliant ethical Islamic banking', 'Medium', true);
