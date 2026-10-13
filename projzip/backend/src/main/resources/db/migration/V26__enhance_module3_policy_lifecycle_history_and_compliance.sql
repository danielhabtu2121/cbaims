-- =========================================================================
-- V26: Module 3 - Insurance Policy Lifecycle, History & Compliance Schema
-- =========================================================================

-- 1. Create structured policy history table for audit and lifecycle traceability
CREATE TABLE IF NOT EXISTS cims_policy_history (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    version INT DEFAULT 1,
    user_id VARCHAR(64),
    user_role VARCHAR(64),
    timestamp VARCHAR(50) NOT NULL,
    reason TEXT,
    workflow_task_id VARCHAR(64),
    snapshot_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_cims_policy_history_policy_id ON cims_policy_history (policy_id);
CREATE INDEX IF NOT EXISTS idx_cims_policy_history_timestamp ON cims_policy_history (timestamp);

-- 2. Enhance cims_insurance_policies with loan_account_id and amendment_reason
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS loan_account_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS amendment_reason TEXT;

-- 3. Add targeted performance indexes on cims_insurance_policies
CREATE INDEX IF NOT EXISTS idx_cims_policies_collateral_active ON cims_insurance_policies (collateral_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_policies_customer_active ON cims_insurance_policies (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_cims_policies_loan_account ON cims_insurance_policies (loan_account_id);
