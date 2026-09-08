-- V20__add_collateral_owner_consent_and_pledge.sql
-- Add consent_info and pledge_agreement_ref to cims_collateral_owners

ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS consent_info TEXT;
ALTER TABLE cims_collateral_owners ADD COLUMN IF NOT EXISTS pledge_agreement_ref VARCHAR(100);
