-- Migration V7: Convert all DATE and TIMESTAMP columns to VARCHAR(50) for robust ISO-string handling
DO $$ 
BEGIN
    -- cims_customers
    ALTER TABLE cims_customers ALTER COLUMN dob_or_incorp TYPE VARCHAR(50) USING dob_or_incorp::text;
    
    -- cims_collaterals
    ALTER TABLE cims_collaterals ALTER COLUMN start_date TYPE VARCHAR(50) USING start_date::text;
    ALTER TABLE cims_collaterals ALTER COLUMN review_date TYPE VARCHAR(50) USING review_date::text;

    -- cims_loan_accounts
    ALTER TABLE cims_loan_accounts ALTER COLUMN line_start_date TYPE VARCHAR(50) USING line_start_date::text;
    ALTER TABLE cims_loan_accounts ALTER COLUMN line_expiry_date TYPE VARCHAR(50) USING line_expiry_date::text;
    ALTER TABLE cims_loan_accounts ALTER COLUMN next_review_due_date TYPE VARCHAR(50) USING next_review_due_date::text;

    -- cims_insurance_policies
    ALTER TABLE cims_insurance_policies ALTER COLUMN effective_date TYPE VARCHAR(50) USING effective_date::text;
    ALTER TABLE cims_insurance_policies ALTER COLUMN expiry_date TYPE VARCHAR(50) USING expiry_date::text;

    -- cims_policy_endorsements
    ALTER TABLE cims_policy_endorsements ALTER COLUMN effective_date TYPE VARCHAR(50) USING effective_date::text;

    -- cbs_sim.customers
    ALTER TABLE cbs_sim.customers ALTER COLUMN dob_or_incorp TYPE VARCHAR(50) USING dob_or_incorp::text;
    ALTER TABLE cbs_sim.customers ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;

    -- cbs_sim.facilities
    ALTER TABLE cbs_sim.facilities ALTER COLUMN line_start_date TYPE VARCHAR(50) USING line_start_date::text;
    ALTER TABLE cbs_sim.facilities ALTER COLUMN line_expiry_date TYPE VARCHAR(50) USING line_expiry_date::text;
    ALTER TABLE cbs_sim.facilities ALTER COLUMN next_review_date TYPE VARCHAR(50) USING next_review_date::text;
    ALTER TABLE cbs_sim.facilities ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;

    -- cbs_sim.collaterals
    ALTER TABLE cbs_sim.collaterals ALTER COLUMN start_date TYPE VARCHAR(50) USING start_date::text;
    ALTER TABLE cbs_sim.collaterals ALTER COLUMN review_date TYPE VARCHAR(50) USING review_date::text;
    ALTER TABLE cbs_sim.collaterals ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;

    -- cims_holiday_calendars
    ALTER TABLE cims_holiday_calendars ALTER COLUMN holiday_date TYPE VARCHAR(50) USING holiday_date::text;

    -- cims_ownership_documents
    ALTER TABLE cims_ownership_documents ALTER COLUMN upload_date TYPE VARCHAR(50) USING upload_date::text;
    ALTER TABLE cims_ownership_documents ALTER COLUMN expiry_date TYPE VARCHAR(50) USING expiry_date::text;

    -- cims_exceptions
    ALTER TABLE cims_exceptions ALTER COLUMN detected_at TYPE VARCHAR(50) USING detected_at::text;
    ALTER TABLE cims_exceptions ALTER COLUMN sla_due_date TYPE VARCHAR(50) USING sla_due_date::text;
    ALTER TABLE cims_exceptions ALTER COLUMN resolved_at TYPE VARCHAR(50) USING resolved_at::text;

    -- cims_audit_logs
    ALTER TABLE cims_audit_logs ALTER COLUMN timestamp TYPE VARCHAR(50) USING timestamp::text;

    -- cims_notifications
    ALTER TABLE cims_notifications ALTER COLUMN sent_at TYPE VARCHAR(50) USING sent_at::text;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
