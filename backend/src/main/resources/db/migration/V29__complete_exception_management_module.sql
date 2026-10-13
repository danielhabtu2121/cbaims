-- Flyway Migration V29: Complete Exception Management Module Schema Extensions

-- 1. Extend cims_exceptions with contextual business entity linkages, ownership, and SLA/escalation fields
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS customer_cif VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS loan_reference VARCHAR(100);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS collateral_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS policy_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS business_segment VARCHAR(100);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS relationship_manager_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS relationship_officer_id VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS detection_source VARCHAR(50) DEFAULT 'AUTOMATED_SCAN';
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS assigned_at VARCHAR(50);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(64);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS escalation_level INT DEFAULT 0;
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS last_escalation_date VARCHAR(50);
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS next_escalation_due VARCHAR(50);

-- 2. Ensure investigation notes table has varchar timestamp for CIMS standard consistency
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_exception_investigation_notes' AND column_name = 'created_at') THEN
        ALTER TABLE cims_exception_investigation_notes ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;
    END IF;
END $$;

-- 3. Create Escalation History Table (US-12.4)
CREATE TABLE IF NOT EXISTS cims_exception_escalation_history (
    id VARCHAR(64) PRIMARY KEY,
    exception_id VARCHAR(64) NOT NULL REFERENCES cims_exceptions(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    previous_role VARCHAR(100),
    previous_user_id VARCHAR(64),
    new_role VARCHAR(100),
    new_user_id VARCHAR(64),
    escalation_level INT DEFAULT 1,
    escalated_by VARCHAR(64) NOT NULL,
    escalated_at VARCHAR(50) NOT NULL,
    reason TEXT,
    notification_reference VARCHAR(100)
);

-- 4. Create Assignment History Table (US-12.2)
CREATE TABLE IF NOT EXISTS cims_exception_assignment_history (
    id VARCHAR(64) PRIMARY KEY,
    exception_id VARCHAR(64) NOT NULL REFERENCES cims_exceptions(id) ON DELETE CASCADE,
    previous_role VARCHAR(100),
    previous_user_id VARCHAR(64),
    new_role VARCHAR(100),
    new_user_id VARCHAR(64),
    assigned_by VARCHAR(64) NOT NULL,
    assigned_at VARCHAR(50) NOT NULL,
    remarks TEXT
);

-- 5. Performance Indexes for Exception Queries & Work Queue
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_status ON cims_exceptions (status);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_type ON cims_exceptions (exception_type);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_segment ON cims_exceptions (business_segment);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_branch ON cims_exceptions (branch);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_assigned_user ON cims_exceptions (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_cims_exceptions_assigned_role ON cims_exceptions (assigned_to_role);
CREATE INDEX IF NOT EXISTS idx_cims_exc_notes_exc_id ON cims_exception_investigation_notes (exception_id);
CREATE INDEX IF NOT EXISTS idx_cims_exc_esc_hist_exc_id ON cims_exception_escalation_history (exception_id);
CREATE INDEX IF NOT EXISTS idx_cims_exc_asgn_hist_exc_id ON cims_exception_assignment_history (exception_id);
