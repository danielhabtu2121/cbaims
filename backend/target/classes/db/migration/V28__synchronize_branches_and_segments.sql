-- Flyway Migration V28: Synchronize Branches, Canonical Segments, and Collateral Net Security Values

-- 1. Normalize segment names across customers and loan accounts to canonical names
UPDATE cims_customers SET segment = 'Interest-Free Banking (IFB)' WHERE segment = 'IFB';
UPDATE cims_customers SET segment = 'MSME Banking' WHERE segment = 'MSME';
UPDATE cims_customers SET segment = 'Retail Banking' WHERE segment = 'Retail';

UPDATE cims_loan_accounts SET segment = 'Interest-Free Banking (IFB)' WHERE segment = 'IFB';
UPDATE cims_loan_accounts SET segment = 'MSME Banking' WHERE segment = 'MSME';
UPDATE cims_loan_accounts SET segment = 'Retail Banking' WHERE segment = 'Retail';

-- 2. Ensure NSV (Net Security Value) in collaterals is synchronized with valuation_amount and haircut
UPDATE cims_collaterals 
SET nsv = ROUND(valuation_amount * (1.0 - (COALESCE(haircut, 20.0) / 100.0)), 2)
WHERE nsv IS NULL OR nsv = 0;

-- 3. Register missing operating branches into cims_branches and district hierarchy
INSERT INTO cims_branches (id, code, name, type, parent_district_id, segment_ids, is_active, created_at, area_office) VALUES
  ('brn-arada', 'BRN-006', 'Arada Branch', 'Branch', 'brn-dist-west', '["Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)"]', true, NOW(), 'Merkato Area Office'),
  ('brn-yeka', 'BRN-007', 'Yeka Sub-Branch', 'Branch', 'brn-dist-east', '["Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)"]', true, NOW(), 'Bole Area Office'),
  ('brn-merkato-ifb', 'BRN-008', 'Merkato IFB Dedicated Branch', 'Branch', 'brn-dist-west', '["Interest-Free Banking (IFB)"]', true, NOW(), 'Merkato Area Office')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cims_district_hierarchies (id, district_name, area_office, branch_name) VALUES
  ('dist-5', 'Addis Ababa West District', 'Merkato Area Office', 'Arada Branch'),
  ('dist-6', 'Addis Ababa East District', 'Bole Area Office', 'Yeka Sub-Branch'),
  ('dist-7', 'Addis Ababa West District', 'Merkato Area Office', 'Merkato IFB Dedicated Branch'),
  ('dist-8', 'Addis Ababa East District', 'Bole Area Office', 'Kazanchis Branch')
ON CONFLICT (id) DO NOTHING;

-- 4. Deactivate orphaned test segment
UPDATE cims_business_segments SET active = false WHERE name = 'new segement';
