-- ============================================================================
-- Normalize already-synced CBS records in PostgreSQL:
-- 1. Mark CBS-synced collaterals, facilities, and customers as CBS_IMPORTED
--    and set un-enriched CBS collaterals to PENDING_ENRICHMENT / INCOMPLETE.
-- 2. Resolve numeric branch codes (e.g. '010', '10') to registered branch names.
-- 3. Resolve numeric facility_type codes ('0'..'8') to loan type names.
-- 4. Resolve numeric business segment codes ('0'..'2') to segment names.
-- ============================================================================

-- 1. Origin type & enrichment readiness for CBS-synced records
UPDATE cims_collaterals
SET origin_type = 'CBS_IMPORTED',
    cbs_collateral_ref = COALESCE(NULLIF(cbs_collateral_ref, ''), code),
    enrichment_status = CASE
        WHEN enrichment_status IS NULL OR enrichment_status = '' OR UPPER(enrichment_status) = 'NOT_APPLICABLE'
        THEN 'PENDING_ENRICHMENT'
        ELSE enrichment_status
    END,
    data_quality_status = CASE
        WHEN (data_quality_status IS NULL OR data_quality_status = '' OR UPPER(data_quality_status) = 'COMPLETE')
             AND COALESCE(UPPER(enrichment_status), '') <> 'APPROVED'
        THEN 'INCOMPLETE'
        ELSE data_quality_status
    END
WHERE source IN ('REAL_CBS', 'CBS_ORACLE', 'CBS_SIM')
  AND (origin_type IS NULL OR origin_type = 'CBAIMS_REGISTERED');

UPDATE cims_loan_accounts
SET origin_type = 'CBS_IMPORTED',
    cbs_source_ref = COALESCE(NULLIF(cbs_source_ref, ''), loan_reference)
WHERE source IN ('REAL_CBS', 'CBS_ORACLE', 'CBS_SIM')
  AND (origin_type IS NULL OR origin_type = 'CBAIMS_REGISTERED');

UPDATE cims_customers
SET origin_type = 'CBS_IMPORTED',
    cbs_source_ref = COALESCE(NULLIF(cbs_source_ref, ''), cif)
WHERE source IN ('REAL_CBS', 'CBS_ORACLE', 'CBS_SIM')
  AND (origin_type IS NULL OR origin_type = 'CBAIMS_REGISTERED');

-- 2. Resolve numeric facility types ('0'..'8')
UPDATE cims_loan_accounts
SET facility_type = CASE LTRIM(REGEXP_REPLACE(TRIM(facility_type), '\.0$', ''), '0')
    WHEN '' THEN 'Short Term Loan'
    WHEN '1' THEN 'Medium-term Loan'
    WHEN '2' THEN 'Long-term Loan'
    WHEN '3' THEN 'Pre-shipment loans'
    WHEN '4' THEN 'Post shipment loans'
    WHEN '5' THEN 'Merchandise loans'
    WHEN '6' THEN 'Advance on LC'
    WHEN '7' THEN 'ECG loans'
    WHEN '8' THEN 'Others (USAID and others)'
    ELSE facility_type
END
WHERE TRIM(facility_type) ~ '^0*([0-8])(\.0)?$';

-- 3. Resolve numeric business segments ('0'..'2')
UPDATE cims_customers
SET segment = CASE LTRIM(REGEXP_REPLACE(TRIM(segment), '\.0$', ''), '0')
    WHEN '' THEN 'Corporate Banking'
    WHEN '1' THEN 'MSME Banking'
    WHEN '2' THEN 'Retail Banking'
    ELSE segment
END
WHERE TRIM(segment) ~ '^0*([0-2])(\.0)?$';

UPDATE cims_loan_accounts
SET segment = CASE LTRIM(REGEXP_REPLACE(TRIM(segment), '\.0$', ''), '0')
    WHEN '' THEN 'Corporate Banking'
    WHEN '1' THEN 'MSME Banking'
    WHEN '2' THEN 'Retail Banking'
    ELSE segment
END
WHERE TRIM(segment) ~ '^0*([0-2])(\.0)?$';

UPDATE cims_collaterals
SET owning_segment = CASE LTRIM(REGEXP_REPLACE(TRIM(owning_segment), '\.0$', ''), '0')
    WHEN '' THEN 'Corporate Banking'
    WHEN '1' THEN 'MSME Banking'
    WHEN '2' THEN 'Retail Banking'
    ELSE owning_segment
END
WHERE TRIM(owning_segment) ~ '^0*([0-2])(\.0)?$';

-- 4. Resolve numeric/code branch values to registered branch names
UPDATE cims_customers c
SET branch = b.name
FROM cims_branches b
WHERE b.name IS NOT NULL AND b.name <> ''
  AND c.branch IS NOT NULL AND c.branch <> ''
  AND (
      UPPER(TRIM(c.branch)) = UPPER(TRIM(b.cbs_branch_code))
      OR UPPER(TRIM(c.branch)) = UPPER(TRIM(b.code))
      OR (TRIM(c.branch) ~ '^\d{1,3}$' AND LPAD(TRIM(c.branch), 3, '0') = TRIM(b.cbs_branch_code))
  )
  AND c.branch <> b.name;

UPDATE cims_loan_accounts l
SET branch = b.name
FROM cims_branches b
WHERE b.name IS NOT NULL AND b.name <> ''
  AND l.branch IS NOT NULL AND l.branch <> ''
  AND (
      UPPER(TRIM(l.branch)) = UPPER(TRIM(b.cbs_branch_code))
      OR UPPER(TRIM(l.branch)) = UPPER(TRIM(b.code))
      OR (TRIM(l.branch) ~ '^\d{1,3}$' AND LPAD(TRIM(l.branch), 3, '0') = TRIM(b.cbs_branch_code))
  )
  AND l.branch <> b.name;

UPDATE cims_collaterals col
SET branch = b.name
FROM cims_branches b
WHERE b.name IS NOT NULL AND b.name <> ''
  AND col.branch IS NOT NULL AND col.branch <> ''
  AND (
      UPPER(TRIM(col.branch)) = UPPER(TRIM(b.cbs_branch_code))
      OR UPPER(TRIM(col.branch)) = UPPER(TRIM(b.code))
      OR (TRIM(col.branch) ~ '^\d{1,3}$' AND LPAD(TRIM(col.branch), 3, '0') = TRIM(b.cbs_branch_code))
  )
  AND col.branch <> b.name;

