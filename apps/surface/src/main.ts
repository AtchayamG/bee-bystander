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
  originalText: string;
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

// App State
let currentScenarioId = 101;
let pipelineData: PipelineResult | null = null;
let rawConversations: Array<{ id: number; title: string }> = [];

// Helper: Safely format a value or report "not reported"
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

async function loadConversations(): Promise<void> {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    rawConversations = data.conversations.map((c: any) => ({
      id: c.id,
      title: c.title
    }));
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function loadPipeline(id: number): Promise<void> {
  currentScenarioId = id;
  try {
    const res = await fetch(`/api/pipeline/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to load pipeline: HTTP ${res.status}`);
    }
    pipelineData = await res.json();
    renderApp();
  } catch (err) {
    console.error('Pipeline fetch failed:', err);
    renderApp();
  }
}

async function toggleConsent(clusterId: string, currentStatus: string): Promise<void> {
  const nextStatus = currentStatus === 'CONSENTED' ? 'REVOKED' : 'CONSENTED';
  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clusterId, status: nextStatus })
    });
    await loadPipeline(currentScenarioId);
  } catch (err) {
    console.error('Failed to update consent:', err);
  }
}

function renderApp(): void {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  if (!pipelineData) {
    appEl.innerHTML = `
      <div class="header-bar">
        <div class="brand-title">
          <span class="logo-badge">Bee Wearable Layer</span>
          <span class="brand-name">Bystander</span>
        </div>
      </div>
      <div class="metric-card">Loading pipeline data...</div>
    `;
    return;
  }

  const data = pipelineData;
  const audit = data.audit;
  const refusal = data.refusal;

  // Compute delta
  const charDelta = Math.max(0, data.rawCharCount - data.redactedCharCount);

  appEl.innerHTML = `
    <!-- Header -->
    <header class="header-bar">
      <div class="brand-title">
        <span class="logo-badge">Bee Wearable Layer</span>
        <div>
          <h1 class="brand-name">Bystander</h1>
          <p class="tagline">Consent-aware capture, redaction, and gating for ambient audio</p>
        </div>
      </div>

      <div class="controls-cluster">
        <label for="scenarioSelect" class="metric-label" style="margin-bottom:0;">Capture Scenario:</label>
        <select id="scenarioSelect" class="scenario-select">
          ${rawConversations
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === currentScenarioId ? 'selected' : ''}>${escapeHtml(
                  c.title
                )} (ID: ${c.id})</option>`
            )
            .join('')}
        </select>
        <div class="status-badge ${data.mode === 'live' ? 'live' : ''}">
          API ${formatField(data.apiStatus.code)}: ${formatField(data.apiStatus.message)}
        </div>
      </div>
    </header>

    <!-- Computed Metrics Strip -->
    <section class="metrics-strip">
      <div class="metric-card">
        <div class="metric-label">Raw Utterances</div>
        <div class="metric-value">${formatField(data.rawUtteranceCount)}</div>
        <div class="metric-sub">Total spoken turns ingested</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Redacted Utterances</div>
        <div class="metric-value">${formatField(data.redactedUtteranceCount)}</div>
        <div class="metric-sub">Cleaned downstream output</div>
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
      <!-- Panel 1: Participant Consent Ledger -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">1. Speaker Consent Ledger</div>
          <div class="panel-count">${data.ledger.length} enrolled clusters</div>
        </div>
        <div class="panel-body">
          <table class="ledger-table">
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
                    <button class="btn-toggle" data-cluster="${escapeHtml(p.clusterId)}" data-status="${escapeHtml(p.status)}">
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
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">2. Gating & Refusal Decision</div>
          <div class="panel-count">Machine-evaluated</div>
        </div>
        <div class="panel-body">
          <div class="refusal-box ${refusal.refused ? 'refused' : 'approved'}">
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

      <!-- Panel 3: Ingested vs Redacted Utterances -->
      <section class="panel" style="grid-column: span 2;">
        <div class="panel-header">
          <div class="panel-title">3. Capture Stream & Redacted Output</div>
          <div class="panel-count">${data.redactedUtterances.length} utterances rendered</div>
        </div>
        <div class="panel-body">
          <div class="utterance-list">
            ${data.redactedUtterances
              .map((u) => {
                const cluster = u.speaker || 'unknown';
                const p = data.ledger.find((item) => item.clusterId === cluster);
                const speakerName = p ? p.name : cluster;
                const isBystander = p?.role === 'BYSTANDER' || p?.status !== 'CONSENTED';

                // Format text with pills for redacted spans
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

      <!-- Panel 4: Verifiable Audit Trail -->
      <section class="panel" style="grid-column: span 2;">
        <div class="panel-header">
          <div class="panel-title">4. Verifiable Redaction Audit Trail</div>
          <div class="panel-count">${audit.removals.length} audit records</div>
        </div>
        <div class="panel-body" style="overflow-x: auto;">
          <table class="audit-table">
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

  // Bind scenario change
  const selectEl = document.getElementById('scenarioSelect') as HTMLSelectElement | null;
  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      loadPipeline(parseInt(target.value, 10));
    });
  }

  // Bind toggle buttons
  const toggleBtns = document.querySelectorAll('.btn-toggle');
  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const clusterId = target.getAttribute('data-cluster');
      const status = target.getAttribute('data-status');
      if (clusterId && status) {
        toggleConsent(clusterId, status);
      }
    });
  });
}

// Initial Boot
async function init(): Promise<void> {
  await loadConversations();
  await loadPipeline(currentScenarioId);
}

init();
