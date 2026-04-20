/**
 * SVG canvas – pan and zoom.
 */

interface CanvasState {
  panX: number;
  panY: number;
  scale: number;
}

const state: CanvasState = { panX: 0, panY: 0, scale: 1 };
let svg: SVGSVGElement;
let root: SVGGElement;

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

export function initCanvas(svgEl: SVGSVGElement): void {
  svg = svgEl;
  root = svgEl.querySelector<SVGGElement>('#canvas-root')!;
  setupPan();
  setupZoom();
}

export function getTransform(): CanvasState {
  return { ...state };
}

export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: (sx - rect.left - state.panX) / state.scale,
    y: (sy - rect.top  - state.panY) / state.scale,
  };
}

export function setZoom(newScale: number, cx?: number, cy?: number): void {
  const rect = svg.getBoundingClientRect();
  const focusX = cx ?? rect.width  / 2;
  const focusY = cy ?? rect.height / 2;
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  state.panX = focusX - (focusX - state.panX) * (clamped / state.scale);
  state.panY = focusY - (focusY - state.panY) * (clamped / state.scale);
  state.scale = clamped;
  applyTransform();
  window.dispatchEvent(new CustomEvent('zoom:changed', { detail: clamped }));
}

export function resetView(): void {
  state.panX = 0;
  state.panY = 0;
  state.scale = 1;
  applyTransform();
}

// ── Internal ───────────────────────────────────────────────

function applyTransform(): void {
  root.setAttribute(
    'transform',
    `translate(${state.panX},${state.panY}) scale(${state.scale})`,
  );
}

function setupPan(): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originPanX = 0;
  let originPanY = 0;

  svg.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originPanX = state.panX;
      originPanY = state.panY;
      svg.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.panX = originPanX + (e.clientX - startX);
    state.panY = originPanY + (e.clientY - startY);
    applyTransform();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 0) {
      if (dragging) {
        dragging = false;
        svg.style.cursor = '';
      }
    }
  });
}

function setupZoom(): void {
  let rafPending = false;
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (rafPending) return;
    rafPending = true;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svg.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    requestAnimationFrame(() => {
      setZoom(state.scale * delta, cx, cy);
      rafPending = false;
    });
  }, { passive: false });
}
