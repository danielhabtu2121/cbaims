-- V59: Improve Reminder Schedule Recurrence (numeric interval, unit, minute-based test recurrence)
-- and link Notification Templates directly to Reminder Schedules with audience isolation (Staff, Customer, Insurer).

-- 1. Enhance cims_reminder_schedules
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS recurrence_interval INT DEFAULT 1;
ALTER TABLE cims_reminder_schedules ADD COLUMN IF NOT EXISTS recurrence_unit VARCHAR(50) DEFAULT 'DAYS';

-- Populate name for existing schedules if empty
UPDATE cims_reminder_schedules
   SET name = CASE
       WHEN id = 'rem-30w' THEN '30 Working Days Pre-Expiry Notice'
       WHEN id = 'rem-25w' THEN '25 Working Days Pre-Expiry Notice'
       WHEN id = 'rem-20w' THEN '20 Working Days Pre-Expiry Notice'
       WHEN id = 'rem-10c' THEN '10 Calendar Days Final Pre-Expiry Alert'
       WHEN id = 'rem-5c-post' THEN '5 Calendar Days Grace Period Notice'
       WHEN id = 'rem-15c-repeat' THEN 'Overdue Policy Recurring Escalation (Every 15 Days)'
       ELSE COALESCE(name, 'Schedule ' || id)
   END
 WHERE name IS NULL OR name = '';

-- 2. Enhance cims_notification_templates
ALTER TABLE cims_notification_templates ADD COLUMN IF NOT EXISTS schedule_id VARCHAR(100);
ALTER TABLE cims_notification_templates ADD COLUMN IF NOT EXISTS audience VARCHAR(50);

-- Link existing templates to corresponding reminder schedules
UPDATE cims_notification_templates
   SET schedule_id = 'rem-30w', audience = 'Customer'
 WHERE id = 'tmpl-1' OR (schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%30%customer%');

UPDATE cims_notification_templates
   SET schedule_id = 'rem-30w', audience = 'Staff'
 WHERE schedule_id IS NULL AND (lower(coalesce(name, '')) LIKE '%30%staff%' OR lower(coalesce(name, '')) LIKE '%digest%');

UPDATE cims_notification_templates
   SET schedule_id = 'rem-25w', audience = 'Staff'
 WHERE schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%25%';

UPDATE cims_notification_templates
   SET schedule_id = 'rem-20w', audience = 'Staff'
 WHERE schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%20%';

UPDATE cims_notification_templates
   SET schedule_id = 'rem-10c', audience = 'Staff'
 WHERE schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%10%';

UPDATE cims_notification_templates
   SET schedule_id = 'rem-5c-post', audience = 'Staff'
 WHERE schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%5%';

UPDATE cims_notification_templates
   SET schedule_id = 'rem-15c-repeat', audience = 'Staff'
 WHERE schedule_id IS NULL AND lower(coalesce(name, '')) LIKE '%15%';

