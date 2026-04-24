import { useState, useEffect } from 'react';

export default function Dashboard() {
  const userName = localStorage.getItem('aegis_user_name') || 'Guest';
  const userEmail = localStorage.getItem('aegis_user_email') || 'Not provided';
  const score = localStorage.getItem('aegis_training_score') || 0;
  const rawRiskProfile = localStorage.getItem('aegis_risk_profile') || 'Unknown';

  const riskProps = {
    'High Risk': {
      title: 'High Trust Tendency',
      desc: 'You are highly vulnerable to urgency-based scams. Take caution when receiving messages about blocked accounts.',
      color: 'var(--scam-red)',
      bg: 'rgba(255, 59, 48, 0.05)',
      border: 'rgba(255, 59, 48, 0.1)'
    },
    'Medium Risk': {
      title: 'Moderate Vulnerability',
      desc: 'Your instincts are good but you may occasionally overlook sophisticated spoofed links or targeted emails.',
      color: '#FF9500',
      bg: 'rgba(255, 149, 0, 0.05)',
      border: 'rgba(255, 149, 0, 0.1)'
    },
    'Low Risk': {
      title: 'Excellent Awareness',
      desc: 'You display superb digital hygiene and correctly identify common social engineering tactics.',
      color: 'var(--safe-green)',
      bg: 'rgba(52, 199, 89, 0.05)',
      border: 'rgba(52, 199, 89, 0.1)'
    },
    'Unknown': {
      title: 'Pending Assessment',
      desc: 'Please complete a Training Simulation to generate your personalized risk profile.',
      color: '#888',
      bg: '#f9f9f9',
      border: '#eee'
    }
  };

  const currentRisk = riskProps[rawRiskProfile] || riskProps['Unknown'];

  const [toggles, setToggles] = useState({
    sms: true,
    calls: false,
    whatsapp: true
  });

  const [profile, setProfile] = useState({ userId: 'Loading...', phone: 'Loading...' });
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/user/profile?email=${encodeURIComponent(userEmail)}`)
      .then(res => res.json())
      .then(data => setProfile({ userId: data.user_id, phone: data.phone }))
      .catch(err => setProfile({ userId: 'Error', phone: 'Error' }));
      
    setTimeout(() => setChartLoaded(true), 100);
  }, [userEmail]);

  const toggleSetting = (key) => setToggles(p => ({ ...p, [key]: !p[key] }));

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>Hi {userName}! Welcome Home</h1>
      <p style={{ marginBottom: '40px' }}>Your personal security and awareness overview.</p>
      
      <div className="dashboard-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 className="card-title">Profile</h2>
            <div style={{ background: 'var(--accent-primary)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#ccc', margin: '0 auto 16px', backgroundImage: `url("https://api.dicebear.com/7.x/initials/svg?seed=${userName}&backgroundColor=10b981")`, backgroundSize: 'cover' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{userName}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{userEmail}</div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Awareness Score</h2>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--safe-green)' }}>100/100</div>
          </div>
          
          <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '0 20px' }}>
            {/* Mock Chart styled exactly to target image */}
            {[40, 55, 45, 60, 65].map((val, i) => (
              <div key={i} style={{ 
                flex: 1, 
                backgroundColor: i === 4 ? 'var(--safe-green)' : 'rgba(255, 255, 255, 0.85)', 
                height: chartLoaded ? `${val}%` : '0%', 
                transition: `height 1s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.1}s`,
                borderRadius: '16px 16px 0 0', 
                position: 'relative',
                boxShadow: i === 4 ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                backgroundImage: i === 4 ? 'linear-gradient(to top, rgba(16,185,129,0.2), rgba(16,185,129,1))' : 'linear-gradient(to top, rgba(255,255,255,0.2), rgba(255,255,255,0.85))'
              }}>
                <span style={{ position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May'][i]}
                </span>
                {chartLoaded && <div style={{position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', fontWeight: 'bold', color: i === 4 ? 'var(--safe-green)' : '#fff', opacity: 0, animation: `slideUpFade 0.5s forwards ${1 + i * 0.1}s`}}>{val}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Risk Profile</h2>
          <div style={{ background: currentRisk.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${currentRisk.border}` }}>
            <div style={{ color: currentRisk.color, fontWeight: 600, marginBottom: '8px' }}>{currentRisk.title}</div>
            <p style={{ fontSize: '13px', lineHeight: 1.5 }}>{currentRisk.desc}</p>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Personal Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="list-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User ID</div>
                <div style={{ fontWeight: 500, marginTop: '4px', color: 'var(--text-main)' }}>{profile.userId}</div>
              </div>
            </div>
            <div className="list-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone</div>
                <div style={{ fontWeight: 500, marginTop: '4px', color: 'var(--text-main)' }}>{profile.phone}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Smart Alerts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="list-item" style={{ border: 'none' }} onClick={() => toggleSetting('sms')}>
              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Auto-scan SMS</span>
              <div className={`toggle-switch ${toggles.sms ? 'on' : ''}`}></div>
            </div>
            <div className="list-item" style={{ border: 'none' }} onClick={() => toggleSetting('calls')}>
              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Call recording AI</span>
              <div className={`toggle-switch ${toggles.calls ? 'on' : ''}`}></div>
            </div>
            <div className="list-item" style={{ border: 'none' }} onClick={() => toggleSetting('whatsapp')}>
              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>WhatsApp Watch</span>
              <div className={`toggle-switch ${toggles.whatsapp ? 'on' : ''}`}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
