-- V61: Required unique Reminder Schedule names
--
-- Reminder Name is the human-readable identity of a schedule and is used when
-- linking Notification Templates. Backfill legacy blank / auto-generated names
-- with meaningful labels, resolve any accidental duplicates, then enforce
-- case-insensitive uniqueness.

UPDATE cims_reminder_schedules
   SET name = CASE
       WHEN id = 'rem-15w' THEN '15 Working Days Pre-Expiry Notice'
       WHEN id = 'rem-30'  THEN '30 Calendar Days Pre-Expiry Notice'
       WHEN id = 'rem-60'  THEN '60 Calendar Days Pre-Expiry Notice'
       WHEN id = 'rem-90'  THEN '90 Calendar Days Pre-Expiry Notice'
       WHEN id = 'rem-7'   THEN '7 Calendar Days Pre-Expiry Notice'
       WHEN id = 'rem-15'  THEN '15 Calendar Days Pre-Expiry Notice'
       ELSE 'Reminder ' || id
   END
 WHERE name IS NULL
    OR BTRIM(name) = ''
    OR name ~* '^Schedule rem-';

-- Make any remaining duplicates unique without losing the original label.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(BTRIM(name)) ORDER BY id) AS rn
      FROM cims_reminder_schedules
     WHERE name IS NOT NULL AND BTRIM(name) <> ''
)
UPDATE cims_reminder_schedules r
   SET name = BTRIM(r.name) || ' (' || r.id || ')'
  FROM ranked
 WHERE r.id = ranked.id
   AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uk_cims_reminder_schedules_name
    ON cims_reminder_schedules (LOWER(BTRIM(name)));
