-- V56: Authoritative assignment scope and configured exception approval routing.
-- Removes legacy duplicate permission rows so the seeded full role matrix is the
-- single source of truth, enables the configured Risk Approver for exception
-- workflows, and registers the exception hierarchy in the Admin screen data.

-- 1. Remove the legacy short permission rows seeded by V4 (perm-1, perm-2, ...).
--    V13 seeds the complete canonical matrix with role-prefixed IDs.
DELETE FROM cims_role_permissions WHERE id ~ '^perm-[0-9]+$';

-- 2. Risk must be able to authorise exception approvals routed to it by the
--    configured Workflow Approval Hierarchy. Auditors/read-only never can.
UPDATE cims_role_permissions
   SET can_view = true, can_approve = true
 WHERE role_code = 'RISK' AND screen_name = 'Approvals';

-- 3. Configure exception routing from the Admin Workflow Approval Hierarchy.
--    These are defaults only: changing them on the Administration screen
--    immediately changes routing because the backend reads this table at runtime.
INSERT INTO cims_approval_hierarchy_configs
    (id, transaction_type, approval_levels, level1_role, level2_role,
     bulk_approve_allowed, sla_hours, active, hierarchy_level, exception_type)
VALUES
    ('ah-exception-risk', 'Exception Approval', 2, 'RISK', 'DISTDIR', false, 24, true, 'Head Office', 'Missing Mandatory Document'),
    ('ah-exception-workflow', 'APPROVE_EXCEPTION', 2, 'RISK', 'DISTDIR', false, 24, true, 'Head Office', 'Missing Mandatory Document'),
    ('ah-exception-collateral', 'APPROVE_COLLATERAL_AND_EXCEPTION', 2, 'RISK', 'DISTDIR', false, 24, true, 'Head Office', 'Missing Mandatory Document')
ON CONFLICT (id) DO UPDATE SET
    level1_role = EXCLUDED.level1_role,
    level2_role = EXCLUDED.level2_role,
    active = EXCLUDED.active,
    exception_type = EXCLUDED.exception_type;
