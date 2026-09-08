-- V3__cims_full_database_rebuild.sql
-- Full CIMS Specification Database Migration

-- 1. Create CBS Simulator Schema & Tables (Simulated Core Banking System)
CREATE SCHEMA IF NOT EXISTS cbs_sim;

CREATE TABLE IF NOT EXISTS cbs_sim.customers (
    id VARCHAR(64) PRIMARY KEY,
    cif VARCHAR(50) NOT NULL UNIQUE,
    customer_type VARCHAR(50) NOT NULL DEFAULT 'Individual',
    full_name VARCHAR(255) NOT NULL,
    national_id VARCHAR(100),
    business_reg_no VARCHAR(100),
    tax_id_no VARCHAR(100),
    dob_or_incorp DATE,
    gender VARCHAR(20),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    business_segment VARCHAR(100) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    customer_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    risk_rating VARCHAR(50) DEFAULT 'Medium',
    synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'Not Synced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cbs_sim.facilities (
    id VARCHAR(64) PRIMARY KEY,
    line_code VARCHAR(100) NOT NULL UNIQUE,
    customer_cif VARCHAR(50) NOT NULL REFERENCES cbs_sim.customers(cif) ON DELETE CASCADE,
    loan_ref_no VARCHAR(100) NOT NULL UNIQUE,
    facility_type VARCHAR(100) NOT NULL,
    line_currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
    revolving_line BOOLEAN DEFAULT FALSE,
    line_start_date DATE NOT NULL,
    line_expiry_date DATE NOT NULL,
    approved_limit NUMERIC(18,2) NOT NULL,
    available_amount NUMERIC(18,2) NOT NULL,
    outstanding_amount NUMERIC(18,2) NOT NULL,
    collateral_contribution NUMERIC(18,2) DEFAULT 0,
    collateral_pct NUMERIC(5,2) DEFAULT 0,
    business_segment VARCHAR(100) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    relationship_manager VARCHAR(100),
    limit_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    next_review_date DATE,
    synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'Not Synced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cbs_sim.collaterals (
    id VARCHAR(64) PRIMARY KEY,
    collateral_code VARCHAR(100) NOT NULL UNIQUE,
    customer_cif VARCHAR(50) NOT NULL REFERENCES cbs_sim.customers(cif) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
    collateral_value NUMERIC(18,2) NOT NULL,
    haircut NUMERIC(5,2) DEFAULT 0,
    limit_contribution NUMERIC(18,2),
    start_date DATE NOT NULL,
    review_date DATE,
    collateral_type VARCHAR(50) NOT NULL DEFAULT 'Borrower-owned',
    tangible BOOLEAN DEFAULT TRUE,
    linked_loan_refs TEXT,
    linked_account_no VARCHAR(100),
    linkage_type VARCHAR(50) NOT NULL DEFAULT 'Primary',
    business_segment VARCHAR(100) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    zip_code VARCHAR(50),
    synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'Not Synced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cbs_sim.sync_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    direction VARCHAR(50) NOT NULL DEFAULT 'CBS->CIMS',
    result VARCHAR(50) NOT NULL,
    error_message TEXT,
    payload_json TEXT
);

-- 2. Enhance CIMS Core Tables with Maker-Checker Dual Control Columns & Missing Fields

-- Role Permissions Table
CREATE TABLE IF NOT EXISTS cims_role_permissions (
    id VARCHAR(64) PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL,
    screen_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE
);

-- Branch Hierarchy
CREATE TABLE IF NOT EXISTS cims_branches (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Branch',
    parent_district_id VARCHAR(64),
    segment_ids TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhance cims_users table
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS district_id VARCHAR(64);
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE cims_users ADD COLUMN IF NOT EXISTS segment_ids TEXT;

-- Enhance cims_customers table
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS cif VARCHAR(50);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'Individual';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS national_id VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS business_reg_no VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS tax_id_no VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS dob_or_incorp DATE;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS risk_rating VARCHAR(50) DEFAULT 'Medium';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CBS_SIM';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS cbs_sync_status VARCHAR(50) DEFAULT 'Synced';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS cbs_synced_at TIMESTAMP;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS once_auth VARCHAR(10) DEFAULT 'Y';
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Enhance cims_loan_accounts / facilities table
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS line_code VARCHAR(100);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS line_currency VARCHAR(10) DEFAULT 'ETB';
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS revolving_line BOOLEAN DEFAULT FALSE;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS line_start_date DATE;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS line_expiry_date DATE;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS available_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS collateral_contribution NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS collateral_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS segment VARCHAR(100);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS rm_user_id VARCHAR(64);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS next_review_due_date DATE;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CBS_SIM';
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;
ALTER TABLE cims_loan_accounts ADD COLUMN IF NOT EXISTS once_auth VARCHAR(10) DEFAULT 'Y';

-- Enhance cims_collaterals table
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'ETB';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS haircut NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS limit_contribution NUMERIC(18,2);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS review_date DATE;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS tangible BOOLEAN DEFAULT TRUE;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS zip_code VARCHAR(50);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS insured_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS net_insurance_coverage_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS insurance_status VARCHAR(50) DEFAULT 'Uninsured';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CBS_SIM';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS once_auth VARCHAR(10) DEFAULT 'Y';
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Enhance cims_loan_collateral_links
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linkage_type VARCHAR(50) DEFAULT 'Primary';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS utilization_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;

-- Enhance cims_collateral_owners
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(50) DEFAULT 'Borrower-owned';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50) DEFAULT 'Individual';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS id_number VARCHAR(100);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS contact_info VARCHAR(255);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS relationship_to_borrower VARCHAR(100);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'Verified';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS verification_date DATE;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS verifying_officer VARCHAR(100);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS gps_x NUMERIC(10,6);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS gps_y NUMERIC(10,6);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS superseded_date DATE;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;

-- Enhance cims_ownership_documents
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'Collateral';
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS entity_id VARCHAR(64);
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 102400;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'application/pdf';
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(64);
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS dms_ref VARCHAR(100);
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(100) DEFAULT '10 Years Post-Settlement';

-- Document Download Logs
CREATE TABLE IF NOT EXISTS cims_document_download_logs (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES cims_ownership_documents(id) ON DELETE CASCADE,
    downloaded_by VARCHAR(64) NOT NULL,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
);

-- Enhance cims_insurance_policies
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS insurer_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS replaces_policy_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS renewed_from_policy_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS closure_reason TEXT;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS maker_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS checker_id VARCHAR(64);
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS checker_dt_stamp TIMESTAMP;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS record_stat VARCHAR(10) DEFAULT 'O';
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS auth_stat VARCHAR(10) DEFAULT 'A';
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS mod_no INT DEFAULT 1;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS once_auth VARCHAR(10) DEFAULT 'Y';
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cims_insurance_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Policy Endorsements
CREATE TABLE IF NOT EXISTS cims_policy_endorsements (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL REFERENCES cims_insurance_policies(id) ON DELETE CASCADE,
    endorsement_no VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    effective_date DATE NOT NULL,
    document_id VARCHAR(64),
    maker_id VARCHAR(64),
    maker_dt_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checker_id VARCHAR(64),
    checker_dt_stamp TIMESTAMP,
    record_stat VARCHAR(10) DEFAULT 'O',
    auth_stat VARCHAR(10) DEFAULT 'A',
    mod_no INT DEFAULT 1
);

-- 3. Workflow & Maker-Checker Dual Control Tables
CREATE TABLE IF NOT EXISTS cims_workflow_tasks (
    id VARCHAR(64) PRIMARY KEY,
    process_instance_id VARCHAR(100),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    payload_diff_json TEXT,
    remarks TEXT,
    maker_id VARCHAR(64) NOT NULL,
    current_step VARCHAR(100) NOT NULL DEFAULT 'Checker Review',
    candidate_role VARCHAR(100) NOT NULL,
    candidate_user_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    priority VARCHAR(20) DEFAULT 'Medium',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    sla_due_at TIMESTAMP,
    is_escalated BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cims_approval_history (
    id VARCHAR(64) PRIMARY KEY,
    workflow_task_id VARCHAR(64) NOT NULL REFERENCES cims_workflow_tasks(id) ON DELETE CASCADE,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(100) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    comments TEXT,
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cims_delegations (
    id VARCHAR(64) PRIMARY KEY,
    delegator_id VARCHAR(64) NOT NULL,
    delegate_id VARCHAR(64) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Exceptions Management Tables
CREATE TABLE IF NOT EXISTS cims_exceptions (
    id VARCHAR(64) PRIMARY KEY,
    exception_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
    description TEXT NOT NULL,
    assigned_to_role VARCHAR(100),
    assigned_to_user_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    sla_due_date DATE,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(64),
    resolution_notes TEXT,
    corrective_action VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS cims_exception_investigation_notes (
    id VARCHAR(64) PRIMARY KEY,
    exception_id VARCHAR(64) NOT NULL REFERENCES cims_exceptions(id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(255),
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Notifications Tables
CREATE TABLE IF NOT EXISTS cims_notifications (
    id VARCHAR(64) PRIMARY KEY,
    channel VARCHAR(20) NOT NULL DEFAULT 'Email',
    template_code VARCHAR(100),
    recipient VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(255),
    message_body TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'Sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    retry_count INT DEFAULT 0
);

-- 6. Administration & Governance Config Tables
CREATE TABLE IF NOT EXISTS cims_approval_hierarchy_configs (
    id VARCHAR(64) PRIMARY KEY,
    transaction_type VARCHAR(100) NOT NULL UNIQUE,
    approval_levels INT DEFAULT 1,
    level1_role VARCHAR(100) NOT NULL,
    level2_role VARCHAR(100),
    bulk_approve_allowed BOOLEAN DEFAULT FALSE,
    sla_hours INT DEFAULT 24,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cims_reminder_schedules (
    id VARCHAR(64) PRIMARY KEY,
    days_before_expiry INT NOT NULL UNIQUE,
    channels_json VARCHAR(100) DEFAULT '["SMS","Email"]',
    recipient_roles_json VARCHAR(255) DEFAULT '["CRO","BRO","BRM","SRM"]',
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cims_scheduled_reports (
    id VARCHAR(64) PRIMARY KEY,
    report_type VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL DEFAULT 'Weekly',
    recipients TEXT NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'PDF',
    parameters_json TEXT,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhance audit logs with extra context
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS role_code VARCHAR(100);
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS field_name VARCHAR(100);
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE cims_audit_logs ADD COLUMN IF NOT EXISTS comments TEXT;
