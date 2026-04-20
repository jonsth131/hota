/**
 * Threat report modal.
 * Builds an HTML summary of all identified threats, grouped by element,
 * with severity/status statistics. Exports via browser print → PDF.
 */

import type { Threat, DiagramElement } from '../types.js';
import { getThreats, getElements, getMetadata, getMethodology } from '../store/model.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
};

function severityClass(s: string): string {
  return { Critical: 'sev-critical', High: 'sev-high', Medium: 'sev-medium',
           Low: 'sev-low', Informational: 'sev-info' }[s] ?? '';
}

function statusClass(s: string): string {
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
    <tr>
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

function buildUnattached(threats: Threat[], elements: DiagramElement[]): string {
  const elementIds = new Set(elements.map((e) => e.id));
  const orphans = threats.filter((t) => !elementIds.has(t.elementId));
  if (!orphans.length) return '';
  const fakeEl: DiagramElement = { id: '', type: 'Process', x: 0, y: 0, w: 0, h: 0, label: 'Okopplade hot', metadata: {} };
  return buildElementSection(fakeEl, orphans);
}

function buildReportHtml(): string {
  const threats  = getThreats();
  const elements = getElements();
  const meta     = getMetadata();
  const method   = getMethodology();

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
        : elementSections + buildUnattached(threats, elements)
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
      <div class="modal-body report-body">
        ${buildReportHtml()}
      </div>
    </div>`;

  overlay.querySelector('.modal-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  overlay.focus();

  overlay.querySelector<HTMLButtonElement>('#report-print-btn')?.addEventListener('click', () => {
    // Temporarily add a print-target class so CSS can scope @media print to just the report body
    const body = overlay.querySelector<HTMLElement>('.report-body');
    if (body) body.classList.add('print-active');
    window.print();
    if (body) body.classList.remove('print-active');
  });
}
