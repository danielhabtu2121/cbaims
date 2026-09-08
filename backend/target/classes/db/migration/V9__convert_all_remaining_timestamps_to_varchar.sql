-- Migration V9: Convert all remaining timestamp & date columns across all CIMS tables to VARCHAR(50)

-- cims_collateral_owners
ALTER TABLE cims_collateral_owners ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
ALTER TABLE cims_collateral_owners ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;
ALTER TABLE cims_collateral_owners ALTER COLUMN verification_date TYPE VARCHAR(50) USING verification_date::text;
ALTER TABLE cims_collateral_owners ALTER COLUMN superseded_date TYPE VARCHAR(50) USING superseded_date::text;

-- cims_ownership_documents
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_documents' AND column_name = 'uploaded_at') THEN
        ALTER TABLE cims_ownership_documents ALTER COLUMN uploaded_at TYPE VARCHAR(50) USING uploaded_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_documents' AND column_name = 'verified_at') THEN
        ALTER TABLE cims_ownership_documents ALTER COLUMN verified_at TYPE VARCHAR(50) USING verified_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_documents' AND column_name = 'maker_dt_stamp') THEN
        ALTER TABLE cims_ownership_documents ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_documents' AND column_name = 'checker_dt_stamp') THEN
        ALTER TABLE cims_ownership_documents ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;
    END IF;
END $$;

-- cims_ownership_transfers
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'created_at') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'effective_date') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN effective_date TYPE VARCHAR(50) USING effective_date::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'approved_at') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN approved_at TYPE VARCHAR(50) USING approved_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'rejected_at') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN rejected_at TYPE VARCHAR(50) USING rejected_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'maker_dt_stamp') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_ownership_transfers' AND column_name = 'checker_dt_stamp') THEN
        ALTER TABLE cims_ownership_transfers ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;
    END IF;
END $$;

-- cims_collateral_inspections
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_inspections' AND column_name = 'inspection_date') THEN
        ALTER TABLE cims_collateral_inspections ALTER COLUMN inspection_date TYPE VARCHAR(50) USING inspection_date::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_inspections' AND column_name = 'maker_dt_stamp') THEN
        ALTER TABLE cims_collateral_inspections ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_inspections' AND column_name = 'checker_dt_stamp') THEN
        ALTER TABLE cims_collateral_inspections ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;
    END IF;
END $$;

-- cims_collateral_valuations
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_valuations' AND column_name = 'valuation_date') THEN
        ALTER TABLE cims_collateral_valuations ALTER COLUMN valuation_date TYPE VARCHAR(50) USING valuation_date::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_valuations' AND column_name = 'maker_dt_stamp') THEN
        ALTER TABLE cims_collateral_valuations ALTER COLUMN maker_dt_stamp TYPE VARCHAR(50) USING maker_dt_stamp::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_collateral_valuations' AND column_name = 'checker_dt_stamp') THEN
        ALTER TABLE cims_collateral_valuations ALTER COLUMN checker_dt_stamp TYPE VARCHAR(50) USING checker_dt_stamp::text;
    END IF;
END $$;

-- cims_delegations
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_delegations' AND column_name = 'start_date') THEN
        ALTER TABLE cims_delegations ALTER COLUMN start_date TYPE VARCHAR(50) USING start_date::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_delegations' AND column_name = 'end_date') THEN
        ALTER TABLE cims_delegations ALTER COLUMN end_date TYPE VARCHAR(50) USING end_date::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_delegations' AND column_name = 'created_at') THEN
        ALTER TABLE cims_delegations ALTER COLUMN created_at TYPE VARCHAR(50) USING created_at::text;
    END IF;
END $$;

-- cims_workflow_tasks
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_workflow_tasks' AND column_name = 'submitted_at') THEN
        ALTER TABLE cims_workflow_tasks ALTER COLUMN submitted_at TYPE VARCHAR(50) USING submitted_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_workflow_tasks' AND column_name = 'completed_at') THEN
        ALTER TABLE cims_workflow_tasks ALTER COLUMN completed_at TYPE VARCHAR(50) USING completed_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_workflow_tasks' AND column_name = 'sla_due_at') THEN
        ALTER TABLE cims_workflow_tasks ALTER COLUMN sla_due_at TYPE VARCHAR(50) USING sla_due_at::text;
    END IF;
END $$;

-- cims_approval_history
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_approval_history' AND column_name = 'decided_at') THEN
        ALTER TABLE cims_approval_history ALTER COLUMN decided_at TYPE VARCHAR(50) USING decided_at::text;
    END IF;
END $$;

-- cims_exceptions
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_exceptions' AND column_name = 'detected_at') THEN
        ALTER TABLE cims_exceptions ALTER COLUMN detected_at TYPE VARCHAR(50) USING detected_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_exceptions' AND column_name = 'resolved_at') THEN
        ALTER TABLE cims_exceptions ALTER COLUMN resolved_at TYPE VARCHAR(50) USING resolved_at::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cims_exceptions' AND column_name = 'sla_due_date') THEN
        ALTER TABLE cims_exceptions ALTER COLUMN sla_due_date TYPE VARCHAR(50) USING sla_due_date::text;
    END IF;
END $$;
