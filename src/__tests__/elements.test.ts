/**
 * Tests for pure logic helpers in diagram/elements.ts and diagram/connections (math only).
 * These tests cover coordinate math that doesn't require a DOM.
 */
import { describe, it, expect } from 'vitest';
import { toPolylineStr, getAnchorPoint, nearestPort } from '../diagram/elements.js';
import type { DiagramElement } from '../types.js';

// ── toPolylineStr ──────────────────────────────────────────

describe('toPolylineStr', () => {
  it('converts a single point', () => {
    expect(toPolylineStr([{ x: 10, y: 20 }])).toBe('10,20');
  });

  it('converts multiple points with spaces', () => {
    expect(toPolylineStr([{ x: 0, y: 0 }, { x: 100, y: 50 }])).toBe('0,0 100,50');
  });

  it('handles decimal coordinates', () => {
    expect(toPolylineStr([{ x: 1.5, y: 2.5 }])).toBe('1.5,2.5');
  });

  it('returns empty string for empty array', () => {
    expect(toPolylineStr([])).toBe('');
  });
});

// ── getAnchorPoint ─────────────────────────────────────────

const makeEl = (overrides: Partial<DiagramElement> = {}): DiagramElement => ({
  id: 'el-test',
  type: 'Process',
  label: 'Test',
  x: 100,
  y: 200,
  w: 80,
  h: 60,
  metadata: {},
  ...overrides,
});

describe('getAnchorPoint', () => {
  it('returns top-center anchor', () => {
    const el = makeEl();
    const pt = getAnchorPoint(el, 'top');
    expect(pt).toEqual({ x: 140, y: 200 }); // cx=100+40, y=200
  });

  it('returns bottom-center anchor', () => {
    const el = makeEl();
    const pt = getAnchorPoint(el, 'bottom');
    expect(pt).toEqual({ x: 140, y: 260 }); // cx=100+40, y=200+60
  });

  it('returns left-center anchor', () => {
    const el = makeEl();
    const pt = getAnchorPoint(el, 'left');
    expect(pt).toEqual({ x: 100, y: 230 }); // x=100, cy=200+30
  });

  it('returns right-center anchor', () => {
    const el = makeEl();
    const pt = getAnchorPoint(el, 'right');
    expect(pt).toEqual({ x: 180, y: 230 }); // x=100+80, cy=200+30
  });

  it('works for ExternalEntity and DataStore', () => {
    for (const type of ['ExternalEntity', 'DataStore'] as const) {
      const el = makeEl({ type });
      expect(getAnchorPoint(el, 'top').y).toBe(el.y);
      expect(getAnchorPoint(el, 'bottom').y).toBe(el.y + el.h);
    }
  });

  it('returns TrustBoundary first point for left side', () => {
    const el = makeEl({
      type: 'TrustBoundary',
      metadata: { points: [{ x: 50, y: 75 }, { x: 150, y: 75 }] },
    });
    const pt = getAnchorPoint(el, 'left');
    expect(pt).toEqual({ x: 50, y: 75 });
  });

  it('returns TrustBoundary last point for right side', () => {
    const el = makeEl({
      type: 'TrustBoundary',
      metadata: { points: [{ x: 50, y: 75 }, { x: 150, y: 75 }] },
    });
    const pt = getAnchorPoint(el, 'right');
    expect(pt).toEqual({ x: 150, y: 75 });
  });
});

// ── nearestPort ────────────────────────────────────────────

describe('nearestPort', () => {
  const el = makeEl({ x: 100, y: 200, w: 80, h: 60 });
  // Anchors: top=(140,200), right=(180,230), bottom=(140,260), left=(100,230)

  it('selects top when querying from directly above', () => {
    expect(nearestPort(el, 140, 100)).toBe('top');
  });

  it('selects bottom when querying from directly below', () => {
    expect(nearestPort(el, 140, 350)).toBe('bottom');
  });

  it('selects left when querying from far left', () => {
    expect(nearestPort(el, 0, 230)).toBe('left');
  });

  it('selects right when querying from far right', () => {
    expect(nearestPort(el, 300, 230)).toBe('right');
  });

  it('returns a valid PortSide for any input', () => {
    const valid = new Set(['top', 'right', 'bottom', 'left']);
    expect(valid.has(nearestPort(el, 50, 50))).toBe(true);
    expect(valid.has(nearestPort(el, 500, 500))).toBe(true);
  });
});
