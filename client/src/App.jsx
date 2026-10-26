import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Compose from './pages/Compose.jsx';
import History from './pages/History.jsx';
import './assets/App.css';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [view, setView] = useState('compose');
  const [selectedId, setSelectedId] = useState(null);

  const refreshUser = useCallback(
    () => api.me().then(setUser).catch(() => setUser(null)),
    []
  );

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Modern Loading Screen
  if (user === undefined) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="boot-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div className="boot-spinner"></div>
          <p>Connecting to Gmail...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  const userInitial = user.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="app-shell">
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="app-header">
        <div className="header-container">
          {/* Brand Logo */}
          <div className="app-brand">
            <div className="brand-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="brand-title">ResumeSender</span>
          </div>

          {/* Segmented Tab Switcher */}
          <nav className="nav-segmented" aria-label="Main Navigation">
            <button
              className={`nav-tab ${view === 'compose' ? 'active' : ''}`}
              onClick={() => setView('compose')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span>New Send</span>
            </button>

            <button
              className={`nav-tab ${view === 'history' ? 'active' : ''}`}
              onClick={() => setView('history')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>History</span>
            </button>
          </nav>

          {/* User Profile & Sign Out */}
          <div className="user-profile-menu">
            <div className="profile-chip" title={user.email}>
              <div className="profile-avatar">{userInitial}</div>
              <div className="profile-info">
                <span className="profile-email">{user.email}</span>
                <span className="status-live-dot">
                  <span className="dot"></span> Connected
                </span>
              </div>
            </div>

            <button className="btn-signout" onClick={signOut} title="Sign Out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= GMAIL REVOKED WARNING ================= */}
      {user.gmailStatus === 'revoked' && (
        <div className="alert-reconnect-bar" role="alert">
          <div className="alert-content">
            <div className="alert-icon">⚠️</div>
            <div className="alert-text">
              <strong>Gmail Connection Expired:</strong> Your authorization has expired or was revoked. Reconnect your Google account to dispatch emails.
            </div>
          </div>
          <a href="/api/auth/google" className="btn-reconnect">
            Reconnect Google Account →
          </a>
        </div>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main className="app-main">
        {view === 'compose' ? (
          <Compose
            user={user}
            onCreated={(id) => {
              setSelectedId(id);
              setView('history');
              refreshUser();
            }}
          />
        ) : (
          <History
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={refreshUser}
          />
        )}
      </main>
    </div>
  );
}