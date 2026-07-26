import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Flame, Award, Clock, History, X, Info } from 'lucide-react';
import { scenariosSet1, scenariosSet2, scenariosSet3 } from '../data/scenarios';
import { decodeScenarioSet } from '../data/scenarioCodec';
import { pushLocalDataToCloud } from '../utils/userStorage';

const sets = [
  decodeScenarioSet(scenariosSet1),
  decodeScenarioSet(scenariosSet2),
  decodeScenarioSet(scenariosSet3),
];

export const getRankFromXp = (xp) => {
  if (xp >= 260) return { name: 'Shield Master', color: '#f59e0b', minXp: 260 };
  if (xp >= 160) return { name: 'Defender', color: '#8b5cf6', minXp: 160 };
  if (xp >= 60) return { name: 'Aware', color: '#10b981', minXp: 60 };
  return { name: 'Rookie', color: '#3b82f6', minXp: 0 };
};

export const RANK_TIERS = [
  { name: 'Shield Master', color: '#f59e0b', xp: '260+ XP', desc: 'Expert level awareness against sophisticated attacks.' },
  { name: 'Defender', color: '#8b5cf6', xp: '160 - 250 XP', desc: 'Strong critical thinking and risk identification.' },
  { name: 'Aware', color: '#10b981', xp: '60 - 150 XP', desc: 'Solid understanding of real-world decision making.' },
  { name: 'Rookie', color: '#3b82f6', xp: '0 - 50 XP', desc: 'Just starting to learn about obvious scams.' }
];

export default function Simulate() {
  const navigate = useNavigate();
  
  // Load State from History
  const [globalIndex, setGlobalIndex] = useState(() => parseInt(localStorage.getItem('aegis_training_idx')) || 0);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('aegis_training_history')) || []);
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('aegis_training_streak')) || 0);
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('aegis_training_xp')) || 0);
  const [setIndex, setSetIndex] = useState(() => parseInt(localStorage.getItem('aegis_training_set_index')) || 0);
  
  // UI State
  const [feedbackState, setFeedbackState] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [showRanksModal, setShowRanksModal] = useState(false);
  
  const allScenarios = sets[setIndex % sets.length];
  const currentRank = getRankFromXp(xp);
  const isComplete = globalIndex >= allScenarios.length;

  useEffect(() => {
    pushLocalDataToCloud().catch(() => null);
  }, [globalIndex, history, streak, xp, setIndex]);
  const currentScenario = isComplete ? null : allScenarios[globalIndex];

  // Timer Logic
  useEffect(() => {
    if (currentScenario?.isTimed && !feedbackState && !isComplete && !showRanksModal) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentScenario, feedbackState, isComplete, showRanksModal]);

  const handleTimeout = () => {
    setStreak(0);
    localStorage.setItem('aegis_training_streak', 0);
    setFeedbackState('incorrect');
    setExplanation("Time's up! Scammers use extreme urgency to force quick, bad decisions.");
    
    saveToHistory(false, "Timeout / No Response");
  };

  const saveToHistory = (isCorrect, responseText) => {
    const newHistoryItem = {
      scenario: currentScenario.message.substring(0, 50) + "...",
      type: currentScenario.type,
      correct: isCorrect,
      response: responseText,
      timestamp: new Date().toISOString()
    };
    
    const newHistory = [...history, newHistoryItem];
    setHistory(newHistory);
    localStorage.setItem('aegis_training_history', JSON.stringify(newHistory));
  };

  const handleChoice = (opt) => {
    if (feedbackState) return;

    saveToHistory(opt.correct, opt.text);

    if (opt.correct) {
      setFeedbackState('correct');
      setExplanation(opt.feedback);
      const newStreak = streak + 1;
      setStreak(newStreak);
      localStorage.setItem('aegis_training_streak', newStreak);
      
      let earnedXp = 10;
      if (newStreak > 0 && newStreak % 5 === 0) earnedXp += 5; // Streak bonus
      
      const newXp = xp + earnedXp;
      setXp(newXp);
      localStorage.setItem('aegis_training_xp', newXp);

    } else {
      setFeedbackState('incorrect');
      setExplanation(opt.feedback);
      setStreak(0);
      localStorage.setItem('aegis_training_streak', 0);
    }
  };

  const nextScenario = () => {
    setFeedbackState(null);
    setExplanation(null);
    setTimeLeft(15);

    const nextIdx = globalIndex + 1;
    setGlobalIndex(nextIdx);
    localStorage.setItem('aegis_training_idx', nextIdx);
  };

  const resetProgress = () => {
    const nextSet = (setIndex + 1) % sets.length;
    localStorage.setItem('aegis_training_set_index', nextSet);
    localStorage.removeItem('aegis_training_idx');
    setSetIndex(nextSet);
    setGlobalIndex(0);
    setFeedbackState(null);
  };

  const animationClass = feedbackState === 'correct' ? 'flash-green' : feedbackState === 'incorrect' ? 'flash-red' : '';

  return (
    <div>
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
        }}
      >
        <Info size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)' }}>Educational simulation only.</strong>{' '}
          All messages below are fictional examples designed to teach scam detection.
          This is not a phishing site — no real credentials or links are involved.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Security Training</h1>
          <p>Level up your scam detection skills.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)' }}>
            <Flame color={streak >= 3 ? '#ef4444' : '#f59e0b'} size={24} />
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{streak}</span>
          </div>
          
          <div 
            className="card" 
            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${currentRank.color}50`, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => setShowRanksModal(true)}
            title="Click to view all ranks"
          >
            <Shield color={currentRank.color} size={24} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{xp} XP</div>
              <div style={{ fontWeight: 'bold', color: currentRank.color, fontSize: '18px' }}>{currentRank.name}</div>
            </div>
            <Info size={16} color="var(--text-muted)" style={{ marginLeft: '8px' }} />
          </div>
        </div>
      </div>

      {isComplete ? (
        <div className="card slide-in-right" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '40px' }}>
          <Award size={64} color={currentRank.color} style={{ marginBottom: '24px' }} />
          <h2 style={{ fontSize: '32px', color: currentRank.color, marginBottom: '16px' }}>Training Set Complete!</h2>
          <p style={{ fontSize: '18px', marginBottom: '24px' }}>You have completed this round of scenarios.</p>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>Total XP:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '20px' }}>{xp} XP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current Rank:</span>
              <span style={{ fontWeight: 'bold', color: currentRank.color, fontSize: '20px' }}>{currentRank.name}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>View Your Profile</button>
            <button className="btn" onClick={resetProgress}>Take Next Set of Questions</button>
          </div>
        </div>
      ) : (
        <div className={`card slide-in-right ${animationClass}`} style={{ maxWidth: '650px', margin: '0 auto 40px auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{currentScenario.type}</span>
              <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                Set {setIndex + 1} • {globalIndex + 1} / {allScenarios.length}
              </span>
            </div>
            
            {currentScenario.isTimed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: timeLeft <= 5 ? 'var(--scam-red)' : 'var(--warning-yellow)', fontWeight: 'bold' }}>
                <Clock size={18} />
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Sender Info */}
          <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
            <strong>From:</strong> {currentScenario.sender}
          </div>

          {/* Message Content */}
          {currentScenario.type === 'Impersonation Chat' ? (
            <div className="chat-container" data-educational="true" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', marginBottom: '32px' }}>
              <div className="chat-bubble scammer">
                {currentScenario.message}
              </div>
            </div>
          ) : (
            <div data-educational="true" style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
              {currentScenario.message}
            </div>
          )}

          {/* Options / Feedback */}
          {!feedbackState ? (
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 500 }}>Select your response:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentScenario.options.map((opt, i) => (
                  <button key={i} className="btn" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', padding: '16px 20px' }} onClick={() => handleChoice(opt)}>
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-slide-up">
              <div style={{ background: feedbackState === 'correct' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '20px', borderRadius: '16px', border: `1px solid ${feedbackState === 'correct' ? 'var(--safe-green)' : 'var(--scam-red)'}`, display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '24px', marginTop: '-4px' }}>
                  {feedbackState === 'correct' ? '✅' : '🚨'}
                </div>
                <div>
                  <h3 style={{ color: feedbackState === 'correct' ? 'var(--safe-green)' : 'var(--scam-red)', margin: '0 0 8px 0', fontSize: '18px' }}>
                    {feedbackState === 'correct' ? 'Correct!' : 'Vulnerable Decision'}
                  </h3>
                  <p style={{ color: 'var(--text-main)', margin: 0 }}>{explanation}</p>
                </div>
              </div>
              
              <button className="btn btn-primary" onClick={nextScenario} style={{ padding: '16px' }}>
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && !isComplete && (
        <div className="card" style={{ maxWidth: '650px', margin: '0 auto', background: 'rgba(21, 24, 33, 0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <History size={20} color="var(--text-muted)" />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Your Response History</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...history].reverse().slice(0, 10).map((h, i) => (
              <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: `4px solid ${h.correct ? 'var(--safe-green)' : 'var(--scam-red)'}` }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{h.type}</span>
                  <span>{h.correct ? '✅ Correct' : '🚨 Incorrect'}</span>
                </div>
                <div style={{ fontSize: '14px', marginBottom: '8px', fontStyle: 'italic' }}>"{h.scenario}"</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>You chose: <strong>{h.response}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranks Modal Overlay */}
      {showRanksModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
            <button 
              onClick={() => setShowRanksModal(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-main)' }}>Awareness Ranks</h2>
            <p style={{ marginBottom: '32px' }}>Current XP: <strong style={{ color: 'var(--accent-primary)' }}>{xp}</strong></p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {RANK_TIERS.map((tier, idx) => {
                const isActive = currentRank.name === tier.name;
                return (
                  <div key={idx} style={{ 
                    padding: '20px', 
                    background: isActive ? `${tier.color}15` : 'rgba(255,255,255,0.02)', 
                    borderRadius: '16px', 
                    border: `1px solid ${isActive ? tier.color : 'rgba(255,255,255,0.05)'}`,
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}>
                    <Shield color={tier.color} size={32} style={{ marginTop: '4px' }} />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '18px', color: tier.color }}>{tier.name}</span>
                        <span style={{ fontSize: '14px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-muted)' }}>{tier.xp}</span>
                      </div>
                      <p style={{ fontSize: '14px', margin: 0, lineHeight: 1.5 }}>{tier.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
