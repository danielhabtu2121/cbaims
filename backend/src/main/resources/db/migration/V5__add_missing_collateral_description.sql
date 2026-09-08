-- Migration V5: Add description column to cims_collaterals and cims_customers fields
ALTER TABLE cims_collaterals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS tax_id_no VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS dob_or_incorp VARCHAR(100);
ALTER TABLE cims_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
