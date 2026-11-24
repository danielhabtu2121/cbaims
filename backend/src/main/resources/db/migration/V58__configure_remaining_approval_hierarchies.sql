-- V58: Complete the Admin Workflow Approval Hierarchy coverage for every workflow
-- transaction type resolved by the backend. Routing is data-driven: changing any of
-- these rows on the Administration screen immediately changes approval routing.
INSERT INTO cims_approval_hierarchy_configs
    (id, transaction_type, approval_levels, level1_role, level2_role,
     bulk_approve_allowed, sla_hours, active, hierarchy_level, exception_type)
VALUES
    ('ah-customer-registration', 'PROC_CUSTOMER_REGISTRATION', 1, 'BRMGR', NULL, true, 24, true, 'Branch', NULL),
    ('ah-customer-maintenance', 'PROC_CUSTOMER_MAINTENANCE', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-collateral-registration', 'PROC_COLLATERAL_REGISTRATION', 1, 'BRMGR', NULL, true, 24, true, 'Branch', NULL),
    ('ah-collateral-maintenance', 'PROC_COLLATERAL_MAINTENANCE', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-collateral-ownership-change', 'PROC_COLLATERAL_OWNERSHIP_CHANGE', 2, 'BRMGR', 'DISTDIR', false, 48, true, 'Branch', NULL),
    ('ah-insurance-exception', 'INSURANCE_EXCEPTION', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-insurance-exception-approve', 'APPROVE_INSURANCE_EXCEPTION', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-insurance-coverage-rule', 'INSURANCE_COVERAGE_RULE', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-insurance-coverage-rule-approve', 'APPROVE_COVERAGE_RULE', 1, 'BRMGR', NULL, false, 24, true, 'Branch', NULL),
    ('ah-collateral-exception-approve', 'APPROVE_COLLATERAL_AND_EXCEPTION', 2, 'RISK', 'DISTDIR', false, 24, true, 'Head Office', 'Missing Mandatory Document')
ON CONFLICT (id) DO UPDATE SET
    transaction_type = EXCLUDED.transaction_type,
    approval_levels = EXCLUDED.approval_levels,
    level1_role = EXCLUDED.level1_role,
    level2_role = EXCLUDED.level2_role,
    bulk_approve_allowed = EXCLUDED.bulk_approve_allowed,
    sla_hours = EXCLUDED.sla_hours,
    active = EXCLUDED.active,
    hierarchy_level = EXCLUDED.hierarchy_level,
    exception_type = EXCLUDED.exception_type;
