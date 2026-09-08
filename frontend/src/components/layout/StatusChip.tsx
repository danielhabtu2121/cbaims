import React from 'react';

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface StatusChipProps {
  label: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
}

/**
 * A record-status indicator styled after a bank ink stamp - a deliberate nod to the
 * maker-checker process this app enforces: nothing is "live" until someone stamps it.
 * Approved/Open reads as a green stamp, Pending/Draft as an amber "awaiting seal" stamp,
 * Rejected/Expired as a red ink stamp - reinforcing the authorization states at a glance.
 */
export const StatusChip: React.FC<StatusChipProps> = ({ label, variant, size = 'sm' }) => {
  let resolvedVariant: StatusVariant = variant || 'neutral';

  if (!variant) {
    const l = (label || '').toLowerCase();
    if (l.includes('insured') && !l.includes('under') && !l.includes('un')) resolvedVariant = 'success';
    else if (l.includes('active') || l.includes('approved') || l.includes('verified') || l.includes('synced') || l.includes('fully') || l === 'o' || l === 'a') resolvedVariant = 'success';
    else if (l.includes('pending') || l.includes('expiring') || l.includes('under') || l.includes('draft') || l.includes('returned') || l === 'u') resolvedVariant = 'warning';
    else if (l.includes('expired') || l.includes('uninsured') || l.includes('rejected') || l.includes('failed') || l.includes('critical') || l.includes('default') || l.includes('blocked') || l === 'r') resolvedVariant = 'danger';
    else if (l.includes('info') || l.includes('progress') || l.includes('review')) resolvedVariant = 'info';
    else resolvedVariant = 'neutral';
  }

  const styles: Record<StatusVariant, { bg: string; color: string; border: string }> = {
    success: { bg: '#EAF4EC', color: '#1F5D45', border: '#9FC7AE' },
    warning: { bg: '#FBF1DE', color: '#8A5A17', border: '#E0BD79' },
    danger: { bg: '#FBEAE9', color: '#A6332F', border: '#E3A6A2' },
    info: { bg: '#E9EEF4', color: '#2E4F6B', border: '#B3C4D6' },
    neutral: { bg: '#EEECE4', color: '#5B5646', border: '#D8D2C2' },
  };

  const current = styles[resolvedVariant];

  return (
    <span
      className="stamp-chip"
      style={{
        backgroundColor: current.bg,
        color: current.color,
        borderColor: current.border,
        padding: size === 'sm' ? '2px 10px' : '4px 13px',
        fontSize: size === 'sm' ? '10.5px' : '11.5px',
      }}
    >
      <span className="stamp-chip-dot" style={{ backgroundColor: current.color }} />
      {label}
    </span>
  );
};
