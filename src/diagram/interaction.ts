/**
 * Handles user interaction: drag, port-connect, select, delete, label edit,
 * and rubber-band multi-element selection.
 */
import type { DiagramElement } from '../types.js';
import { screenToWorld } from './canvas.js';
import { getElementNode } from './elements.js';
import { updateElement, removeElement, getElements, getConnections, addConnection } from '../store/model.js';
import { showGhostLine, hideGhostLine, updateConnectionPathsForElement } from './connections.js';
import { showResizeHandles, hideResizeHandles, updateResizeHandles, isResizeDragging } from './resize.js';
import {
  showBoundaryHandles, hideBoundaryHandles, isBoundaryDragging, startBoundaryLineDrag,
  getBoundaryPoints, commitBoundaryPoints,
} from './boundary.js';
import { updateBoundaryPolylineDirect } from './elements.js';
import { getCurrentTool } from '../ui/sidebar.js';
import {
  initMarquee, startMarquee, updateMarquee, endMarquee, isMarqueeActive,
} from './multiselect.js';

let selectedIds: Set<string> = new Set();
let onSelectCb: ((ids: Set<string>) => void) | null = null;
let selLayer: SVGGElement | null = null;
let svgEl: SVGSVGElement | null = null;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initInteraction(
  svg: SVGSVGElement,
  selectionLayer: SVGGElement,
  onSelect: (ids: Set<string>) => void,
): void {
  onSelectCb = onSelect;
  selLayer = selectionLayer;
  svgEl = svg;
  initMarquee(selectionLayer);

  svg.addEventListener('mousedown', onMouseDown);
  svg.addEventListener('mousemove', onMouseMove);
  svg.addEventListener('mouseup', onMouseUp);
  svg.addEventListener('dblclick', onDblClick);
  window.addEventListener('keydown', onKeyDown);
}

// ── Drag state ─────────────────────────────────────────────

/** Single-element drag. */
let drag: {
  id: string;
  ox: number; oy: number;
  startX: number; startY: number;
  currentX: number; currentY: number;
} | null = null;

/** Multi-element drag: maps element id → original position + snapshot. */
let multiDrag: {
  start: { x: number; y: number };
  dx: number; dy: number;
  items: Map<string, { ox: number; oy: number; el: DiagramElement }>;
} | null = null;

let connecting: { fromId: string; fromX: number; fromY: number } | null = null;
let connectionJustStarted = false; // true until the mouseup that ends the first port click
let marqueeStartW: { x: number; y: number } | null = null;

// ── Overlay helpers ────────────────────────────────────────

const PAD = 4;

/** Confirmed selection overlays, keyed by element id so positions can be updated during drag. */
const selectionOverlayMap = new Map<string, SVGElement>();
/** Temporary preview overlays drawn during marquee drag. */
let previewOverlayEls: SVGElement[] = [];

function makeRectOverlay(x: number, y: number, w: number, h: number, cls: string): SVGRectElement {
  const r = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
  r.setAttribute('x', String(x - PAD)); r.setAttribute('y', String(y - PAD));
  r.setAttribute('width', String(w + PAD * 2)); r.setAttribute('height', String(h + PAD * 2));
  r.setAttribute('rx', '4'); r.setAttribute('ry', '4');
  r.classList.add(cls);
  return r;
}

function makePolylineOverlay(pts: { x: number; y: number }[], cls: string): SVGPolylineElement {
  const p = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
  p.setAttribute('fill', 'none');
  p.setAttribute('points', pts.map((pt) => `${pt.x},${pt.y}`).join(' '));
  p.classList.add(cls);
  return p;
}

function clearSelectionOverlays(): void {
  selectionOverlayMap.forEach((el) => el.parentNode?.removeChild(el));
  selectionOverlayMap.clear();
}

function renderSelectionOverlays(): void {
  clearSelectionOverlays();
  if (!selLayer || selectedIds.size <= 1) return;
  for (const id of selectedIds) {
    const el = getElements().find((x) => x.id === id);
    if (!el) continue;
    let overlay: SVGElement;
    if (el.type === 'TrustBoundary') {
      overlay = makePolylineOverlay(getBoundaryPoints(el), 'selection-overlay');
    } else {
      overlay = makeRectOverlay(el.x, el.y, el.w, el.h, 'selection-overlay');
    }
    selLayer.appendChild(overlay);
    selectionOverlayMap.set(id, overlay);
  }
}

/** Call during multi-drag mousemove to move overlays with their elements. */
function updateOverlayPositions(dx: number, dy: number): void {
  for (const [id, overlay] of selectionOverlayMap) {
    const info = multiDrag?.items.get(id);
    if (!info) continue;
    if (info.el.type === 'TrustBoundary') {
      const pts = getBoundaryPoints(info.el).map((p) => ({ x: p.x + dx, y: p.y + dy }));
      overlay.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    } else {
      const nx = info.ox + dx, ny = info.oy + dy;
      overlay.setAttribute('x', String(nx - PAD));
      overlay.setAttribute('y', String(ny - PAD));
    }
  }
}

// ── Marquee preview helpers ────────────────────────────────

function updateMarqueePreview(wx: number, wy: number): void {
  if (!marqueeStartW || !selLayer) return;
  const rx1 = Math.min(marqueeStartW.x, wx), ry1 = Math.min(marqueeStartW.y, wy);
  const rx2 = Math.max(marqueeStartW.x, wx), ry2 = Math.max(marqueeStartW.y, wy);

  // Clear previous preview overlays and rebuild
  previewOverlayEls.forEach((el) => el.parentNode?.removeChild(el));
  previewOverlayEls = [];

  for (const el of getElements()) {
    const node = document.querySelector<SVGGElement>(`[data-id="${el.id}"]`);
    if (!node) continue;
    let inside: boolean;
    if (el.type === 'TrustBoundary') {
      const pts = getBoundaryPoints(el);
      inside = pts.some((p) => p.x >= rx1 && p.x <= rx2 && p.y >= ry1 && p.y <= ry2);
      if (inside) {
        const poly = makePolylineOverlay(pts, 'selection-overlay-preview');
        selLayer.appendChild(poly);
        previewOverlayEls.push(poly);
      }
    } else {
      inside = el.x + el.w >= rx1 && el.x <= rx2 && el.y + el.h >= ry1 && el.y <= ry2;
      if (inside) {
        const rect = makeRectOverlay(el.x, el.y, el.w, el.h, 'selection-overlay-preview');
        selLayer.appendChild(rect);
        previewOverlayEls.push(rect);
      }
    }
    node.classList.toggle('marquee-preview', inside);
  }
}

function clearMarqueePreview(): void {
  document.querySelectorAll('.marquee-preview').forEach((n) => n.classList.remove('marquee-preview'));
  previewOverlayEls.forEach((el) => el.parentNode?.removeChild(el));
  previewOverlayEls = [];
  marqueeStartW = null;
}

// ── Event handlers ─────────────────────────────────────────

function onMouseDown(e: MouseEvent): void {
  const target = e.target as Element;
  if (e.button !== 0) return;

  // Resize / boundary handle clicks are owned by their modules
  if (target.classList.contains('resize-handle')) return;

  // Port click → start connecting (click-to-click mode)
  if (target.classList.contains('port')) {
    const group = target.closest<SVGGElement>('[data-id]');
    if (!group) return;
    const el = getElements().find((x) => x.id === group.dataset['id']);
    // TrustZone and TrustBoundary cannot be connected
    if (!el || el.type === 'TrustZone' || el.type === 'TrustBoundary') return;
    e.stopPropagation();
    if (connecting) {
      // Second click on a port: if it's a different element, complete the connection
      if (group.dataset['id'] !== connecting.fromId) {
        const toId = group.dataset['id']!;
        const exists = getConnections().some(
          (c) => (c.from === connecting!.fromId && c.to === toId) ||
                  (c.from === toId && c.to === connecting!.fromId),
        );
        if (!exists) addConnection({ from: connecting.fromId, to: toId });
      }
      hideGhostLine();
      svgEl?.classList.remove('connecting-active');
      connecting = null;
      connectionJustStarted = false;
    } else {
      // First click: begin connection from this port
      const w = screenToWorld(e.clientX, e.clientY);
      connecting = { fromId: group.dataset['id']!, fromX: w.x, fromY: w.y };
      connectionJustStarted = true;
      svgEl?.classList.add('connecting-active');
    }
    return;
  }

  // Element click → complete connection OR select + drag start
  const group = target.closest<SVGGElement>('.diagram-element');
  if (group) {
    const id = group.dataset['id']!;
    const el = getElements().find((x) => x.id === id);
    if (!el) return;

    // If we're in connection mode, clicking an element completes the connection
    if (connecting && !connectionJustStarted) {
      if (id !== connecting.fromId && el.type !== 'TrustZone' && el.type !== 'TrustBoundary') {
        const exists = getConnections().some(
          (c) => (c.from === connecting!.fromId && c.to === id) ||
                  (c.from === id && c.to === connecting!.fromId),
        );
        if (!exists) addConnection({ from: connecting.fromId, to: id });
      }
      hideGhostLine();
      svgEl?.classList.remove('connecting-active');
      connecting = null;
      e.stopPropagation();
      return;
    }

    if (e.shiftKey) {
      // Shift+click: toggle element in/out of selection
      if (selectedIds.has(id)) {
        deselect(id);
      } else {
        addToSelection(id, el);
      }
      e.stopPropagation();
      return;
    }

    if (el.type === 'TrustBoundary') {
      // TrustBoundary drag is owned by boundary.ts; single-select it
      replaceSelection(id, el);
      startBoundaryLineDrag(el, e);
      e.stopPropagation();
      return;
    }

    const w = screenToWorld(e.clientX, e.clientY);

    if (selectedIds.size > 1 && selectedIds.has(id)) {
      // Click on a multi-selected element → start grouped drag
      const items = new Map<string, { ox: number; oy: number; el: DiagramElement }>();
      for (const sid of selectedIds) {
        const sel = getElements().find((x) => x.id === sid);
        if (sel && sel.type !== 'TrustBoundary') {
          items.set(sid, { ox: sel.x, oy: sel.y, el: sel });
        } else if (sel && sel.type === 'TrustBoundary') {
          // TrustBoundary moves via its points; store first-point as ox/oy
          const pts = getBoundaryPoints(sel);
          items.set(sid, { ox: pts[0]!.x, oy: pts[0]!.y, el: sel });
        }
      }
      multiDrag = { start: { x: w.x, y: w.y }, dx: 0, dy: 0, items };
      e.stopPropagation();
      return;
    }

    // Single-select + drag
    replaceSelection(id, el);
    drag = { id, ox: el.x, oy: el.y, startX: w.x, startY: w.y, currentX: el.x, currentY: el.y };
    e.stopPropagation();
    return;
  }

  // Connection click → select (clears multi), but cancel connecting-mode if active
  const conn = target.closest<SVGGElement>('.diagram-connection');
  if (conn) {
    if (connecting) {
      hideGhostLine();
      svgEl?.classList.remove('connecting-active');
      connecting = null;
      connectionJustStarted = false;
    }
    clearSelectionVisual();
    selectedIds = new Set([conn.dataset['id']!]);
    onSelectCb?.(new Set(selectedIds));
    e.stopPropagation();
    return;
  }

  // Background click → cancel connecting, start marquee, or deselect
  if (connecting) {
    hideGhostLine();
    svgEl?.classList.remove('connecting-active');
    connecting = null;
    connectionJustStarted = false;
  }
  clearSelectionVisual();
  selectedIds = new Set();
  onSelectCb?.(new Set());
  if (getCurrentTool() === 'select') {
    const w = screenToWorld(e.clientX, e.clientY);
    marqueeStartW = { x: w.x, y: w.y };
    startMarquee(w.x, w.y);
  }
}

function onMouseMove(e: MouseEvent): void {
  // Resize and boundary modules own mouse during their drags
  if (isResizeDragging() || isBoundaryDragging()) return;

  if (isMarqueeActive()) {
    const w = screenToWorld(e.clientX, e.clientY);
    updateMarquee(w.x, w.y);
    updateMarqueePreview(w.x, w.y);
    e.preventDefault();
    return;
  }

  if (drag) {
    const w = screenToWorld(e.clientX, e.clientY);
    const newX = drag.ox + (w.x - drag.startX);
    const newY = drag.oy + (w.y - drag.startY);
    drag.currentX = newX;
    drag.currentY = newY;
    const node = getElementNode(drag.id);
    if (node) node.setAttribute('transform', `translate(${newX},${newY})`);
    const el = getElements().find((x) => x.id === drag!.id);
    if (el) {
      updateConnectionPathsForElement({ ...el, x: newX, y: newY }, getConnections(), getElements());
      updateResizeHandles({ ...el, x: newX, y: newY });
    }
    e.preventDefault();
    return;
  }

  if (multiDrag) {
    const w = screenToWorld(e.clientX, e.clientY);
    const dx = w.x - multiDrag.start.x;
    const dy = w.y - multiDrag.start.y;
    multiDrag.dx = dx;
    multiDrag.dy = dy;

    // Build virtual element list with updated positions for connection path calc
    const movedMap = new Map<string, { x: number; y: number }>();
    for (const [sid, info] of multiDrag.items) {
      if (info.el.type !== 'TrustBoundary') {
        movedMap.set(sid, { x: info.ox + dx, y: info.oy + dy });
      }
    }
    const virtualElements = getElements().map((e) => {
      const m = movedMap.get(e.id);
      return m ? { ...e, ...m } : e;
    });

    for (const [sid, info] of multiDrag.items) {
      if (info.el.type === 'TrustBoundary') {
        const pts = getBoundaryPoints(info.el).map((p) => ({ x: p.x + dx, y: p.y + dy }));
        updateBoundaryPolylineDirect(sid, pts);
      } else {
        const newX = info.ox + dx;
        const newY = info.oy + dy;
        const node = getElementNode(sid);
        if (node) node.setAttribute('transform', `translate(${newX},${newY})`);
        updateConnectionPathsForElement(
          { ...info.el, x: newX, y: newY },
          getConnections(),
          virtualElements,
        );
      }
    }
    // Move selection overlays with their elements
    updateOverlayPositions(dx, dy);
    e.preventDefault();
    return;
  }

  if (connecting) {
    const w = screenToWorld(e.clientX, e.clientY);
    // Draw ghost line from the stored start position to current cursor
    showGhostLine(e.currentTarget as SVGSVGElement, connecting.fromX, connecting.fromY, w.x, w.y);
  }
}

function onMouseUp(e: MouseEvent): void {
  if (isMarqueeActive()) {
    const rect = endMarquee();
    clearMarqueePreview();
    if (rect && (rect.w > 4 || rect.h > 4)) {
      // Select elements whose bounding box overlaps the marquee
      const rx1 = rect.x, ry1 = rect.y, rx2 = rect.x + rect.w, ry2 = rect.y + rect.h;
      const matched = new Set<string>();
      for (const el of getElements()) {
        if (el.type === 'TrustBoundary') {
          // Hit-test any boundary point inside the rect
          const pts = getBoundaryPoints(el);
          if (pts.some((p) => p.x >= rx1 && p.x <= rx2 && p.y >= ry1 && p.y <= ry2)) {
            matched.add(el.id);
          }
        } else if (el.x + el.w >= rx1 && el.x <= rx2 && el.y + el.h >= ry1 && el.y <= ry2) {
          matched.add(el.id);
        }
      }
      selectedIds = matched;
      applySelectionVisual();
    } else {
      // Tiny drag = background click → already cleared in mousedown
    }
    return;
  }

  if (drag) {
    if (drag.currentX !== drag.ox || drag.currentY !== drag.oy) {
      updateElement(drag.id, { x: drag.currentX, y: drag.currentY });
    }
    drag = null;
    return;
  }

  if (multiDrag) {
    const { dx, dy, items } = multiDrag;
    if (dx !== 0 || dy !== 0) {
      for (const [sid, info] of items) {
        if (info.el.type === 'TrustBoundary') {
          const pts = getBoundaryPoints(info.el).map((p) => ({ x: p.x + dx, y: p.y + dy }));
          commitBoundaryPoints(sid, pts);
        } else {
          updateElement(sid, { x: info.ox + dx, y: info.oy + dy });
        }
      }
    }
    multiDrag = null;
    // Re-render overlays at final committed positions (model:updated triggers renderElement
    // which rebuilds elements, so overlays need a fresh render after model settles)
    requestAnimationFrame(() => renderSelectionOverlays());
    return;
  }

  if (connecting) {
    // If this mouseup is the release of the initial port-click, keep connecting
    if (connectionJustStarted) {
      connectionJustStarted = false;
      return;
    }
    // Otherwise: mouseup on element body completes the connection (fallback for drag-style usage)
    hideGhostLine();
    svgEl?.classList.remove('connecting-active');
    const target = e.target as Element;
    const toGroup = target.closest<SVGGElement>('.diagram-element');
    if (toGroup && toGroup.dataset['id'] !== connecting.fromId) {
      const toId = toGroup.dataset['id']!;
      const toEl = getElements().find((x) => x.id === toId);
      if (!(toEl?.type === 'TrustZone' || toEl?.type === 'TrustBoundary')) {
        const exists = getConnections().some(
          (c) => (c.from === connecting!.fromId && c.to === toId) ||
                  (c.from === toId && c.to === connecting!.fromId),
        );
        if (!exists) addConnection({ from: connecting.fromId, to: toId });
      }
    }
    connecting = null;
  }
}

function onDblClick(e: MouseEvent): void {
  const target = e.target as Element;
  const group = target.closest<SVGGElement>('.diagram-element');
  if (!group) return;
  const id = group.dataset['id']!;
  const el = getElements().find((x) => x.id === id);
  if (!el) return;
  startInlineEdit(el, group, e.currentTarget as SVGSVGElement);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && connecting) {
    hideGhostLine();
    svgEl?.classList.remove('connecting-active');
    connecting = null;
    connectionJustStarted = false;
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) removeElement(id);
    clearSelectionVisual();
    selectedIds = new Set();
    onSelectCb?.(new Set());
  }
}

// ── Inline label edit ──────────────────────────────────────

function startInlineEdit(el: DiagramElement, group: SVGGElement, svg: SVGSVGElement): void {
  const rect = group.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const input = document.createElement('input');
  input.type = 'text';
  input.value = el.label;
  input.classList.add('inline-edit');
  input.style.left  = `${rect.left - svgRect.left + rect.width / 2 - 60}px`;
  input.style.top   = `${rect.top  - svgRect.top  + rect.height / 2 - 12}px`;
  input.style.width = '120px';

  const container = svg.parentElement!;
  container.style.position = 'relative';
  container.appendChild(input);
  input.focus();
  input.select();

  const finish = (): void => {
    const val = input.value.trim();
    if (val) updateElement(el.id, { label: val });
    input.remove();
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') finish();
    if (ev.key === 'Escape') input.remove();
  });
}

// ── Selection helpers ──────────────────────────────────────

function clearSelectionVisual(): void {
  for (const id of selectedIds) {
    document.querySelector<SVGGElement>(`[data-id="${id}"]`)?.classList.remove('selected');
  }
  clearSelectionOverlays();
  hideResizeHandles();
  hideBoundaryHandles();
}

function applySelectionVisual(): void {
  for (const id of selectedIds) {
    document.querySelector<SVGGElement>(`[data-id="${id}"]`)?.classList.add('selected');
  }
  if (selectedIds.size === 1) {
    const [id] = selectedIds;
    const el = getElements().find((x) => x.id === id);
    if (el) {
      if (el.type === 'TrustBoundary') showBoundaryHandles(el);
      else showResizeHandles(el);
    }
  } else {
    renderSelectionOverlays();
  }
  onSelectCb?.(new Set(selectedIds));
}

function replaceSelection(id: string, el: DiagramElement): void {
  clearSelectionVisual();
  selectedIds = new Set([id]);
  applySelectionVisual();
  void el; // consumed by applySelectionVisual via getElements()
}

function addToSelection(id: string, _el: DiagramElement): void {
  selectedIds.add(id);
  document.querySelector<SVGGElement>(`[data-id="${id}"]`)?.classList.add('selected');
  // Handles only for single-select; overlays for multi
  hideResizeHandles();
  hideBoundaryHandles();
  renderSelectionOverlays();
  onSelectCb?.(new Set(selectedIds));
}

function deselect(id: string): void {
  selectedIds.delete(id);
  document.querySelector<SVGGElement>(`[data-id="${id}"]`)?.classList.remove('selected');
  if (selectedIds.size === 1) {
    clearSelectionOverlays();
    const [remaining] = selectedIds;
    const el = getElements().find((x) => x.id === remaining);
    if (el) {
      if (el.type === 'TrustBoundary') showBoundaryHandles(el);
      else showResizeHandles(el);
    }
  } else {
    renderSelectionOverlays();
    hideResizeHandles();
    hideBoundaryHandles();
  }
  onSelectCb?.(new Set(selectedIds));
}

// ── Public API ─────────────────────────────────────────────

export function getSelectedId(): string | null {
  return selectedIds.size === 1 ? [...selectedIds][0]! : null;
}
export function getSelectedIds(): Set<string> { return new Set(selectedIds); }
export function clearSelection(): void {
  clearSelectionVisual();
  selectedIds = new Set();
  onSelectCb?.(new Set());
}

/** Programmatically select a single element by id (e.g. from list click). */
export function selectElementById(id: string): void {
  const el = getElements().find((x) => x.id === id);
  if (!el) return;
  clearSelectionVisual();
  selectedIds = new Set([id]);
  applySelectionVisual();
}
