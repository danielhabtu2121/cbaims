-- Normalize CBS business segment codes/labels across loans, customers, collaterals, and users,
-- and backfill placeholder customer/collateral segments from linked loans.

UPDATE cims_loan_accounts
SET segment = CASE
    WHEN UPPER(TRIM(segment)) IN ('0', 'CORPORATE', 'CORPORATE BANKING', 'CORPORATE BANKING CUSTOMERS') THEN 'Corporate Banking'
    WHEN UPPER(TRIM(segment)) IN ('1', 'MSME', 'MSME BANKING', 'MSME BANKING CUSTOMERS') THEN 'MSME Banking'
    WHEN UPPER(TRIM(segment)) IN ('2', 'MRETAIL', 'RETAIL', 'RETAIL BANKING', '2RETAIL BANKING CUSTOMERS', 'RETAIL BANKING CUSTOMERS') THEN 'Retail Banking'
    WHEN UPPER(TRIM(segment)) IN ('IFB', 'INTEREST-FREE BANKING', 'INTEREST FREE BANKING', 'INTEREST-FREE BANKING (IFB)') THEN 'Interest-Free Banking (IFB)'
    ELSE segment
END
WHERE segment IS NOT NULL;

UPDATE cims_customers
SET segment = CASE
    WHEN UPPER(TRIM(segment)) IN ('0', 'CORPORATE', 'CORPORATE BANKING', 'CORPORATE BANKING CUSTOMERS') THEN 'Corporate Banking'
    WHEN UPPER(TRIM(segment)) IN ('1', 'MSME', 'MSME BANKING', 'MSME BANKING CUSTOMERS') THEN 'MSME Banking'
    WHEN UPPER(TRIM(segment)) IN ('2', 'MRETAIL', 'RETAIL', 'RETAIL BANKING', '2RETAIL BANKING CUSTOMERS', 'RETAIL BANKING CUSTOMERS') THEN 'Retail Banking'
    WHEN UPPER(TRIM(segment)) IN ('IFB', 'INTEREST-FREE BANKING', 'INTEREST FREE BANKING', 'INTEREST-FREE BANKING (IFB)') THEN 'Interest-Free Banking (IFB)'
    ELSE segment
END
WHERE segment IS NOT NULL;

UPDATE cims_collaterals
SET owning_segment = CASE
    WHEN UPPER(TRIM(owning_segment)) IN ('0', 'CORPORATE', 'CORPORATE BANKING', 'CORPORATE BANKING CUSTOMERS') THEN 'Corporate Banking'
    WHEN UPPER(TRIM(owning_segment)) IN ('1', 'MSME', 'MSME BANKING', 'MSME BANKING CUSTOMERS') THEN 'MSME Banking'
    WHEN UPPER(TRIM(owning_segment)) IN ('2', 'MRETAIL', 'RETAIL', 'RETAIL BANKING', '2RETAIL BANKING CUSTOMERS', 'RETAIL BANKING CUSTOMERS') THEN 'Retail Banking'
    WHEN UPPER(TRIM(owning_segment)) IN ('IFB', 'INTEREST-FREE BANKING', 'INTEREST FREE BANKING', 'INTEREST-FREE BANKING (IFB)') THEN 'Interest-Free Banking (IFB)'
    ELSE owning_segment
END
WHERE owning_segment IS NOT NULL;

UPDATE cims_users
SET segment = CASE
    WHEN UPPER(TRIM(segment)) IN ('0', 'CORPORATE', 'CORPORATE BANKING', 'CORPORATE BANKING CUSTOMERS') THEN 'Corporate Banking'
    WHEN UPPER(TRIM(segment)) IN ('1', 'MSME', 'MSME BANKING', 'MSME BANKING CUSTOMERS') THEN 'MSME Banking'
    WHEN UPPER(TRIM(segment)) IN ('2', 'MRETAIL', 'RETAIL', 'RETAIL BANKING', '2RETAIL BANKING CUSTOMERS', 'RETAIL BANKING CUSTOMERS') THEN 'Retail Banking'
    WHEN UPPER(TRIM(segment)) IN ('IFB', 'INTEREST-FREE BANKING', 'INTEREST FREE BANKING', 'INTEREST-FREE BANKING (IFB)') THEN 'Interest-Free Banking (IFB)'
    ELSE segment
END
WHERE segment IS NOT NULL;

-- Backfill placeholder customer segments from their active/latest loan segment
UPDATE cims_customers c
SET segment = sub.loan_seg
FROM (
    SELECT DISTINCT ON (la.customer_id) la.customer_id, la.segment AS loan_seg
    FROM cims_loan_accounts la
    WHERE la.customer_id IS NOT NULL
      AND la.segment IS NOT NULL
      AND UPPER(TRIM(la.segment)) NOT IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG')
    ORDER BY la.customer_id, la.id
) sub
WHERE c.id = sub.customer_id
  AND (c.segment IS NULL OR UPPER(TRIM(c.segment)) IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG'));

-- Backfill placeholder collateral owning_segment from linked loan first, then customer
UPDATE cims_collaterals col
SET owning_segment = sub.loan_seg
FROM (
    SELECT DISTINCT ON (lcl.collateral_id) lcl.collateral_id, la.segment AS loan_seg
    FROM cims_loan_collateral_links lcl
    JOIN cims_loan_accounts la ON la.id = lcl.loan_account_id
    WHERE la.segment IS NOT NULL
      AND UPPER(TRIM(la.segment)) NOT IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG')
    ORDER BY lcl.collateral_id, lcl.id
) sub
WHERE col.id = sub.collateral_id
  AND (col.owning_segment IS NULL OR UPPER(TRIM(col.owning_segment)) IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG'));

UPDATE cims_collaterals col
SET owning_segment = c.segment
FROM cims_customers c
WHERE col.customer_id = c.id
  AND c.segment IS NOT NULL
  AND UPPER(TRIM(c.segment)) NOT IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG')
  AND (col.owning_segment IS NULL OR UPPER(TRIM(col.owning_segment)) IN ('', 'GENERAL', 'UNSEGMENTED', 'SHORT', 'MEDIUM', 'LONG'));

