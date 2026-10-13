import React from 'react';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 100,
  strokeWidth = 10,
  label,
  showPercentage = true,
}) => {
  const clamped = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  let color = '#1E8E5A'; // Green >= 100%
  let trackColor = '#E5F6ED';
  if (value < 70) {
    color = '#C0362C'; // Red < 70%
    trackColor = '#FCEAE8';
  } else if (value < 100) {
    color = '#B8860B'; // Amber 70-99%
    trackColor = '#FFF6DF';
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Bar */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          {showPercentage && (
            <span style={{ fontSize: size > 80 ? '16px' : '12px', fontWeight: 700, color: '#0F172A' }} className="tabular-nums">
              {value.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {label && <span style={{ fontSize: '11px', color: '#5B6B82', fontWeight: 600 }}>{label}</span>}
    </div>
  );
};
