import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { saveUsername } from '../utils/userStorage';
import { isGmailAddress, mapAuthError, isEmailVerified, getPostLoginPath } from '../utils/authHelpers';
import '../styles/login.css';

export default function Login({ isSignup }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      
      // Store the user's email from OAuth login (like Google)
      if (session.user?.email) {
        localStorage.setItem('aegis_user_email', session.user.email);
      }
      
      const path = getPostLoginPath(session, session.user?.email || '');
      if (path === '/verify-email') {
        navigate(path, { state: { email: session.user?.email, username: session.user?.user_metadata?.username } });
      } else {
        navigate(path);
      }
    });
  }, [navigate]);

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setErrorMsg('');
    localStorage.setItem('aegis_auth_method', 'oauth');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/home`,
      },
    });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (isSignup) {
      if (!isGmailAddress(normalizedEmail)) {
        setErrorMsg('Please use a Gmail address (@gmail.com or @googlemail.com). One account per Gmail.');
        setLoading(false);
        return;
      }
      if (!username.trim()) {
        setErrorMsg('Please choose a username.');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: { username: username.trim() },
        },
      });

      if (error) {
        setErrorMsg(mapAuthError(error.message));
      } else {
        localStorage.setItem('aegis_auth_method', 'email');
        setSuccessMsg('');
        navigate('/verify-email', {
          state: { email: normalizedEmail, username: username.trim() },
        });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (error) {
        setErrorMsg(mapAuthError(error.message));
      } else if (data.session && !isEmailVerified(data.session)) {
        navigate('/verify-email', {
          state: {
            email: normalizedEmail,
            username: data.user?.user_metadata?.username,
          },
        });
      } else if (data.session) {
        localStorage.setItem('aegis_user_email', normalizedEmail);
        localStorage.setItem('aegis_auth_method', 'email');
        const userMeta = data.user?.user_metadata;
        if (userMeta?.username) saveUsername(userMeta.username);

        if (data.user?.id && typeof supabase.from === 'function') {
          supabase
            .from('profiles')
            .upsert(
              { id: data.user.id, username: userMeta?.username || username.trim() },
              { onConflict: 'id' }
            )
            .then(() => null)
            .catch(() => null);
        }

        navigate('/home');
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-root">

      {/* Left Branding Panel - Dribbble Style */}
      <div className="login-brand-panel login-hide-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', zIndex: 10 }}>
          <Shield size={36} />
          <span style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Aegis AI</span>
        </div>

        <div style={{ color: 'white', zIndex: 10, maxWidth: '500px', marginBottom: '10%' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '800', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
            Detect. Prevent.<br />Secure.
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.5, fontWeight: 400 }}>
            Advanced multi-channel threat detection powered by real-time artificial intelligence. An educational cybersecurity awareness platform for everyone.
          </p>
        </div>

        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
      </div>

      <div className="login-form-panel">

        <div style={{ position: 'absolute', top: '40px', right: '40px', fontSize: '14px' }}>
          {isSignup ? "Already a member? " : "Not a member? "}
          <span
            style={{ color: '#10b981', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            onClick={() => navigate(isSignup ? '/login' : '/signup')}
          >
            {isSignup ? "Sign In" : "Sign up now"}
          </span>
        </div>

        <div className="login-form-inner">
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '32px', color: '#fff', letterSpacing: '-0.5px' }}>
            {isSignup ? "Sign up to Aegis" : "Sign in to Aegis"}
          </h1>

          {isSignup && (
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
              Sign up with Google or Apple — no username needed. Use the Gmail form below to pick a username and verify by code.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <button type="button" onClick={() => handleOAuthLogin('google')} className="login-social-btn login-oauth-btn">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" style={{ width: '20px' }} />
              Sign {isSignup ? 'up' : 'in'} with Google
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0', color: '#666' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ padding: '0 16px', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {isSignup ? 'or sign up with Gmail' : 'or sign in with email'}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          {/* Error/Success Messages */}
          {errorMsg && <div style={{ color: '#ef4444', marginBottom: '24px', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}
          {successMsg && <div style={{ color: '#10b981', marginBottom: '24px', fontSize: '14px', background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isSignup && (
              <div>
                <label className="label-text login-field">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input-dribbble login-field"
                  maxLength={32}
                  placeholder="Your display name on Aegis"
                />
              </div>
            )}

            <div>
              <label className="label-text login-field">{isSignup ? 'Gmail address' : 'Email Address'}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input-dribbble login-field"
                placeholder="you@gmail.com"
              />
              {isSignup && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                  We send a 6-digit code to verify your Gmail. One account per address.
                </p>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="label-text login-field">Password</label>
                {!isSignup && (
                  <span style={{ fontSize: '13px', color: '#10b981', cursor: 'pointer', fontWeight: 500 }}>
                    Forgot password?
                  </span>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input-dribbble login-field"
              />
            </div>

            {isSignup && (
              <div>
                <label className="label-text login-field">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input-dribbble login-field"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn login-field"
              style={{
                marginTop: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                padding: '18px',
                borderRadius: '30px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.25s ease',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                width: '100%',
              }}
            >
              {loading ? 'Please wait...' : isSignup ? 'Send verification code' : 'Sign In'}
            </button>
          </form>

          {/* Trust & transparency notice */}
          <div style={{ marginTop: '24px', fontSize: '12px', color: '#475569', lineHeight: 1.6, textAlign: 'center' }}>
            🔒 Authentication is powered by{' '}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Supabase</a>.
            Aegis AI never sees or stores your password.
          </div>

          {/* Legal links */}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px' }}>
            <Link to="/privacy" style={{ color: '#475569', textDecoration: 'underline' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: '#475569', textDecoration: 'underline' }}>Terms of Service</Link>
            <Link to="/about" style={{ color: '#475569', textDecoration: 'underline' }}>About</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
