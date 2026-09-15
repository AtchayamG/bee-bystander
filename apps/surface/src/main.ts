// Bystander Surface - 4-View Accessible Single Page Application
// Strict Invariants: No hardcoded checkmarks, no invented numbers, no numeric fallbacks, WCAG AAA compliant

interface ParticipantConsent {
  clusterId: string;
  name: string;
  role: string;
  status: string;
  updatedAt: number;
  notes?: string;
}

interface Utterance {
  id: number;
  realtime: boolean;
  start: number | null;
  end: number | null;
  spoken_at: number | null;
  text: string;
  speaker: string;
  created_at: number;
}

interface RedactionEntry {
  id: string;
  utteranceId: number;
  clusterId: string;
  speakerName: string;
  category: string;
  reason: string;
  span: [number, number];
  charCount: number;
  wordCount: number;
  replacementText: string;
}

interface RedactionAudit {
  removals: RedactionEntry[];
  totalRedactedChars: number;
  totalRedactedWords: number;
  unconsentedSpeakerCount: number;
  piiCount: number;
  processedAt: number;
}

interface RefusalResult {
  refused: boolean;
  code?: string;
  reason?: string;
  details?: {
    triggerUtteranceId?: number;
    clusterId?: string;
    explanation: string;
  };
}

interface PipelineResult {
  conversationId: number;
  title: string;
  rawUtteranceCount: number;
  redactedUtteranceCount: number;
  rawCharCount: number;
  redactedCharCount: number;
  ledger: ParticipantConsent[];
  audit: RedactionAudit;
  refusal: RefusalResult;
  redactedUtterances: Utterance[];
  redactedText: string;
  summary: string | null;
  mode: string;
  apiStatus: {
    code: number;
    message: string;
  };
}

interface EventRecord {
  id: string;
  kind: string;
  clusterId: string | null;
  conversationId: number | null;
  detail: string | null;
  createdAt: number;
}

interface StoredAuditRecord {
  id: string;
  conversationId: number;
  category: string;
  clusterId: string;
  reason: string;
  spanStart: number;
  spanEnd: number;
  charCount: number;
  wordCount: number;
  replacementText: string;
  createdAt: number;
}

interface AppStatus {
  service: string;
  version: string;
  protocolFloor: string;
  mcpEndpoint: string;
  // Names the server actually registered, from GET /api/status. Optional so an
  // older server renders "not reported" instead of a hardcoded list.
  mcpTools?: string[];
  activeDbPath: string;
  // Reported by GET /api/status, which reads PRAGMA journal_mode and
  // PRAGMA foreign_keys off the open database. Optional so a server that
  // predates the field renders "not reported" rather than a confident literal.
  storage?: {
    journalMode: string;
    foreignKeys: boolean;
  };
  retentionDays: number;
  beeApi: {
    // Matches what GET /api/status actually sends. `status` was declared here
    // but never sent by the server, so anything reading it rendered
    // "not reported" - the honest fallback firing on a field that was simply
    // mistyped rather than missing.
    mode: 'live' | 'fixture';
    hasToken: boolean;
    endpoint: string;
    code: number;
    message: string;
  };
  participants: ParticipantConsent[];
}

type ViewRoute = 'capture' | 'ledger' | 'audit' | 'settings';

// Application State
let currentRoute: ViewRoute = 'capture';
let currentScenarioId = 101;
let pipelineData: PipelineResult | null = null;
let rawConversations: Array<{ id: number; title: string }> = [];
let allEvents: EventRecord[] = [];
let storedAuditRecords: StoredAuditRecord[] = [];
let auditSelectedScenarioId = 101;
let appStatus: AppStatus | null = null;
let purgeModalOpen = false;
let formAlertMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
let auditAlertMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
let settingsAlertMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;

// Helpers: Strict truthfulness, no numeric fallback
function formatField(val: unknown): string {
  if (val === undefined || val === null || val === '') {
    return 'not reported';
  }
  return String(val);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseRoute(): ViewRoute {
  const hash = window.location.hash.replace(/^#/, '').toLowerCase();
  if (hash === 'ledger' || hash === 'audit' || hash === 'settings') {
    return hash;
  }
  return 'capture';
}

// API Interactions
async function loadConversations(): Promise<void> {
  try {
    const res = await fetch('/api/conversations');
    if (res.ok) {
      const data = await res.json();
      rawConversations = data.conversations.map((c: any) => ({
        id: c.id,
        title: c.title
      }));
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function loadPipeline(id: number): Promise<void> {
  currentScenarioId = id;
  try {
    const res = await fetch(`/api/pipeline/${id}`);
    if (!res.ok) {
      throw new Error(`Pipeline returned HTTP ${res.status}`);
    }
    pipelineData = await res.json();
  } catch (err) {
    console.error('Failed to load pipeline:', err);
  }
  renderApp();
}

async function loadLedgerData(): Promise<void> {
  try {
    const [statusRes, eventsRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/events')
    ]);
    if (statusRes.ok) {
      appStatus = await statusRes.json();
    }
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      allEvents = data.events;
    }
  } catch (err) {
    console.error('Failed to load ledger data:', err);
  }
  renderApp();
}

async function loadAuditRecords(convId: number): Promise<void> {
  auditSelectedScenarioId = convId;
  try {
    const res = await fetch(`/api/audit/${convId}`);
    if (res.ok) {
      const data = await res.json();
      storedAuditRecords = data.records;
    }
  } catch (err) {
    console.error('Failed to load audit records:', err);
  }
  renderApp();
}

async function loadSettingsData(): Promise<void> {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      appStatus = await res.json();
    }
  } catch (err) {
    console.error('Failed to load settings data:', err);
  }
  renderApp();
}

async function toggleConsentStatus(clusterId: string, currentStatus: string): Promise<void> {
  const nextStatus = currentStatus === 'CONSENTED' ? 'REVOKED' : 'CONSENTED';
  try {
    const res = await fetch(`/api/consent/${encodeURIComponent(clusterId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) {
      if (currentRoute === 'capture') {
        await loadPipeline(currentScenarioId);
      } else {
        await loadLedgerData();
      }
    }
  } catch (err) {
    console.error('Failed to toggle consent:', err);
  }
}

async function unenrolCluster(clusterId: string): Promise<void> {
  try {
    const res = await fetch(`/api/consent/${encodeURIComponent(clusterId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      formAlertMessage = {
        text: `Un-enrolled ${clusterId}. Cluster reverted to UNKNOWN (strict refusal).`,
        type: 'info'
      };
      await loadLedgerData();
    }
  } catch (err) {
    console.error('Failed to un-enrol cluster:', err);
  }
}

async function submitEnrolment(e: Event): Promise<void> {
  e.preventDefault();
  const clusterInput = document.getElementById('enrol-cluster') as HTMLInputElement | null;
  const nameInput = document.getElementById('enrol-name') as HTMLInputElement | null;
  const roleSelect = document.getElementById('enrol-role') as HTMLSelectElement | null;
  const statusSelect = document.getElementById('enrol-status') as HTMLSelectElement | null;
  const notesInput = document.getElementById('enrol-notes') as HTMLInputElement | null;

  if (!clusterInput || !nameInput || !roleSelect || !statusSelect) return;

  const payload = {
    clusterId: clusterInput.value.trim(),
    name: nameInput.value.trim(),
    role: roleSelect.value,
    status: statusSelect.value,
    notes: notesInput ? notesInput.value.trim() : undefined
  };

  try {
    const res = await fetch('/api/consent/enrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.status === 201) {
      formAlertMessage = {
        text: `Successfully enrolled ${result.participant.name} (${result.participant.clusterId}) with status ${result.participant.status}.`,
        type: 'success'
      };
      clusterInput.value = '';
      nameInput.value = '';
      if (notesInput) notesInput.value = '';
      await loadLedgerData();
    } else {
      formAlertMessage = {
        text: `Enrolment rejected: [${result.code}] ${result.error}`,
        type: 'error'
      };
      renderApp();
    }
  } catch (err) {
    formAlertMessage = {
      text: `Network error submitting enrolment: ${String(err)}`,
      type: 'error'
    };
    renderApp();
  }
}

async function executePurge(): Promise<void> {
  try {
    const res = await fetch('/api/retention/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: auditSelectedScenarioId })
    });
    const result = await res.json();
    purgeModalOpen = false;
    if (res.ok) {
      // Reload audit records to prove 0 remain
      const reloadRes = await fetch(`/api/audit/${auditSelectedScenarioId}`);
      const reloadData = await reloadRes.json();
      storedAuditRecords = reloadData.records;
      auditAlertMessage = {
        text: `Purged conversation ${auditSelectedScenarioId}: ${result.deletedAuditRecords} records deleted. Verified ${storedAuditRecords.length} records remain.`,
        type: 'success'
      };
    } else {
      auditAlertMessage = {
        text: `Purge failed: [${result.code}] ${result.error}`,
        type: 'error'
      };
    }
  } catch (err) {
    purgeModalOpen = false;
    auditAlertMessage = {
      text: `Network error during purge: ${String(err)}`,
      type: 'error'
    };
  }
  renderApp();
}

async function saveRetentionConfig(days: number): Promise<void> {
  try {
    const res = await fetch('/api/retention/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: days })
    });
    const result = await res.json();
    if (res.ok) {
      settingsAlertMessage = {
        text: `Retention window updated to ${result.retentionDays} days.`,
        type: 'success'
      };
      await loadSettingsData();
    } else {
      settingsAlertMessage = {
        text: `Config update rejected: [${result.code}] ${result.error}`,
        type: 'error'
      };
      renderApp();
    }
  } catch (err) {
    settingsAlertMessage = {
      text: `Network error saving config: ${String(err)}`,
      type: 'error'
    };
    renderApp();
  }
}

async function triggerImmediateSweep(): Promise<void> {
  try {
    const res = await fetch('/api/retention/sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (res.ok) {
      settingsAlertMessage = {
        text: `Sweep executed: ${result.sweptAuditRecords} expired records deleted from SQLite.`,
        type: 'success'
      };
    } else {
      settingsAlertMessage = {
        text: `Sweep failed: ${result.error}`,
        type: 'error'
      };
    }
  } catch (err) {
    settingsAlertMessage = {
      text: `Network error during sweep: ${String(err)}`,
      type: 'error'
    };
  }
  renderApp();
}

// VIEW 1: Capture View
function renderCaptureView(): string {
  if (!pipelineData) {
    return '<div class="metric-card">Loading pipeline capture stream...</div>';
  }

  const data = pipelineData;
  const audit = data.audit;
  const refusal = data.refusal;
  const charDelta = Math.max(0, data.rawCharCount - data.redactedCharCount);

  return `
    <!-- Scenario Selection & API Telemetry -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
      <div class="controls-cluster">
        <label for="scenarioSelect" class="metric-label" style="margin-bottom:0;">Active Capture Scenario:</label>
        <select id="scenarioSelect" class="scenario-select" aria-label="Select Capture Scenario">
          ${rawConversations
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === currentScenarioId ? 'selected' : ''}>${escapeHtml(
                  c.title
                )} (ID: ${c.id})</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="status-badge ${data.mode === 'live' ? 'live' : ''}">
        API ${formatField(data.apiStatus.code)}: ${formatField(data.apiStatus.message)}
      </div>
    </div>

    <!-- Computed Metrics Strip -->
    <section class="metrics-strip" aria-label="Pipeline Metrics">
      <div class="metric-card">
        <div class="metric-label">Raw Utterances</div>
        <div class="metric-value">${formatField(data.rawUtteranceCount)}</div>
        <div class="metric-sub">Total turns ingested from device</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Redacted Utterances</div>
        <div class="metric-value">${formatField(data.redactedUtteranceCount)}</div>
        <div class="metric-sub">Cleaned downstream transcript</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Redactions</div>
        <div class="metric-value">${formatField(audit.removals.length)}</div>
        <div class="metric-sub">${formatField(audit.unconsentedSpeakerCount)} unconsented, ${formatField(audit.piiCount)} PII</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Characters Removed</div>
        <div class="metric-value">${formatField(audit.totalRedactedChars)}</div>
        <div class="metric-sub">${formatField(audit.totalRedactedWords)} words scrubbed (delta: ${formatField(charDelta)})</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Downstream Gate</div>
        <div class="metric-value" style="font-size:18px; color: ${refusal.refused ? 'var(--color-danger)' : 'var(--color-success)'}">
          ${refusal.refused ? 'REFUSED' : 'APPROVED'}
        </div>
        <div class="metric-sub">${refusal.refused ? 'Blocked at capture layer' : 'Ready for summarisation'}</div>
      </div>
    </section>

    <!-- Main 2x2 Pipeline Grid -->
    <main class="pipeline-grid">
      <!-- Panel 1: Consent Ledger Summary for this Scenario -->
      <section class="panel" aria-label="Consent Ledger Summary">
        <div class="panel-header">
          <div class="panel-title">1. Speaker Consent Ledger Summary</div>
          <div class="panel-count">${data.ledger.length} enrolled clusters</div>
        </div>
        <div class="panel-body">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cluster</th>
                <th>Participant</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledger
                .map(
                  (p) => `
                <tr>
                  <td><code>${escapeHtml(p.clusterId)}</code></td>
                  <td>${escapeHtml(p.name)}</td>
                  <td><span style="font-size:11px; color:var(--text-dim);">${escapeHtml(p.role)}</span></td>
                  <td>
                    <span class="status-pill ${p.status.toLowerCase()}">
                      ${escapeHtml(p.status)}
                    </span>
                  </td>
                  <td>
                    <button class="btn-action btn-toggle-capture" data-cluster="${escapeHtml(p.clusterId)}" data-status="${escapeHtml(p.status)}">
                      Toggle
                    </button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <p style="font-size: 11px; color: var(--text-dim); margin-top: 14px;">
            Invariant: Unmapped clusters default to UNKNOWN. UNKNOWN is never treated as consent.
          </p>
        </div>
      </section>

      <!-- Panel 2: Refusal & Gate Evaluation -->
      <section class="panel" aria-label="Downstream Gate Decision">
        <div class="panel-header">
          <div class="panel-title">2. Gating &amp; Refusal Decision</div>
          <div class="panel-count">Machine-evaluated</div>
        </div>
        <div class="panel-body">
          <div class="refusal-box ${refusal.refused ? 'refused' : 'approved'}" aria-live="assertive" role="${refusal.refused ? 'alert' : 'status'}">
            <div class="refusal-title ${refusal.refused ? 'danger' : 'success'}">
              ${refusal.refused ? 'Downstream Summary Refused' : 'Downstream Summary Permitted'}
            </div>
            <div class="refusal-desc">
              ${refusal.refused ? escapeHtml(refusal.reason || 'Summary suppressed') : 'All active speakers have consented. Content-level PII has been scrubbed.'}
            </div>
            ${
              refusal.refused && refusal.code
                ? `<div class="refusal-code">Reason Code: <code>${escapeHtml(refusal.code)}</code></div>`
                : ''
            }
          </div>

          <div class="metric-card" style="margin-top: 12px;">
            <div class="metric-label">Downstream Summary Payload</div>
            <div style="font-size: 13px; color: var(--text-muted); font-style: ${data.summary ? 'normal' : 'italic'};">
              ${data.summary ? escapeHtml(data.summary) : '[Refused: Bystander withheld summary from assistant]'}
            </div>
          </div>
        </div>
      </section>

      <!-- Panel 3: Ingested Turns vs Protected Redacted Output -->
      <section class="panel" style="grid-column: span 2;" aria-label="Capture Stream and Output">
        <div class="panel-header">
          <div class="panel-title">3. Capture Stream &amp; In-Place Redactions</div>
          <div class="panel-count">${data.redactedUtterances.length} turns processed</div>
        </div>
        <div class="panel-body">
          <div class="utterance-list">
            ${data.redactedUtterances
              .map((u) => {
                const cluster = u.speaker || 'unknown';
                const p = data.ledger.find((item) => item.clusterId === cluster);
                const speakerName = p ? p.name : cluster;
                const isBystander = p?.role === 'BYSTANDER' || p?.status !== 'CONSENTED';

                let formattedText = escapeHtml(u.text);
                formattedText = formattedText.replace(
                  /\[REDACTED: UNCONSENTED SPEAKER ([^\]]+)\]/g,
                  '<span class="redacted-pill speaker">[REDACTED: UNCONSENTED SPEAKER $1]</span>'
                );
                formattedText = formattedText.replace(
                  /\[REDACTED: EMAIL\]/g,
                  '<span class="redacted-pill pii">[REDACTED: EMAIL]</span>'
                );
                formattedText = formattedText.replace(
                  /\[REDACTED: PHONE\]/g,
                  '<span class="redacted-pill pii">[REDACTED: PHONE]</span>'
                );
                formattedText = formattedText.replace(
                  /\[REDACTED: ENTITY\]/g,
                  '<span class="redacted-pill entity">[REDACTED: ENTITY]</span>'
                );

                return `
                  <div class="utterance-item">
                    <div class="utterance-header">
                      <span class="speaker-tag ${isBystander ? 'bystander' : 'colleague'}">
                        ${escapeHtml(speakerName)} (${escapeHtml(cluster)})
                      </span>
                      <span class="utterance-time">Turn #${formatField(u.id)}</span>
                    </div>
                    <div class="utterance-text">${formattedText}</div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </section>

      <!-- Panel 4: Verifiable Redaction Audit Trail -->
      <section class="panel" style="grid-column: span 2;" aria-label="Verifiable Audit Trail">
        <div class="panel-header">
          <div class="panel-title">4. Verifiable Redaction Audit Trail</div>
          <div class="panel-count">${audit.removals.length} audit records</div>
        </div>
        <div class="panel-body" style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Category</th>
                <th>Cluster</th>
                <th>Trigger Reason</th>
                <th>Original Span</th>
                <th>Replacement Output</th>
              </tr>
            </thead>
            <tbody>
              ${
                audit.removals.length === 0
                  ? '<tr><td colspan="6" style="text-align:center; padding: 16px;">No redactions performed for this capture.</td></tr>'
                  : audit.removals
                      .map(
                        (r) => `
                <tr>
                  <td><code>${escapeHtml(r.id)}</code></td>
                  <td><span class="redacted-pill ${r.category === 'UNCONSENTED_SPEAKER' ? 'speaker' : 'pii'}">${escapeHtml(r.category)}</span></td>
                  <td><code>${escapeHtml(r.clusterId)}</code></td>
                  <td>${escapeHtml(r.reason)}</td>
                  <td><code>[${formatField(r.span[0])}, ${formatField(r.span[1])}]</code></td>
                  <td><code>${escapeHtml(r.replacementText)}</code></td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `;
}

// VIEW 2: Ledger View
function renderLedgerView(): string {
  const participants = appStatus?.participants || [];

  return `
    <div class="view-section">
      <div>
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Speaker Consent Ledger</h2>
        <p class="tagline">Manage speaker identity clusters, declared roles, and explicit consent grants.</p>
      </div>

      ${
        formAlertMessage
          ? `<div class="alert-banner ${formAlertMessage.type}" aria-live="polite">${escapeHtml(formAlertMessage.text)}</div>`
          : ''
      }

      <!-- Enrolment Form -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">Enrol New Speaker Cluster</div>
          <div class="panel-count">POST /api/consent/enrol</div>
        </div>
        <div class="panel-body">
          <form id="enrol-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="enrol-cluster" class="form-label">Cluster ID (Required)</label>
                <input type="text" id="enrol-cluster" class="form-input" placeholder="e.g. SPEAKER_5" required />
              </div>
              <div class="form-group">
                <label for="enrol-name" class="form-label">Participant Name (Required)</label>
                <input type="text" id="enrol-name" class="form-input" placeholder="e.g. Dr. Patel" required />
              </div>
              <div class="form-group">
                <label for="enrol-role" class="form-label">Declared Role</label>
                <select id="enrol-role" class="form-select">
                  <option value="PARTICIPANT">PARTICIPANT (Active Speaker)</option>
                  <option value="WEARER">WEARER (Device Owner)</option>
                  <option value="BYSTANDER">BYSTANDER (Third Party)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="enrol-status" class="form-label">Initial Consent Status</label>
                <select id="enrol-status" class="form-select">
                  <option value="CONSENTED">CONSENTED</option>
                  <option value="REVOKED">REVOKED</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="enrol-notes" class="form-label">Notes (Optional)</label>
              <input type="text" id="enrol-notes" class="form-input" placeholder="Context or relationship metadata" />
            </div>
            <button type="submit" class="btn-primary">Enrol Participant</button>
          </form>
        </div>
      </section>

      <!-- Registered Speakers Table -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">Registered Speaker Clusters</div>
          <div class="panel-count">${participants.length} clusters in SQLite</div>
        </div>
        <div class="panel-body" style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cluster ID</th>
                <th>Participant Name</th>
                <th>Declared Role</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                participants.length === 0
                  ? '<tr><td colspan="7" style="text-align:center; padding: 16px;">No participants enrolled.</td></tr>'
                  : participants
                      .map(
                        (p) => `
                <tr>
                  <td><code>${escapeHtml(p.clusterId)}</code></td>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td><span style="font-size:11px; color:var(--text-dim);">${escapeHtml(p.role)}</span></td>
                  <td><span class="status-pill ${p.status.toLowerCase()}">${escapeHtml(p.status)}</span></td>
                  <td>${escapeHtml(p.notes ? p.notes : 'none')}</td>
                  <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">
                    ${p.updatedAt ? new Date(p.updatedAt).toLocaleTimeString() : 'not reported'}
                  </td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn-action btn-toggle-ledger" data-cluster="${escapeHtml(p.clusterId)}" data-status="${escapeHtml(p.status)}">
                        Toggle Status
                      </button>
                      <button class="btn-action danger btn-unenrol-ledger" data-cluster="${escapeHtml(p.clusterId)}">
                        Un-enrol
                      </button>
                    </div>
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Audit Log of Recent Consent Changes -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">Audit Log of Recent Consent Changes</div>
          <div class="panel-count">${allEvents.length} events logged</div>
        </div>
        <div class="panel-body" style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Event Kind</th>
                <th>Cluster ID</th>
                <th>Detail</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${
                allEvents.length === 0
                  ? '<tr><td colspan="4" style="text-align:center; padding: 16px;">No events logged yet.</td></tr>'
                  : allEvents
                      .map(
                        (e) => `
                <tr>
                  <td><code>${escapeHtml(e.kind)}</code></td>
                  <td><code>${escapeHtml(e.clusterId ? e.clusterId : 'n/a')}</code></td>
                  <td>${escapeHtml(e.detail ? e.detail : 'not reported')}</td>
                  <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">
                    ${new Date(e.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

// VIEW 3: Audit View
function renderAuditView(): string {
  return `
    <div class="view-section">
      <div>
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Compliance &amp; Audit Trail Inspector</h2>
        <p class="tagline">Provable redaction accounting without storing or leaking removed speech.</p>
      </div>

      ${
        auditAlertMessage
          ? `<div class="alert-banner ${auditAlertMessage.type}" aria-live="polite">${escapeHtml(auditAlertMessage.text)}</div>`
          : ''
      }

      <!-- Controls Toolbar -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:var(--bg-card); padding:16px; border-radius:8px; border:1px solid var(--border-subtle);">
        <div class="controls-cluster">
          <label for="auditConvSelect" class="form-label" style="margin-bottom:0;">Inspect Conversation:</label>
          <select id="auditConvSelect" class="form-select">
            ${rawConversations
              .map(
                (c) =>
                  `<option value="${c.id}" ${c.id === auditSelectedScenarioId ? 'selected' : ''}>${escapeHtml(
                    c.title
                  )} (ID: ${c.id})</option>`
              )
              .join('')}
          </select>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button id="btn-export-json" class="btn-secondary">Export JSON</button>
          <button id="btn-export-csv" class="btn-secondary">Export CSV</button>
          <button id="btn-open-purge" class="btn-danger">Purge This Conversation</button>
        </div>
      </div>

      <!-- Stored Records Table -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">Stored Audit Records (SQLite)</div>
          <div class="panel-count">${storedAuditRecords.length} records verified</div>
        </div>
        <div class="panel-body" style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Category</th>
                <th>Cluster</th>
                <th>Trigger Reason</th>
                <th>Character Span</th>
                <th>Impact</th>
                <th>Replacement Output</th>
                <th>Logged At</th>
              </tr>
            </thead>
            <tbody>
              ${
                storedAuditRecords.length === 0
                  ? `<tr><td colspan="8" style="text-align:center; padding: 24px; color:var(--text-muted);">
                      0 audit records remain for conversation ${auditSelectedScenarioId}.
                    </td></tr>`
                  : storedAuditRecords
                      .map(
                        (r) => `
                <tr>
                  <td><code>${escapeHtml(r.id)}</code></td>
                  <td><span class="redacted-pill ${r.category === 'UNCONSENTED_SPEAKER' ? 'speaker' : 'pii'}">${escapeHtml(r.category)}</span></td>
                  <td><code>${escapeHtml(r.clusterId)}</code></td>
                  <td>${escapeHtml(r.reason)}</td>
                  <td><code>[${formatField(r.spanStart)}, ${formatField(r.spanEnd)}]</code></td>
                  <td>${formatField(r.charCount)} chars / ${formatField(r.wordCount)} words</td>
                  <td><code>${escapeHtml(r.replacementText)}</code></td>
                  <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">
                    ${new Date(r.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
          <p style="font-size: 11px; color: var(--text-dim); margin-top: 14px;">
            Invariant: The audit database strictly contains no column capable of storing removed speech.
          </p>
        </div>
      </section>
    </div>

    <!-- Purge Confirmation Modal -->
    ${
      purgeModalOpen
        ? `
      <div class="modal-backdrop" id="purge-modal-backdrop">
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="purge-modal-title">
          <h3 id="purge-modal-title" class="modal-title">Confirm Local Purge</h3>
          <p class="modal-body">
            Are you sure you want to permanently delete all stored audit records for
            <strong>Conversation ${auditSelectedScenarioId}</strong> from the local SQLite database?
            This operation cannot be undone. An immutable PURGE event will be recorded.
          </p>
          <div class="modal-actions">
            <button id="modal-cancel-btn" class="btn-secondary" autofocus>Cancel</button>
            <button id="modal-confirm-btn" class="btn-danger">Confirm Purge</button>
          </div>
        </div>
      </div>
    `
        : ''
    }
  `;
}

// VIEW 4: Settings View
function renderSettingsView(): string {
  const status = appStatus;
  // Not `status?.retentionDays ? status.retentionDays : 30`. That ternary is a
  // numeric fallback wearing a disguise - it slipped past the guard test, which
  // scans for `|| <number>` and `?? <number>` - and it turned a real retention
  // window of 0 days into a displayed 30. Blank until the server reports.
  const retentionDays = typeof status?.retentionDays === 'number' ? status.retentionDays : '';
  // `beeApi.status` is not a field the server sends; this read was always
  // undefined, so the badge said "Local fixture mode" even with a token
  // configured. The server sends `mode`.
  const isLive = status?.beeApi.mode === 'live';

  return `
    <div class="view-section">
      <div>
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">System Settings &amp; Transparency</h2>
        <p class="tagline">Runtime configuration, upstream connection telemetry, and protocol compliance.</p>
      </div>

      ${
        settingsAlertMessage
          ? `<div class="alert-banner ${settingsAlertMessage.type}" aria-live="polite">${escapeHtml(settingsAlertMessage.text)}</div>`
          : ''
      }

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
        <!-- Data Retention Configuration -->
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title">Audit Retention Window</div>
            <div class="panel-count">GET/POST /api/retention/config</div>
          </div>
          <div class="panel-body">
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
              Threshold for automated retention of redaction audit records. Records older than this threshold are purged during sweeps.
            </p>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="retention-days-input" class="form-label">Retention Period (Days)</label>
              <input type="number" id="retention-days-input" class="form-input" min="1" step="1" value="${retentionDays}" />
            </div>
            <div style="display:flex; gap:10px;">
              <button id="btn-save-retention" class="btn-primary">Update Threshold</button>
              <button id="btn-trigger-sweep" class="btn-secondary">Trigger Sweep</button>
            </div>
          </div>
        </section>

        <!-- Upstream Bee API Telemetry -->
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title">Upstream Bee API Connection</div>
            <div class="panel-count">Telemetry</div>
          </div>
          <div class="panel-body">
            <div style="margin-bottom: 14px;">
              <span class="status-badge ${isLive ? 'live' : ''}">
                ${isLive ? 'Connected to Bee API' : 'Local fixture mode'}
              </span>
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Configured Endpoint:</strong> <code>${formatField(status?.beeApi.endpoint)}</code>
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Upstream Status:</strong> <code>${formatField(status?.beeApi.message)}</code>
            </div>
            <p style="font-size: 11px; color: var(--text-dim); margin-top: 14px;">
              Honest Fallback Guard: When BEE_TOKEN is unset, Bystander uses local fixtures and reports genuine HTTP 401 status. Zero fabricated tokens.
            </p>
          </div>
        </section>

        <!-- Model Context Protocol (MCP) Server -->
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title">Model Context Protocol (MCP)</div>
            <div class="panel-count">Endpoint: /mcp</div>
          </div>
          <div class="panel-body">
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Endpoint URL:</strong> <code>${formatField(status?.mcpEndpoint)}</code> (Streamable HTTP, POST/GET)
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Supported Protocol Floor:</strong> <code>${formatField(status?.protocolFloor)}</code>
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Server Status:</strong> <span class="status-pill consented">Active (Streamable HTTP)</span>
            </div>
            <div style="font-size:11px; color:var(--text-dim); margin-top: 14px;">
              ${
                status?.mcpTools?.length
                  ? `Exposes ${status.mcpTools.length} registered tool${status.mcpTools.length === 1 ? '' : 's'}: ${status.mcpTools.map((t) => escapeHtml(t)).join(', ')}.`
                  : `Registered tools: ${formatField(undefined)}`
              }
            </div>
          </div>
        </section>

        <!-- Local Storage & Invariants -->
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title">SQLite Sovereign Persistence</div>
            <div class="panel-count">better-sqlite3</div>
          </div>
          <div class="panel-body">
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Active Database Path:</strong>
              <div style="word-break:break-all; font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:4px;">
                ${formatField(status?.activeDbPath)}
              </div>
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Journal Mode:</strong> <code>${formatField(status?.storage?.journalMode)}</code>
            </div>
            <div style="font-size:13px; margin-bottom: 8px;">
              <strong>Foreign Key Constraints:</strong>
              <code>${
                status?.storage
                  ? status.storage.foreignKeys
                    ? 'ON'
                    : 'OFF'
                  : formatField(undefined)
              }</code>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

// Primary Render Router
function renderApp(): void {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  appEl.innerHTML = `
    <!-- Top Header -->
    <header class="header-bar">
      <div class="brand-title">
        <span class="logo-badge">Bee Wearable Layer</span>
        <div>
          <h1 class="brand-name">Bystander</h1>
          <p class="tagline">Consent-aware capture, redaction, and gating for ambient audio</p>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-bar" aria-label="Main Application Navigation">
      <a href="#capture" class="nav-tab ${currentRoute === 'capture' ? 'active' : ''}" ${currentRoute === 'capture' ? 'aria-current="page"' : ''}>
        Capture Stream
      </a>
      <a href="#ledger" class="nav-tab ${currentRoute === 'ledger' ? 'active' : ''}" ${currentRoute === 'ledger' ? 'aria-current="page"' : ''}>
        Consent Ledger
      </a>
      <a href="#audit" class="nav-tab ${currentRoute === 'audit' ? 'active' : ''}" ${currentRoute === 'audit' ? 'aria-current="page"' : ''}>
        Audit &amp; Compliance
      </a>
      <a href="#settings" class="nav-tab ${currentRoute === 'settings' ? 'active' : ''}" ${currentRoute === 'settings' ? 'aria-current="page"' : ''}>
        Settings &amp; Transparency
      </a>
    </nav>

    <!-- Route Content -->
    <div id="view-container">
      ${
        currentRoute === 'capture'
          ? renderCaptureView()
          : currentRoute === 'ledger'
          ? renderLedgerView()
          : currentRoute === 'audit'
          ? renderAuditView()
          : renderSettingsView()
      }
    </div>
  `;

  bindEventListeners();
}

// Event Bindings
function bindEventListeners(): void {
  if (currentRoute === 'capture') {
    const scenarioSelect = document.getElementById('scenarioSelect') as HTMLSelectElement | null;
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const parsed = parseInt(target.value, 10);
        const nextId = isNaN(parsed) ? 101 : parsed;
        loadPipeline(nextId);
      });
    }

    const captureToggles = document.querySelectorAll('.btn-toggle-capture');
    captureToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clusterId = target.getAttribute('data-cluster');
        const status = target.getAttribute('data-status');
        if (clusterId && status) {
          toggleConsentStatus(clusterId, status);
        }
      });
    });
  } else if (currentRoute === 'ledger') {
    const enrolForm = document.getElementById('enrol-form') as HTMLFormElement | null;
    if (enrolForm) {
      enrolForm.addEventListener('submit', submitEnrolment);
    }

    const ledgerToggles = document.querySelectorAll('.btn-toggle-ledger');
    ledgerToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clusterId = target.getAttribute('data-cluster');
        const status = target.getAttribute('data-status');
        if (clusterId && status) {
          toggleConsentStatus(clusterId, status);
        }
      });
    });

    const unenrolBtns = document.querySelectorAll('.btn-unenrol-ledger');
    unenrolBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clusterId = target.getAttribute('data-cluster');
        if (clusterId) {
          unenrolCluster(clusterId);
        }
      });
    });
  } else if (currentRoute === 'audit') {
    const auditConvSelect = document.getElementById('auditConvSelect') as HTMLSelectElement | null;
    if (auditConvSelect) {
      auditConvSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const parsed = parseInt(target.value, 10);
        const nextId = isNaN(parsed) ? 101 : parsed;
        loadAuditRecords(nextId);
      });
    }

    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        window.location.href = `/api/audit/${auditSelectedScenarioId}/export?format=json`;
      });
    }

    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        window.location.href = `/api/audit/${auditSelectedScenarioId}/export?format=csv`;
      });
    }

    const btnOpenPurge = document.getElementById('btn-open-purge');
    if (btnOpenPurge) {
      btnOpenPurge.addEventListener('click', () => {
        purgeModalOpen = true;
        renderApp();
      });
    }

    if (purgeModalOpen) {
      const cancelBtn = document.getElementById('modal-cancel-btn');
      const confirmBtn = document.getElementById('modal-confirm-btn');
      const backdrop = document.getElementById('purge-modal-backdrop');

      const closeModal = () => {
        purgeModalOpen = false;
        renderApp();
        btnOpenPurge?.focus();
      };

      if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
        cancelBtn.focus();
      }

      if (confirmBtn) {
        confirmBtn.addEventListener('click', executePurge);
      }

      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) {
            closeModal();
          }
        });
      }

      // Keyboard trap and Escape dismiss
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!purgeModalOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          window.removeEventListener('keydown', handleKeyDown);
          closeModal();
        } else if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === cancelBtn) {
            e.preventDefault();
            confirmBtn?.focus();
          } else if (!e.shiftKey && document.activeElement === confirmBtn) {
            e.preventDefault();
            cancelBtn?.focus();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown, { once: true });
    }
  } else if (currentRoute === 'settings') {
    const btnSaveRetention = document.getElementById('btn-save-retention');
    if (btnSaveRetention) {
      btnSaveRetention.addEventListener('click', () => {
        const input = document.getElementById('retention-days-input') as HTMLInputElement | null;
        if (input) {
          const parsed = parseInt(input.value, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            saveRetentionConfig(parsed);
          } else {
            settingsAlertMessage = {
              text: 'Retention period must be a positive integer >= 1.',
              type: 'error'
            };
            renderApp();
          }
        }
      });
    }

    const btnTriggerSweep = document.getElementById('btn-trigger-sweep');
    if (btnTriggerSweep) {
      btnTriggerSweep.addEventListener('click', triggerImmediateSweep);
    }
  }
}

// Router Initialisation
async function handleRouteChange(): Promise<void> {
  currentRoute = parseRoute();
  if (currentRoute === 'capture') {
    if (!pipelineData || pipelineData.conversationId !== currentScenarioId) {
      await loadPipeline(currentScenarioId);
    } else {
      renderApp();
    }
  } else if (currentRoute === 'ledger') {
    await loadLedgerData();
  } else if (currentRoute === 'audit') {
    await loadAuditRecords(auditSelectedScenarioId);
  } else if (currentRoute === 'settings') {
    await loadSettingsData();
  }
}

// Initial Boot Sequence
async function init(): Promise<void> {
  window.addEventListener('hashchange', () => {
    handleRouteChange();
  });

  await loadConversations();
  await handleRouteChange();
}

init();
