-- V11: Relax collateral_id and customer_id nullability on cims_insurance_policies
ALTER TABLE cims_insurance_policies ALTER COLUMN collateral_id DROP NOT NULL;
ALTER TABLE cims_insurance_policies ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE cims_insurance_policies ALTER COLUMN insurer_name DROP NOT NULL;
ALTER TABLE cims_insurance_policies ALTER COLUMN coverage_type DROP NOT NULL;
ALTER TABLE cims_insurance_policies ALTER COLUMN effective_date DROP NOT NULL;
ALTER TABLE cims_insurance_policies ALTER COLUMN expiry_date DROP NOT NULL;
