-- Migration V33: Notification integrations for Outlook and SMS with delivery tracking
ALTER TABLE cims_notifications ADD COLUMN IF NOT EXISTS channel_provider VARCHAR(50) DEFAULT 'SIMULATOR';
ALTER TABLE cims_notifications ADD COLUMN IF NOT EXISTS delivery_reference VARCHAR(150);
ALTER TABLE cims_notifications ADD COLUMN IF NOT EXISTS read_status VARCHAR(20) DEFAULT 'UNREAD';
ALTER TABLE cims_notifications ADD COLUMN IF NOT EXISTS read_at VARCHAR(50);

-- Indexes for notification querying
CREATE INDEX IF NOT EXISTS idx_cims_notifications_channel ON cims_notifications (channel);
CREATE INDEX IF NOT EXISTS idx_cims_notifications_read_status ON cims_notifications (read_status);

-- Seed Outlook (Microsoft Graph / Office 365) and SMS Gateway parameters in cims_system_parameters
INSERT INTO cims_system_parameters (param_key, param_value, description, param_type)
VALUES
  ('notification_outlook_enabled', 'true', 'Enable Microsoft Outlook / Office 365 Email integration', 'boolean'),
  ('notification_outlook_provider', 'SIMULATOR', 'Outlook provider mode: SIMULATOR, MICROSOFT_GRAPH, or OFFICE365_SMTP', 'string'),
  ('notification_outlook_tenant_id', 'cims-bank-aad-tenant-id', 'Microsoft Azure AD Tenant ID for MS Graph API', 'string'),
  ('notification_outlook_client_id', 'cims-bank-app-client-id', 'Microsoft Azure AD Application (Client) ID', 'string'),
  ('notification_outlook_client_secret', 'cims-secret-key-encrypted', 'Microsoft Azure AD Client Secret', 'password'),
  ('notification_outlook_sender_email', 'cims-notifications@cims-bank.et', 'Authoritative Outlook mailbox sender address', 'string'),
  ('notification_outlook_smtp_host', 'smtp.office365.com', 'Office 365 SMTP relay host', 'string'),
  ('notification_outlook_smtp_port', '587', 'Office 365 SMTP port (587 for STARTTLS)', 'numeric'),
  ('notification_outlook_smtp_starttls', 'true', 'Require STARTTLS encryption for SMTP', 'boolean'),
  ('notification_sms_enabled', 'true', 'Enable Enterprise SMS Gateway integration', 'boolean'),
  ('notification_sms_provider', 'SIMULATOR', 'SMS provider mode: SIMULATOR, ETHIO_TELECOM_REST, TWILIO_REST, or HTTP_GATEWAY', 'string'),
  ('notification_sms_gateway_url', 'https://sms.ethiotelecom.et/api/v1/send', 'Ethio Telecom / Enterprise SMS Gateway API endpoint', 'string'),
  ('notification_sms_api_key', 'ethio-cims-sms-key-live', 'SMS Gateway API authentication token / key', 'password'),
  ('notification_sms_sender_id', 'CIMS-BANK', 'Registered SMS Shortcode / Alpha Sender ID', 'string'),
  ('notification_sms_max_concat_parts', '3', 'Maximum concatenated SMS parts allowed per dispatch', 'numeric')
ON CONFLICT (param_key) DO UPDATE
SET description = EXCLUDED.description, param_type = EXCLUDED.param_type;
