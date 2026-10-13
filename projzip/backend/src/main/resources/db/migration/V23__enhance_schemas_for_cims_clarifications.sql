-- V23: Schema enhancements for CIMS business clarification and domain alignment

-- 1. CBS Simulator Collaterals: separate collateral_type (asset type) from ownership_type
ALTER TABLE cbs_sim.collaterals ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(50) DEFAULT 'Borrower-owned';

UPDATE cbs_sim.collaterals
SET ownership_type = collateral_type
WHERE collateral_type IN ('Borrower-owned', 'Third-party-owned');

UPDATE cbs_sim.collaterals
SET collateral_type = CASE
    WHEN category = 'Immovable Properties' THEN 'Building'
    WHEN category = 'Movable Properties' THEN 'Vehicle'
    WHEN category = 'Business Mortgages' THEN 'Industrial Machinery'
    WHEN category = 'Financial Assets' THEN 'Marketable Shares'
    ELSE 'Warehouse Receipt'
END
WHERE collateral_type IN ('Borrower-owned', 'Third-party-owned');

-- 2. CIMS Collaterals: valuation date and method
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS valuation_date VARCHAR(50);
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(100);

-- 3. Approval Hierarchy Config: organizational context routing & remove doc verification
ALTER TABLE cims_approval_hierarchy_configs DROP CONSTRAINT IF EXISTS cims_approval_hierarchy_configs_transaction_type_key;
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(50) DEFAULT 'Branch';
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS branch_code VARCHAR(100);
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS district_name VARCHAR(100);
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS ho_department VARCHAR(100);
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS exception_type VARCHAR(100);
ALTER TABLE cims_approval_hierarchy_configs ADD COLUMN IF NOT EXISTS maker_role VARCHAR(50);

DELETE FROM cims_approval_hierarchy_configs WHERE transaction_type = 'Document Verification';

-- 4. Reminder Schedules: audience, recurrence, day-basis
ALTER TABLE cims_reminder_schedules DROP CONSTRAINT IF EXISTS cims_reminder_schedules_days_before_expiry_key;
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS audience VARCHAR(50) DEFAULT 'Staff';
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS trigger_basis VARCHAR(50) DEFAULT 'Before Expiry';
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS offset_days INT DEFAULT 30;
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS day_type VARCHAR(50) DEFAULT 'Working Day';
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS recurrence VARCHAR(100) DEFAULT 'One-time';
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS continue_until VARCHAR(100) DEFAULT 'Renewed';

-- 5. Mandatory Document Rules: conditional taxonomy & ownership rules
ALTER TABLE cims_mandatory_document_rules ADD COLUMN IF NOT EXISTS collateral_type VARCHAR(100);
ALTER TABLE cims_mandatory_document_rules ADD COLUMN IF NOT EXISTS ownership_condition VARCHAR(100);
ALTER TABLE cims_mandatory_document_rules ADD COLUMN IF NOT EXISTS applicability_condition VARCHAR(255);
ALTER TABLE cims_mandatory_document_rules ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 6. Collateral Taxonomies: active flag
ALTER TABLE cims_collateral_taxonomies ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 7. System Parameters: type metadata & documented parameters
ALTER TABLE cims_system_parameters ADD COLUMN IF NOT EXISTS param_type VARCHAR(50) DEFAULT 'string';

INSERT INTO cims_system_parameters (param_key, param_value, description, param_type)
VALUES
  ('staff_reminder_intervals', '30,25,20,every-other', 'Staff reminder sequence: 30, 25, 20 working days, then every other working day', 'working days'),
  ('escalation_timelines', '48', 'Escalation turnaround SLA in hours', 'duration'),
  ('max_staff_notifications_per_day', '5', 'Maximum reminder notifications dispatched to a staff user per day', 'numeric'),
  ('customer_notification_frequency', '5', 'Customer reminder interval in days until renewed/resolved', 'calendar days'),
  ('insurance_coverage_threshold', '100.0', 'Minimum required insurance coverage percentage of exposure', 'percentage'),
  ('min_policy_validity_period', '365', 'Minimum validity period in days for acceptable policies', 'calendar days'),
  ('doc_expiry_warning_period', '30', 'Days before document expiry to trigger alerts', 'calendar days')
ON CONFLICT (param_key) DO UPDATE
SET description = EXCLUDED.description, param_type = EXCLUDED.param_type;

-- 8. Notification Templates: event type & channel separation
ALTER TABLE cims_notification_templates ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) DEFAULT 'Expiry Reminder';
ALTER TABLE cims_notification_templates ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'Email';

UPDATE cims_notification_templates
SET channel = CASE WHEN type ILIKE '%sms%' THEN 'SMS' ELSE 'Email' END,
    event_type = CASE
      WHEN name ILIKE '%expired%' THEN 'Expired Policy'
      WHEN name ILIKE '%reminder%' THEN 'Expiry Reminder'
      WHEN name ILIKE '%breach%' OR name ILIKE '%exception%' THEN 'Compliance Exception'
      WHEN name ILIKE '%approval%' THEN 'Approval Request'
      WHEN name ILIKE '%reject%' THEN 'Rejected Policy'
      WHEN name ILIKE '%missing%' OR name ILIKE '%document%' THEN 'Missing Documentation'
      WHEN name ILIKE '%cancel%' THEN 'Policy Cancellation'
      WHEN name ILIKE '%endorse%' THEN 'Policy Endorsement'
      ELSE 'System Alert'
    END;

-- 9. Exceptions: supporting evidence document
ALTER TABLE cims_exceptions ADD COLUMN IF NOT EXISTS evidence_document VARCHAR(255);

-- 10. Branches: area office
ALTER TABLE cims_branches ADD COLUMN IF NOT EXISTS area_office VARCHAR(150);

