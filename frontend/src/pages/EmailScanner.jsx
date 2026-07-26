import { useState, useEffect } from 'react';
import { Mail, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Link as LinkIcon, Key, Lock, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { pushLocalDataToCloud } from '../utils/userStorage';



export default function EmailScanner() {
  const [emails, setEmails] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Real Gmail Sync States
  const [gmailAddress, setGmailAddress] = useState(() => localStorage.getItem('aegis_gmail_address') || '');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const fetchEmails = () => {
    handleRealGmailFetch();
  };

  const handleRealGmailFetch = async () => {
    if (!gmailAddress || !appPassword) {
      setSyncError("Gmail address and App Password are required.");
      return;
    }

    setIsFetching(true);
    setSyncError(null);
    setEmails([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(apiUrl('/api/gmail/fetch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: gmailAddress, app_password: appPassword }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Safely parse JSON — some errors return HTML or plain text
      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          setSyncError('Server returned an invalid response. It may be restarting — please try again in 30 seconds.');
          setIsFetching(false);
          return;
        }
      } else {
        // Non-JSON response (e.g., Render cold start HTML page, 502 proxy error)
        const text = await response.text();
        console.error('Non-JSON response:', response.status, text.substring(0, 200));
        setSyncError(`Server returned an unexpected response (HTTP ${response.status}). The backend may be starting up — please try again in 30 seconds.`);
        setIsFetching(false);
        return;
      }

      if (!response.ok) {
        // Non-200 status with JSON body
        setSyncError(data?.error || data?.detail || `Server error (HTTP ${response.status})`);
        setIsFetching(false);
      } else if (data.error) {
        setSyncError(data.error);
        setIsFetching(false);
      } else if (data.emails) {
        localStorage.setItem('aegis_gmail_address', gmailAddress);
        setEmails(data.emails);
        if (data.emails.length === 0) {
          setSyncError('No emails found in your inbox.');
        }
        setIsFetching(false);
      } else {
        setSyncError("Received an unexpected response format from the server.");
        setIsFetching(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Gmail fetch error:', err);

      if (err.name === 'AbortError') {
        setSyncError('Request timed out. The server may be waking up (free tier cold start). Please try again in 30 seconds.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setSyncError('Cannot reach the backend server. Check your internet connection or ensure the backend is running.');
      } else {
        setSyncError(`Connection error: ${err.message || 'Unknown error'}. Please try again.`);
      }
      setIsFetching(false);
    }
  };

  useEffect(() => {
    // Process queue sequentially
    const scanNext = async () => {
      const pendingEmail = emails.find(e => e.status === 'PENDING');
      if (!pendingEmail) return;

      // Update state to scanning
      setEmails(prev => prev.map(e => e.id === pendingEmail.id ? { ...e, status: 'SCANNING' } : e));

      // Artificial delay so the user can visually see the AI "thinking" 
      await new Promise(r => setTimeout(r, 800));

      try {
        const payload = `${pendingEmail.from}\n${pendingEmail.subject}\n\n${pendingEmail.body}`;
        const response = await fetch(apiUrl('/api/scan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: payload })
        });
        const data = await response.json();

        setEmails(prev => prev.map(e => e.id === pendingEmail.id ? { ...e, status: 'DONE', result: data } : e));
        
        // Save to History
        try {
          const safeData = {
            id: Date.now() + Math.random(),
            text: `Subject: ${pendingEmail.subject}`,
            type: "Email",
            date: new Date().toLocaleString(),
            risk: data.risk,
            label: data.label,
            reason: data.reason || '',
            confidence: data.confidence !== undefined ? data.confidence : 0,
            detected_keywords: data.detected_keywords || [],
            suspicious_links: data.suspicious_links || []
          };
          const existing = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
          localStorage.setItem('aegis_scan_history', JSON.stringify([safeData, ...existing]));
          pushLocalDataToCloud().catch(() => null);
        } catch (e) {
          console.error("Failed to save to history", e);
        }
      } catch (err) {
        console.error("Scan error:", err);
        setEmails(prev => prev.map(e => e.id === pendingEmail.id ? { ...e, status: 'ERROR', result: { risk: "ERROR", reason: "Backend connection failed" } } : e));
      }
    };

    scanNext();
  }, [emails]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="animate-slide-up">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={32} color="#FF6B00" /> Inbox Sandbox
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Scan your emails with Aegis AI NLP engines to flag phishing attempts and scams instantly.</p>
        </div>

        {/* Only show refresh button if we already have emails loaded */}
        {emails.length > 0 && (
          <button className="btn btn-primary" onClick={fetchEmails} disabled={isFetching} style={{ width: 'auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Syncing..." : "Resync Gmail"}
          </button>
        )}
      </div>



      {/* Educational disclaimer — not a credential harvest */}
      <div
        data-educational="true"
        style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          fontSize: '14px',
          lineHeight: 1.5,
          maxWidth: '900px',
        }}
      >
        <ShieldAlert size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)' }}>This is not a login page.</strong>{' '}
          Aegis AI is an educational tool. Your Gmail App Password is sent directly to our backend
          to read inbox messages for scam analysis — it is never stored or shared. You can revoke
          the App Password at any time from your Google Account settings.
        </p>
      </div>

      {/* Main Content Area */}
      {emails.length === 0 ? (
        /* Real Gmail Login Form */
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '32px', textAlign: 'left', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255, 107, 0, 0.1)', padding: '12px', borderRadius: '12px', color: '#FF6B00', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Lock size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Secure Gmail Connection</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Connect your personal Gmail inbox to run real-time local scam checks.</p>
            </div>
          </div>

          {syncError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', fontSize: '14px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>{syncError}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.75px', color: 'var(--text-muted)', marginBottom: '8px' }}>Gmail Address</label>
              <input
                type="email"
                placeholder="your.email@gmail.com"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                autoComplete="off"
                name="aegis-gmail-address"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.75px', color: 'var(--text-muted)', marginBottom: '8px' }}>Google App Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  autoComplete="off"
                  name="aegis-app-password"
                  style={{ width: '100%', padding: '12px 48px 12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', letterSpacing: showPassword ? 'normal' : '4px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', color: '#FF6B00', fontWeight: 600, fontSize: '13px' }}>
                <HelpCircle size={16} /> How do I get a Google App Password?
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                <li>Go to your <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer" style={{ color: '#FF6B00', textDecoration: 'underline' }}>Google Account settings</a>.</li>
                <li>Enable <strong>2-Step Verification</strong> under the Security section.</li>
                <li>Search for <strong>"App passwords"</strong> in the search bar.</li>
                <li>Create a password: select <em>Other</em>, name it <em>Aegis AI</em>.</li>
                <li>Copy the <strong>16-character code</strong> and paste it above!</li>
              </ol>
            </div>

            <button
              onClick={handleRealGmailFetch}
              disabled={isFetching || !gmailAddress || !appPassword}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', borderRadius: '8px', marginTop: '8px', fontWeight: 600, fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              {isFetching ? <RefreshCw size={18} className="animate-spin" /> : "Connect & Scan Gmail Inbox"}
            </button>
          </div>
        </div>
      ) : (
        /* Email List Card */
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {emails.length === 0 ? (
            <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Mail size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <h3>Inbox Empty</h3>
              <p>Click "Fetch Emails" to load the dataset and begin automatic ML analysis.</p>
            </div>
          ) : (
            <div>
              {/* Dynamic stats bar in premium aesthetics */}
              <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Loaded {emails.length} emails from {gmailAddress}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Status:
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                    background: emails.some(e => e.status !== 'DONE') ? 'var(--accent-primary)' : 'var(--safe-green)',
                    boxShadow: emails.some(e => e.status !== 'DONE') ? '0 0 8px var(--accent-primary)' : '0 0 8px var(--safe-green)'
                  }} />
                  {emails.some(e => e.status !== 'DONE') ? 'Scanning...' : 'All Scanned'}
                </span>
              </div>

              {emails.map((email) => (
                <div key={email.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s ease' }}>
                  {/* Header Row */}
                  <div
                    onClick={() => toggleExpand(email.id)}
                    style={{
                      padding: '24px', display: 'flex', alignItems: 'center', gap: '20px',
                      cursor: 'pointer', background: expandedId === email.id ? 'rgba(255,255,255,0.02)' : 'transparent'
                    }}
                    className="list-item"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>From: {email.from}</div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{email.subject}</div>
                    </div>

                    <div style={{ width: '150px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                      {email.status === 'PENDING' && <span className="badge" style={{ background: '#334155', color: '#94a3b8' }}>Queued</span>}
                      {email.status === 'SCANNING' && <span className="badge animate-pulse-glow" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>Analyzing...</span>}
                      {email.status === 'DONE' && (
                        <span className={`badge ${email.result?.risk === 'SAFE' ? 'safe' : email.result?.risk === 'SCAM' ? 'scam' : 'suspicious'}`}>
                          {email.result?.risk}
                        </span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {expandedId === email.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {expandedId === email.id && (
                    <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ padding: '20px', background: '#0f172a', borderRadius: '12px', marginTop: '16px', fontSize: '15px', lineHeight: '1.6', wordBreak: 'break-word', color: 'rgba(255, 255, 255, 0.85)' }}>
                        {email.body}
                      </div>

                      {email.status === 'DONE' && email.result && (
                        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                          <div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>Aegis Model Classification</div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                              {email.result.risk === 'SAFE' ? <CheckCircle size={32} color="var(--safe-green)" /> :
                                email.result.risk === 'SCAM' ? <ShieldAlert size={32} color="var(--scam-red)" /> :
                                  <AlertTriangle size={32} color="#FF9500" />}
                              <div>
                                <strong style={{ color: email.result.risk === 'SAFE' ? 'var(--safe-green)' : email.result.risk === 'SCAM' ? 'var(--scam-red)' : '#FF9500', fontSize: '16px' }}>
                                  Risk Level: {email.result.risk} ({Math.round(email.result.confidence * 100)}%)
                                </strong>
                                <p style={{ marginTop: '6px', fontSize: '14px', lineHeight: '1.5', color: 'var(--text-muted)' }}>{email.result.reason}</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>Detected Signatures</div>

                            {email.result.detected_keywords?.length > 0 ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <Key size={16} color="var(--warning-yellow)" />
                                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Keywords:</span>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {email.result.detected_keywords.map(kw => (
                                    <span key={kw} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-yellow)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 500 }}>{kw}</span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                                <Key size={16} color="var(--safe-green)" />
                                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No suspicious terms found.</span>
                              </div>
                            )}

                            {email.result.suspicious_links?.length > 0 ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <LinkIcon size={16} color="var(--scam-red)" />
                                <span style={{ fontSize: '14px', color: 'var(--scam-red)', fontWeight: 500 }}>Malicious Link Found: {email.result.suspicious_links[0]}</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <LinkIcon size={16} color="var(--safe-green)" />
                                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No malicious links detected.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

