/**
 * Rubber-band (marquee) selection rectangle drawn on the SVG canvas.
 * Callers handle element hit-testing; this module only owns the visual rect.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

let marqueeEl: SVGRectElement | null = null;
let marqueeLayer: SVGGElement | null = null;
let startX = 0;
let startY = 0;
let active = false;

export interface MarqueeRect {
  x: number; y: number; w: number; h: number;
}

export function initMarquee(layer: SVGGElement): void {
  marqueeLayer = layer;
}

export function startMarquee(wx: number, wy: number): void {
  if (!marqueeLayer) return;
  startX = wx;
  startY = wy;
  active = true;
  marqueeEl = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
  marqueeEl.classList.add('selection-marquee');
  marqueeEl.setAttribute('x', String(wx));
  marqueeEl.setAttribute('y', String(wy));
  marqueeEl.setAttribute('width', '0');
  marqueeEl.setAttribute('height', '0');
  marqueeLayer.appendChild(marqueeEl);
}

export function updateMarquee(wx: number, wy: number): void {
  if (!marqueeEl) return;
  marqueeEl.setAttribute('x', String(Math.min(startX, wx)));
  marqueeEl.setAttribute('y', String(Math.min(startY, wy)));
  marqueeEl.setAttribute('width', String(Math.abs(wx - startX)));
  marqueeEl.setAttribute('height', String(Math.abs(wy - startY)));
}

/** Returns the rect and clears the visual element. Returns null if marquee wasn't active. */
export function endMarquee(): MarqueeRect | null {
  if (!marqueeEl || !active) return null;
  const rect: MarqueeRect = {
    x: parseFloat(marqueeEl.getAttribute('x') ?? '0'),
    y: parseFloat(marqueeEl.getAttribute('y') ?? '0'),
    w: parseFloat(marqueeEl.getAttribute('width') ?? '0'),
    h: parseFloat(marqueeEl.getAttribute('height') ?? '0'),
  };
  clearMarquee();
  return rect;
}

export function clearMarquee(): void {
  marqueeEl?.parentNode?.removeChild(marqueeEl);
  marqueeEl = null;
  active = false;
}

export function isMarqueeActive(): boolean { return active; }
