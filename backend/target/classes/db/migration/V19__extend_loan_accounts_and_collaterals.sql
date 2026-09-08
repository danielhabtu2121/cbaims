-- V19__extend_loan_accounts_and_collaterals.sql
-- Extend Loan Accounts and Collaterals with CBS sync metadata

ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(64);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS cbs_sync_status VARCHAR(50) DEFAULT 'Synced';
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS cbs_synced_at VARCHAR(50);

ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS cbs_sync_status VARCHAR(50) DEFAULT 'Synced';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS cbs_synced_at VARCHAR(50);
