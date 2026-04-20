/**
 * Threat report modal.
 * Builds an HTML summary of all identified threats, grouped by element,
 * with severity/status statistics. Exports via browser print → PDF.
 */

import type { Threat, DiagramElement, Connection } from '../types.js';
import { getThreats, getElements, getConnections, getMetadata, getMethodology } from '../store/model.js';
import { esc } from '../utils/sanitize.js';

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
};

export function severityClass(s: string): string {
  return { Critical: 'sev-critical', High: 'sev-high', Medium: 'sev-medium',
           Low: 'sev-low', Informational: 'sev-info' }[s] ?? '';
}

export function statusClass(s: string): string {
  return `status-${s.toLowerCase().replace(/\s+/g, '-')}`;
}

function buildSummary(threats: Threat[]): string {
  const bySev: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
  const bySt: Record<string, number> = {};
  for (const t of threats) {
    bySev[t.severity] = (bySev[t.severity] ?? 0) + 1;
    bySt[t.status]    = (bySt[t.status]    ?? 0) + 1;
  }
  const sevCells = Object.entries(bySev)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `<span class="report-badge ${severityClass(s)}">${n} ${esc(s)}</span>`)
    .join('');
  const stCells = Object.entries(bySt)
    .map(([s, n]) => `<span class="report-status-chip ${statusClass(s)}">${n} ${esc(s)}</span>`)
    .join('');

  return `
    <section class="report-summary">
      <div class="report-stat"><strong>${threats.length}</strong><span>Totalt antal hot</span></div>
      <div class="report-chips">${sevCells || '<em>Inga hot</em>'}</div>
      <div class="report-chips">${stCells}</div>
    </section>`;
}

function buildElementSection(el: DiagramElement, threats: Threat[]): string {
  const sorted = [...threats].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
  const rows = sorted.map((t) => `
    <tr data-severity="${esc(t.severity)}" data-status="${esc(t.status)}">
      <td><span class="report-badge ${severityClass(t.severity)}">${esc(t.severity)}</span></td>
      <td class="report-threat-title">${esc(t.title)}</td>
      <td>${esc(t.category)}</td>
      <td><span class="report-status-chip ${statusClass(t.status)}">${esc(t.status)}</span></td>
      <td class="report-desc">${esc(t.description || '—')}</td>
      <td class="report-desc">${esc(t.mitigation || '—')}</td>
    </tr>`).join('');

  return `
    <section class="report-element-section">
      <h3 class="report-element-name">${esc(el.label || el.type)} <span class="report-el-type">(${esc(el.type)})</span></h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>Allvarlighetsgrad</th><th>Titel</th><th>Kategori</th>
            <th>Status</th><th>Beskrivning</th><th>Åtgärd</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function buildConnectionSection(conn: Connection, threats: Threat[], elements: DiagramElement[]): string {
  const fromEl   = elements.find((e) => e.id === conn.from);
  const toEl     = elements.find((e) => e.id === conn.to);
  const fromName = fromEl?.label ?? conn.from;
  const toName   = toEl?.label   ?? conn.to;
  const label    = conn.label ? `${esc(conn.label)} (${esc(fromName)} → ${esc(toName)})` : `${esc(fromName)} → ${esc(toName)}`;
  const fakeEl: DiagramElement = {
    id: conn.id, type: 'Process', x: 0, y: 0, w: 0, h: 0,
    label: label.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
    metadata: {},
  };
  const section = buildElementSection(fakeEl, threats);
  return section.replace(
    /<span class="report-el-type">\([^)]*\)<\/span>/,
    '<span class="report-el-type">(Dataflöde)</span>',
  );
}

function buildUnattached(threats: Threat[], elements: DiagramElement[], connections: Connection[]): string {
  const knownIds = new Set([...elements.map((e) => e.id), ...connections.map((c) => c.id)]);
  const orphans = threats.filter((t) => !knownIds.has(t.elementId));
  if (!orphans.length) return '';
  const fakeEl: DiagramElement = { id: '', type: 'Process', x: 0, y: 0, w: 0, h: 0, label: 'Okopplade hot', metadata: {} };
  return buildElementSection(fakeEl, orphans);
}

function buildReportHtml(): string {
  const threats      = getThreats();
  const elements     = getElements();
  const connections  = getConnections();
  const meta         = getMetadata();
  const method       = getMethodology();

  const grouped = new Map<string, Threat[]>();
  for (const t of threats) {
    const arr = grouped.get(t.elementId) ?? [];
    arr.push(t);
    grouped.set(t.elementId, arr);
  }

  const elementSections = elements
    .filter((el) => grouped.has(el.id))
    .map((el) => buildElementSection(el, grouped.get(el.id)!))
    .join('');

  const connectionSections = connections
    .filter((c) => grouped.has(c.id))
    .map((c) => buildConnectionSection(c, grouped.get(c.id)!, elements))
    .join('');

  const today = new Date().toLocaleDateString('sv-SE');

  return `
    <div class="report-root" id="report-printable">
      <header class="report-header">
        <div class="report-title-row">
          <h1 class="report-project-name">🛡️ ${esc(meta.name || 'Namnlöst projekt')}</h1>
          <span class="report-method-badge">${esc(method)}</span>
        </div>
        <div class="report-meta-row">
          ${meta.author   ? `<span>👤 ${esc(meta.author)}</span>` : ''}
          ${meta.version  ? `<span>v${esc(meta.version)}</span>` : ''}
          <span>📅 ${today}</span>
          ${meta.scope    ? `<span>Scope: ${esc(meta.scope)}</span>` : ''}
        </div>
        ${meta.description ? `<p class="report-description">${esc(meta.description)}</p>` : ''}
      </header>

      ${buildSummary(threats)}

      ${threats.length === 0
        ? '<p class="report-empty">Inga hot har identifierats ännu.</p>'
        : elementSections + connectionSections + buildUnattached(threats, elements, connections)
      }
    </div>`;
}

// ── Public API ─────────────────────────────────────────────

export function openReportModal(): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'report-modal-title');

  const close = () => overlay.remove();

  overlay.innerHTML = `
    <div class="modal modal-report">
      <div class="modal-header">
        <h2 id="report-modal-title">Hotrapport</h2>
        <div class="report-actions">
          <button id="report-print-btn" class="btn-primary">🖨️ Skriv ut / Spara PDF</button>
          <button class="modal-close" aria-label="Stäng">✕</button>
        </div>
      </div>
      <div class="report-filters">
        <select id="filter-severity" title="Filtrera på allvarlighetsgrad">
          <option value="">Alla allvarlighetsgrader</option>
          <option>Critical</option><option>High</option>
          <option>Medium</option><option>Low</option><option>Informational</option>
        </select>
        <select id="filter-status" title="Filtrera på status">
          <option value="">Alla statusar</option>
          <option>Open</option><option>Mitigated</option><option>Accepted</option>
          <option>Transferred</option><option>In Progress</option><option>N/A</option>
        </select>
      </div>
      <div class="modal-body report-body">
        ${buildReportHtml()}
      </div>
    </div>`;

  overlay.querySelector('.modal-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  overlay.focus();

  // Filter wiring
  const applyFilter = (): void => {
    const sev = overlay.querySelector<HTMLSelectElement>('#filter-severity')?.value ?? '';
    const st  = overlay.querySelector<HTMLSelectElement>('#filter-status')?.value ?? '';
    overlay.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      const match = (!sev || row.dataset['severity'] === sev) && (!st || row.dataset['status'] === st);
      row.style.display = match ? '' : 'none';
    });
    overlay.querySelectorAll<HTMLElement>('.report-element-section').forEach((section) => {
      const hasVisible = section.querySelectorAll('tbody tr:not([style*="display: none"])').length > 0;
      section.style.display = hasVisible ? '' : 'none';
    });
  };
  overlay.querySelector('#filter-severity')?.addEventListener('change', applyFilter);
  overlay.querySelector('#filter-status')?.addEventListener('change', applyFilter);

  overlay.querySelector<HTMLButtonElement>('#report-print-btn')?.addEventListener('click', () => {
    // Temporarily add a print-target class so CSS can scope @media print to just the report body
    const body = overlay.querySelector<HTMLElement>('.report-body');
    if (body) body.classList.add('print-active');
    window.print();
    if (body) body.classList.remove('print-active');
  });
}
