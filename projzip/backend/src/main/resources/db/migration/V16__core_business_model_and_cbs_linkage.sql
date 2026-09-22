-- V16__core_business_model_and_cbs_linkage.sql
-- Core Business Model Extension and CBS CLTB_ACC_COLL_LINK_DTLS Simulation

-- 1. Extend cims_loan_collateral_links to fully match banking linkage attributes
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS account_number VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS branch_code VARCHAR(32);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linked_reference_no VARCHAR(64);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linkage_currency VARCHAR(10) DEFAULT 'ETB';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS overall_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS collateral_category VARCHAR(100);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS haircut NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS limit_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linked_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS linked_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS util_order INT DEFAULT 1;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS reinstate_order INT DEFAULT 1;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS util_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS taken_over VARCHAR(10) DEFAULT 'N';
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS effective_date VARCHAR(50);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS end_date VARCHAR(50);
ALTER TABLE cims_loan_collateral_links ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- 2. Create CBS Simulator CLTB_ACC_COLL_LINK_DTLS Table
CREATE SCHEMA IF NOT EXISTS cbs_sim;

CREATE TABLE IF NOT EXISTS cbs_sim.cltb_acc_coll_link_dtls (
    id VARCHAR(64) PRIMARY KEY,
    account_number VARCHAR(64) NOT NULL,
    branch_code VARCHAR(32) NOT NULL DEFAULT 'BRN-001',
    linkage_type VARCHAR(50) NOT NULL DEFAULT 'Primary',
    linked_reference_no VARCHAR(64) NOT NULL,
    description TEXT,
    linkage_branch VARCHAR(32) DEFAULT 'BRN-001',
    linkage_currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
    overall_amount NUMERIC(18,2) DEFAULT 0,
    collateral_category VARCHAR(100),
    haircut NUMERIC(5,2) DEFAULT 0,
    limit_amount NUMERIC(18,2) DEFAULT 0,
    linked_amount NUMERIC(18,2) DEFAULT 0,
    linked_percent_number NUMERIC(5,2) DEFAULT 0,
    util_order INT DEFAULT 1,
    reinstate_order INT DEFAULT 1,
    util_amount NUMERIC(18,2) DEFAULT 0,
    commitment_product VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    taken_over VARCHAR(10) DEFAULT 'N',
    synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'Not Synced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Composite Operational & Lookup Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_cims_links_facility ON cims_loan_collateral_links (facility_id);
CREATE INDEX IF NOT EXISTS idx_cims_links_status ON cims_loan_collateral_links (status);
CREATE INDEX IF NOT EXISTS idx_cims_links_acc_col ON cims_loan_collateral_links (loan_account_id, collateral_id);
CREATE INDEX IF NOT EXISTS idx_cbs_links_acc ON cbs_sim.cltb_acc_coll_link_dtls (account_number);
CREATE INDEX IF NOT EXISTS idx_cbs_links_ref ON cbs_sim.cltb_acc_coll_link_dtls (linked_reference_no);
