-- Migration V6: Convert timestamp columns to VARCHAR(50) for uniform ISO timestamp support across all entities
ALTER TABLE cims_customers ALTER COLUMN cbs_synced_at TYPE VARCHAR(50) USING cbs_synced_at::text;
ALTER TABLE cims_customers ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_customers ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_loan_accounts ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_loan_accounts ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_collaterals ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_collaterals ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_insurance_policies ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_insurance_policies ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_policy_endorsements ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_policy_endorsements ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_loan_collateral_links ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_loan_collateral_links ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;

ALTER TABLE cims_collateral_owners ALTER COLUMN superseded_date TYPE VARCHAR(50) USING superseded_date::text;
ALTER TABLE cims_collateral_owners ALTER COLUMN verification_date TYPE VARCHAR(50) USING verification_date::text;

ALTER TABLE cbs_sim.customers ALTER COLUMN synced_at TYPE VARCHAR(50) USING synced_at::text;
ALTER TABLE cbs_sim.facilities ALTER COLUMN synced_at TYPE VARCHAR(50) USING synced_at::text;
ALTER TABLE cbs_sim.collaterals ALTER COLUMN synced_at TYPE VARCHAR(50) USING synced_at::text;
ALTER TABLE cbs_sim.sync_logs ALTER COLUMN timestamp TYPE VARCHAR(50) USING timestamp::text;
