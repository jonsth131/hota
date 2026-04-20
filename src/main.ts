/**
 * Hota – entry point.
 * Wires all modules together.
 */
// @ts-expect-error – Vite handles CSS imports at build time
import './style.css';
import type { ElementType, Model } from './types.js';
import { initCanvas, screenToWorld } from './diagram/canvas.js';
import { renderElement, removeElementNode, clearAll as clearElements } from './diagram/elements.js';
import { renderConnection, removeConnectionNode, clearAllConnections, initArrowMarker } from './diagram/connections.js';
import { initInteraction, getSelectedIds, selectElementById } from './diagram/interaction.js';
import { initResize, updateResizeHandles } from './diagram/resize.js';
import { initBoundary, updateBoundaryHandles } from './diagram/boundary.js';
import { initToolbar } from './ui/toolbar.js';
import { initSidebar, highlightListItems } from './ui/sidebar.js';
import { initProperties, selectItems } from './ui/properties.js';
import { openMetadataModal, openThreatModal, openThemeModal } from './ui/modals.js';
import { openReportModal } from './ui/report.js';
import {
  addElement, getElements, getConnections, on, elementDefaultSize,
} from './store/model.js';
import { initPersistence, loadFromStorage } from './store/persistence.js';

// ── Theme ──────────────────────────────────────────────────

const savedTheme = localStorage.getItem('hota-theme') ?? 'dark';
document.documentElement.dataset['theme'] = savedTheme;

// ── DOM refs ───────────────────────────────────────────────

const svg          = document.querySelector<SVGSVGElement>('#diagram-svg')!;
const connLayer    = svg.querySelector<SVGGElement>('#conn-layer')!;
const elLayer      = svg.querySelector<SVGGElement>('#el-layer')!;
const selectLayer  = svg.querySelector<SVGGElement>('#selection-layer')!;
const defs         = svg.querySelector<SVGDefsElement>('defs')!;
const toolbar      = document.querySelector<HTMLElement>('#toolbar')!;
const sidebar      = document.querySelector<HTMLElement>('#sidebar')!;
const propPanel    = document.querySelector<HTMLElement>('#properties')!;

// ── Init canvas ────────────────────────────────────────────

initArrowMarker(defs);
initCanvas(svg);
initResize(svg, selectLayer);
initBoundary(svg, selectLayer);

// ── Init UI ────────────────────────────────────────────────

initToolbar(toolbar, openMetadataModal, openThemeModal, openReportModal);
initSidebar(sidebar, svg, placeElement, (id) => {
  selectElementById(id);
  selectItems(new Set([id]), propPanel, (elId, threatId) => openThreatModal(elId, threatId));
  highlightListItems(new Set([id]));
});
initProperties(propPanel, (elId, threatId) => openThreatModal(elId, threatId));
initInteraction(svg, selectLayer, (ids) => {
  selectItems(ids, propPanel, (elId, threatId) => openThreatModal(elId, threatId));
  highlightListItems(ids);
});

// ── State → render bindings ────────────────────────────────

on('element:added', (el) => {
  renderElement(el, elLayer);
  rerenderConnections();
});

on('element:updated', (el) => {
  renderElement(el, elLayer);
  rerenderConnections();
  // Re-apply selected class and handles after node was recreated
  const selIds = getSelectedIds();
  if (selIds.has(el.id)) {
    document.querySelector<SVGGElement>(`[data-id="${el.id}"]`)?.classList.add('selected');
    if (selIds.size === 1) {
      if (el.type === 'TrustBoundary') {
        updateBoundaryHandles(el);
      } else {
        updateResizeHandles(el);
      }
    }
  }
});

on('element:removed', (id) => {
  removeElementNode(id);
  rerenderConnections();
});

on('connection:added', () => rerenderConnections());
on('connection:updated', () => rerenderConnections());
on('connection:removed', (id) => removeConnectionNode(id));

on('model:loaded', (model: Model) => {
  clearElements();
  clearAllConnections();
  model.elements.forEach((el) => renderElement(el, elLayer));
  rerenderConnections();
});

// ── Persistence ────────────────────────────────────────────
// Must be initialized AFTER all on() listeners so model:loaded fires into registered handlers.

initPersistence();
loadFromStorage();

// ── Place element from sidebar ─────────────────────────────

function placeElement(type: ElementType, sx: number, sy: number): void {
  const world = screenToWorld(sx, sy);
  const size = elementDefaultSize(type);
  // Center element on cursor; TrustBoundary y is the line y (no h offset)
  const x = world.x - size.w / 2;
  const y = type === 'TrustBoundary' ? world.y : world.y - size.h / 2;
  addElement({ type, x, y });
}

// ── Re-render all connections ──────────────────────────────

function rerenderConnections(): void {
  clearAllConnections();
  const elements = getElements();
  const elementMap = new Map(elements.map((e) => [e.id, e]));
  getConnections().forEach((conn) => {
    const from = elementMap.get(conn.from);
    const to   = elementMap.get(conn.to);
    if (from && to) renderConnection(conn, from, to, connLayer);
  });
}
