-- V21: Create Dashboard Snapshots Table for Point-in-Time History and Trend Tracking
CREATE TABLE IF NOT EXISTS cims_dashboard_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    snapshot_date VARCHAR(32) NOT NULL,
    as_of_date VARCHAR(32) NOT NULL,
    captured_at VARCHAR(64) NOT NULL,
    scope_level VARCHAR(32) NOT NULL,
    scope_id VARCHAR(128) NOT NULL,
    total_exposure DOUBLE PRECISION DEFAULT 0,
    collateral_value DOUBLE PRECISION DEFAULT 0,
    net_security_value DOUBLE PRECISION DEFAULT 0,
    required_insurance DOUBLE PRECISION DEFAULT 0,
    active_insurance DOUBLE PRECISION DEFAULT 0,
    insurance_gap DOUBLE PRECISION DEFAULT 0,
    coverage_percentage DOUBLE PRECISION DEFAULT 0,
    uninsured_collaterals_count BIGINT DEFAULT 0,
    underinsured_collaterals_count BIGINT DEFAULT 0,
    expired_policies_count BIGINT DEFAULT 0,
    open_exceptions_count BIGINT DEFAULT 0,
    total_facilities_count BIGINT DEFAULT 0,
    total_customers_count BIGINT DEFAULT 0,
    total_collaterals_count BIGINT DEFAULT 0,
    CONSTRAINT uk_snapshot_date_scope UNIQUE (snapshot_date, scope_level, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_scope ON cims_dashboard_snapshots(scope_level, scope_id, snapshot_date);
