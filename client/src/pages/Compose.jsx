import React, { useMemo, useState, useRef } from 'react';
import { api } from '../api.js';
import '../assets/Compose.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseBulkText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];

  lines.forEach((line, i) => {
    const parts = line.split(/[,\t;]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    const email = (parts[0] || '').toLowerCase();
    if (i === 0 && email === 'email') return; // Skip CSV header
    if (!EMAIL_RE.test(email)) {
      invalid.push(line);
      return;
    }
    valid.push({
      id: Math.random().toString(36).substring(2, 9),
      email,
      name: parts[1] || '',
      company: parts[2] || '',
    });
  });

  return { valid, invalid };
}

const fill = (text, r) =>
  text.replace(/\{\{\s*(name|company)\s*\}\}/gi, (_, k) =>
    k.toLowerCase() === 'name' ? r.name || 'there' : r.company || 'your company'
  );

export default function Compose({ user, onCreated }) {
  const { maxRecipients, maxPdfMb, dailyLimit } = user.limits;

  // Recipients State (Array of objects instead of raw text)
  const [recipients, setRecipients] = useState([]);
  const [inputMode, setInputMode] = useState('single'); // 'single' | 'bulk'

  // Single Input Fields
  const [singleEmail, setSingleEmail] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleCompany, setSingleCompany] = useState('');
  const [singleError, setSingleError] = useState('');

  // Bulk Input Field
  const [bulkText, setBulkText] = useState('');

  // General Form States
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);

  const remainingToday = Math.max(dailyLimit - user.sentToday, 0);
  const quotaPercent = Math.min(Math.round((user.sentToday / dailyLimit) * 100), 100);

  // Validation (Resume is now 100% Optional)
  const problems = [];
  if (recipients.length === 0) problems.push('Add at least one recipient.');
  if (recipients.length > maxRecipients) problems.push(`Maximum ${maxRecipients} recipients allowed per batch.`);
  if (recipients.length > remainingToday) problems.push(`Only ${remainingToday} sends left in your 24h limit.`);
  if (!subject.trim()) problems.push('Enter an email subject line.');
  if (!body.trim()) problems.push('Write your email message.');
  
  // Only validate file IF user chooses to upload one
  if (file) {
    if (!/\.pdf$/i.test(file.name)) problems.push('Resume must be a PDF.');
    else if (file.size > maxPdfMb * 1024 * 1024) problems.push(`Resume must be under ${maxPdfMb} MB.`);
  }

  // Add individual recipient
  const handleAddSingle = (e) => {
    e?.preventDefault();
    setSingleError('');

    const cleanEmail = singleEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setSingleError('Please enter an email address.');
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setSingleError('Invalid email format (e.g., recruiter@company.com).');
      return;
    }
    if (recipients.some((r) => r.email === cleanEmail)) {
      setSingleError('This email is already added in the list.');
      return;
    }

    setRecipients((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        email: cleanEmail,
        name: singleName.trim(),
        company: singleCompany.trim(),
      },
    ]);

    // Reset inputs
    setSingleEmail('');
    setSingleName('');
    setSingleCompany('');
  };

  // Add bulk text
  const handleAddBulk = () => {
    if (!bulkText.trim()) return;
    const { valid, invalid } = parseBulkText(bulkText);

    if (invalid.length > 0 && valid.length === 0) {
      setError(`No valid emails found. Please check: ${invalid.slice(0, 2).join(', ')}`);
      return;
    }

    // Filter duplicates
    setRecipients((prev) => {
      const existing = new Set(prev.map((r) => r.email));
      const newItems = valid.filter((v) => !existing.has(v.email));
      return [...prev, ...newItems];
    });

    setBulkText('');
    setInputMode('single');
  };

  // Import CSV File
  const importCsv = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    const { valid } = parseBulkText(text);

    setRecipients((prev) => {
      const existing = new Set(prev.map((r) => r.email));
      const newItems = valid.filter((v) => !existing.has(v.email));
      return [...prev, ...newItems];
    });
  };

  const removeRecipient = (id) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAllRecipients = () => {
    if (window.confirm('Remove all recipients from list?')) {
      setRecipients([]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
  };

  const insertVariable = (variable) => {
    setBody((prev) => `${prev} {{${variable}}}`);
    if (bodyRef.current) bodyRef.current.focus();
  };

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('subject', subject);
      form.append('body', body);
      form.append('recipients', JSON.stringify(recipients));
      
      // Append file only if user uploaded one
      if (file) {
        form.append('resume', file);
      }
      
      const { id } = await api.create(form);
      onCreated(id);
    } catch (err) {
      const extra = err.details?.invalid?.length ? `: ${err.details.invalid.join(', ')}` : '';
      setError(err.message + extra);
      setStep('edit');
    } finally {
      setBusy(false);
    }
  };

  // ================= PREVIEW SCREEN =================
  if (step === 'preview') {
    const first = recipients[0];
    return (
      <div className="compose-container">
        <div className="compose-card">
          <div className="preview-top-bar">
            <div>
              <span className="badge-tag">Final Check</span>
              <h2>Ready to Dispatch</h2>
              <p className="preview-sub">
                Each email is generated as its own individual thread. Candidates never see each other.
              </p>
            </div>
            <div className="summary-pill">
              <strong>{recipients.length}</strong> {recipients.length === 1 ? 'Email' : 'Emails'}
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-box">
              <span className="summary-label">Sender</span>
              <span className="summary-val">{user.email}</span>
            </div>
            <div className="summary-box">
              <span className="summary-label">Total Recipients</span>
              <span className="summary-val">{recipients.length} Candidates</span>
            </div>
            <div className="summary-box">
              <span className="summary-label">Resume Attachment</span>
              <span className="summary-val">
                {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'None (Text Only)'}
              </span>
            </div>
          </div>

          <div className="email-client-preview">
            <div className="email-client-header">
              <div className="client-avatar">{user.email.charAt(0).toUpperCase()}</div>
              <div className="client-meta">
                <div className="client-sender">
                  <strong>You</strong> <span className="client-email">&lt;{user.email}&gt;</span>
                </div>
                <div className="client-to">
                  to: <span className="chip-to">{first.name || first.email}</span>
                  {recipients.length > 1 && (
                    <span className="chip-muted">+{recipients.length - 1} other individual sends</span>
                  )}
                </div>
              </div>
            </div>

            <div className="email-client-subject">{fill(subject, first)}</div>
            <div className="email-client-body">{fill(body, first)}</div>

            {/* Conditionally display attachment preview if one was uploaded */}
            {file && (
              <div className="email-client-attachment">
                <div className="pdf-icon">PDF</div>
                <div className="pdf-info">
                  <span className="pdf-name">{file.name}</span>
                  <span className="pdf-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>
            )}
          </div>

          {error && <div className="banner bad">{error}</div>}

          <div className="preview-footer-actions">
            <button className="btn secondary" onClick={() => setStep('edit')} disabled={busy}>
              ← Back to Edit
            </button>
            <button className="btn primary glow" onClick={send} disabled={busy}>
              {busy ? 'Dispatching...' : `Send ${recipients.length} Personalized Email${recipients.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= EDIT SCREEN =================
  return (
    <div className="compose-container">
      <div className="compose-card">
        {/* Header with Daily Quota Bar */}
        <div className="compose-header">
          <div>
            <h2>New Outreach Campaign</h2>
            <p className="subtitle">Deliver your resume straight to recruiters from your personal Gmail.</p>
          </div>

          <div className="quota-widget">
            <div className="quota-labels">
              <span>24h Gmail Quota</span>
              <strong>{user.sentToday}/{dailyLimit} sent</strong>
            </div>
            <div className="quota-track">
              <div
                className={`quota-fill ${quotaPercent > 80 ? 'danger' : ''}`}
                style={{ width: `${quotaPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 1: SMART RECIPIENT MANAGER ================= */}
        <div className="form-group recipient-manager-box">
          <div className="manager-top-bar">
            <div>
              <label className="section-title">Recipients</label>
              <p className="section-desc">Add candidates one by one or paste a list.</p>
            </div>

            {/* Mode Switcher */}
            <div className="mode-toggle">
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'single' ? 'active' : ''}`}
                onClick={() => setInputMode('single')}
              >
                + Add One by One
              </button>
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'bulk' ? 'active' : ''}`}
                onClick={() => setInputMode('bulk')}
              >
                📋 Bulk Paste
              </button>
              <label className="toggle-btn csv-label">
                📁 Upload CSV
                <input type="file" accept=".csv,.txt" onChange={importCsv} hidden />
              </label>
            </div>
          </div>

          {/* Mode 1: Individual Field Input */}
          {inputMode === 'single' && (
            <div className="single-input-row">
              <div className="input-field flex-2">
                <span className="field-hint">Email Address *</span>
                <input
                  type="email"
                  className="modern-input"
                  placeholder="e.g. recruiter@google.com"
                  value={singleEmail}
                  onChange={(e) => {
                    setSingleEmail(e.target.value);
                    setSingleError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSingle(e)}
                />
              </div>

              <div className="input-field flex-1">
                <span className="field-hint">Name (Optional)</span>
                <input
                  type="text"
                  className="modern-input"
                  placeholder="e.g. Sarah"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSingle(e)}
                />
              </div>

              <div className="input-field flex-1">
                <span className="field-hint">Company (Optional)</span>
                <input
                  type="text"
                  className="modern-input"
                  placeholder="e.g. Google"
                  value={singleCompany}
                  onChange={(e) => setSingleCompany(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSingle(e)}
                />
              </div>

              <button type="button" className="btn-add-candidate" onClick={handleAddSingle}>
                + Add
              </button>
            </div>
          )}

          {singleError && <p className="field-error-msg">{singleError}</p>}

          {/* Mode 2: Bulk Paste */}
          {inputMode === 'bulk' && (
            <div className="bulk-input-box">
              <p className="bulk-help">
                💡 Paste any list below. You can paste just emails, or <code>email, name, company</code>.
              </p>
              <textarea
                className="modern-textarea code-font"
                rows={4}
                placeholder={`recruiter@stripe.com, Sarah, Stripe\nhiring@apple.com\nalex@meta.com, Alex`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="bulk-actions">
                <button type="button" className="btn primary small" onClick={handleAddBulk}>
                  Add to Recipient List
                </button>
                <button type="button" className="btn secondary small" onClick={() => setInputMode('single')}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Recipient Cards Display */}
          <div className="recipients-display-area">
            <div className="display-header">
              <span className="count-tag">
                <strong>{recipients.length}</strong> {recipients.length === 1 ? 'candidate' : 'candidates'} added
                {recipients.length > maxRecipients && (
                  <span className="overlimit-warning"> (Max {maxRecipients})</span>
                )}
              </span>
              {recipients.length > 0 && (
                <button type="button" className="btn-clear-all" onClick={clearAllRecipients}>
                  Clear List
                </button>
              )}
            </div>

            {recipients.length === 0 ? (
              <div className="empty-recipients-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <span>No recipients added yet. Enter an email above or upload a CSV.</span>
              </div>
            ) : (
              <div className="recipients-grid-list">
                {recipients.map((r) => (
                  <div key={r.id} className="recipient-chip-card">
                    <div className="chip-avatar">
                      {(r.name || r.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="chip-content">
                      <span className="chip-email">{r.email}</span>
                      <div className="chip-meta">
                        {r.name && <span className="meta-tag name">👤 {r.name}</span>}
                        {r.company && <span className="meta-tag company">🏢 {r.company}</span>}
                        {!r.name && !r.company && <span className="meta-tag empty">Email only</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-chip"
                      onClick={() => removeRecipient(r.id)}
                      title="Remove candidate"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================= SECTION 2: SUBJECT ================= */}
        <div className="form-group">
          <label htmlFor="subject">Subject Line</label>
          <input
            id="subject"
            className="modern-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Application: Full Stack Engineer — {{name}}"
            maxLength={200}
          />
        </div>

        {/* ================= SECTION 3: BODY & TEMPLATE TAGS ================= */}
        <div className="form-group">
          <div className="label-row">
            <label htmlFor="body">Email Message</label>
            <div className="variable-picker">
              <span className="var-hint">Click to insert:</span>
              <button type="button" className="tag-btn" onClick={() => insertVariable('name')}>
                + &#123;&#123;name&#125;&#125;
              </button>
              <button type="button" className="tag-btn" onClick={() => insertVariable('company')}>
                + &#123;&#123;company&#125;&#125;
              </button>
            </div>
          </div>

          <textarea
            id="body"
            ref={bodyRef}
            rows={7}
            className="modern-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{name}},&#10;&#10;I’ve been following {{company}}’s latest work and wanted to submit my resume for open engineering roles..."
          />
        </div>

        {/* ================= SECTION 4: RESUME DROPZONE (OPTIONAL) ================= */}
        <div className="form-group">
          <div className="label-row">
            <label>Resume Attachment <span className="label-sub">(Optional)</span></label>
          </div>
          
          {!file ? (
            <div
              className={`dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="drop-title">
                <strong>Click to upload</strong> or drag & drop (Optional)
              </p>
              <p className="drop-sub">PDF only (up to {maxPdfMb} MB)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                hidden
              />
            </div>
          ) : (
            <div className="file-preview-card">
              <div className="file-badge">PDF</div>
              <div className="file-meta">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <button type="button" className="btn-remove-file" onClick={() => setFile(null)}>
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Global Errors */}
        {error && <div className="banner bad">{error}</div>}

        {/* Footer Actions */}
        <div className="compose-footer">
          <div className="footer-left">
            {problems.length > 0 ? (
              <span className="validation-warning">⚠️ {problems[0]}</span>
            ) : (
              <span className="validation-success">✓ Ready to send</span>
            )}
          </div>

          <button
            className="btn primary"
            disabled={problems.length > 0 || user.gmailStatus !== 'connected'}
            onClick={() => setStep('preview')}
          >
            Review & Preview →
          </button>
        </div>
      </div>
    </div>
  );
}