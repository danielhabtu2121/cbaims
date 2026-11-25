-- V62__preserve_demo_dataset_updates.sql
-- Safely applies the demo portfolio dataset updates previously introduced on V22
-- without altering V22 itself, preserving existing UAT migration checksums and referential integrity.

-- 1. Free CIF-000104 if the legacy placeholder customer holds it and cust-msme-104 does not yet exist
UPDATE cims_customers
   SET cif = NULL
 WHERE id = 'cust-1788155218663'
   AND cif = 'CIF-000104'
   AND NOT EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

-- 2. Add MSME customer cust-msme-104 (Ethio-Tannery Processing Enterprise), if missing
INSERT INTO cims_customers (
    id, cif, customer_type, name, business_reg_no, tax_id_no, dob_or_incorp,
    phone, email, address, segment, branch, status, risk_rating
)
SELECT
    'cust-msme-104',
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM cims_customers WHERE cif = 'CIF-000104' AND id <> 'cust-msme-104')
        THEN 'CIF-000104'
        ELSE NULL
    END,
    'Business',
    'Ethio-Tannery Processing Enterprise',
    'REG-ET-2019-1122',
    'TIN-00334455',
    '2019-02-14',
    '+251911556677',
    'info@ethiotannery.com',
    'Akaki Kality Industrial Zone, Addis Ababa',
    'MSME Banking',
    'Merkato Branch',
    'Active',
    'Medium'
WHERE NOT EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104')
ON CONFLICT (id) DO NOTHING;

-- 3. Add Retail customer cust-ret-103 (Dr. Yohannes Tadesse Bekele), if missing
INSERT INTO cims_customers (
    id, cif, customer_type, name, business_reg_no, tax_id_no, dob_or_incorp,
    phone, email, address, segment, branch, status, risk_rating
)
SELECT
    'cust-ret-103',
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM cims_customers WHERE cif = 'CIF-000103' AND id <> 'cust-ret-103')
        THEN 'CIF-000103'
        ELSE NULL
    END,
    'Individual',
    'Dr. Yohannes Tadesse Bekele',
    NULL,
    'TIN-00112233',
    '1982-11-04',
    '+251911778899',
    'dr.yohannes@gmail.com',
    'Yeka Subcity, Woreda 07, Addis Ababa',
    'Retail Banking',
    'Merkato Branch',
    'Active',
    'Low'
WHERE NOT EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-ret-103')
ON CONFLICT (id) DO NOTHING;

-- 4. Correct affected loan account customer reference (cust-1788155218663 / loan-msme-004 -> cust-msme-104)
UPDATE cims_loan_accounts
   SET customer_id = 'cust-msme-104'
 WHERE (
           customer_id = 'cust-1788155218663'
           OR (
               id = 'loan-msme-004'
               AND (
                   customer_id IS NULL
                   OR customer_id = 'cust-1788155218663'
                   OR NOT EXISTS (SELECT 1 FROM cims_customers c WHERE c.id = cims_loan_accounts.customer_id)
               )
           )
       )
   AND customer_id IS DISTINCT FROM 'cust-msme-104'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

-- 5. Correct affected collateral customer references
UPDATE cims_collaterals
   SET customer_id = 'cust-msme-104'
 WHERE (
           customer_id = 'cust-1788155218663'
           OR (
               id = 'col-msme-104-a'
               AND (
                   customer_id IS NULL
                   OR customer_id = 'cust-1788155218663'
                   OR NOT EXISTS (SELECT 1 FROM cims_customers c WHERE c.id = cims_collaterals.customer_id)
               )
           )
       )
   AND customer_id IS DISTINCT FROM 'cust-msme-104'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

UPDATE cims_collaterals
   SET customer_id = 'cust-ret-103'
 WHERE (
           customer_id = 'cust-1788161152835'
           OR (
               id = 'col-ret-103-a'
               AND (
                   customer_id IS NULL
                   OR customer_id = 'cust-1788161152835'
                   OR NOT EXISTS (SELECT 1 FROM cims_customers c WHERE c.id = cims_collaterals.customer_id)
               )
           )
       )
   AND customer_id IS DISTINCT FROM 'cust-ret-103'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-ret-103');

-- 6. Reassign any existing link and link-history references from legacy placeholder customer IDs
UPDATE cims_loan_collateral_links
   SET customer_id = CASE
           WHEN customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE customer_id
       END,
       borrower_customer_id = CASE
           WHEN borrower_customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN borrower_customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE borrower_customer_id
       END,
       legal_owner_customer_id = CASE
           WHEN legal_owner_customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN legal_owner_customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE legal_owner_customer_id
       END
 WHERE customer_id IN ('cust-1788155218663', 'cust-1788161152835')
    OR borrower_customer_id IN ('cust-1788155218663', 'cust-1788161152835')
    OR legal_owner_customer_id IN ('cust-1788155218663', 'cust-1788161152835');

UPDATE cims_loan_collateral_link_history
   SET customer_id = CASE
           WHEN customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE customer_id
       END,
       borrower_customer_id = CASE
           WHEN borrower_customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN borrower_customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE borrower_customer_id
       END,
       legal_owner_customer_id = CASE
           WHEN legal_owner_customer_id = 'cust-1788155218663' THEN 'cust-msme-104'
           WHEN legal_owner_customer_id = 'cust-1788161152835' THEN 'cust-ret-103'
           ELSE legal_owner_customer_id
       END
 WHERE customer_id IN ('cust-1788155218663', 'cust-1788161152835')
    OR borrower_customer_id IN ('cust-1788155218663', 'cust-1788161152835')
    OR legal_owner_customer_id IN ('cust-1788155218663', 'cust-1788161152835');

-- 7. Add Retail loan-collateral link link-ret-003 (loan-ret-008 -> col-ret-103-a, 6.8M, Primary, Active) if missing
INSERT INTO cims_loan_collateral_links (
    id, loan_account_id, collateral_id, allocated_amount, linkage_type, status,
    customer_id, borrower_customer_id, legal_owner_customer_id,
    relationship_context, third_party, relationship_status, release_status,
    collateral_rank, is_first_degree_internal, first_degree_holder_name,
    facility_coverage_pct, collateral_allocation_pct
)
SELECT
    'link-ret-003',
    a.id,
    c.id,
    6800000.00,
    'Primary',
    'Active',
    a.customer_id,
    a.customer_id,
    c.customer_id,
    CASE
        WHEN c.customer_id IS NOT NULL AND a.customer_id IS NOT NULL
             AND LOWER(TRIM(c.customer_id)) <> LOWER(TRIM(a.customer_id)) THEN 'Third-party'
        ELSE 'Borrower-owned'
    END,
    CASE
        WHEN c.customer_id IS NOT NULL AND a.customer_id IS NOT NULL
             AND LOWER(TRIM(c.customer_id)) <> LOWER(TRIM(a.customer_id)) THEN TRUE
        ELSE FALSE
    END,
    'Active',
    'Eligible',
    COALESCE(c.collateral_rank, '1st'),
    COALESCE(c.is_first_degree_internal, TRUE),
    COALESCE(c.first_degree_holder_name, 'Dashen Bank S.C.'),
    CASE
        WHEN a.outstanding_balance > 0 THEN LEAST(ROUND(CAST((6800000.00 / a.outstanding_balance) * 100.0 AS NUMERIC), 2), 999.99)
        WHEN a.approved_limit > 0 THEN LEAST(ROUND(CAST((6800000.00 / a.approved_limit) * 100.0 AS NUMERIC), 2), 999.99)
        ELSE 100.00
    END,
    0.00
FROM cims_loan_accounts a
JOIN cims_collaterals c ON c.id = 'col-ret-103-a'
WHERE a.id = 'loan-ret-008'
  AND NOT EXISTS (SELECT 1 FROM cims_loan_collateral_links WHERE id = 'link-ret-003')
  AND NOT EXISTS (
      SELECT 1 FROM cims_loan_collateral_links
      WHERE loan_account_id = 'loan-ret-008'
        AND collateral_id = 'col-ret-103-a'
        AND status = 'Active'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Add shared-collateral link link-shared-corp-ret (loan-corp-006 -> col-ifb-105-b, 5M, Secondary, Active) if missing
INSERT INTO cims_loan_collateral_links (
    id, loan_account_id, collateral_id, allocated_amount, linkage_type, status,
    customer_id, borrower_customer_id, legal_owner_customer_id,
    relationship_context, third_party, relationship_status, release_status,
    collateral_rank, is_first_degree_internal, first_degree_holder_name,
    facility_coverage_pct, collateral_allocation_pct
)
SELECT
    'link-shared-corp-ret',
    a.id,
    c.id,
    5000000.00,
    'Secondary',
    'Active',
    a.customer_id,
    a.customer_id,
    c.customer_id,
    CASE
        WHEN c.customer_id IS NOT NULL AND a.customer_id IS NOT NULL
             AND LOWER(TRIM(c.customer_id)) <> LOWER(TRIM(a.customer_id)) THEN 'Third-party'
        ELSE 'Borrower-owned'
    END,
    CASE
        WHEN c.customer_id IS NOT NULL AND a.customer_id IS NOT NULL
             AND LOWER(TRIM(c.customer_id)) <> LOWER(TRIM(a.customer_id)) THEN TRUE
        ELSE FALSE
    END,
    'Active',
    'Eligible',
    COALESCE(c.collateral_rank, '1st'),
    COALESCE(c.is_first_degree_internal, TRUE),
    COALESCE(c.first_degree_holder_name, 'Dashen Bank S.C.'),
    CASE
        WHEN a.outstanding_balance > 0 THEN LEAST(ROUND(CAST((5000000.00 / a.outstanding_balance) * 100.0 AS NUMERIC), 2), 999.99)
        WHEN a.approved_limit > 0 THEN LEAST(ROUND(CAST((5000000.00 / a.approved_limit) * 100.0 AS NUMERIC), 2), 999.99)
        ELSE 100.00
    END,
    0.00
FROM cims_loan_accounts a
JOIN cims_collaterals c ON c.id = 'col-ifb-105-b'
WHERE a.id = 'loan-corp-006'
  AND NOT EXISTS (SELECT 1 FROM cims_loan_collateral_links WHERE id = 'link-shared-corp-ret')
  AND NOT EXISTS (
      SELECT 1 FROM cims_loan_collateral_links
      WHERE loan_account_id = 'loan-corp-006'
        AND collateral_id = 'col-ifb-105-b'
        AND status = 'Active'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed initial link history records for any newly inserted links above
INSERT INTO cims_loan_collateral_link_history (
    id, link_id, collateral_id, loan_account_id, facility_id, customer_id,
    previous_allocated_amount, new_allocated_amount,
    previous_linkage_type, new_linkage_type,
    previous_effective_date, new_effective_date,
    previous_status, new_status,
    action_type, change_reason,
    maker_id, maker_dt_stamp, auth_stat
)
SELECT
    'hist-' || l.id, l.id, l.collateral_id, l.loan_account_id, l.facility_id, l.customer_id,
    0, l.allocated_amount,
    'None', l.linkage_type,
    NULL, l.effective_date,
    'None', l.status,
    'MIGRATION_INITIAL', 'Baseline relationship state recorded by V62 demo dataset preservation.',
    l.maker_id, CURRENT_TIMESTAMP::text, 'A'
FROM cims_loan_collateral_links l
WHERE l.id IN ('link-ret-003', 'link-shared-corp-ret')
ON CONFLICT (id) DO NOTHING;

-- 9. Correct customer references on affected insurance policies (pol-due-05 and pol-due-06)
UPDATE cims_insurance_policies
   SET customer_id = 'cust-msme-104'
 WHERE (
           customer_id = 'cust-1788155218663'
           OR (
               id = 'pol-due-05'
               AND (
                   customer_id IS NULL
                   OR customer_id = 'cust-1788155218663'
                   OR NOT EXISTS (SELECT 1 FROM cims_customers c WHERE c.id = cims_insurance_policies.customer_id)
               )
           )
       )
   AND customer_id IS DISTINCT FROM 'cust-msme-104'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

UPDATE cims_insurance_policies
   SET customer_id = 'cust-ret-103'
 WHERE (
           customer_id = 'cust-1788161152835'
           OR (
               id = 'pol-due-06'
               AND (
                   customer_id IS NULL
                   OR customer_id = 'cust-1788161152835'
                   OR NOT EXISTS (SELECT 1 FROM cims_customers c WHERE c.id = cims_insurance_policies.customer_id)
               )
           )
       )
   AND customer_id IS DISTINCT FROM 'cust-ret-103'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-ret-103');

-- 10. Reassign any derived exception, claim, and CBS provenance references from legacy customer IDs
UPDATE cims_exceptions
   SET customer_id = 'cust-msme-104',
       customer_cif = COALESCE(NULLIF(BTRIM(customer_cif), ''), (SELECT cif FROM cims_customers WHERE id = 'cust-msme-104'))
 WHERE customer_id = 'cust-1788155218663'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

UPDATE cims_exceptions
   SET customer_id = 'cust-ret-103',
       customer_cif = COALESCE(NULLIF(BTRIM(customer_cif), ''), (SELECT cif FROM cims_customers WHERE id = 'cust-ret-103'))
 WHERE customer_id = 'cust-1788161152835'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-ret-103');

UPDATE cims_insurance_claims
   SET customer_id = CASE WHEN customer_id = 'cust-1788155218663' THEN 'cust-msme-104' ELSE 'cust-ret-103' END
 WHERE customer_id IN ('cust-1788155218663', 'cust-1788161152835')
   AND (
       (customer_id = 'cust-1788155218663' AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104'))
       OR (customer_id = 'cust-1788161152835' AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-ret-103'))
   );

UPDATE cbs_customer_provenance_logs
   SET customer_id = 'cust-msme-104'
 WHERE customer_id = 'cust-1788155218663'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

UPDATE cbs_customer_raw_snapshots
   SET customer_id = 'cust-msme-104'
 WHERE customer_id = 'cust-1788155218663'
   AND EXISTS (SELECT 1 FROM cims_customers WHERE id = 'cust-msme-104');

-- 11. Remove superseded placeholder customer cust-1788155218663 only if nothing references it anymore
DELETE FROM cims_customers
 WHERE id = 'cust-1788155218663'
   AND NOT EXISTS (SELECT 1 FROM cims_loan_accounts WHERE customer_id = 'cust-1788155218663')
   AND NOT EXISTS (SELECT 1 FROM cims_collaterals WHERE customer_id = 'cust-1788155218663')
   AND NOT EXISTS (SELECT 1 FROM cims_insurance_policies WHERE customer_id = 'cust-1788155218663');

