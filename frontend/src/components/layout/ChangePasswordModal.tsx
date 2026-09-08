import React, { useState } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (oldPass: string, newPass: string) => Promise<boolean>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isPolicySatisfied = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPolicySatisfied) {
      setError('Please satisfy all password policy requirements.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const ok = await onSubmit(currentPassword, newPassword);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setError('Incorrect current password.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 37, 69, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '450px',
          maxWidth: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #DCE4EE',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key style={{ width: '18px', height: '18px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Change User Password</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{ padding: '8px 12px', backgroundColor: '#FCEAE8', border: '1px solid #F5B8B3', color: '#C0362C', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle style={{ width: '14px', height: '14px' }} />
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '8px 12px', backgroundColor: '#E5F6ED', border: '1px solid #A6E5C5', color: '#1E8E5A', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check style={{ width: '14px', height: '14px' }} />
              Password updated successfully!
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                Current Password (M)
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DCE4EE', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                New Password (M)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DCE4EE', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                Confirm New Password (M)
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DCE4EE', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Password Policy Live Checklist */}
          <div style={{ backgroundColor: '#F4F8FD', border: '1px solid #DCE4EE', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5B6B82', marginBottom: '6px' }}>
              Security Policy Requirements:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
              <div style={{ color: hasMinLength ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hasMinLength ? '✔' : '⚪'} At least 8 characters
              </div>
              <div style={{ color: hasUpperCase ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hasUpperCase ? '✔' : '⚪'} 1 Uppercase letter
              </div>
              <div style={{ color: hasLowerCase ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hasLowerCase ? '✔' : '⚪'} 1 Lowercase letter
              </div>
              <div style={{ color: hasNumber ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hasNumber ? '✔' : '⚪'} 1 Number
              </div>
              <div style={{ color: hasSpecial ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hasSpecial ? '✔' : '⚪'} 1 Special character
              </div>
              <div style={{ color: passwordsMatch ? '#1E8E5A' : '#5B6B82', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {passwordsMatch ? '✔' : '⚪'} Passwords match
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={!isPolicySatisfied || loading} className="btn-primary">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
