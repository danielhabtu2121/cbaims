-- V27__enterprise_scalability_indexes_and_views.sql
-- High-performance database indexing and query acceleration for large corporation data volumes

-- 1. Accelerate Customer Multi-Attribute Search & Aggregation
CREATE INDEX IF NOT EXISTS idx_cims_cust_name_lower ON cims_customers (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_cims_cust_tax_id_lower ON cims_customers (LOWER(tax_id_no));
CREATE INDEX IF NOT EXISTS idx_cims_cust_status ON cims_customers (status);
CREATE INDEX IF NOT EXISTS idx_cims_cust_branch ON cims_customers (branch);
CREATE INDEX IF NOT EXISTS idx_cims_cust_segment ON cims_customers (segment);

-- 2. Accelerate Loan Accounts / Facilities Balance & Search Queries
CREATE INDEX IF NOT EXISTS idx_cims_loan_acc_no_lower ON cims_loan_accounts (LOWER(account_number));
CREATE INDEX IF NOT EXISTS idx_cims_loan_cust_status ON cims_loan_accounts (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_loan_out_bal ON cims_loan_accounts (outstanding_balance DESC);
CREATE INDEX IF NOT EXISTS idx_cims_loan_seg_brn ON cims_loan_accounts (segment, branch);
CREATE INDEX IF NOT EXISTS idx_cims_loan_type ON cims_loan_accounts (facility_type);

-- 3. Accelerate Collaterals High-Value Queries & Search
CREATE INDEX IF NOT EXISTS idx_cims_col_val_amt ON cims_collaterals (valuation_amount DESC);
CREATE INDEX IF NOT EXISTS idx_cims_col_cat_status ON cims_collaterals (category, status);
CREATE INDEX IF NOT EXISTS idx_cims_col_type ON cims_collaterals (type);

-- 4. Accelerate Cross-Collateralization Link Lookups
CREATE INDEX IF NOT EXISTS idx_cims_links_fac_col ON cims_loan_collateral_links (facility_id, collateral_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_col_stat ON cims_loan_collateral_links (collateral_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_links_cust ON cims_loan_collateral_links (customer_id);

-- 5. Accelerate Lightweight Document Auditing without Payload Fetches
CREATE INDEX IF NOT EXISTS idx_cims_docs_col_entity ON cims_ownership_documents (collateral_id, entity_id, is_latest);
CREATE INDEX IF NOT EXISTS idx_cims_docs_verification ON cims_ownership_documents (verification_status, status);
