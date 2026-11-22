-- V54: Deduplicate role permissions and enforce uniqueness on (role_code, screen_name)
-- Fixes Role Matrix persistence bug where duplicate rows conflicted and prevented updates from taking effect.

-- 1. Remove obsolete numeric ID duplicate rows where modern semantic ID rows exist
DELETE FROM cims_role_permissions 
WHERE id ~ '^perm-[0-9]+$' 
  AND (role_code, screen_name) IN (
    SELECT role_code, screen_name FROM cims_role_permissions WHERE id !~ '^perm-[0-9]+$'
  );

-- 2. Clean up any remaining duplicate rows by retaining the latest entry
DELETE FROM cims_role_permissions a USING cims_role_permissions b
WHERE a.ctid < b.ctid AND a.role_code = b.role_code AND a.screen_name = b.screen_name;

-- 3. Enforce unique constraint so no duplicates can ever be inserted again
ALTER TABLE cims_role_permissions 
  DROP CONSTRAINT IF EXISTS uq_role_screen;

ALTER TABLE cims_role_permissions 
  ADD CONSTRAINT uq_role_screen UNIQUE (role_code, screen_name);

