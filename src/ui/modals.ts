/**
 * Modals: metadata, threat editor, theme picker, save dialog, alert.
 */
import type { Threat, Severity, ThreatStatus, Methodology } from '../types.js';
import { getMetadata, updateMetadata, addThreat, updateThreat, getThreats, getMethodology, serializeModel } from '../store/model.js';
import { STRIDE_CATEGORIES, getThreatTemplates } from '../methodology/stride.js';
import { getPastaCategories } from '../methodology/pasta.js';
import { triggerDownload } from '../io/json.js';
import { exportYaml } from '../io/yaml.js';
import { esc } from '../utils/sanitize.js';

// ── Alert modal ────────────────────────────────────────────

/**
 * Shows a non-blocking alert modal instead of the browser's native alert().
 * @param message  The message to display (plain text, will be escaped).
 * @param title    Optional title; defaults to "Fel".
 */
export function openAlertModal(message: string, title = 'Fel'): void {
  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal--narrow" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div class="modal-header">
        <h2 id="alert-title">⚠️ ${esc(title)}</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        <p class="alert-message">${esc(message)}</p>
        <div class="alert-footer">
          <button class="btn-primary alert-ok">OK</button>
        </div>
      </div>
    </div>`;

  const close = (): void => { modal.parentNode?.removeChild(modal); };
  modal.querySelector('.modal-close')?.addEventListener('click', close);
  modal.querySelector('.alert-ok')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape' || e.key === 'Enter') { close(); document.removeEventListener('keydown', handler); }
  });
  document.body.appendChild(modal);
  (modal.querySelector('.alert-ok') as HTMLButtonElement | null)?.focus();
}

// ── Confirm modal ──────────────────────────────────────────

/**
 * Shows a non-blocking confirmation modal instead of the browser's native confirm().
 * @param message    The question to display (plain text, will be escaped).
 * @param onConfirm  Called if the user confirms.
 * @param title      Optional title; defaults to "Bekräfta".
 */
export function openConfirmModal(message: string, onConfirm: () => void, title = 'Bekräfta'): void {
  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal--narrow" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="modal-header">
        <h2 id="confirm-title">${esc(title)}</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        <p class="alert-message">${esc(message)}</p>
        <div class="confirm-footer">
          <button class="btn-secondary confirm-cancel">Avbryt</button>
          <button class="btn-danger confirm-ok">Ja, fortsätt</button>
        </div>
      </div>
    </div>`;

  const close = (): void => { modal.parentNode?.removeChild(modal); };
  const confirm = (): void => { close(); onConfirm(); };

  modal.querySelector('.modal-close')?.addEventListener('click', close);
  modal.querySelector('.confirm-cancel')?.addEventListener('click', close);
  modal.querySelector('.confirm-ok')?.addEventListener('click', confirm);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    if (e.key === 'Enter')  { confirm(); document.removeEventListener('keydown', handler); }
  });
  document.body.appendChild(modal);
  (modal.querySelector('.confirm-ok') as HTMLButtonElement | null)?.focus();
}

// ── Save modal ─────────────────────────────────────────────

interface SaveFormat {
  id: string;
  label: string;
  description: string;
  icon: string;
  mime: string;
  ext: string;
  serialize: (name: string) => string;
}

const SAVE_FORMATS: SaveFormat[] = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Maskinläsbart, lätt att integrera med verktyg och API:er.',
    icon: '{ }',
    mime: 'application/json',
    ext: 'json',
    serialize: () => JSON.stringify(serializeModel(), null, 2),
  },
  {
    id: 'yaml',
    label: 'YAML',
    description: 'Mer läsbart för människor, populärt i DevSecOps-flöden.',
    icon: '—',
    mime: 'application/x-yaml',
    ext: 'yaml',
    serialize: () => exportYaml(serializeModel()),
  },
];

export function openSaveModal(): void {
  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="save-title">
      <div class="modal-header">
        <h2 id="save-title">💾 Spara diagram</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        <p class="save-hint">Välj format för nedladdning:</p>
        <div class="save-format-list">
          ${SAVE_FORMATS.map((f) => `
            <button class="save-format-btn" data-format="${f.id}">
              <span class="save-format-icon">${esc(f.icon)}</span>
              <span class="save-format-info">
                <strong>${esc(f.label)}</strong>
                <span>${esc(f.description)}</span>
              </span>
              <span class="save-format-arrow">↓</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = (): void => modal.remove();
  modal.querySelector('.modal-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  modal.querySelectorAll<HTMLButtonElement>('.save-format-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fmt = SAVE_FORMATS.find((f) => f.id === btn.dataset['format']);
      if (!fmt) return;
      const name = serializeModel().metadata.name || 'hota-diagram';
      triggerDownload(fmt.serialize(name), `${name}.${fmt.ext}`, fmt.mime);
      close();
    });
  });
}

// ── Metadata modal ─────────────────────────────────────────

export function openMetadataModal(): void {
  const meta  = getMetadata();
  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="meta-title">
      <div class="modal-header">
        <h2 id="meta-title">Projektmetadata</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Projektnamn</label>
          <input id="m-name" type="text" maxlength="200" value="${esc(meta.name)}" />
        </div>
        <div class="form-row">
          <label>Författare</label>
          <input id="m-author" type="text" maxlength="200" value="${esc(meta.author)}" />
        </div>
        <div class="form-row">
          <label>Version</label>
          <input id="m-version" type="text" maxlength="50" value="${esc(meta.version)}" />
        </div>
        <div class="form-row">
          <label>Datum</label>
          <input id="m-date" type="date" value="${esc(meta.date)}" />
        </div>
        <div class="form-row">
          <label>Beskrivning</label>
          <textarea id="m-desc" rows="3" maxlength="5000">${esc(meta.description)}</textarea>
        </div>
        <div class="form-row">
          <label>Scope</label>
          <textarea id="m-scope" rows="2" maxlength="2000">${esc(meta.scope)}</textarea>
        </div>
        <div class="form-row">
          <label>Antaganden (ett per rad)</label>
          <textarea id="m-assumptions" rows="3" maxlength="5000">${meta.assumptions.map(esc).join('\n')}</textarea>
        </div>
        <div class="form-row">
          <label>Utanför scope (ett per rad)</label>
          <textarea id="m-outofscope" rows="3" maxlength="5000">${meta.outOfScope.map(esc).join('\n')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button id="m-save" class="btn-primary">Spara</button>
        <button id="m-cancel" class="btn-secondary">Avbryt</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = (): void => modal.remove();

  modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
  modal.querySelector('#m-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  modal.querySelector('#m-save')?.addEventListener('click', () => {
    const get = (id: string): string =>
      (modal.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '').trim();
    const splitLines = (id: string): string[] =>
      get(id).split('\n').map((l) => l.trim()).filter(Boolean);

    updateMetadata({
      name: get('m-name') || meta.name,
      author: get('m-author'),
      version: get('m-version'),
      date: get('m-date'),
      description: get('m-desc'),
      scope: get('m-scope'),
      assumptions: splitLines('m-assumptions'),
      outOfScope: splitLines('m-outofscope'),
    });
    closeModal();
  });
}

// ── Threat modal ───────────────────────────────────────────

export function openThreatModal(elementId: string, threatId?: string): void {
  const method      = getMethodology() as Methodology;
  const existing    = threatId ? getThreats().find((t) => t.id === threatId) : undefined;
  const categories  = method === 'STRIDE' ? STRIDE_CATEGORIES.map((c) => ({ id: c.id, name: c.name })) : getPastaCategories();
  const templates   = getThreatTemplates(elementId.includes('conn') ? 'connection' : 'Process');
  const severities: Severity[]     = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
  const statuses: ThreatStatus[]   = ['Open', 'Mitigated', 'Accepted', 'Transferred', 'In Progress'];

  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-threat" role="dialog" aria-modal="true" aria-labelledby="threat-title">
      <div class="modal-header">
        <h2 id="threat-title">${existing ? 'Redigera hot' : 'Lägg till hot'}</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        ${!existing ? `
        <div class="form-row">
          <label>Använd mall</label>
          <select id="t-template">
            <option value="">-- Välj mall --</option>
            ${templates.map((t) => `<option value="${esc(t.title)}" data-cat="${esc(t.category)}" data-sev="${esc(t.severity)}">${esc(t.title)}</option>`).join('')}
          </select>
        </div>
        <hr />` : ''}
        <div class="form-row">
          <label>Titel</label>
          <input id="t-title" type="text" value="${esc(existing?.title ?? '')}" placeholder="Beskriv hotet kort" />
        </div>
        <div class="form-row">
          <label>Kategori (${method})</label>
          <select id="t-category">
            ${categories.map((c) => `<option value="${esc(c.id)}" ${existing?.category === c.id ? 'selected' : ''}>${esc(c.id)} – ${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Allvarlighetsgrad</label>
          <select id="t-severity">
            ${severities.map((sv) => `<option ${existing?.severity === sv ? 'selected' : ''}>${esc(sv)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Beskrivning</label>
          <textarea id="t-desc" rows="3">${esc(existing?.description ?? '')}</textarea>
        </div>
        <div class="form-row">
          <label>Mitigering / kontrollåtgärd</label>
          <textarea id="t-mitigation" rows="3">${esc(existing?.mitigation ?? '')}</textarea>
        </div>
        <div class="form-row">
          <label>Status</label>
          <select id="t-status">
            ${statuses.map((st) => `<option ${existing?.status === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button id="t-save" class="btn-primary">Spara</button>
        <button id="t-cancel" class="btn-secondary">Avbryt</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = (): void => modal.remove();
  modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
  modal.querySelector('#t-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Fill from template
  modal.querySelector<HTMLSelectElement>('#t-template')?.addEventListener('change', (e) => {
    const sel = (e.target as HTMLSelectElement).selectedOptions[0];
    if (!sel?.value) return;
    (modal.querySelector<HTMLInputElement>('#t-title'))!.value = sel.value;
    (modal.querySelector<HTMLSelectElement>('#t-category'))!.value = sel.dataset['cat'] ?? '';
    (modal.querySelector<HTMLSelectElement>('#t-severity'))!.value = sel.dataset['sev'] ?? 'Medium';
  });

  modal.querySelector('#t-save')?.addEventListener('click', () => {
    const get = (id: string): string =>
      (modal.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '').trim();

    const patch: Omit<Threat, 'id'> = {
      elementId:   elementId,
      title:       get('t-title') || 'Namnlöst hot',
      category:    get('t-category'),
      severity:    (get('t-severity') as Severity) || 'Medium',
      description: get('t-desc'),
      mitigation:  get('t-mitigation'),
      status:      (get('t-status') as ThreatStatus) || 'Open',
    };

    if (existing) updateThreat(existing.id, patch);
    else addThreat(patch);
    closeModal();
  });
}

// ── Theme picker modal ─────────────────────────────────────

interface ThemeOption {
  id: string;
  name: string;
  emoji: string;
}

const THEMES: ThemeOption[] = [
  { id: 'dark',        name: 'Dark',             emoji: '🌑' },
  { id: 'light',       name: 'Light',            emoji: '☀️' },
  { id: 'nord',        name: 'Nord',             emoji: '🏔️' },
  { id: 'gruvbox',     name: 'Gruvbox',          emoji: '🪵' },
  { id: 'rosepine',    name: 'Rosé Pine',        emoji: '🌹' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', emoji: '☕' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', emoji: '🥛' },
  { id: 'solarized-dark',   name: 'Solarized Dark',   emoji: '🌞' },
  { id: 'solarized-light',  name: 'Solarized Light',  emoji: '💛' },
  { id: 'dracula',     name: 'Dracula',          emoji: '🧛' },
  { id: 'nineties',    name: '90s Web',          emoji: '💾' },
  { id: 'hacker',      name: 'Hacker',           emoji: '💻' },
];

export function openThemeModal(): void {
  const current = document.documentElement.dataset['theme'] ?? 'dark';
  const modal   = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-theme" role="dialog" aria-modal="true" aria-labelledby="theme-title">
      <div class="modal-header">
        <h2 id="theme-title">Välj tema</h2>
        <button class="modal-close" aria-label="Stäng">✕</button>
      </div>
      <div class="modal-body">
        <div class="theme-grid">
          ${THEMES.map((t) => `
            <button class="theme-card ${t.id === current ? 'active' : ''}"
                    data-theme-id="${t.id}"
                    title="${esc(t.name)}">
              <span class="theme-emoji">${t.emoji}</span>
              <span class="theme-name">${esc(t.name)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = (): void => modal.remove();
  modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  modal.querySelectorAll<HTMLButtonElement>('.theme-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeId = btn.dataset['themeId']!;
      document.documentElement.dataset['theme'] = themeId;
      localStorage.setItem('hota-theme', themeId);
      modal.querySelectorAll('.theme-card').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
