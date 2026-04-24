import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Home, Clock, Activity, Settings, LogOut, Mail, LayoutDashboard } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav className={`sidebar ${expanded ? 'expanded' : ''}`} onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', marginBottom: '40px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div className="sidebar-logo" style={{ marginBottom: 0, minWidth: '50px' }}>
          <Shield size={32} />
        </div>
        <span className="nav-text" style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          <span className="gradient-text">Aegis AI</span>
        </span>
      </div>

      <div style={{ flex: 1, width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active-primary' : ''}`} title="Scan">
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><Home size={22} /></div>
          <span className="nav-text">Scan Center</span>
        </NavLink>
        <NavLink to="/email" className={({ isActive }) => `nav-item ${isActive ? 'active-primary' : ''}`} title="Email Inbox Simulation">
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><Mail size={22} /></div>
          <span className="nav-text">Inbox Sandbox</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="History">
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><Clock size={22} /></div>
          <span className="nav-text">Scan Logs</span>
        </NavLink>
        <NavLink to="/simulate" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Simulate">
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><Activity size={22} /></div>
          <span className="nav-text">Training Simulation</span>
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Dashboard">
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><LayoutDashboard size={22} /></div>
          <span className="nav-text">Profile Dashboard</span>
        </NavLink>
      </div>

      <div style={{ width: '100%', padding: '0 20px' }}>
        <div onClick={() => supabase.auth.signOut()} className="nav-item" style={{ cursor: 'pointer' }}>
          <div style={{ minWidth: '50px', display: 'flex', justifyContent: 'center' }}><LogOut size={22} /></div>
          <span className="nav-text">Log Out</span>
        </div>
      </div>
    </nav>
  );
}
