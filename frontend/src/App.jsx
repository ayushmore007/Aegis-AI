import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { syncUserFromSession } from './utils/userStorage';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Config from './pages/Config';
import Home from './pages/Home';
import EmailScanner from './pages/EmailScanner';
import History from './pages/History';
import Simulate from './pages/Simulate';
import Dashboard from './pages/Dashboard';
import VerifyEmail from './pages/VerifyEmail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import About from './pages/About';
import { isEmailVerified, isOAuthSession } from './utils/authHelpers';

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const finishLoading = () => {
      if (mounted) setLoading(false);
    };

    // Safety: never stay on "Loading..." forever (e.g. hung network)
    const timeout = window.setTimeout(finishLoading, 8000);

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        setSession(initialSession);
        if (initialSession) syncUserFromSession(initialSession);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(finishLoading);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      finishLoading();
      if (nextSession) syncUserFromSession(nextSession);
    });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(16,185,129,0.25)',
            borderTopColor: '#10b981',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ opacity: 0.7, fontSize: 14 }}>Signing you in…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/about" element={<About />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/login"
          element={
            !session ? (
              <Login />
            ) : !isOAuthSession(session) && !isEmailVerified(session) ? (
              <Navigate to="/verify-email" state={{ email: session.user?.email, username: session.user?.user_metadata?.username }} replace />
            ) : (
              <Navigate to="/config" replace />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !session ? (
              <Login isSignup={true} />
            ) : !isOAuthSession(session) && !isEmailVerified(session) ? (
              <Navigate to="/verify-email" state={{ email: session.user?.email, username: session.user?.user_metadata?.username }} replace />
            ) : (
              <Navigate to="/config" replace />
            )
          }
        />
        <Route
          path="/config"
          element={
            <ProtectedRoute session={session}>
              <Navigate to="/home" replace />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute session={session}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/email" element={<EmailScanner />} />
          <Route path="/history" element={<History />} />
          <Route path="/simulate" element={<Simulate />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
