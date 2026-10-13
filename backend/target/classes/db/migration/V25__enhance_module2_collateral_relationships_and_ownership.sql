-- ==============================================================================
-- Migration V25: Enhance Module 2 — Collateral, Facility Relationship & Ownership
-- Database: cims_db_dev
-- ==============================================================================

-- 1. Enhance cims_collaterals with missing Module 2 fields
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS charge_type VARCHAR(50) DEFAULT 'Mortgage';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS nsv NUMERIC(18,2);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS secured BOOLEAN DEFAULT TRUE;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS cbs_last_updated VARCHAR(50);

-- Sync initial NSV for existing collaterals where null
UPDATE cims_collaterals 
SET nsv = ROUND(CAST(valuation_amount * (1.0 - (COALESCE(haircut, 0) / 100.0)) AS NUMERIC), 2)
WHERE nsv IS NULL AND valuation_amount IS NOT NULL;

-- 2. Enhance cims_loan_collateral_links with relationship fields
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS relationship_status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS release_status VARCHAR(50) DEFAULT 'Eligible';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linked_percentage NUMERIC(5,2);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS utilization_percentage NUMERIC(5,2);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS effective_date VARCHAR(50);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS end_date VARCHAR(50);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- Populate customer_id on links from loan accounts where missing
UPDATE cims_loan_collateral_links l
SET customer_id = a.customer_id
FROM cims_loan_accounts a
WHERE (l.loan_account_id = a.id OR l.loan_account_id = a.loan_reference)
  AND l.customer_id IS NULL;

-- 3. Duplicate Link Protection: Deduplicate pre-existing active duplicates then create partial unique index
WITH duplicates AS (
    SELECT ctid,
           ROW_NUMBER() OVER (
               PARTITION BY collateral_id, loan_account_id
               ORDER BY id DESC
           ) as rn
    FROM cims_loan_collateral_links
    WHERE status = 'Active'
)
UPDATE cims_loan_collateral_links
SET status = 'Historical', relationship_status = 'Historical'
WHERE ctid IN (
    SELECT ctid FROM duplicates WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_loan_col_link
ON cims_loan_collateral_links (collateral_id, loan_account_id)
WHERE status = 'Active';

-- Performance indexes for link lookups
CREATE INDEX IF NOT EXISTS idx_col_links_col_id ON cims_loan_collateral_links (collateral_id);
CREATE INDEX IF NOT EXISTS idx_col_links_loan_acc_id ON cims_loan_collateral_links (loan_account_id);
CREATE INDEX IF NOT EXISTS idx_col_links_cust_id ON cims_loan_collateral_links (customer_id);
CREATE INDEX IF NOT EXISTS idx_col_links_status ON cims_loan_collateral_links (status);

-- 4. Enhance cims_collateral_owners with historical retention and business identification fields
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS business_reg_no VARCHAR(100);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS effective_from VARCHAR(50);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS effective_to VARCHAR(50);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS transfer_reason TEXT;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS supporting_doc_ref VARCHAR(255);

-- Update historical status for superseded owners
UPDATE cims_collateral_owners
SET status = 'Historical',
    effective_to = superseded_date
WHERE superseded_date IS NOT NULL AND status = 'Active';

CREATE INDEX IF NOT EXISTS idx_col_owners_col_id ON cims_collateral_owners (collateral_id);
CREATE INDEX IF NOT EXISTS idx_col_owners_status ON cims_collateral_owners (status);

-- 5. Seed Authoritative Clarified Bank Collateral Taxonomy
INSERT INTO cims_collateral_taxonomies (id, category, sub_category, insurance_mandatory, mandatory_coverage_type, active)
VALUES
  ('tax-bldg-comm', 'Immovable Properties', 'Buildings - Commercial', true, 'Fire & Lightning', true),
  ('tax-bldg-res', 'Immovable Properties', 'Buildings - Residential', true, 'Fire & Lightning', true),
  ('tax-bldg-mix', 'Immovable Properties', 'Buildings - Mixed-use', true, 'Fire & Lightning', true),
  ('tax-coffee', 'Immovable Properties', 'Coffee Sites', true, 'Fire, Theft & Combustion', true),
  ('tax-land', 'Immovable Properties', 'Land Use Rights', false, 'None', true),
  ('tax-veh', 'Movable Properties', 'Vehicles', true, 'Comprehensive Motor', true),
  ('tax-const-mach', 'Movable Properties', 'Construction Machineries', true, 'Contractor All-Risk / Machinery Breakdown', true),
  ('tax-ind-mach', 'Business Mortgages', 'Industrial/Office Machinery', true, 'Machinery Breakdown & Fire', true),
  ('tax-furn', 'Business Mortgages', 'Furniture', true, 'Fire & Burglary', true),
  ('tax-shares', 'Financial Assets', 'Marketable Shares', false, 'None', true),
  ('tax-bills', 'Financial Assets', 'Negotiable Bills of Payments', false, 'None', true),
  ('tax-cash-blocked', 'Financial Assets', 'Cash and Cash Substitutes - Blocked Accounts', false, 'None', true),
  ('tax-cash-tbills', 'Financial Assets', 'Cash and Cash Substitutes - Treasury Bills', false, 'None', true),
  ('tax-live', 'Agricultural / Other', 'Livestock', true, 'Livestock Mortality', true),
  ('tax-farm', 'Agricultural / Other', 'Farm Products', true, 'Fire & Crop Protection', true),
  ('tax-whr', 'Agricultural / Other', 'Warehouse Receipts', true, 'Warehouse All-Risk', true),
  ('tax-ip', 'Agricultural / Other', 'Intellectual Property Rights', false, 'None', true),
  ('tax-guar-pers', 'Guarantees', 'Personal Guarantee', false, 'None', true)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  sub_category = EXCLUDED.sub_category,
  insurance_mandatory = EXCLUDED.insurance_mandatory,
  mandatory_coverage_type = EXCLUDED.mandatory_coverage_type,
  active = EXCLUDED.active;
