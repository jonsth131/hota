/**
 * SVG rendering for DataFlow connections (bezier arrows).
 */
import type { Connection, DiagramElement, PortSide, Point } from '../types.js';
import { getAnchorPoint, nearestPort } from './elements.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const connRegistry = new Map<string, SVGGElement>();
let ghostLine: SVGPathElement | null = null;

// ── Public API ─────────────────────────────────────────────

export function initArrowMarker(defs: SVGDefsElement): void {
  const marker = document.createElementNS(SVG_NS, 'marker') as SVGMarkerElement;
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
  path.setAttribute('d', 'M0,0 L0,6 L8,3 z');
  path.classList.add('arrow-head');
  marker.appendChild(path);
  defs.appendChild(marker);
}

export function renderConnection(
  conn: Connection,
  fromEl: DiagramElement,
  toEl: DiagramElement,
  layer: SVGGElement,
): SVGGElement {
  removeConnectionNode(conn.id);
  const fromSide = nearestPort(fromEl, toEl.x + toEl.w / 2, toEl.y + toEl.h / 2);
  const toSide   = nearestPort(toEl, fromEl.x + fromEl.w / 2, fromEl.y + fromEl.h / 2);
  const p1 = getAnchorPoint(fromEl, fromSide);
  const p2 = getAnchorPoint(toEl, toSide);
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  g.setAttribute('data-id', conn.id);
  g.classList.add('diagram-connection');
  // Wide invisible path for easier hit-testing
  const hit = makePath(p1, fromSide, p2, toSide);
  hit.classList.add('conn-hit');
  g.appendChild(hit);
  const p = makePath(p1, fromSide, p2, toSide);
  p.setAttribute('marker-end', 'url(#arrow)');
  p.classList.add('conn-path');
  g.appendChild(p);
  if (conn.label) {
    const mid = midpoint(p1, p2);
    const t = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
    t.setAttribute('x', String(mid.x));
    t.setAttribute('y', String(mid.y - 6));
    t.classList.add('conn-label');
    t.textContent = conn.label;
    g.appendChild(t);
  }
  layer.appendChild(g);
  connRegistry.set(conn.id, g);
  return g;
}

export function removeConnectionNode(id: string): void {
  const g = connRegistry.get(id);
  g?.parentNode?.removeChild(g);
  connRegistry.delete(id);
}

export function clearAllConnections(): void {
  connRegistry.forEach((g) => g.parentNode?.removeChild(g));
  connRegistry.clear();
}

/**
 * Updates SVG paths for all connections touching movedEl, without re-rendering.
 * Called during element drag to keep connections live without a full model round-trip.
 */
export function updateConnectionPathsForElement(
  movedEl: DiagramElement,
  connections: Connection[],
  elements: DiagramElement[],
): void {
  for (const conn of connections) {
    if (conn.from !== movedEl.id && conn.to !== movedEl.id) continue;
    const g = connRegistry.get(conn.id);
    if (!g) continue;
    const fromEl = conn.from === movedEl.id ? movedEl : elements.find((e) => e.id === conn.from);
    const toEl   = conn.to   === movedEl.id ? movedEl : elements.find((e) => e.id === conn.to);
    if (!fromEl || !toEl) continue;
    const fromSide = nearestPort(fromEl, toEl.x + toEl.w / 2, toEl.y + toEl.h / 2);
    const toSide   = nearestPort(toEl, fromEl.x + fromEl.w / 2, fromEl.y + fromEl.h / 2);
    const p1 = getAnchorPoint(fromEl, fromSide);
    const p2 = getAnchorPoint(toEl, toSide);
    const path = g.querySelector<SVGPathElement>('.conn-path');
    if (path) path.setAttribute('d', bezierD(p1, fromSide, p2, toSide));
    const label = g.querySelector<SVGTextElement>('.conn-label');
    if (label) {
      const mid = midpoint(p1, p2);
      label.setAttribute('x', String(mid.x));
      label.setAttribute('y', String(mid.y - 6));
    }
  }
}

// ── Ghost line (during connect) ────────────────────────────

export function showGhostLine(layer: SVGElement, x1: number, y1: number, x2: number, y2: number): void {
  hideGhostLine();
  ghostLine = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
  ghostLine.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
  ghostLine.classList.add('ghost-line');
  layer.appendChild(ghostLine);
}

export function hideGhostLine(): void {
  ghostLine?.parentNode?.removeChild(ghostLine);
  ghostLine = null;
}

// ── Bezier path ────────────────────────────────────────────

function makePath(
  p1: Point, s1: PortSide,
  p2: Point, s2: PortSide,
): SVGPathElement {
  const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
  path.setAttribute('d', bezierD(p1, s1, p2, s2));
  return path;
}

const BEZIER_CONTROL_OFFSET = 60;

export function bezierD(p1: Point, s1: PortSide, p2: Point, s2: PortSide): string {
  const c1 = controlPoint(p1, s1, BEZIER_CONTROL_OFFSET);
  const c2 = controlPoint(p2, s2, BEZIER_CONTROL_OFFSET);
  return `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
}

export function controlPoint(p: Point, side: PortSide, offset: number): Point {
  switch (side) {
    case 'top':    return { x: p.x,          y: p.y - offset };
    case 'right':  return { x: p.x + offset, y: p.y };
    case 'bottom': return { x: p.x,          y: p.y + offset };
    case 'left':   return { x: p.x - offset, y: p.y };
  }
}

export function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}
