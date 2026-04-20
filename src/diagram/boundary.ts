/**
 * TrustBoundary polyline editor.
 * Handles rendering of point handles, drag-to-move points,
 * drag-midpoint to insert new points, and right-click to delete.
 */
import type { DiagramElement } from '../types.js';
import { screenToWorld } from './canvas.js';
import { updateElement, getElements } from '../store/model.js';
import { updateBoundaryPolylineDirect } from './elements.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type BoundaryPoint = { x: number; y: number };

// ── Helpers ────────────────────────────────────────────────

export function getBoundaryPoints(el: DiagramElement): BoundaryPoint[] {
  const pts = (el.metadata as Record<string, unknown>)['points'];
  if (Array.isArray(pts) && pts.length >= 2) return pts as BoundaryPoint[];
  // Fallback: two-point horizontal line
  return [{ x: el.x, y: el.y }, { x: el.x + el.w, y: el.y }];
}

export function commitBoundaryPoints(id: string, points: BoundaryPoint[]): void {
  const el = getElements().find((e) => e.id === id);
  if (!el) return;
  const first = points[0]!;
  const xs = points.map((p) => p.x);
  const w = Math.max(10, Math.max(...xs) - Math.min(...xs));
  updateElement(id, {
    x: first.x,
    y: first.y,
    w,
    metadata: { ...(el.metadata as object), points },
  });
}

// ── Module state ───────────────────────────────────────────

let layer: SVGGElement | null = null;
let svgEl: SVGSVGElement | null = null;
let activeElementId: string | null = null;
let currentPts: BoundaryPoint[] = [];
/** Tracks every handle element so we can remove only those, not the whole layer. */
let handleEls: SVGElement[] = [];

type DragState =
  | { kind: 'point';  ptIdx: number;  startX: number; startY: number; origPts: BoundaryPoint[]; elId: string }
  | { kind: 'insert'; segIdx: number; startX: number; startY: number; origPts: BoundaryPoint[]; elId: string }
  | { kind: 'line';                   startX: number; startY: number; origPts: BoundaryPoint[]; elId: string }
  | null;

let drag: DragState = null;

// ── Public API ─────────────────────────────────────────────

export function initBoundary(svg: SVGSVGElement, selectionLayer: SVGGElement): void {
  svgEl = svg;
  layer = selectionLayer;
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
}

export function showBoundaryHandles(el: DiagramElement): void {
  activeElementId = el.id;
  currentPts = getBoundaryPoints(el);
  renderHandles(currentPts, el.id);
}

export function hideBoundaryHandles(): void {
  activeElementId = null;
  currentPts = [];
  handleEls.forEach((el) => el.parentNode?.removeChild(el));
  handleEls = [];
}

export function updateBoundaryHandles(el: DiagramElement): void {
  if (activeElementId === el.id) {
    currentPts = getBoundaryPoints(el);
    renderHandles(currentPts, el.id);
  }
}

export function isBoundaryDragging(): boolean {
  return drag !== null;
}

/** Called by interaction.ts when user mousedowns on a TrustBoundary element body. */
export function startBoundaryLineDrag(el: DiagramElement, e: MouseEvent): void {
  const w = screenToWorld(e.clientX, e.clientY);
  const pts = getBoundaryPoints(el);
  currentPts = pts.map((p) => ({ ...p }));
  drag = { kind: 'line', startX: w.x, startY: w.y, origPts: currentPts.map((p) => ({ ...p })), elId: el.id };
}

// ── Handle rendering ───────────────────────────────────────

function renderHandles(pts: BoundaryPoint[], elId: string): void {
  if (!layer) return;
  // Remove only the previously tracked handles — don't clear the whole layer
  handleEls.forEach((el) => el.parentNode?.removeChild(el));
  handleEls = [];
  const l = layer;

  // Midpoint handles (insert new point by dragging)
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const mid = makeSvgEl<SVGCircleElement>('circle');
    mid.setAttribute('cx', String(mx));
    mid.setAttribute('cy', String(my));
    mid.setAttribute('r', '5');
    mid.classList.add('boundary-midpoint-handle');
    const segI = i;
    mid.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const w = screenToWorld(e.clientX, e.clientY);
      const el = getElements().find((x) => x.id === elId)!;
      const latestPts = getBoundaryPoints(el);
      drag = { kind: 'insert', segIdx: segI, startX: w.x, startY: w.y, origPts: latestPts.map((p) => ({ ...p })), elId };
    });
    layer.appendChild(mid);
    handleEls.push(mid);
  }

  // Point handles (drag to move, right-click to delete)
  pts.forEach((pt, i) => {
    const h = makeSvgEl<SVGCircleElement>('circle');
    h.setAttribute('cx', String(pt.x));
    h.setAttribute('cy', String(pt.y));
    h.setAttribute('r', '7');
    h.classList.add('boundary-point-handle');
    const ptI = i;
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const w = screenToWorld(e.clientX, e.clientY);
      const el = getElements().find((x) => x.id === elId)!;
      const latestPts = getBoundaryPoints(el);
      drag = { kind: 'point', ptIdx: ptI, startX: w.x, startY: w.y, origPts: latestPts.map((p) => ({ ...p })), elId };
    });
    h.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const el = getElements().find((x) => x.id === elId);
      if (!el) return;
      const latestPts = getBoundaryPoints(el);
      if (latestPts.length <= 2) return; // keep minimum 2 points
      const newPts = latestPts.filter((_, idx) => idx !== ptI);
      commitBoundaryPoints(elId, newPts);
    });
    l.appendChild(h);
    handleEls.push(h);
  });
}

// ── Window mouse handlers ──────────────────────────────────

function onWindowMouseMove(e: MouseEvent): void {
  if (!drag || !svgEl) return;
  const world = screenToWorld(e.clientX, e.clientY);
  const dx = world.x - drag.startX;
  const dy = world.y - drag.startY;
  let newPts: BoundaryPoint[];

  if (drag.kind === 'line') {
    newPts = drag.origPts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  } else if (drag.kind === 'point') {
    newPts = drag.origPts.map((p, i) =>
      i === (drag as Extract<DragState & object, { kind: 'point' }>).ptIdx
        ? { x: p.x + dx, y: p.y + dy }
        : { ...p },
    );
  } else {
    // insert: place new point at current mouse position between seg endpoints
    const { segIdx, origPts } = drag;
    newPts = [
      ...origPts.slice(0, segIdx + 1),
      { x: world.x, y: world.y },
      ...origPts.slice(segIdx + 1),
    ];
  }

  currentPts = newPts;
  updateBoundaryPolylineDirect(drag.elId, newPts);
  renderHandles(newPts, drag.elId);
}

function onWindowMouseUp(): void {
  if (!drag) return;
  const elId = drag.elId;
  drag = null;
  commitBoundaryPoints(elId, currentPts);
}

// ── Utils ──────────────────────────────────────────────────

function makeSvgEl<T extends SVGElement>(tag: string): T {
  return document.createElementNS(SVG_NS, tag) as T;
}
