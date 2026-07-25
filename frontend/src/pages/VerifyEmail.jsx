import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { saveUsername } from '../utils/userStorage';
import { mapAuthError } from '../utils/authHelpers';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state?.email || '').trim().toLowerCase();
  const username = (location.state?.username || '').trim();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState(
    email
      ? `We sent a 6-digit verification code to ${email}. Enter it below to confirm your Gmail.`
      : 'Enter the verification code from your email.'
  );

  if (!email) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <p>No email address found. Please sign up again.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/signup')}>
            Back to sign up
          </button>
        </div>
      </div>
    );
  }

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const token = code.replace(/\D/g, '').slice(0, 6);
    if (token.length !== 6) {
      setErrorMsg('Please enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      const fallback = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      setErrorMsg(mapAuthError(error.message));
      setLoading(false);
      return;
    }

    if (username) saveUsername(username);
    else if (data.user?.user_metadata?.username) saveUsername(data.user.user_metadata.username);

    localStorage.setItem('aegis_user_email', email);
    localStorage.setItem('aegis_auth_method', 'email');
    setLoading(false);
    navigate('/home', { replace: true });
  };

  const handleResend = async () => {
    setErrorMsg('');
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setResendLoading(false);
    if (error) {
      setErrorMsg(mapAuthError(error.message));
    } else {
      setInfoMsg(`A new code was sent to ${email}.`);
    }
  };

  return (
    <div
      className="config-page-enter"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: '40px 32px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Verify your Gmail</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{infoMsg}</p>

        {errorMsg && (
          <div
            style={{
              color: '#ef4444',
              marginBottom: 16,
              fontSize: 14,
              background: 'rgba(239, 68, 68, 0.1)',
              padding: 12,
              borderRadius: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input-field"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ textAlign: 'center', fontSize: 28, letterSpacing: 8, marginBottom: 16 }}
            maxLength={6}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>

        <button
          type="button"
          className="btn"
          style={{ marginTop: 16, background: 'transparent', color: 'var(--text-muted)' }}
          onClick={handleResend}
          disabled={resendLoading}
        >
          {resendLoading ? 'Sending…' : 'Resend code'}
        </button>

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          Already verified?{' '}
          <span style={{ color: '#10b981', cursor: 'pointer' }} onClick={() => navigate('/login')}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}
