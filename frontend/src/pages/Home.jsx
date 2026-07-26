import { useState, useRef, useEffect } from 'react';
import { ShieldAlert, CheckCircle, FileAudio, AlertTriangle } from 'lucide-react';
import { playSound } from '../utils/audio';
import { apiUrl } from '../lib/api';
import { pushLocalDataToCloud } from '../utils/userStorage';

async function parseApiJson(response) {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    throw new Error('Empty response from server (API may be waking up — retry in 60s).');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid server response. Retry in a moment.');
  }
}

export default function Home() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const userName = localStorage.getItem('aegis_user_name');

  // Check for prefilled text from Dashboard Quick Test Presets
  useEffect(() => {
    const prefill = localStorage.getItem('aegis_prefill_scan');
    if (prefill) {
      setInput(prefill);
      localStorage.removeItem('aegis_prefill_scan');
    }
  }, []);

  const handleScan = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    playSound('scan');

    try {
      const response = await fetch(apiUrl('/api/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });
      const data = await parseApiJson(response);
      if (data.error && !data.risk) {
        throw new Error(data.error);
      }
      setResult(data);

      if (data.risk === 'SAFE') {
        playSound('safe');
      } else {
        playSound('scam');
      }

      // Save to History
      const safeData = {
        id: Date.now(),
        text: input,
        type: "Text",
        date: new Date().toLocaleString(),
        risk: data.risk,
        label: data.label,
        reason: data.reason || '',
        confidence: data.confidence || 0,
        detected_keywords: data.detected_keywords || [],
        suspicious_links: data.suspicious_links || []
      };
      const existing = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
      localStorage.setItem('aegis_scan_history', JSON.stringify([safeData, ...existing]));
      pushLocalDataToCloud().catch(() => null);

    } catch (err) {
      console.error(err);
      setResult({ risk: 'ERROR', confidence: 0, label: 'error', reason: 'Failed to connect to backend server.' });
      playSound('scam');
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
    playSound('scan');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(apiUrl('/api/scan-audio'), {
        method: 'POST',
        body: formData
      });
      const data = await parseApiJson(response);
      if (data.error) {
        setInput(`Error: ${data.error}`);
        setResult({ risk: 'ERROR', confidence: 0, label: 'upload_failed', reason: data.error });
        playSound('scam');
        return;
      }

      if (data.transcription) {
        const langNote = data.detected_language ? ` [${data.detected_language}]` : '';
        const methodNote = data.method ? ` (${data.method})` : '';
        setInput(`${data.transcription}${langNote}${methodNote}`);
      }
      setResult(data);

      if (data.risk === 'SAFE') {
        playSound('safe');
      } else {
        playSound('scam');
      }

      // Save to History
      const safeData = {
        id: Date.now(),
        text: data.transcription || "Audio File",
        type: "Audio",
        date: new Date().toLocaleString(),
        risk: data.risk,
        label: data.label,
        reason: data.reason || '',
        confidence: data.confidence || 0,
        detected_keywords: data.detected_keywords || [],
        suspicious_links: data.suspicious_links || []
      };
      const existing = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
      localStorage.setItem('aegis_scan_history', JSON.stringify([safeData, ...existing]));
      pushLocalDataToCloud().catch(() => null);

    } catch (err) {
      console.error(err);
      setInput('Error: Connection failed. The backend server might be offline.');
      setResult({ risk: 'ERROR', confidence: 0, label: 'error', reason: 'Failed to connect to backend server.' });
      playSound('scam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>
        {userName ? `Welcome, ${userName}` : 'Scan Center'}
      </h1>
      <p style={{ marginBottom: '16px' }}>Analyze any message, email, or audio file for social engineering threats.</p>

      {/* Educational disclaimer for Safe Browsing compliance */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.06)',
        border: '1px solid rgba(16, 185, 129, 0.12)',
        borderRadius: '10px',
        padding: '10px 16px',
        marginBottom: '32px',
        fontSize: '12px',
        color: '#64748b',
        lineHeight: 1.5,
      }}>
        🎓 <strong style={{ color: '#94a3b8' }}>Educational Tool</strong> — This analysis is for cybersecurity awareness purposes only. No data is stored on our servers.
      </div>

      <div className="home-grid">
        <div className="card">
          <h2 className="card-title">New Scan</h2>
          <div className="scanner-container">
            {loading && <div className="scanner-laser"></div>}
            <textarea
              className="input-field"
              placeholder="Paste suspicious text, SMS, or email here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{ border: loading ? '1px solid var(--accent-primary)' : '' }}
            ></textarea>
          </div>

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
