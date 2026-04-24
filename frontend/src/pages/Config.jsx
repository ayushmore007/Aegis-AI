import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Config() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const Title = ["Allow SMS Access", "Allow Call Audios", "Allow Email Access"];
  const Desc = [
    "Aegis AI needs access to your SMS to automatically detect and flag phishing messages in real-time.",
    "We use local speech-to-text to analyze incoming suspicious calls for impersonation tactics.",
    "Connect your inbox to protect against spear-phishing and job-scam emails securely."
  ];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else navigate('/home');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
      <div className="card" style={{ width: '450px', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ width: '40px', height: '6px', borderRadius: '4px', background: s <= step ? 'var(--accent-primary)' : '#eee' }}></div>
          ))}
        </div>
        
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>{Title[step-1]}</h2>
        <p style={{ marginBottom: '40px', lineHeight: 1.6 }}>{Desc[step-1]}</p>
        
        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          <button className="btn btn-primary" onClick={handleNext}>Grant Permission</button>
          <button className="btn" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={handleNext}>Skip for now</button>
        </div>
      </div>
      
      <div style={{ marginTop: '40px', maxWidth: '450px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px' }}>
          <strong>Manual Fallback:</strong> Even if you deny permissions, you can always paste text or upload audio files manually in the app later.
        </p>
      </div>
    </div>
  );
}
