import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import '../assets/History.css';

const STATUS_CONFIG = {
  sent: { label: 'Delivered', icon: '✓', class: 'sent' },
  failed: { label: 'Failed', icon: '✕', class: 'failed' },
  sending: { label: 'Sending...', icon: '↻', class: 'sending' },
  pending: { label: 'Queued', icon: '⏱', class: 'pending' },
};

const when = (d) =>
  new Date(d).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function History({ selectedId, onSelect, onChanged }) {
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tableFilter, setTableFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadList = useCallback(
    () => api.campaigns().then((d) => setList(d.campaigns)).catch((e) => setError(e.message)),
    []
  );
  const loadDetail = useCallback(
    (id) => api.campaign(id).then(setDetail).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  // Live polling while sending
  const active = list.some((c) => c.status === 'running') || detail?.campaign?.status === 'running';
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => {
      loadList();
      if (selectedId) loadDetail(selectedId);
      onChanged?.();
    }, 3000);
    return () => clearInterval(t);
  }, [active, selectedId, loadList, loadDetail, onChanged]);

  const messages = detail?.messages || [];
  const count = (s) => messages.filter((m) => m.status === s).length;
  const sentCount = count('sent');
  const failedCount = count('failed');
  const waitingCount = count('pending') + count('sending');
  const totalCount = messages.length;
  const successRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  const retryable =
    messages.filter((m) => m.status === 'failed' && m.errorCategory !== 'invalid').length + count('pending');

  // Filter & Search recipients
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const matchesFilter =
        tableFilter === 'all' ||
        (tableFilter === 'sent' && m.status === 'sent') ||
        (tableFilter === 'failed' && m.status === 'failed') ||
        (tableFilter === 'pending' && (m.status === 'pending' || m.status === 'sending'));

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.email.toLowerCase().includes(q) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.company && m.company.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [messages, tableFilter, searchQuery]);

  const retry = async () => {
    setBusy(true);
    setError('');
    try {
      await api.retry(selectedId);
      await Promise.all([loadDetail(selectedId), loadList()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (idToDelete) => {
    const id = idToDelete || selectedId;
    if (!window.confirm('Delete this send, its recipient list, and the stored resume?')) return;
    setBusy(true);
    setError('');
    try {
      await api.remove(id);
      if (id === selectedId) onSelect(null);
      await loadList();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ================= VIEW 1: SELECTED CAMPAIGN RECIPIENTS TABLE =================
  if (selectedId && detail) {
    return (
      <div className="table-dashboard-container">
        {/* Navigation Breadcrumb */}
        <div className="dashboard-top-nav">
          <button className="btn-back-link" onClick={() => onSelect(null)}>
            ← Back to All Campaigns
          </button>
          <div className="campaign-tag-live">
            {detail.campaign.status === 'running' ? (
              <span className="live-chip">● Sending in progress</span>
            ) : (
              <span className="done-chip">✓ Completed</span>
            )}
          </div>
        </div>

        {/* Campaign Header & Summary KPIs */}
        <div className="campaign-summary-card">
          <div className="summary-left">
            <h2>{detail.campaign.subject}</h2>
            <div className="summary-details">
              <span>📅 {when(detail.campaign.createdAt)}</span>
              <span>📎 {detail.campaign.attachment.filename}</span>
            </div>
          </div>

          <div className="summary-kpis">
            <div className="kpi-box success">
              <span className="kpi-num">{sentCount}</span>
              <span className="kpi-txt">Delivered</span>
            </div>
            <div className="kpi-box danger">
              <span className="kpi-num">{failedCount}</span>
              <span className="kpi-txt">Failed</span>
            </div>
            <div className="kpi-box warning">
              <span className="kpi-num">{waitingCount}</span>
              <span className="kpi-txt">Queued</span>
            </div>
            <div className="kpi-box info">
              <span className="kpi-num">{successRate}%</span>
              <span className="kpi-txt">Success Rate</span>
            </div>
          </div>
        </div>

        {error && <div className="table-alert-banner">{error}</div>}

        {/* Table Filters & Search */}
        <div className="table-filter-header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by recruiter email, name, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="tab-filters">
            <button
              className={`filter-tab ${tableFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTableFilter('all')}
            >
              All ({messages.length})
            </button>
            <button
              className={`filter-tab ${tableFilter === 'sent' ? 'active' : ''}`}
              onClick={() => setTableFilter('sent')}
            >
              Delivered ({sentCount})
            </button>
            <button
              className={`filter-tab ${tableFilter === 'failed' ? 'active' : ''}`}
              onClick={() => setTableFilter('failed')}
            >
              Failed ({failedCount})
            </button>
            <button
              className={`filter-tab ${tableFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setTableFilter('pending')}
            >
              In Queue ({waitingCount})
            </button>
          </div>

          {detail.campaign.status !== 'running' && retryable > 0 && (
            <button className="btn-action-primary" onClick={retry} disabled={busy}>
              ↻ Retry {retryable} Failed
            </button>
          )}
        </div>

        {/* Recipients Table */}
        <div className="data-table-wrapper">
          <table className="modern-data-table">
            <thead>
              <tr>
                <th>Candidate / Recipient</th>
                <th>Company</th>
                <th>Delivery Status</th>
                <th>Sent At / Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-table-cell">
                    No recipients found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((m) => {
                  const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
                  const initial = (m.name || m.email).charAt(0).toUpperCase();

                  return (
                    <tr key={m._id}>
                      <td>
                        <div className="user-profile-cell">
                          <span className="user-avatar">{initial}</span>
                          <div className="user-info">
                            <span className="user-email">{m.email}</span>
                            {m.name && <span className="user-name">{m.name}</span>}
                          </div>
                        </div>
                      </td>

                      <td>
                        {m.company ? (
                          <span className="company-tag">🏢 {m.company}</span>
                        ) : (
                          <span className="muted-dash">—</span>
                        )}
                      </td>

                      <td>
                        <span className={`status-badge ${cfg.class}`}>
                          <span className="status-icon">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </td>

                      <td>
                        {m.status === 'sent' && m.sentAt ? (
                          <span className="timestamp-text">{when(m.sentAt)}</span>
                        ) : m.errorMessage ? (
                          <span className="error-text" title={m.errorMessage}>
                            {m.errorMessage}
                          </span>
                        ) : (
                          <span className="muted-dash">Pending in Gmail</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ================= VIEW 2: ALL CAMPAIGNS MASTER TABLE =================
  return (
    <div className="table-dashboard-container">
      {/* Top Header */}
      <div className="master-table-header">
        <div>
          <h2>Outreach Campaign History</h2>
          <p className="master-subtitle">All your resume email dispatches tracked in a single tabular dashboard.</p>
        </div>
        <div className="total-badge">{list.length} Total Sends</div>
      </div>

      {error && <div className="table-alert-banner">{error}</div>}

      {/* Main Table */}
      <div className="data-table-wrapper">
        <table className="modern-data-table">
          <thead>
            <tr>
              <th>Campaign Subject</th>
              <th>Date Sent</th>
              <th>Progress</th>
              <th>Delivered</th>
              <th>Failed</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No outreach campaigns sent yet. Create a new send in the Compose tab to see it here!
                </td>
              </tr>
            ) : (
              list.map((c) => {
                const isRunning = c.status === 'running';
                const pct = c.total > 0 ? Math.round((c.counts.sent / c.total) * 100) : 0;

                return (
                  <tr key={c.id} className="interactive-row" onClick={() => onSelect(c.id)}>
                    {/* Subject */}
                    <td>
                      <div className="campaign-subject-cell">
                        <strong className="subject-title">{c.subject}</strong>
                        {c.attachment?.filename && (
                          <span className="attachment-sub">📎 {c.attachment.filename}</span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td>
                      <span className="timestamp-text">{when(c.createdAt)}</span>
                    </td>

                    {/* Progress Bar & Numbers */}
                    <td style={{ minWidth: '150px' }}>
                      <div className="progress-cell">
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${c.counts.failed > 0 ? 'has-fail' : ''}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="progress-txt">
                          {c.counts.sent} / {c.total} ({pct}%)
                        </span>
                      </div>
                    </td>

                    {/* Delivered */}
                    <td>
                      <span className="count-pill-green">{c.counts.sent}</span>
                    </td>

                    {/* Failed */}
                    <td>
                      <span className={`count-pill-red ${c.counts.failed === 0 ? 'zero' : ''}`}>
                        {c.counts.failed}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      {isRunning ? (
                        <span className="status-badge sending">
                          <span className="pulse-dot"></span> Sending
                        </span>
                      ) : (
                        <span className="status-badge sent">✓ Completed</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="action-button-group">
                        <button className="btn-table-view" onClick={() => onSelect(c.id)}>
                          View Details →
                        </button>
                        {!isRunning && (
                          <button
                            className="btn-table-delete"
                            title="Delete campaign"
                            onClick={() => remove(c.id)}
                            disabled={busy}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}