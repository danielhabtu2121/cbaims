-- V17: DMS document storage and versioning support for cims_ownership_documents

ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS file_content TEXT;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS parent_document_id VARCHAR(64);
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS version_notes TEXT;
ALTER TABLE cims_ownership_documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_cims_docs_parent ON cims_ownership_documents (parent_document_id);
CREATE INDEX IF NOT EXISTS idx_cims_docs_entity ON cims_ownership_documents (entity_type, entity_id);
