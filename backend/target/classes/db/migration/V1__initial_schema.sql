-- V1__initial_schema.sql: Baseline Schema DDL for CIMS Production Rebuild

CREATE TABLE cims_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    segment VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE cims_customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    segment VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50)
);

CREATE TABLE cims_loan_accounts (
    id VARCHAR(64) PRIMARY KEY,
    loan_reference VARCHAR(100) NOT NULL UNIQUE,
    customer_id VARCHAR(64) NOT NULL REFERENCES cims_customers(id),
    facility_type VARCHAR(100) NOT NULL,
    approved_limit NUMERIC(18,2) NOT NULL,
    outstanding_balance NUMERIC(18,2) NOT NULL,
    status VARCHAR(50) NOT NULL
);

CREATE TABLE cims_collaterals (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    valuation_amount NUMERIC(18,2) NOT NULL,
    current_allocation NUMERIC(18,2) DEFAULT 0,
    utilization_percentage NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    owner_type VARCHAR(50) NOT NULL,
    owning_segment VARCHAR(100) NOT NULL,
    registration_number VARCHAR(100),
    title_deed_number VARCHAR(100),
    tin_number VARCHAR(100),
    gps_coordinates VARCHAR(100),
    branch VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'Pending',
    created_by VARCHAR(64)
);

CREATE TABLE cims_collateral_owners (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    tin VARCHAR(100)
);

CREATE TABLE cims_ownership_documents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) NOT NULL,
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id) ON DELETE CASCADE,
    upload_date VARCHAR(50) NOT NULL,
    version INT DEFAULT 1,
    file_url TEXT
);

CREATE TABLE cims_loan_collateral_links (
    id VARCHAR(64) PRIMARY KEY,
    loan_account_id VARCHAR(64) NOT NULL REFERENCES cims_loan_accounts(id),
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id),
    allocated_amount NUMERIC(18,2) NOT NULL
);

CREATE TABLE cims_insurance_policies (
    id VARCHAR(64) PRIMARY KEY,
    policy_number VARCHAR(100) NOT NULL UNIQUE,
    insurer_name VARCHAR(255) NOT NULL,
    effective_date VARCHAR(50) NOT NULL,
    expiry_date VARCHAR(50) NOT NULL,
    insured_amount NUMERIC(18,2) NOT NULL,
    premium NUMERIC(18,2) NOT NULL,
    coverage_type VARCHAR(100) NOT NULL,
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id),
    status VARCHAR(50) NOT NULL,
    version INT DEFAULT 1,
    history_json TEXT
);

CREATE TABLE cims_exception_requests (
    id VARCHAR(64) PRIMARY KEY,
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id),
    policy_id VARCHAR(64),
    requested_by VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    evidence_document VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    resolved_by VARCHAR(64),
    resolved_at VARCHAR(50),
    comments TEXT
);

CREATE TABLE cims_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp VARCHAR(100) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    old_value_state TEXT,
    new_value_state TEXT
);

CREATE TABLE cims_business_segments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    risk_profile VARCHAR(50),
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE cims_ownership_transfers (
    id VARCHAR(64) PRIMARY KEY,
    collateral_id VARCHAR(64) NOT NULL REFERENCES cims_collaterals(id),
    source_segment VARCHAR(100) NOT NULL,
    destination_segment VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    initiated_by VARCHAR(64) NOT NULL,
    initiated_at VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    approved_by VARCHAR(64),
    approved_at VARCHAR(50),
    remarks TEXT
);

CREATE TABLE cims_approved_insurers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE cims_collateral_taxonomies (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    insurance_mandatory BOOLEAN DEFAULT TRUE,
    mandatory_coverage_type VARCHAR(100)
);

CREATE TABLE cims_mandatory_document_rules (
    id VARCHAR(64) PRIMARY KEY,
    collateral_category VARCHAR(100) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    mandatory BOOLEAN DEFAULT TRUE
);

CREATE TABLE cims_escalation_rules (
    id VARCHAR(64) PRIMARY KEY,
    days_before_expiry INT NOT NULL,
    escalation_role VARCHAR(100) NOT NULL,
    recipient_type VARCHAR(100) NOT NULL
);

CREATE TABLE cims_district_hierarchies (
    id VARCHAR(64) PRIMARY KEY,
    district_name VARCHAR(100) NOT NULL,
    area_office VARCHAR(100) NOT NULL,
    branch_name VARCHAR(100) NOT NULL
);

CREATE TABLE cims_holiday_calendars (
    id VARCHAR(64) PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE cims_system_parameters (
    param_key VARCHAR(100) PRIMARY KEY,
    param_value TEXT NOT NULL,
    description TEXT
);

CREATE TABLE cims_notification_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    trigger_days_before INT NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);
