import { useState, useEffect } from 'react';
import { ShieldAlert, Shield } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('aegis_scan_history');
    if (raw) {
      setHistory(JSON.parse(raw));
    }
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>Scan History</h1>
      <p style={{ marginBottom: '40px' }}>Past interactions analyzed by the AI Engine.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
            <p>No scans yet. Try scanning your first message from the Scan Center.</p>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className="card" onClick={() => setSelectedLog(selectedLog === item.id ? null : item.id)} style={{ padding: '20px 24px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', borderLeft: `4px solid ${item.risk === 'SAFE' ? 'var(--safe-green)' : item.risk === 'SCAM' ? 'var(--scam-red)' : '#FF9500'}` }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ marginRight: '24px' }}>
                  {item.risk === 'SAFE' ? <Shield size={32} color="var(--safe-green)" /> : <ShieldAlert size={32} color={item.risk === 'SCAM' ? "var(--scam-red)" : "#FF9500"} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>{item.type}</span>
                    <span style={{ fontSize: '12px', color: '#888' }}>{item.date}</span>
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 500, whiteSpace: selectedLog === item.id ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedLog === item.id ? item.text : `"${item.text}"`}
                  </p>
                </div>
                <div style={{ marginLeft: '24px' }}>
                  <span className={`badge ${(item.risk || 'UNKNOWN').toLowerCase()}`}>
                    {item.risk || 'UNKNOWN'}
                  </span>
                </div>
              </div>
              
              {selectedLog === item.id && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUpFade 0.3s' }}>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>Detailed Analysis</h3>
                  
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '14px', margin: 0, color: '#e2e8f0', lineHeight: '1.6' }}><strong style={{color: '#94a3b8', marginRight: '8px'}}>AI Finding:</strong> {item.reason || 'No detailed reason provided.'}</p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Confidence Score</div>
                      <div style={{ fontWeight: 600, color: item.confidence > 0.8 ? 'var(--safe-green)' : 'var(--warning-yellow)' }}>
                        {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    
                    {item.detected_keywords && item.detected_keywords.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Flags Triggered</div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.detected_keywords.join(', ')}</div>
                      </div>
                    )}
                  </div>

                  {item.suspicious_links && item.suspicious_links.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', marginTop: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <div style={{ fontSize: '12px', color: 'var(--scam-red)', marginBottom: '4px', fontWeight: 600 }}>Suspicious Links Found</div>
                      <div style={{ color: '#e2e8f0', fontSize: '13px', wordBreak: 'break-all' }}>{item.suspicious_links.map(l => typeof l === 'string' ? l : l.url).join(', ')}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
