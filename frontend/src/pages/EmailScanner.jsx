import { useState, useEffect } from 'react';
import { Mail, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Link as LinkIcon, Key } from 'lucide-react';

const MOCK_DATASET = [
  {
    "from": "bank-support@gmail.com",
    "subject": "Urgent: Verify your account",
    "body": "Your bank account will be blocked. Click here to verify immediately: http://fake-bank-login.com"
  },
  {
    "from": "friend@gmail.com",
    "subject": "Meeting tomorrow",
    "body": "Hey, are we still meeting tomorrow at 10?"
  },
  {
    "from": "lottery@win.com",
    "subject": "Congratulations! You won",
    "body": "You have won ₹10,000 lottery. Claim now: http://bit.ly/win-money"
  },
  {
    "from": "hr@company.com",
    "subject": "Job Offer",
    "body": "We are pleased to offer you a job. Please review the attached details."
  },
  {
    "from": "kyc-update@bank.com",
    "subject": "KYC Update Required",
    "body": "Update your KYC immediately or your account will be suspended. Visit http://secure-bank-update.com"
  }
];

export default function EmailScanner() {
  const [emails, setEmails] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchEmails = () => {
    setIsFetching(true);
    setEmails([]);
    
    // Simulate initial loading from 'inbox'
    setTimeout(() => {
      const initialized = MOCK_DATASET.map((e, idx) => ({ ...e, id: idx, status: 'PENDING', result: null }));
      setEmails(initialized);
      setIsFetching(false);
    }, 1000);
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
        const response = await fetch('http://127.0.0.1:8000/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: payload })
        });
        const data = await response.json();
        
        setEmails(prev => prev.map(e => e.id === pendingEmail.id ? { ...e, status: 'DONE', result: data } : e));
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={32} color="#3b82f6" /> Simulated Email Fetching
          </h1>
          <p>Mock inbox integrated with our TF-IDF + Naive Bayes ML model.</p>
        </div>
        
        <button className="btn btn-primary" onClick={fetchEmails} disabled={isFetching} style={{ width: 'auto', padding: '12px 24px' }}>
          <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Syncing..." : "Fetch Emails"}
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {emails.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <h3>Inbox Empty</h3>
            <p>Click "Fetch Emails" to load the dataset and begin automatic ML analysis.</p>
          </div>
        ) : (
          <div>
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>From: {email.from}</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{email.subject}</div>
                  </div>
                  
                  <div style={{ width: '150px', display: 'flex', justifyContent: 'center' }}>
                    {email.status === 'PENDING' && <span className="badge" style={{ background: '#334155', color: '#94a3b8' }}>Queued</span>}
                    {email.status === 'SCANNING' && <span className="badge animate-pulse-glow" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>Analyzing...</span>}
                    {email.status === 'DONE' && (
                      <span className={`badge ${email.result?.risk === 'SAFE' ? 'safe' : email.result?.risk === 'SCAM' ? 'scam' : 'suspicious'}`}>
                         {email.result?.risk}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ color: 'var(--text-muted)' }}>
                     {expandedId === email.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Expanded Detail View */}
                {expandedId === email.id && (
                  <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ padding: '20px', background: '#0f172a', borderRadius: '12px', marginTop: '16px', fontSize: '15px', lineHeight: '1.6' }}>
                      {email.body}
                    </div>
                    
                    {email.status === 'DONE' && email.result && (
                      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>ML Classification</div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {email.result.risk === 'SAFE' ? <CheckCircle size={32} color="var(--safe-green)" /> : 
                             email.result.risk === 'SCAM' ? <ShieldAlert size={32} color="var(--scam-red)" /> : 
                             <AlertTriangle size={32} color="#FF9500" />}
                             <div>
                               <strong style={{ color: email.result.risk === 'SAFE' ? 'var(--safe-green)' : email.result.risk === 'SCAM' ? 'var(--scam-red)' : '#FF9500' }}>
                                 Risk Level: {email.result.risk}
                               </strong>
                               <p style={{ marginTop: '4px', fontSize: '14px' }}>{email.result.reason}</p>
                             </div>
                          </div>
                        </div>
                        
                        <div>
                          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>Detected Signatures</div>
                          
                          {email.result.detected_keywords?.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                              <Key size={16} color="var(--warning-yellow)" />
                              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Suspicious Keywords:</span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {email.result.detected_keywords.map(kw => (
                                  <span key={kw} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-yellow)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {email.result.suspicious_links?.length > 0 ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <LinkIcon size={16} color="var(--scam-red)" />
                              <span style={{ fontSize: '14px', color: 'var(--scam-red)' }}>Malicious Link Found: {email.result.suspicious_links[0]}</span>
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
      
      {/* Quick spin animation override for refresh button */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
}
