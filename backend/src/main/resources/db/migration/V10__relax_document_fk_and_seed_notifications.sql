-- Migration V10: Relax document foreign key and seed real-time notification dispatch queue

-- Make collateral_id nullable and relax strict foreign key on cims_ownership_documents
ALTER TABLE cims_ownership_documents ALTER COLUMN collateral_id DROP NOT NULL;
ALTER TABLE cims_ownership_documents DROP CONSTRAINT IF EXISTS cims_ownership_documents_collateral_id_fkey;

-- Ensure all cims_notifications timestamp columns are VARCHAR(50)
ALTER TABLE cims_notifications ALTER COLUMN sent_at TYPE VARCHAR(50) USING sent_at::text;

-- Seed initial real-time notification dispatch records
INSERT INTO cims_notifications (id, channel, template_code, recipient, recipient_name, subject, message_body, entity_type, entity_id, status, sent_at, retry_count)
VALUES 
('notif-101', 'Email', 'POLICY_EXPIRY_WARNING', 'finance@midrocinvestment.et', 'Midroc Investment Group', 'URGENT: Collateral Insurance Policy Expiring in 15 Days', 'Dear Midroc Investment Group Finance Dept,\n\nYour Industrial All-Risks Policy POL-IND-2025-001 (Sum Insured: ETB 45,000,000) securing Credit Facility FAC-MIDROC-001 is scheduled to expire on 2026-09-02.\n\nPlease submit an updated renewal certificate to prevent credit limit freezing.', 'Insurance Policy', 'pol-1', 'Sent', '2026-08-18 09:30:00', 0),
('notif-102', 'SMS', 'POLICY_EXPIRY_SMS', '+251911445566', 'Midroc Finance Manager', 'CIMS Policy Expiry Alert', 'CIMS Alert: Policy POL-IND-2025-001 for Midroc HQ Building expires in 15 days. Please renew immediately to avoid facility suspension.', 'Insurance Policy', 'pol-1', 'Sent', '2026-08-18 09:31:00', 0),
('notif-103', 'Email', 'WORKFLOW_CHECKER_ALERT', 'brmgr@cims-bank.et', 'Branch Manager', 'Dual Control Authorization Required: New Collateral Registration', 'Dear Branch Manager,\n\nA new collateral asset COL-VEH-8802 (Mercedes Actros Heavy Commercial Truck) with valuation ETB 8,500,000 has been submitted by Maker CRO_USER for dual-control authorization.\n\nPlease log in to Maker-Checker Inbox to review and authorize.', 'Collateral', 'col-1', 'Sent', '2026-08-19 08:15:00', 0),
('notif-104', 'SMS', 'WORKFLOW_CHECKER_SMS', '+251911000222', 'Branch Manager', 'CIMS Approval Alert', 'CIMS Alert: Maker CRO_USER submitted Collateral COL-VEH-8802 for your authorization. Please review in CIMS Maker-Checker Inbox.', 'Collateral', 'col-1', 'Sent', '2026-08-19 08:15:30', 0),
('notif-105', 'Email', 'INSURANCE_DEFICIT_WARNING', 'cfo@habeshabrewery.et', 'Habesha Breweries S.C.', 'CIMS Notice: Underinsurance Deficit Detected on Facility', 'Dear Customer,\n\nA net insurance coverage deficit of ETB 5,000,000 has been identified on your pledged collateral asset COL-HABESHA-8888.\n\nPlease arrange supplementary insurance endorsement within 10 banking days.', 'Collateral', 'col-2', 'Sent', '2026-08-19 09:00:00', 0);
