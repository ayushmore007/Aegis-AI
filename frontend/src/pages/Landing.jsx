import { useNavigate } from 'react-router-dom';
import { Fingerprint } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('aegis_user_name');

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100vh', textAlign: 'center',
      padding: '40px', background: '#000'
    }}>
      
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }} className="animate-slide-up">
        <h1 style={{ fontSize: '100px', fontWeight: 800, marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-3px' }}>
          <span className="gradient-text dynamic-color-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '20px' }}>
            <Fingerprint size={80} color="#10b981" /> Aegis AI
          </span>
        </h1>
        
        <p style={{ fontSize: '22px', maxWidth: '600px', margin: '40px auto', color: '#94a3b8', fontWeight: 400 }}>
          Detect scams. Train your instincts. Stay protected with the world's most advanced behavioral phishing guard.
        </p>
      
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
          <button 
            className="animate-pulse-glow"
            onClick={() => navigate('/login')}
            style={{ 
              background: '#0a0a0a', 
              color: '#fff', 
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '16px 40px', 
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            Join The Community
          </button>
        </div>
      </div>
    </div>
  );
}
