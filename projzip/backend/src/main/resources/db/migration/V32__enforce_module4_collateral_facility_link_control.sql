-- ==============================================================================
-- Migration V32: Module 4 — Collateral-Facility Relationship, Allocation & Shared Collateral Control
-- Database: cims_db_dev
-- ==============================================================================

-- 1. Ensure unique constraint for active collateral-facility relationships (Section 14 & 15)
-- First, safely reconcile any accidental duplicate active links if present (retaining the record with highest allocation or latest update)
WITH ranked_duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY collateral_id, loan_account_id 
               ORDER BY allocated_amount DESC, COALESCE(maker_dt_stamp, '') DESC, id DESC
           ) as rn
    FROM cims_loan_collateral_links
    WHERE status = 'Active'
)
UPDATE cims_loan_collateral_links
SET status = 'Historical',
    relationship_status = 'Historical',
    change_reason = 'Reconciled duplicate active link during Module 4 migration'
WHERE id IN (
    SELECT id FROM ranked_duplicates WHERE rn > 1
);

-- Ensure the partial unique index on active relationships
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_loan_col_link 
ON cims_loan_collateral_links (collateral_id, loan_account_id) 
WHERE status = 'Active';

-- 2. Fast lookup indexes for duplicate collateral prevention (Section 23 & 24)
CREATE INDEX IF NOT EXISTS idx_collaterals_title_deed_lower 
ON cims_collaterals (LOWER(TRIM(title_deed_number))) 
WHERE title_deed_number IS NOT NULL AND title_deed_number <> '';

CREATE INDEX IF NOT EXISTS idx_collaterals_reg_no_lower 
ON cims_collaterals (LOWER(TRIM(registration_number))) 
WHERE registration_number IS NOT NULL AND registration_number <> '';

CREATE INDEX IF NOT EXISTS idx_collaterals_code_lower 
ON cims_collaterals (LOWER(TRIM(code)));

-- 3. Additional query support for multi-facility and cross-collateral lookups
CREATE INDEX IF NOT EXISTS idx_links_col_loan_active 
ON cims_loan_collateral_links (collateral_id, loan_account_id, status);
