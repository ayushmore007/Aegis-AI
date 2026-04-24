import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Simulate() {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const scenarios = [
    {
      type: 'WhatsApp',
      sender: '+91 88888 88888 (Unknown)',
      message: "Hi Dad, I dropped my phone in the toilet and this is my new temporary number. Please send rs 5000 to my friend's account urgently for repair.",
      options: [
        { text: "Reply asking for a voice note proof", correct: true, feedback: "Correct! Scammers using the 'Hi Mum/Dad' tactic usually avoid sending voice notes." },
        { text: "Send the money immediately", correct: false, feedback: "Warning! This is a classic impersonation scam exploiting emotional urgency." },
      ]
    },
    {
      type: 'SMS',
      sender: 'HDFC-Bank',
      message: "Dear customer, your PAN is not linked to your account. Your account will freeze in 24hrs. Update via: http://hdfc.kyc-update-net.com",
      options: [
        { text: "Click the link and fill details", correct: false, feedback: "Danger! Notice the urgency 'freeze in 24hrs' and the suspicious URL." },
        { text: "Ignore or verify with branch", correct: true, feedback: "Excellent! Banks never send unverified links via SMS demanding immediate KYC." },
      ]
    },
    {
      type: 'Email',
      sender: 'Amazon Support <service@aws-billing-net.com>',
      message: "Urgent: Your Amazon Prime order #827391 has been suspended due to billing error. Please update your payment method immediately to avoid cancellation: http://amazon-billing-update-net.com",
      options: [
        { text: "Update the payment method quickly", correct: false, feedback: "Warning! Check the sender's email domain closely, it is not an official amazon.com address." },
        { text: "Check Amazon account directly in the official app", correct: true, feedback: "Perfect! Always go to the official portal instead of clicking links in threatening emails." },
      ]
    },
    {
      type: 'WhatsApp',
      sender: 'Colleague (Arun HR)',
      message: "Hey, I'm stuck with limited data right now. Can you forward me the 6-digit OTP you just received? HR sent it to your number by mistake for my login.",
      options: [
        { text: "Send the OTP to be helpful", correct: false, feedback: "Critical mistake! OTPs are strictly personal. Never share an OTP, even with colleagues or friends." },
        { text: "Refuse and call Arun to verify", correct: true, feedback: "Great awareness! This is a classic social engineering tactic to bypass 2FA authentication." },
      ]
    },
    {
      type: 'SMS',
      sender: 'TATA-Promo',
      message: "Congratulations! Your mobile number has won the Tata Safari Mega Draw! Claim your prize within 2 hours here: http://tata-safari-winner.in",
      options: [
        { text: "Click the link to claim the prize", correct: false, feedback: "Scam! They use greed and artificial time limits to trick you into entering personal banking details." },
        { text: "Ignore and mark as spam", correct: true, feedback: "Spot on! Unsolicited prize claims are one of the oldest and most dangerous phishing lures." },
      ]
    }
  ];

  const current = scenarios[scenario];

  const handleChoice = (opt) => {
    setFeedback({ ...opt });
    if (opt.correct) setScore(prev => prev + 1);
  };

  const nextScenario = () => {
    if (scenario === scenarios.length - 1) {
      setIsComplete(true);
      const percentage = Math.round((score / scenarios.length) * 100);
      localStorage.setItem('aegis_training_score', percentage);
      
      let pProfile = "Low Risk";
      if (percentage < 50) pProfile = "High Risk";
      else if (percentage <= 80) pProfile = "Medium Risk";
      localStorage.setItem('aegis_risk_profile', pProfile);
    } else {
      setFeedback(null);
      setScenario((scenario + 1));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Training Simulation</h1>
          <p>Test your instincts against real-world social engineering tactics.</p>
        </div>
        <div className="card" style={{ padding: '12px 24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Level:</span> <span style={{ color: 'var(--accent-primary)' }}>Medium</span>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--card-bg)' }}>
        {isComplete ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--accent-primary)' }}>Training Complete!</h2>
            <p style={{ fontSize: '18px', marginBottom: '32px' }}>
              Your Awareness Score: <strong style={{ fontSize: '24px' }}>{Math.round(((score + (feedback?.correct ? 1 : 0)) / scenarios.length) * 100)}%</strong>
            </p>
            <p style={{ marginBottom: '40px', color: '#666' }}>
              Your profile has been updated. Check your Dashboard to see your personalized risk profile analysis.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{current.type} Message <span style={{fontSize: '12px', marginLeft: '8px', color: 'var(--text-muted)'}}>(Scenario {scenario+1}/{scenarios.length})</span></span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{current.sender}</span>
            </div>
            
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '18px', lineHeight: 1.5, marginBottom: '32px', position: 'relative', color: 'var(--text-main)' }}>
              "{current.message}"
            </div>

            {!feedback ? (
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 500 }}>What would you do?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {current.options.map((opt, i) => (
                    <button key={i} className="btn" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-main)', textAlign: 'left' }} onClick={() => handleChoice(opt)}>
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: feedback.correct ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', padding: '24px', borderRadius: '16px', border: `1px solid ${feedback.correct ? 'var(--safe-green)' : 'var(--scam-red)'}` }}>
                <h3 style={{ color: feedback.correct ? 'var(--safe-green)' : 'var(--scam-red)', marginBottom: '8px' }}>
                  {feedback.correct ? 'Good Instincts!' : 'Vulnerable Decision'}
                </h3>
                <p style={{ color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '24px' }}>{feedback.feedback}</p>
                <button className="btn btn-primary" onClick={nextScenario}>{scenario === scenarios.length - 1 ? 'Finish Simulation' : 'Next Scenario'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
