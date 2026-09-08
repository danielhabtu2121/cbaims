-- V15: workflow/taxonomy corrections.
-- V14 is intentionally left immutable after it was applied/repaired in existing environments.

-- The loan/collateral link table uses loan_account_id, not loan_id.
CREATE INDEX IF NOT EXISTS idx_cims_links_loan_account
    ON cims_loan_collateral_links (loan_account_id);

-- Ensure collateral registration is represented by an explicit configurable
-- approval hierarchy instead of relying on the service fallback role.
INSERT INTO cims_approval_hierarchy_configs
    (id, transaction_type, approval_levels, level1_role, level2_role, bulk_approve_allowed, sla_hours, active)
VALUES
    ('ah-collateral-registration', 'PROC_COLLATERAL_REGISTRATION', 1, 'BRMGR', NULL, true, 24, true)
ON CONFLICT (id) DO UPDATE SET
    transaction_type = EXCLUDED.transaction_type,
    approval_levels = EXCLUDED.approval_levels,
    level1_role = EXCLUDED.level1_role,
    level2_role = EXCLUDED.level2_role,
    bulk_approve_allowed = EXCLUDED.bulk_approve_allowed,
    sla_hours = EXCLUDED.sla_hours,
    active = EXCLUDED.active;
