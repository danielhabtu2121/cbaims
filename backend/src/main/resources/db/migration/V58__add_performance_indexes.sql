-- ============================================================================
-- Performance indexes for high-scale CBS datasets (100k+ customers/facilities,
-- 70k+ collaterals, 300k+ loan-collateral links).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cims_customers_cif ON cims_customers (cif);
CREATE INDEX IF NOT EXISTS idx_cims_customers_segment ON cims_customers (segment);
CREATE INDEX IF NOT EXISTS idx_cims_customers_branch ON cims_customers (branch);

CREATE INDEX IF NOT EXISTS idx_cims_loans_customer_id ON cims_loan_accounts (customer_id);
CREATE INDEX IF NOT EXISTS idx_cims_loans_segment ON cims_loan_accounts (segment);
CREATE INDEX IF NOT EXISTS idx_cims_loans_branch ON cims_loan_accounts (branch);
CREATE INDEX IF NOT EXISTS idx_cims_loans_reference ON cims_loan_accounts (loan_reference);

CREATE INDEX IF NOT EXISTS idx_cims_collaterals_customer_id ON cims_collaterals (customer_id);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_segment ON cims_collaterals (owning_segment);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_branch ON cims_collaterals (branch);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_origin ON cims_collaterals (origin_type);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_code ON cims_collaterals (code);

CREATE INDEX IF NOT EXISTS idx_cims_links_loan_id ON cims_loan_collateral_links (loan_account_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_col_id ON cims_loan_collateral_links (collateral_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_status ON cims_loan_collateral_links (status);

