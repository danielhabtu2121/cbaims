-- V14: CIMS operational query indexes. Safe/idempotent for existing environments.
CREATE INDEX IF NOT EXISTS idx_cims_customers_cif ON cims_customers (LOWER(cif));
CREATE INDEX IF NOT EXISTS idx_cims_customers_segment_branch ON cims_customers (segment, branch);
CREATE INDEX IF NOT EXISTS idx_cims_facilities_customer ON cims_loan_accounts (customer_id);
CREATE INDEX IF NOT EXISTS idx_cims_facilities_line_code ON cims_loan_accounts (LOWER(line_code));
CREATE INDEX IF NOT EXISTS idx_cims_facilities_loan_ref ON cims_loan_accounts (LOWER(loan_reference));
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_code ON cims_collaterals (LOWER(code));
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_customer ON cims_collaterals (customer_id);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_segment_branch ON cims_collaterals (owning_segment, branch);
-- Replaced by V15__workflow_taxonomy_and_index_fixes.sql using loan_account_id.
-- CREATE INDEX IF NOT EXISTS idx_cims_links_loan ON cims_loan_collateral_links (loan_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_collateral ON cims_loan_collateral_links (collateral_id);
CREATE INDEX IF NOT EXISTS idx_cims_policies_collateral ON cims_insurance_policies (collateral_id);
CREATE INDEX IF NOT EXISTS idx_cims_policies_customer ON cims_insurance_policies (customer_id);
CREATE INDEX IF NOT EXISTS idx_cims_policies_status_expiry ON cims_insurance_policies (status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_cims_policies_number ON cims_insurance_policies (LOWER(policy_number));
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_status ON cims_exceptions (status, severity);
CREATE INDEX IF NOT EXISTS idx_cims_documents_collateral ON cims_ownership_documents (collateral_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_notifications_recipient_status ON cims_notifications (recipient, status);
