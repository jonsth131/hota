/**
 * Tests for pure math helpers in diagram/connections.ts.
 * These functions have no DOM dependency and can be tested directly.
 */
import { describe, it, expect } from 'vitest';
import { bezierD, controlPoint, midpoint } from '../diagram/connections.js';
import type { Point } from '../types.js';

// ── controlPoint ───────────────────────────────────────────

describe('controlPoint', () => {
  const p: Point = { x: 100, y: 100 };
  const offset = 60;

  it('offsets upward for top side', () => {
    expect(controlPoint(p, 'top', offset)).toEqual({ x: 100, y: 40 });
  });

  it('offsets right for right side', () => {
    expect(controlPoint(p, 'right', offset)).toEqual({ x: 160, y: 100 });
  });

  it('offsets downward for bottom side', () => {
    expect(controlPoint(p, 'bottom', offset)).toEqual({ x: 100, y: 160 });
  });

  it('offsets left for left side', () => {
    expect(controlPoint(p, 'left', offset)).toEqual({ x: 40, y: 100 });
  });
});

// ── midpoint ───────────────────────────────────────────────

describe('midpoint', () => {
  it('calculates midpoint between two points', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 100, y: 100 })).toEqual({ x: 50, y: 50 });
  });

  it('handles non-integer midpoints', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('returns the same point when both inputs are equal', () => {
    expect(midpoint({ x: 42, y: 7 }, { x: 42, y: 7 })).toEqual({ x: 42, y: 7 });
  });
});

// ── bezierD ────────────────────────────────────────────────

describe('bezierD', () => {
  const p1: Point = { x: 0, y: 50 };
  const p2: Point = { x: 200, y: 50 };

  it('produces a valid SVG cubic bezier path string', () => {
    const d = bezierD(p1, 'right', p2, 'left');
    expect(d).toMatch(/^M[\d.,]+ C[\d., ]+ [\d.,]+,[\d.,]+$/);
  });

  it('starts at p1 and ends at p2', () => {
    const d = bezierD(p1, 'right', p2, 'left');
    expect(d.startsWith('M0,50')).toBe(true);
    expect(d.endsWith('200,50')).toBe(true);
  });

  it('uses correct control points for right→left connection', () => {
    // right offset from p1=(0,50): c1=(60,50); left offset from p2=(200,50): c2=(140,50)
    const d = bezierD(p1, 'right', p2, 'left');
    expect(d).toBe('M0,50 C60,50 140,50 200,50');
  });

  it('uses correct control points for top→bottom connection', () => {
    const a: Point = { x: 100, y: 0 };
    const b: Point = { x: 100, y: 200 };
    const d = bezierD(a, 'top', b, 'bottom');
    // top offsets upward: c1=(100,-60); bottom offsets down: c2=(100,260)
    expect(d).toBe('M100,0 C100,-60 100,260 100,200');
  });
});
