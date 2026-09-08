-- V18__cims_authoritative_redevelopment_and_linkages.sql
-- CIMS Authoritative Full System Redevelopment Schema Extensions & Integrity Indexes

-- 1. Ensure cims_sync_logs table has full tracking fields
CREATE TABLE IF NOT EXISTS cims_sync_logs (
    id VARCHAR(64) PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'Success',
    records_processed INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    payload_snapshot TEXT,
    triggered_by VARCHAR(64) DEFAULT 'SYSTEM',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 2. Extend Insurance Policies with lifecycle chaining columns
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS renewed_from_policy_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS replaces_policy_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS closure_reason TEXT;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS reopening_reason TEXT;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS endorsement_count INT DEFAULT 0;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 3. Composite Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_cims_sync_logs_type_status ON cims_sync_logs (sync_type, status);
CREATE INDEX IF NOT EXISTS idx_cims_policies_renewed_from ON cims_insurance_policies (renewed_from_policy_id);
CREATE INDEX IF NOT EXISTS idx_cims_policies_replaces ON cims_insurance_policies (replaces_policy_id);
CREATE INDEX IF NOT EXISTS idx_cims_policies_collateral_status ON cims_insurance_policies (collateral_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_collaterals_cust_status ON cims_collaterals (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_loans_cust_status ON cims_loan_accounts (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_entity ON cims_exceptions (entity_type, entity_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_wf_tasks_entity ON cims_workflow_tasks (entity_type, entity_id, status);
