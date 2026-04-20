/**
 * Tests for localStorage persistence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addElement, resetModel, getElements } from '../store/model.js';
import { initPersistence, loadFromStorage, clearStorage } from '../store/persistence.js';

// ── In-memory storage mock ─────────────────────────────────

function makeStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem:    (k: string) => data[k] ?? null,
    setItem:    (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  };
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  resetModel();
});

describe('clearStorage', () => {
  it('removes the stored key', () => {
    const store = makeStore();
    store.setItem('hota-model', '{}');
    clearStorage(store);
    expect(store.getItem('hota-model')).toBeNull();
  });
});

describe('loadFromStorage', () => {
  it('returns false when storage is empty', () => {
    expect(loadFromStorage(makeStore())).toBe(false);
  });

  it('returns false for corrupt data', () => {
    const store = makeStore();
    store.setItem('hota-model', 'not valid json {{{');
    expect(loadFromStorage(store)).toBe(false);
  });

  it('returns false for empty model (no elements/threats)', () => {
    const store = makeStore();
    store.setItem('hota-model', JSON.stringify({
      version: '1.0',
      metadata: { name: 'X', author: '', version: '1.0', date: '2026-01-01', description: '', scope: '', assumptions: [], outOfScope: [] },
      methodology: 'STRIDE',
      elements: [],
      connections: [],
      threats: [],
    }));
    expect(loadFromStorage(store)).toBe(false);
  });

  it('loads model when elements exist', () => {
    const store = makeStore();
    store.setItem('hota-model', JSON.stringify({
      version: '1.0',
      metadata: { name: 'Saved', author: 'Bob', version: '1.0', date: '2026-01-01', description: '', scope: '', assumptions: [], outOfScope: [] },
      methodology: 'STRIDE',
      elements: [{ id: 'e1', type: 'Process', x: 0, y: 0, w: 80, h: 80, label: 'API' }],
      connections: [],
      threats: [],
    }));
    expect(loadFromStorage(store)).toBe(true);
    expect(getElements()).toHaveLength(1);
    expect(getElements()[0]?.label).toBe('API');
  });
});

describe('initPersistence + auto-save', () => {
  it('saves to storage after model changes (debounced)', () => {
    vi.useFakeTimers();
    const store = makeStore();
    initPersistence(store);
    addElement({ type: 'Process', x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    const saved = store.getItem('hota-model');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.elements).toHaveLength(1);
  });
});

