import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Apple, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Login({ isSignup }) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/home');
    });
  }, [navigate]);

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin + '/config'
      }
    });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            username: username,
          }
        }
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Account created successfully! Please check your email inbox to confirm your email address before logging in.');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        if (email.trim()) localStorage.setItem('aegis_user_email', email.trim());
        const userMeta = data.user?.user_metadata;
        if (userMeta && userMeta.first_name) {
          localStorage.setItem('aegis_user_name', `${userMeta.first_name} ${userMeta.last_name || ''}`);
        } else if (!localStorage.getItem('aegis_user_name') && email.trim()) {
          const derived = email.split('@')[0];
          const formatted = derived.charAt(0).toUpperCase() + derived.slice(1);
          localStorage.setItem('aegis_user_name', formatted);
        }
        
        // Ensure profile is inserted
        const username_from_meta = userMeta?.username || email.split('@')[0];
        if (data.user) {
          await supabase.from('profiles').insert([{ id: data.user.id, username: username_from_meta }]).catch(() => null);
        }

        navigate('/config');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Left Branding Panel - Dribbble Style */}
      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          position: 'relative',
          overflow: 'hidden',
          padding: '40px',
        }} 
        className="hide-on-mobile"
      >
        <style>
          {`
            @media (max-width: 900px) {
              .hide-on-mobile {
                display: none !important;
              }
            }
            .input-field-dribbble {
              width: 100%;
              min-height: 48px;
              padding: 14px 16px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.1);
              background: rgba(255,255,255,0.03);
              color: white;
              font-size: 15px;
              transition: all 0.2s ease;
              box-sizing: border-box;
            }
            .input-field-dribbble:focus {
              outline: none;
              border-color: #10b981;
              background: rgba(255,255,255,0.08);
              box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
            }
            .social-btn {
              background: #fff;
              color: #000;
              border: none;
              display: flex;
              gap: 12px;
              padding: 16px;
              border-radius: 30px;
              font-weight: 600;
              font-size: 15px;
              justify-content: center;
              align-items: center;
              transition: all 0.2s;
              cursor: pointer;
              width: 100%;
            }
            .social-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(255,255,255,0.1);
            }
            .social-btn.apple {
              background: #111;
              color: #fff;
              border: 1px solid rgba(255,255,255,0.15);
            }
            .social-btn.apple:hover {
              background: #1a1a1a;
            }
            .label-text {
              display: block;
              font-size: 14px;
              margin-bottom: 8px;
              font-weight: 600;
              color: #eee;
            }
          `}
        </style>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', zIndex: 10 }}>
          <Shield size={36} />
          <span style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Aegis AI</span>
        </div>
        
        <div style={{ color: 'white', zIndex: 10, maxWidth: '500px', marginBottom: '10%' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '800', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
            Detect. Prevent.<br/>Secure.
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.5, fontWeight: 400 }}>
            Advanced multi-channel phishing detection powered by real-time artificial intelligence. Join thousands protecting their digital footprint today.
          </p>
        </div>
        
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, transparent 60%)', borderRadius: '50%' }}></div>
      </div>

      {/* Right Form Panel */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative'
      }}>
        
        <div style={{ position: 'absolute', top: '40px', right: '40px', fontSize: '14px' }}>
          {isSignup ? "Already a member? " : "Not a member? "}
          <span 
            style={{ color: '#10b981', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            onClick={() => navigate(isSignup ? '/login' : '/signup')}
          >
            {isSignup ? "Sign In" : "Sign up now"}
          </span>
        </div>

        <div style={{ width: '100%', maxWidth: '420px', marginTop: '60px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '32px', color: '#fff', letterSpacing: '-0.5px' }}>
            {isSignup ? "Sign up to Aegis" : "Sign in to Aegis"}
          </h1>

          {/* OAuth Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <button type="button" onClick={() => handleOAuthLogin('google')} className="social-btn">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" style={{ width: '20px' }} />
              Sign {isSignup ? 'up' : 'in'} with Google
            </button>
            <button type="button" onClick={() => handleOAuthLogin('apple')} className="social-btn apple">
              <Apple size={22} fill="white" />
              Sign {isSignup ? 'up' : 'in'} with Apple
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0', color: '#666' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ padding: '0 16px', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
              or sign in with email
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          {/* Error/Success Messages */}
          {errorMsg && <div style={{ color: '#ef4444', marginBottom: '24px', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}
          {successMsg && <div style={{ color: '#10b981', marginBottom: '24px', fontSize: '14px', background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isSignup && (
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label-text">First Name</label>
                  <input 
                    type="text" 
                    required 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-field-dribbble"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label-text">Last Name</label>
                  <input 
                    type="text" 
                    required 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-field-dribbble"
                  />
                </div>
              </div>
            )}
            
            {isSignup && (
              <div>
                <label className="label-text">Username</label>
                <input 
                  type="text" 
                  required 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field-dribbble"
                />
              </div>
            )}
            
            <div>
              <label className="label-text">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field-dribbble"
              />
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="label-text">Password</label>
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
                className="input-field-dribbble" 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                marginTop: '12px', 
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                color: 'white',
                border: 'none', 
                padding: '18px', 
                borderRadius: '30px', 
                fontSize: '16px', 
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)'
              }}
              onMouseOver={(e) => {
                if(!loading) e.currentTarget.style.transform = 'translateY(-2px)';
                if(!loading) e.currentTarget.style.boxShadow = '0 12px 24px rgba(16, 185, 129, 0.35)';
              }}
              onMouseOut={(e) => {
                if(!loading) e.currentTarget.style.transform = 'translateY(0)';
                if(!loading) e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.25)';
              }}
            >
              {loading ? "Please wait..." : (isSignup ? "Create account" : "Sign In")}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}
