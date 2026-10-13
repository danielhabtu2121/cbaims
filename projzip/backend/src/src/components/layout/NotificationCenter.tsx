import React from 'react';
import { X, Mail, MessageSquare, AlertCircle, CheckCircle, RotateCw } from 'lucide-react';
import { NotificationItem } from '../../types';
import { StatusChip } from './StatusChip';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onResend?: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onResend,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 37, 69, 0.4)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '100%',
          backgroundColor: '#FFFFFF',
          height: '100%',
          boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#08192E',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Notification Center</h3>
            <p style={{ fontSize: '11px', color: '#B9D3EB', margin: '2px 0 0 0' }}>
              Real-time SMS & Email Outbound Alerts ({notifications.length})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* List Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5B6B82', fontSize: '13px' }}>
              No notifications in dispatch queue.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  border: '1px solid #DCE4EE',
                  borderRadius: '8px',
                  padding: '12px',
                  backgroundColor: n.status === 'Failed' ? '#FCEAE8' : '#F4F8FD',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {n.channel === 'SMS' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#2C6295' }}>
                        <MessageSquare style={{ width: '13px', height: '13px' }} /> SMS
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#2E6FB8' }}>
                        <Mail style={{ width: '13px', height: '13px' }} /> Email
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: '#5B6B82' }}>→ {n.recipient}</span>
                  </div>
                  <StatusChip label={n.status} size="sm" />
                </div>

                {n.subject && (
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                    {n.subject}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: '#5B6B82', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {n.messageBody}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#94A3B8' }}>
                  <span>{n.sentAt?.replace('T', ' ').substring(0, 19)}</span>
                  {n.status === 'Failed' && onResend && (
                    <button
                      onClick={() => onResend(n.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#C0362C',
                        fontWeight: 600,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCw style={{ width: '12px', height: '12px' }} /> Resend
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
