/**
 * SVG rendering for all diagram element types.
 */
import type { DiagramElement, ElementType, PortSide, Point } from '../types.js';
import { getBoundaryPoints, type BoundaryPoint } from './boundary.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const nodeRegistry = new Map<string, SVGGElement>();

export interface Port {
  id: string;
  elementId: string;
  side: PortSide;
  x: number;
  y: number;
}

// ── Public API ─────────────────────────────────────────────

export function renderElement(el: DiagramElement, layer: SVGGElement): SVGGElement {
  removeElementNode(el.id);
  const g = makeSvg<SVGGElement>('g');
  g.setAttribute('data-id', el.id);
  g.setAttribute('data-type', el.type);
  g.classList.add('diagram-element');
  // TrustBoundary uses absolute world coords — do NOT apply translate
  if (el.type !== 'TrustBoundary') {
    g.setAttribute('transform', `translate(${el.x},${el.y})`);
  }
  buildShape(g, el);
  buildLabel(g, el);
  buildPorts(g, el);
  if (el.groupId) {
    g.setAttribute('data-group-id', el.groupId);
    if (el.type !== 'TrustBoundary') {
      const badge = makeSvg<SVGCircleElement>('circle');
      badge.setAttribute('cx', String(el.w - 5));
      badge.setAttribute('cy', '5');
      badge.setAttribute('r', '4');
      badge.classList.add('group-badge');
      g.appendChild(badge);
    }
  }
  layer.appendChild(g);
  nodeRegistry.set(el.id, g);
  return g;
}

export function updateElementPosition(id: string, x: number, y: number): void {
  const g = nodeRegistry.get(id);
  if (g) g.setAttribute('transform', `translate(${x},${y})`);
}

export function updateElementLabel(id: string, label: string): void {
  const g = nodeRegistry.get(id);
  if (!g) return;
  const t = g.querySelector<SVGTextElement>('.el-label');
  if (t) t.textContent = label;
}

/** Directly updates TrustBoundary smooth path SVG during drag (no model update). */
export function updateBoundaryPolylineDirect(id: string, points: BoundaryPoint[]): void {
  const g = nodeRegistry.get(id);
  if (!g) return;
  const d = toSmoothPathD(points);
  g.querySelectorAll<SVGPathElement>('path').forEach((p) => p.setAttribute('d', d));
  // Reposition label above the midpoint of the polyline
  const t = g.querySelector<SVGTextElement>('.el-label');
  if (t && points.length >= 2) {
    const midIdx = Math.floor((points.length - 1) / 2);
    const a = points[midIdx]!;
    const b = points[midIdx + 1] ?? a;
    t.setAttribute('x', String((a.x + b.x) / 2));
    t.setAttribute('y', String((a.y + b.y) / 2 - 8));
  }
  const ports = g.querySelectorAll<SVGCircleElement>('[data-port]');
  ports.forEach((dot) => {
    const side = dot.getAttribute('data-port');
    if (side === 'left')  { dot.setAttribute('cx', String(points[0]!.x)); dot.setAttribute('cy', String(points[0]!.y)); }
    if (side === 'right') { dot.setAttribute('cx', String(points[points.length - 1]!.x)); dot.setAttribute('cy', String(points[points.length - 1]!.y)); }
  });
}

/** Directly updates element shape and position in the SVG during resize drag (no model update). */
export function updateElementShapeDirect(id: string, x: number, y: number, w: number, h: number): void {
  const g = nodeRegistry.get(id);
  if (!g) return;
  g.setAttribute('transform', `translate(${x},${y})`);

  const rect = g.querySelector<SVGRectElement | SVGCircleElement>('rect, circle');
  if (!rect) return;
  if (rect.tagName === 'circle') {
    const r = Math.min(w, h) / 2;
    rect.setAttribute('cx', String(w / 2));
    rect.setAttribute('cy', String(h / 2));
    rect.setAttribute('r', String(r));
  } else {
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    // DataStore: also update the two horizontal lines
    const lines = g.querySelectorAll<SVGLineElement>('.el-ds-line');
    if (lines.length === 2) {
      lines[0]!.setAttribute('x2', String(w));
      lines[1]!.setAttribute('x2', String(w));
      lines[1]!.setAttribute('y1', String(h));
      lines[1]!.setAttribute('y2', String(h));
    }
    // TrustZone also just has a rect — nothing extra needed
  }
  // Update label position
  const label = g.querySelector<SVGTextElement>('.el-label');
  if (label) {
    label.setAttribute('x', String(w / 2));
    label.setAttribute('y', String(h / 2 + 4));
  }
  // Update port positions
  const ports = g.querySelectorAll<SVGCircleElement>('[data-port]');
  ports.forEach((dot) => {
    switch (dot.getAttribute('data-port')) {
      case 'top':    dot.setAttribute('cx', String(w / 2)); dot.setAttribute('cy', '0'); break;
      case 'right':  dot.setAttribute('cx', String(w));     dot.setAttribute('cy', String(h / 2)); break;
      case 'bottom': dot.setAttribute('cx', String(w / 2)); dot.setAttribute('cy', String(h)); break;
      case 'left':   dot.setAttribute('cx', '0');           dot.setAttribute('cy', String(h / 2)); break;
    }
  });
}

export function removeElementNode(id: string): void {
  const g = nodeRegistry.get(id);
  g?.parentNode?.removeChild(g);
  nodeRegistry.delete(id);
}

export function getElementNode(id: string): SVGGElement | undefined {
  return nodeRegistry.get(id);
}

export function clearAll(): void {
  nodeRegistry.forEach((g) => g.parentNode?.removeChild(g));
  nodeRegistry.clear();
}

// ── Port helpers ───────────────────────────────────────────

export function getAnchorPoint(el: DiagramElement, side: PortSide): Point {
  if (el.type === 'TrustBoundary') {
    const pts = getBoundaryPoints(el);
    if (side === 'left')  return pts[0]!;
    if (side === 'right') return pts[pts.length - 1]!;
    return pts[0]!;
  }
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  switch (side) {
    case 'top':    return { x: cx,           y: el.y };
    case 'right':  return { x: el.x + el.w,  y: cy   };
    case 'bottom': return { x: cx,           y: el.y + el.h };
    case 'left':   return { x: el.x,         y: cy   };
  }
}

export function nearestPort(
  el: DiagramElement,
  fromX: number,
  fromY: number,
): PortSide {
  const sides: PortSide[] = ['top', 'right', 'bottom', 'left'];
  let best: PortSide = 'right';
  let bestDist = Infinity;
  for (const side of sides) {
    const p = getAnchorPoint(el, side);
    const d = Math.hypot(p.x - fromX, p.y - fromY);
    if (d < bestDist) { bestDist = d; best = side; }
  }
  return best;
}

// ── Shape builders ─────────────────────────────────────────

function buildShape(g: SVGGElement, el: DiagramElement): void {
  switch (el.type) {
    case 'Process':        buildProcess(g, el);        break;
    case 'ExternalEntity': buildExternalEntity(g, el); break;
    case 'DataStore':      buildDataStore(g, el);      break;
    case 'TrustBoundary':  buildTrustBoundaryLine(g, el); break;
    case 'TrustZone':      buildTrustZone(g, el);      break;
  }
}

function buildProcess(g: SVGGElement, el: DiagramElement): void {
  const r = Math.min(el.w, el.h) / 2;
  const c = makeSvg<SVGCircleElement>('circle');
  c.setAttribute('cx', String(el.w / 2));
  c.setAttribute('cy', String(el.h / 2));
  c.setAttribute('r', String(r));
  c.classList.add('el-shape', 'el-process');
  g.appendChild(c);
}

function buildExternalEntity(g: SVGGElement, el: DiagramElement): void {
  const rect = makeSvg<SVGRectElement>('rect');
  rect.setAttribute('width', String(el.w));
  rect.setAttribute('height', String(el.h));
  rect.classList.add('el-shape', 'el-external');
  g.appendChild(rect);
}

function buildDataStore(g: SVGGElement, el: DiagramElement): void {
  // Invisible hit-area rect so the whole element is draggable/clickable
  const hit = makeSvg<SVGRectElement>('rect');
  hit.setAttribute('width', String(el.w));
  hit.setAttribute('height', String(el.h));
  hit.classList.add('el-hit-area', 'el-datastore');
  // Top line
  const top = makeSvg<SVGLineElement>('line');
  top.setAttribute('x1', '0');   top.setAttribute('y1', '0');
  top.setAttribute('x2', String(el.w)); top.setAttribute('y2', '0');
  top.classList.add('el-ds-line');
  // Bottom line
  const bot = makeSvg<SVGLineElement>('line');
  bot.setAttribute('x1', '0');   bot.setAttribute('y1', String(el.h));
  bot.setAttribute('x2', String(el.w)); bot.setAttribute('y2', String(el.h));
  bot.classList.add('el-ds-line');
  g.appendChild(hit);
  g.appendChild(top);
  g.appendChild(bot);
}

function buildTrustBoundaryLine(g: SVGGElement, el: DiagramElement): void {
  const pts = getBoundaryPoints(el);
  const d = toSmoothPathD(pts);
  // Thick invisible path for hit-testing (easy to click even on thin line)
  const hit = makeSvg<SVGPathElement>('path');
  hit.setAttribute('d', d);
  hit.classList.add('el-boundary-hit');
  // Visible dashed path
  const line = makeSvg<SVGPathElement>('path');
  line.setAttribute('d', d);
  line.classList.add('el-trust-boundary-line');
  g.appendChild(hit);
  g.appendChild(line);
}

function buildTrustZone(g: SVGGElement, el: DiagramElement): void {
  const rect = makeSvg<SVGRectElement>('rect');
  rect.setAttribute('width', String(el.w));
  rect.setAttribute('height', String(el.h));
  rect.classList.add('el-shape', 'el-trust-zone');
  g.appendChild(rect);
}

function buildLabel(g: SVGGElement, el: DiagramElement): void {
  const t = makeSvg<SVGTextElement>('text');
  if (el.type === 'TrustBoundary') {
    // Label above the midpoint of the polyline (absolute coords — no translate on g)
    const pts = getBoundaryPoints(el);
    const midIdx = Math.floor((pts.length - 1) / 2);
    const a = pts[midIdx]!;
    const b = pts[midIdx + 1] ?? a;
    t.setAttribute('x', String((a.x + b.x) / 2));
    t.setAttribute('y', String((a.y + b.y) / 2 - 8));
  } else if (el.type === 'TrustZone') {
    // Position label just above the top edge so it doesn't overlap inner elements
    t.setAttribute('x', String(el.w / 2));
    t.setAttribute('y', '-6');
  } else {
    t.setAttribute('x', String(el.w / 2));
    t.setAttribute('y', String(el.h / 2 + 4));
  }
  t.classList.add('el-label');
  t.textContent = el.label;
  g.appendChild(t);
}

function buildPorts(g: SVGGElement, el: DiagramElement): void {
  // TrustZone and TrustBoundary cannot be connected to other elements
  if (el.type === 'TrustZone' || el.type === 'TrustBoundary') return;

  type PortDef = { side: PortSide; cx: number; cy: number };
  const ports: PortDef[] = [
    { side: 'top',    cx: el.w / 2, cy: 0 },
    { side: 'right',  cx: el.w,     cy: el.h / 2 },
    { side: 'bottom', cx: el.w / 2, cy: el.h },
    { side: 'left',   cx: 0,        cy: el.h / 2 },
  ];
  for (const p of ports) {
    const dot = makeSvg<SVGCircleElement>('circle');
    dot.setAttribute('cx', String(p.cx));
    dot.setAttribute('cy', String(p.cy));
    dot.setAttribute('r', '5');
    dot.setAttribute('data-port', p.side);
    dot.classList.add('port');
    g.appendChild(dot);
  }
}

// ── SVG helper ─────────────────────────────────────────────

export function toPolylineStr(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

/** Converts boundary points to a smooth SVG path using quadratic bezier through midpoints. */
export function toSmoothPathD(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  if (pts.length === 2) return `M${pts[0]!.x},${pts[0]!.y} L${pts[1]!.x},${pts[1]!.y}`;
  const d: string[] = [`M${pts[0]!.x},${pts[0]!.y}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d.push(`Q${curr.x},${curr.y} ${mx},${my}`);
  }
  const last = pts[pts.length - 1]!;
  d.push(`L${last.x},${last.y}`);
  return d.join(' ');
}

function makeSvg<T extends SVGElement>(tag: string): T {
  return document.createElementNS(SVG_NS, tag) as T;
}

export type { ElementType };
