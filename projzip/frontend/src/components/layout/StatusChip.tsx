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
 * A soft-tint status pill with a small color dot - the modern, low-noise pattern used
 * across today's SaaS dashboards. Color is resolved from the label when not given
 * explicitly, so existing call sites (which mostly just pass a status string) keep
 * working unchanged.
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
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-line)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-line)' },
    danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger-line)' },
    info:    { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'var(--info-line)' },
    neutral: { bg: '#F1F4F8',           color: '#475467',        border: '#DDE3EA' },
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
