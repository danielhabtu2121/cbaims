-- V12: Drop strict foreign key constraint on cims_insurance_policies.collateral_id
ALTER TABLE cims_insurance_policies DROP CONSTRAINT IF EXISTS cims_insurance_policies_collateral_id_fkey;
