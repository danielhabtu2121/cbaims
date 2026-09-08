import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  secondsRemaining?: number;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  onStayLoggedIn,
  onLogout,
  secondsRemaining = 120,
}) => {
  const [countdown, setCountdown] = useState(secondsRemaining);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(secondsRemaining);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, secondsRemaining, onLogout]);

  if (!isOpen) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 37, 69, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #DCE4EE',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FFF6DF',
            color: '#B8860B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}
        >
          <Clock style={{ width: '26px', height: '26px' }} />
        </div>

        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>
          Session Inactivity Warning
        </h3>

        <p style={{ fontSize: '13px', color: '#5B6B82', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Your active CIMS session will automatically terminate in{' '}
          <strong style={{ color: '#C0362C' }}>
            {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
          </strong>{' '}
          due to inactivity per bank security policy.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={onStayLoggedIn} className="btn-primary" style={{ flex: 1 }}>
            Stay Logged In
          </button>
          <button onClick={onLogout} className="btn-secondary" style={{ flex: 1 }}>
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
};
