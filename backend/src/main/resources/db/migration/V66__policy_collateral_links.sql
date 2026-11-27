-- ============================================================================
-- Multi-collateral insurance allocation support (1 policy -> N collaterals,
-- single branch per policy, explicit allocated_insured_amount per collateral).
-- ============================================================================

CREATE TABLE IF NOT EXISTS cims_policy_collateral_links (
    id VARCHAR(100) PRIMARY KEY,
    policy_id VARCHAR(100) NOT NULL,
    collateral_id VARCHAR(100) NOT NULL,
    allocated_insured_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    allocation_pct DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    branch VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at VARCHAR(100),
    updated_at VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_pcl_policy_id ON cims_policy_collateral_links (policy_id);
CREATE INDEX IF NOT EXISTS idx_pcl_collateral_id ON cims_policy_collateral_links (collateral_id);
CREATE INDEX IF NOT EXISTS idx_pcl_status ON cims_policy_collateral_links (status);

-- Backfill existing single-collateral policies
INSERT INTO cims_policy_collateral_links (id, policy_id, collateral_id, allocated_insured_amount, allocation_pct, branch, status, created_at)
SELECT 'pcl-' || p.id || '-' || LEFT(MD5(p.collateral_id), 8),
       p.id,
       p.collateral_id,
       COALESCE(p.insured_amount, 0.0),
       100.0,
       c.branch,
       CASE WHEN UPPER(COALESCE(p.status, '')) IN ('CANCELLED', 'CLOSED') THEN p.status ELSE 'Active' END,
       COALESCE(p.effective_date, '')
FROM cims_policies p
LEFT JOIN cims_collaterals c ON c.id = p.collateral_id OR c.code = p.collateral_id
WHERE p.collateral_id IS NOT NULL AND TRIM(p.collateral_id) <> ''
ON CONFLICT (id) DO NOTHING;
