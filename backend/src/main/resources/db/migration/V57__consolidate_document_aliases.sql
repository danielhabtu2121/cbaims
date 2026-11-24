-- V57: Consolidate admin document-rule aliases that describe the same physical document.
-- One confirmed file now satisfies the consolidated requirement:
--   * Title Deed / Approved Plan / Property Ownership Certificate
--   * Third-Party Consent / Pledge Agreement / Letter of Consent
-- Legacy alias rows are retained for history but deactivated so the checklist,
-- backend validation and exception rules all use a single canonical requirement.

UPDATE cims_mandatory_document_rules
   SET document_type = 'Title Deed / Approved Plan / Property Ownership Certificate',
       active = true
 WHERE id = 'doc-r-title-deed';

UPDATE cims_mandatory_document_rules
   SET active = false
 WHERE id <> 'doc-r-title-deed'
   AND (
        id IN ('doc-r-building-plan', 'doc-r2')
        OR lower(coalesce(document_type, '')) LIKE '%approved plan%'
        OR lower(coalesce(document_type, '')) LIKE '%building plan%'
   );

UPDATE cims_mandatory_document_rules
   SET document_type = 'Third-Party Consent / Pledge Agreement / Letter of Consent',
       active = true
 WHERE id IN ('doc-r-tp-pledge', 'doc-rule-tp-pledge');

UPDATE cims_mandatory_document_rules
   SET active = false
 WHERE id NOT IN ('doc-r-tp-pledge', 'doc-rule-tp-pledge')
   AND lower(coalesce(document_type, '')) LIKE '%consent%';
