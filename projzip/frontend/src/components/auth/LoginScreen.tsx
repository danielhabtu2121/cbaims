import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { UserSession } from '../../types';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onSelectPersona: (persona: UserSession) => void;
  availablePersonas: UserSession[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onSelectPersona,
  availablePersonas,
}) => {
  const [username, setUsername] = useState('brmgr_user');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await onLogin(username, password);
      if (!ok) {
        setError('Invalid credentials or account is locked.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--canvas)',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)',
        backgroundSize: '24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #DCE4EE',
          boxShadow: '0 10px 25px -5px rgba(11, 37, 69, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            backgroundColor: '#0E284E',
            padding: '28px 24px',
            textAlign: 'center',
            color: '#FFFFFF',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8B6BFF 0%, #6D4FE0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <Shield style={{ width: '28px', height: '28px', color: '#FFFFFF' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-body)', fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '0.3px' }}>
            CDIMS Enterprise
          </h1>
          <p style={{ fontSize: '11px', color: '#B9D3EB', margin: '5px 0 0 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Collateral Document &amp; Insurance Management · Maker-Checker Controlled
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px 24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#FCEAE8',
                border: '1px solid #F5B8B3',
                color: '#C0362C',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
                Username / Staff ID (M)
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: '#5B6B82' }} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. brmgr_user"
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '6px',
                    border: '1px solid #DCE4EE',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                  Password (M)
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact the IT Helpdesk or your System Administrator to reset credentials.');
                  }}
                  style={{ fontSize: '11px', color: '#7C5CFC', textDecoration: 'none', fontWeight: 600 }}
                >
                  Forgot Password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: '#5B6B82' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 36px',
                    borderRadius: '6px',
                    border: '1px solid #DCE4EE',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#5B6B82',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  {showPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px',
                fontSize: '14px',
                marginTop: '8px',
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In to CDIMS'}
            </button>
          </form>

          {/* Quick Persona Selector for Testing */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #DCE4EE' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5B6B82', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Quick Persona Sign-In (Simulator)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {availablePersonas.slice(0, 6).map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => onSelectPersona(p)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#F4F8FD',
                    border: '1px solid #DCE4EE',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#08192E',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{p.role}</span>
                  <ArrowRight style={{ width: '11px', height: '11px', color: '#2E6FB8' }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#F4F8FD',
            borderTop: '1px solid #DCE4EE',
            textAlign: 'center',
            fontSize: '11px',
            color: '#5B6B82',
          }}
        >
          Protected Bank System — Unauthorized access is prohibited and audited.
        </div>
      </div>
    </div>
  );
};
