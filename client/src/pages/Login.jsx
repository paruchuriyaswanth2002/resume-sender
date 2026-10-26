import React from 'react';
import '../assets/Login.css'; 

const ERRORS = {
  denied: 'Google sign-in was cancelled.',
  state: 'Sign-in session expired. Please try again.',
  not_allowed: 'This Google account is not authorized to access this app.',
  scope: 'Permission to send email was not granted. Please tick the "Send email on your behalf" box and retry.',
  oauth: 'Authentication failed. Please check your connection and try again.',
};

export default function Login() {
  const code = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('error')
    : null;

  return (
    <div className="modern-split">
      {/* ================= LEFT SIDE: HERO & IMAGE SHOWCASE ================= */}
      <div className="hero-side">
        {/* Background Image with Deep Gradient Overlay */}
        <div className="hero-bg-media">
          <img
            src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1400&q=80"
            alt="Productive workspace"
            className="hero-img"
          />
          <div className="hero-gradient-overlay"></div>
          <div className="ambient-orb orb-1"></div>
          <div className="ambient-orb orb-2"></div>
        </div>

        {/* Brand Header */}
        <div className="hero-top">
          <div className="brand-chip">
            <div className="brand-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span>ResumeSender</span>
          </div>
          <span className="version-pill">v2.0 • Gmail Native</span>
        </div>

        {/* Center: Hero Copy & Floating UI Glass Cards */}
        <div className="hero-center">
          <h1 className="hero-headline">
            Land more interviews with <span className="text-highlight">direct-inbox</span> outreach.
          </h1>
          <p className="hero-subline">
            Automate personalized resume dispatches to hundreds of recruiters directly from your own Gmail account—bypassing spam filters completely.
          </p>

          {/* Floating UI Live Badges */}
          <div className="floating-cards-group">
            {/* Card 1: Deliverability */}
            <div className="glass-card card-top">
              <div className="glass-icon green">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="card-label">Primary Inbox Delivery</p>
                <p className="card-value">100% Native Gmail Protocol</p>
              </div>
            </div>

            {/* Card 2: Recruiter Response Alert */}
            <div className="glass-card card-bottom">
              <div className="avatar-stack">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" alt="Recruiter" />
                <span className="online-badge"></span>
              </div>
              <div>
                <p className="card-label">Sarah • Tech Recruiter</p>
                <p className="card-value response">"Reviewed your resume. Let's talk!"</p>
              </div>
              <span className="card-time">2m ago</span>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof */}
        <div className="hero-footer">
          <div className="stats-row">
            <div>
              <span className="stat-number">3.8x</span>
              <span className="stat-text">Higher reply rate</span>
            </div>
            <div className="stat-divider"></div>
            <div>
              <span className="stat-number">0%</span>
              <span className="stat-text">Spam penalty</span>
            </div>
            <div className="stat-divider"></div>
            <div>
              <span className="stat-number">Zero</span>
              <span className="stat-text">Inbox access</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE: AUTH FORM ================= */}
      <div className="auth-side">
        <div className="auth-box">
          <div className="auth-header">
            <span className="auth-tag">Direct Gmail Integration</span>
            <h2>Get Started</h2>
            <p className="auth-desc">
              Connect your Google account to start dispatching your personalized resumes to recruiters.
            </p>
          </div>

          {/* Dynamic Error Banner */}
          {code && (
            <div className="alert-banner" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{ERRORS[code] || 'Something went wrong. Please try again.'}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <div className="action-wrapper">
            <a className="btn-google" href="/api/auth/google">
              <svg className="g-logo" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>

          {/* Privacy Guarantee Box */}
          <div className="security-box">
            <div className="shield-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="security-copy">
              <h6>Guaranteed Privacy Sandbox</h6>
              <p>
                We only request Google's <code>gmail.send</code> permission to trigger your outreach. 
                This app <strong>cannot read, view, or store</strong> your incoming emails.
              </p>
            </div>
          </div>

          <p className="auth-footer-terms">
            By connecting, you authorize ResumeSender to send emails only when initiated by you.
          </p>
        </div>
      </div>
    </div>
  );
}