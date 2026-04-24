import { useState, useRef } from 'react';
import { ShieldAlert, CheckCircle, FileAudio, AlertTriangle } from 'lucide-react';

export default function Home() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const userName = localStorage.getItem('aegis_user_name');

  const handleScan = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });
      const data = await response.json();
      setResult(data);
      
      // Save to History
      const safeData = {
        id: Date.now(),
        text: input,
        type: "Text",
        date: new Date().toLocaleString(),
        risk: data.risk,
        label: data.label
      };
      const existing = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
      localStorage.setItem('aegis_scan_history', JSON.stringify([safeData, ...existing]));
      
    } catch (err) {
      console.error(err);
      setResult({ risk: 'ERROR', confidence: 0, label: 'error', reason: 'Failed to connect to backend server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setResult(null);
    setInput("Processing audio file...");
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/scan-audio', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.error) {
        setInput(`Error: ${data.error}`);
        setResult({ risk: 'ERROR', confidence: 0, label: 'upload_failed', reason: data.error });
        return;
      }
      
      if (data.transcription) {
        setInput(data.transcription);
      }
      setResult(data);
      
      // Save to History
      const safeData = {
        id: Date.now(),
        text: data.transcription || "Audio File",
        type: "Audio",
        date: new Date().toLocaleString(),
        risk: data.risk,
        label: data.label
      };
      const existing = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
      localStorage.setItem('aegis_scan_history', JSON.stringify([safeData, ...existing]));
      
    } catch (err) {
      console.error(err);
      setInput('Error: Connection failed. The backend server might be offline.');
      setResult({ risk: 'ERROR', confidence: 0, label: 'error', reason: 'Failed to connect to backend server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>
        {userName ? `Welcome, ${userName}` : 'Scan Center'}
      </h1>
      <p style={{ marginBottom: '40px' }}>Analyze any message, email, or audio file for social engineering threats.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="card">
          <h2 className="card-title">New Scan</h2>
          <textarea 
            className="input-field" 
            placeholder="Paste suspicious text, SMS, or email here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          ></textarea>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <input 
              type="file" 
              accept="audio/*" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleAudioUpload} 
            />
            <button 
              className="btn" 
              style={{ background: '#f5f5f5', color: '#333', display: 'flex', gap: '8px', alignItems: 'center' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <FileAudio size={18} /> Upload Audio
            </button>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleScan} disabled={loading}>
              {loading ? 'Analyzing...' : 'Scan Now'}
            </button>
          </div>
        </div>

        <div>
          {result && (
            <div className={`card`} style={{ borderTop: `4px solid ${result.risk === 'SAFE' ? 'var(--safe-green)' : result.risk === 'SCAM' ? 'var(--scam-red)' : '#FF9500'}` }}>
              <h2 className="card-title">Analysis Result</h2>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                {result.risk === 'SAFE' ? <CheckCircle size={48} color="var(--safe-green)" /> : 
                 result.risk === 'SCAM' ? <ShieldAlert size={48} color="var(--scam-red)" /> : 
                 <AlertTriangle size={48} color="#FF9500" />}
                
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: result.risk === 'SAFE' ? 'var(--safe-green)' : result.risk === 'SCAM' ? 'var(--scam-red)' : '#FF9500' }}>
                    {result.risk}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                    {Math.round(result.confidence * 100)}% Confidence • {result.label}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Reason Breakdown</div>
                <p style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>{result.reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
