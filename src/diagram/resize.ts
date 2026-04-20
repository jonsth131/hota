/**
 * Resize handles overlay.
 * Renders 8 handles (corners + midpoints) for the selected element.
 * Lives in #selection-layer which pans/zooms with the canvas.
 */

import type { DiagramElement } from '../types.js';
import { screenToWorld } from './canvas.js';
import { updateElement, getElements } from '../store/model.js';
import { updateElementShapeDirect } from './elements.js';
import { updateConnectionPathsForElement } from './connections.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HANDLE_SIZE = 8;
const MIN_W = 40;
const MIN_H = 30;

type HandlePos = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CURSOR: Record<HandlePos, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  e:  'e-resize',  se: 'se-resize',
  s:  's-resize',  sw: 'sw-resize', w: 'w-resize',
};

interface ResizeDrag {
  handle: HandlePos;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  elementId: string;
  currentX: number;
  currentY: number;
  currentW: number;
  currentH: number;
}

let layer: SVGGElement | null = null;
let svgEl: SVGSVGElement | null = null;
let activeDrag: ResizeDrag | null = null;
let activeElementId: string | null = null;
/** Tracks handle elements so only those are removed on hide, not the whole layer. */
let handleEls: SVGElement[] = [];

// ── Init ───────────────────────────────────────────────────

export function initResize(svg: SVGSVGElement, selectionLayer: SVGGElement): void {
  svgEl = svg;
  layer = selectionLayer;
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
}

// ── Show / hide / update ───────────────────────────────────

export function showResizeHandles(el: DiagramElement): void {
  if (el.type === 'TrustBoundary') return; // boundary.ts handles this
  activeElementId = el.id;
  renderHandles(el);
}

export function hideResizeHandles(): void {
  activeElementId = null;
  handleEls.forEach((el) => el.parentNode?.removeChild(el));
  handleEls = [];
}

export function updateResizeHandles(el: DiagramElement): void {
  if (el.type === 'TrustBoundary') return;
  if (activeElementId === el.id) renderHandles(el);
}

export function isResizeDragging(): boolean {
  return activeDrag !== null;
}

// ── Render ─────────────────────────────────────────────────

function renderHandles(el: DiagramElement): void {
  if (!layer) return;
  // Remove only previously tracked handles — don't clear the whole layer
  handleEls.forEach((e) => e.parentNode?.removeChild(e));
  handleEls = [];

  if (el.type === 'TrustBoundary') {
    renderLineHandles(el);
  } else {
    renderBoxHandles(el);
  }
}

function renderLineHandles(el: DiagramElement): void {
  if (!layer) return;
  const { x, y, w } = el;

  // Selection indicator: line highlighting
  const selLine = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
  selLine.setAttribute('x1', String(x));
  selLine.setAttribute('y1', String(y));
  selLine.setAttribute('x2', String(x + w));
  selLine.setAttribute('y2', String(y));
  selLine.classList.add('resize-border-line');
  layer.appendChild(selLine);
  handleEls.push(selLine);

  // 3 handles: left endpoint, midpoint (move only), right endpoint
  const lineHandles: { pos: HandlePos; cx: number; cy: number }[] = [
    { pos: 'w',  cx: x,       cy: y },
    { pos: 'e',  cx: x + w,   cy: y },
    { pos: 'n',  cx: x + w/2, cy: y }, // midpoint — used only for dragging (interaction.ts handles it)
  ];
  for (const handle of lineHandles) {
    const hs = HANDLE_SIZE;
    const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    rect.setAttribute('x', String(handle.cx - hs / 2));
    rect.setAttribute('y', String(handle.cy - hs / 2));
    rect.setAttribute('width', String(hs));
    rect.setAttribute('height', String(hs));
    rect.setAttribute('data-handle', handle.pos);
    rect.classList.add('resize-handle');
    rect.style.cursor = handle.pos === 'n' ? 'move' : 'ew-resize';
    rect.addEventListener('mousedown', (e) => onHandleMouseDown(e, handle.pos, el));
    layer.appendChild(rect);
    handleEls.push(rect);
  }
}

function renderBoxHandles(el: DiagramElement): void {
  if (!layer) return;
  const { x, y, w, h } = el;

  // Selection border
  const border = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
  border.setAttribute('x', String(x));
  border.setAttribute('y', String(y));
  border.setAttribute('width', String(w));
  border.setAttribute('height', String(h));
  border.classList.add('resize-border');
  layer.appendChild(border);
  handleEls.push(border);

  // 8 handles
  const handles: { pos: HandlePos; cx: number; cy: number }[] = [
    { pos: 'nw', cx: x,       cy: y       },
    { pos: 'n',  cx: x + w/2, cy: y       },
    { pos: 'ne', cx: x + w,   cy: y       },
    { pos: 'e',  cx: x + w,   cy: y + h/2 },
    { pos: 'se', cx: x + w,   cy: y + h   },
    { pos: 's',  cx: x + w/2, cy: y + h   },
    { pos: 'sw', cx: x,       cy: y + h   },
    { pos: 'w',  cx: x,       cy: y + h/2 },
  ];

  for (const handle of handles) {
    const hs = HANDLE_SIZE;
    const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    rect.setAttribute('x', String(handle.cx - hs / 2));
    rect.setAttribute('y', String(handle.cy - hs / 2));
    rect.setAttribute('width', String(hs));
    rect.setAttribute('height', String(hs));
    rect.setAttribute('data-handle', handle.pos);
    rect.classList.add('resize-handle');
    rect.style.cursor = CURSOR[handle.pos];
    rect.addEventListener('mousedown', (e) => onHandleMouseDown(e, handle.pos, el));
    layer.appendChild(rect);
    handleEls.push(rect);
  }
}

// ── Mouse handlers ─────────────────────────────────────────

function onHandleMouseDown(e: MouseEvent, handle: HandlePos, el: DiagramElement): void {
  if (!svgEl) return;
  e.stopPropagation();
  e.preventDefault();
  const w = screenToWorld(e.clientX, e.clientY);
  activeDrag = {
    handle,
    startX: w.x,
    startY: w.y,
    origX: el.x,
    origY: el.y,
    origW: el.w,
    origH: el.h,
    elementId: el.id,
    currentX: el.x,
    currentY: el.y,
    currentW: el.w,
    currentH: el.h,
  };
}

function onWindowMouseMove(e: MouseEvent): void {
  if (!activeDrag || !svgEl) return;

  const world = screenToWorld(e.clientX, e.clientY);
  const dx = world.x - activeDrag.startX;
  const dy = world.y - activeDrag.startY;

  const { origX, origY, origW, origH, elementId, handle } = activeDrag;
  let x = origX, y = origY, w = origW, h = origH;

  const el = getElements().find((el) => el.id === elementId);
  const isLine = el?.type === 'TrustBoundary';

  if (isLine) {
    switch (handle) {
      case 'w':
        w = Math.max(MIN_W, origW - dx);
        x = origX + origW - w;
        break;
      case 'e':
        w = Math.max(MIN_W, origW + dx);
        break;
    }
  } else {
    switch (handle) {
      case 'se': w = Math.max(MIN_W, origW + dx); h = Math.max(MIN_H, origH + dy); break;
      case 'e':  w = Math.max(MIN_W, origW + dx); break;
      case 's':  h = Math.max(MIN_H, origH + dy); break;
      case 'ne':
        w = Math.max(MIN_W, origW + dx);
        h = Math.max(MIN_H, origH - dy);
        y = origY + origH - h;
        break;
      case 'n':
        h = Math.max(MIN_H, origH - dy);
        y = origY + origH - h;
        break;
      case 'nw':
        w = Math.max(MIN_W, origW - dx);
        h = Math.max(MIN_H, origH - dy);
        x = origX + origW - w;
        y = origY + origH - h;
        break;
      case 'sw':
        w = Math.max(MIN_W, origW - dx);
        h = Math.max(MIN_H, origH + dy);
        x = origX + origW - w;
        break;
      case 'w':
        w = Math.max(MIN_W, origW - dx);
        x = origX + origW - w;
        break;
    }
  }

  // Update current tracked size for mouseUp commit
  activeDrag.currentX = x;
  activeDrag.currentY = y;
  activeDrag.currentW = w;
  activeDrag.currentH = h;

  // Direct SVG update — no model event, no full re-render
  updateElementShapeDirect(elementId, x, y, w, h);
  if (el) {
    updateConnectionPathsForElement({ ...el, x, y, w, h }, [], getElements());
  }

  // Update handles visually
  if (el) renderHandles({ ...el, x, y, w, h });
}

function onWindowMouseUp(): void {
  if (activeDrag) {
    // Commit final position to model (single update)
    const { elementId, currentX, currentY, currentW, currentH } = activeDrag;
    updateElement(elementId, { x: currentX, y: currentY, w: currentW, h: currentH });
  }
  activeDrag = null;
}
