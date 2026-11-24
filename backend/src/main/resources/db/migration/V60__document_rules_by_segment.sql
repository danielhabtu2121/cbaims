-- V60: Mandatory document rules by business segment
--
-- Adds an explicit segment scope to each rule so administrators can define a
-- requirement either for one business segment or for every segment.
--
-- Precedence when resolving requirements for a collateral:
--   1. Active segment-specific rules (rule.segment = collateral.owning_segment)
--   2. Active global rules (rule.segment = 'All Segments' / NULL / blank)
-- Both scopes are combined; duplicates are collapsed by document type so a
-- document is only ever required once. Inactive rules never participate.

ALTER TABLE cims_mandatory_document_rules
    ADD COLUMN IF NOT EXISTS segment VARCHAR(100);

-- Existing rows keep working as global requirements.
UPDATE cims_mandatory_document_rules
   SET segment = 'All Segments'
 WHERE segment IS NULL OR BTRIM(segment) = '';

-- Seed exactly three mandatory documents for each of the two core collateral
-- categories, applying to All Segments (six rules total, not per-segment copies).
INSERT INTO cims_mandatory_document_rules
    (id, segment, collateral_category, collateral_type, document_type,
     ownership_condition, applicability_condition, mandatory, exception_allowed, active)
VALUES
    ('doc-r-all-immo-1', 'All Segments', 'Immovable Properties', 'All',
     'Title Deed / Approved Plan / Property Ownership Certificate',
     'Any', 'Standard', true, true, true),
    ('doc-r-all-immo-2', 'All Segments', 'Immovable Properties', 'All',
     'Approved Building Plan',
     'Any', 'Standard', true, true, true),
    ('doc-r-all-immo-3', 'All Segments', 'Immovable Properties', 'All',
     'Valuation Report',
     'Any', 'Standard', true, true, true),
    ('doc-r-all-move-1', 'All Segments', 'Movable Properties', 'All',
     'Vehicle Registration Certificate',
     'Any', 'Standard', true, true, true),
    ('doc-r-all-move-2', 'All Segments', 'Movable Properties', 'All',
     'Machinery Ownership Certificate',
     'Any', 'Standard', true, true, true),
    ('doc-r-all-move-3', 'All Segments', 'Movable Properties', 'All',
     'Purchase Document',
     'Any', 'Standard', true, true, true)
ON CONFLICT (id) DO UPDATE SET
    segment = EXCLUDED.segment,
    collateral_category = EXCLUDED.collateral_category,
    collateral_type = EXCLUDED.collateral_type,
    document_type = EXCLUDED.document_type,
    ownership_condition = EXCLUDED.ownership_condition,
    applicability_condition = EXCLUDED.applicability_condition,
    mandatory = EXCLUDED.mandatory,
    exception_allowed = EXCLUDED.exception_allowed,
    active = EXCLUDED.active;
