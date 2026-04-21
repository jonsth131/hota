/**
 * Properties panel: element/connection properties + threat list.
 */
import type { DiagramElement, Connection, Threat, Severity, ThreatStatus } from '../types.js';
import { esc } from '../utils/sanitize.js';
import {
  getElements, getConnections, getThreats, getMethodology,
  updateElement, updateConnection, removeThreat, removeElement, removeConnection, on,
  groupElements, ungroupElements, bringToFront, sendToBack,
} from '../store/model.js';

let _currentId: string | null = null;
let _currentIds: Set<string> = new Set();

export function initProperties(container: HTMLElement, onThreat: (elementId: string, threatId?: string) => void): void {
  on('element:updated',    () => refresh(container, onThreat));
  on('element:removed',    () => showEmpty(container));
  on('element:reordered',  () => refresh(container, onThreat));
  on('connection:updated', () => refresh(container, onThreat));
  on('connection:removed', () => showEmpty(container));
  on('threat:added',       () => refresh(container, onThreat));
  on('threat:updated',     () => refresh(container, onThreat));
  on('threat:removed',     () => refresh(container, onThreat));
  on('model:loaded',       () => showEmpty(container));

  showEmpty(container);
}

export function selectItem(id: string | null, container: HTMLElement, onThreat: (elementId: string, threatId?: string) => void): void {
  _currentId = id;
  _currentIds = id ? new Set([id]) : new Set();
  refresh(container, onThreat);
}

/**
 * Select one or more items. With a single id, shows element/connection properties.
 * With multiple ids, shows a multi-select summary with bulk-delete.
 */
export function selectItems(ids: Set<string>, container: HTMLElement, onThreat: (elementId: string, threatId?: string) => void): void {
  _currentIds = new Set(ids);
  _currentId = ids.size === 1 ? [...ids][0]! : null;
  if (ids.size > 1) {
    showMultiSelect(container, ids);
  } else {
    refresh(container, onThreat);
  }
}

function showMultiSelect(container: HTMLElement, ids: Set<string>): void {
  const panel = container.querySelector<HTMLElement>('#properties-content');
  if (!panel) return;
  const elements = getElements().filter((e) => ids.has(e.id));
  const sharedGroupId = elements[0]?.groupId &&
    elements.every((e) => e.groupId === elements[0]!.groupId)
    ? elements[0].groupId
    : null;

  panel.innerHTML = `
    <div class="multi-select-info">
      <p class="multi-select-count">${ids.size} element markerade</p>
      <div class="prop-row">
        <button id="btn-to-front-multi" class="btn btn-secondary btn-sm" title="Till förgrunden">↑ Förgrunden</button>
        <button id="btn-to-back-multi"  class="btn btn-secondary btn-sm" title="Till bakgrunden">↓ Bakgrunden</button>
      </div>
      <div class="prop-row">
        <button id="btn-group-selected" class="btn btn-secondary btn-sm">⬡ Gruppera</button>
        ${sharedGroupId ? `<button id="btn-ungroup-multi" class="btn btn-secondary btn-sm">Avgruppera</button>` : ''}
      </div>
      <button id="btn-delete-selected" class="btn btn-danger btn-sm">🗑 Radera markerade</button>
    </div>`;

  panel.querySelector('#btn-to-front-multi')?.addEventListener('click', () => {
    bringToFront([...ids]);
  });
  panel.querySelector('#btn-to-back-multi')?.addEventListener('click', () => {
    sendToBack([...ids]);
  });
  panel.querySelector('#btn-group-selected')?.addEventListener('click', () => {
    groupElements([...ids]);
  });
  panel.querySelector('#btn-ungroup-multi')?.addEventListener('click', () => {
    if (sharedGroupId) ungroupElements(sharedGroupId);
  });
  panel.querySelector('#btn-delete-selected')?.addEventListener('click', () => {
    for (const id of _currentIds) removeElement(id);
    _currentIds = new Set();
    _currentId = null;
  });
}

function refresh(container: HTMLElement, onThreat: (elementId: string, threatId?: string) => void): void {
  if (!_currentId) { showEmpty(container); return; }
  const el   = getElements().find((x) => x.id === _currentId);
  const conn = !el ? getConnections().find((x) => x.id === _currentId) : undefined;
  if (el)   showElement(container, el, onThreat);
  else if (conn) showConnection(container, conn, onThreat);
  else      showEmpty(container);
}

// ── Empty state ────────────────────────────────────────────

function showEmpty(container: HTMLElement): void {
  const panel = container.querySelector<HTMLElement>('#properties-content');
  if (!panel) return;
  panel.innerHTML = '<p class="text-muted">Välj ett element eller en koppling för att se egenskaper.</p>';
}

// ── Element properties ─────────────────────────────────────

function showElement(
  container: HTMLElement,
  el: DiagramElement,
  onThreat: (elementId: string, threatId?: string) => void,
): void {
  const panel = container.querySelector<HTMLElement>('#properties-content');
  if (!panel) return;

  const threats = getThreats().filter((t) => t.elementId === el.id);
  const method  = getMethodology();

  panel.innerHTML = `
    <div class="prop-group">
      <label>Typ</label>
      <span class="prop-readonly">${esc(el.type)}</span>
    </div>
    <div class="prop-group">
      <label for="prop-label">Namn</label>
      <input id="prop-label" type="text" value="${esc(el.label)}" />
    </div>
    <div class="prop-group">
      <label>Position</label>
      <span class="prop-readonly">x:${Math.round(el.x)} y:${Math.round(el.y)}</span>
    </div>
    <div class="prop-group">
      <label for="prop-notes">Anteckningar</label>
      <textarea id="prop-notes" rows="3" placeholder="Fri text om elementet…">${esc((el.metadata['notes'] as string) ?? '')}</textarea>
    </div>
    <div class="prop-group">
      <label>Lager</label>
      <div class="prop-row">
        <button id="btn-to-front" class="btn btn-secondary btn-sm" title="Till förgrunden">↑ Förgrunden</button>
        <button id="btn-to-back"  class="btn btn-secondary btn-sm" title="Till bakgrunden">↓ Bakgrunden</button>
      </div>
    </div>
    ${el.groupId ? `
    <div class="prop-group">
      <label>Grupp</label>
      <div class="prop-row">
        <span class="prop-readonly prop-grouped">⬡ Grupperad</span>
        <button id="btn-ungroup" class="btn btn-secondary btn-sm">Avgruppera</button>
      </div>
    </div>` : ''}
    <div class="prop-group">
      <button id="btn-delete-el" class="btn btn-danger btn-sm">🗑 Radera element</button>
    </div>
    <hr />
    <div class="prop-threats-header">
      <h4>Hot (${threats.length})</h4>
      <button id="add-threat-btn" class="btn-sm">+ Lägg till hot</button>
    </div>
    <ul class="threat-list" id="threat-list">
      ${threats.map((t) => threatItem(t, method)).join('')}
    </ul>
  `;

  panel.querySelector<HTMLInputElement>('#prop-label')?.addEventListener('change', (e) => {
    updateElement(el.id, { label: (e.target as HTMLInputElement).value.trim() || el.label });
  });

  panel.querySelector<HTMLTextAreaElement>('#prop-notes')?.addEventListener('change', (e) => {
    updateElement(el.id, { metadata: { ...el.metadata, notes: (e.target as HTMLTextAreaElement).value } });
  });

  panel.querySelector<HTMLButtonElement>('#btn-to-front')?.addEventListener('click', () => {
    bringToFront([el.id]);
  });
  panel.querySelector<HTMLButtonElement>('#btn-to-back')?.addEventListener('click', () => {
    sendToBack([el.id]);
  });
  panel.querySelector<HTMLButtonElement>('#btn-ungroup')?.addEventListener('click', () => {
    if (el.groupId) ungroupElements(el.groupId);
  });

  panel.querySelector<HTMLButtonElement>('#btn-delete-el')?.addEventListener('click', () => {
    removeElement(el.id);
  });

  panel.querySelector<HTMLButtonElement>('#add-threat-btn')?.addEventListener('click', () => {
    onThreat(el.id);
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-edit-threat]').forEach((btn) => {
    btn.addEventListener('click', () => onThreat(el.id, btn.dataset['editThreat']!));
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-del-threat]').forEach((btn) => {
    btn.addEventListener('click', () => removeThreat(btn.dataset['delThreat']!));
  });
}

// ── Connection properties ──────────────────────────────────

function showConnection(
  container: HTMLElement,
  conn: Connection,
  onThreat: (elementId: string, threatId?: string) => void,
): void {
  const panel = container.querySelector<HTMLElement>('#properties-content');
  if (!panel) return;

  const elements = getElements();
  const fromEl = elements.find((e) => e.id === conn.from);
  const toEl   = elements.find((e) => e.id === conn.to);
  const fromLabel = fromEl?.label ?? conn.from;
  const toLabel   = toEl?.label   ?? conn.to;
  const threats = getThreats().filter((t) => t.elementId === conn.id);
  const method  = getMethodology();

  panel.innerHTML = `
    <div class="prop-group">
      <label>Typ</label>
      <span class="prop-readonly">Dataflöde</span>
    </div>
    <div class="prop-group">
      <label for="conn-label">Etikett</label>
      <input id="conn-label" type="text" value="${esc(conn.label)}" />
    </div>
    <div class="prop-group">
      <label>Från → Till</label>
      <span class="prop-readonly">${esc(fromLabel)} → ${esc(toLabel)}</span>
    </div>
    <div class="prop-group">
      <button id="btn-delete-conn" class="btn btn-danger btn-sm">🗑 Radera koppling</button>
    </div>
    <hr />
    <div class="prop-threats-header">
      <h4>Hot (${threats.length})</h4>
      <button id="add-threat-btn" class="btn-sm">+ Lägg till hot</button>
    </div>
    <ul class="threat-list" id="threat-list">
      ${threats.map((t) => threatItem(t, method)).join('')}
    </ul>
  `;

  panel.querySelector<HTMLInputElement>('#conn-label')?.addEventListener('change', (e) => {
    updateConnection(conn.id, { label: (e.target as HTMLInputElement).value });
  });

  panel.querySelector<HTMLButtonElement>('#btn-delete-conn')?.addEventListener('click', () => {
    removeConnection(conn.id);
  });

  panel.querySelector<HTMLButtonElement>('#add-threat-btn')?.addEventListener('click', () => {
    onThreat(conn.id);
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-edit-threat]').forEach((btn) => {
    btn.addEventListener('click', () => onThreat(conn.id, btn.dataset['editThreat']!));
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-del-threat]').forEach((btn) => {
    btn.addEventListener('click', () => removeThreat(btn.dataset['delThreat']!));
  });
}

// ── Threat list item ───────────────────────────────────────

function threatItem(t: Threat, method: string): string {
  const severityClass = `severity-${(t.severity as Severity).toLowerCase()}`;
  return `
    <li class="threat-item" data-id="${esc(t.id)}">
      <div class="threat-header">
        <span class="threat-badge ${severityClass}">${esc(t.severity)}</span>
        <span class="threat-category">${esc(t.category)} ${method === 'STRIDE' ? '' : ''}</span>
        <div class="threat-actions">
          <button data-edit-threat="${esc(t.id)}" class="btn-icon" title="Redigera">✏️</button>
          <button data-del-threat="${esc(t.id)}" class="btn-icon" title="Ta bort">✕</button>
        </div>
      </div>
      <div class="threat-title">${esc(t.title)}</div>
      <div class="threat-status status-${(t.status as ThreatStatus).toLowerCase()}">${esc(t.status)}</div>
    </li>
  `;
}


