-- V24__enhance_cbs_sync_and_metadata.sql
-- Module 1: CBS Integration & Master Data Foundation Schema Enhancements

-- 1. Enhance cbs_sim.sync_logs with operational tracking and batch statistics
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS source_system VARCHAR(50) DEFAULT 'CBS_SIM';
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS start_time VARCHAR(50);
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS completion_time VARCHAR(50);
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS records_processed INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS records_succeeded INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS records_failed INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS customer_count INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS facility_count INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS collateral_count INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS relationship_count INT DEFAULT 0;
ALTER TABLE cbs_sim.sync_logs ADD COLUMN IF NOT EXISTS sync_batch_id VARCHAR(64);

-- 2. Enhance cims_loan_collateral_links with source traceability metadata
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CBS_SIM';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS source_record_id VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS cbs_sync_status VARCHAR(50) DEFAULT 'Synced';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS cbs_synced_at VARCHAR(50);

-- 3. Enhance performance indexes for CBS Lookups and Master Data reconciliation
CREATE INDEX IF NOT EXISTS idx_cbs_sim_sync_logs_ts ON cbs_sim.sync_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_cbs_sim_sync_logs_result ON cbs_sim.sync_logs (result);
CREATE INDEX IF NOT EXISTS idx_cbs_sim_sync_logs_entity ON cbs_sim.sync_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_src_rec ON cims_loan_collateral_links (source_record_id);
CREATE INDEX IF NOT EXISTS idx_cims_customers_cif_lower ON cims_customers (LOWER(cif));
CREATE INDEX IF NOT EXISTS idx_cims_loans_ref_lower ON cims_loan_accounts (LOWER(loan_reference));
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_code_lower ON cims_collaterals (LOWER(code));
