import { describe, it, expect, beforeEach } from 'vitest';
import {
  addElement, removeElement, updateElement, getElements,
  addConnection, removeConnection, getConnections,
  addThreat, removeThreat, updateThreat, getThreats,
  loadModel, resetModel, serializeModel,
  getMetadata, updateMetadata, getMethodology, setMethodology,
  elementDefaultSize,
  undo, redo, canUndo, canRedo,
  groupElements, ungroupElements, bringToFront, sendToBack,
  on,
} from '../store/model.js';

beforeEach(() => resetModel());

describe('Elements', () => {
  it('adds an element', () => {
    addElement({ type: 'Process', x: 10, y: 20 });
    expect(getElements()).toHaveLength(1);
    expect(getElements()[0]?.type).toBe('Process');
  });

  it('removes an element', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    removeElement(el.id);
    expect(getElements()).toHaveLength(0);
  });

  it('updates an element', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    updateElement(el.id, { label: 'Ny label' });
    expect(getElements()[0]?.label).toBe('Ny label');
  });

  it('cascades delete to connections', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    addConnection({ from: a.id, to: b.id });
    removeElement(a.id);
    expect(getConnections()).toHaveLength(0);
  });

  it('cascades delete to threats', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    addThreat({ elementId: el.id, title: 'Hot', category: 'S', severity: 'High', description: '', mitigation: '', status: 'Open' });
    removeElement(el.id);
    expect(getThreats()).toHaveLength(0);
  });
});

describe('Connections', () => {
  it('adds a connection', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    addConnection({ from: a.id, to: b.id });
    expect(getConnections()).toHaveLength(1);
  });

  it('removes a connection', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    const c = addConnection({ from: a.id, to: b.id });
    removeConnection(c.id);
    expect(getConnections()).toHaveLength(0);
  });
});

describe('Threats', () => {
  it('adds a threat', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    addThreat({ elementId: el.id, title: 'Spoofing', category: 'S', severity: 'High', description: '', mitigation: '', status: 'Open' });
    expect(getThreats()).toHaveLength(1);
  });

  it('updates a threat', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    const t  = addThreat({ elementId: el.id, title: 'Org', category: 'S', severity: 'High', description: '', mitigation: '', status: 'Open' });
    updateThreat(t.id, { status: 'Mitigated' });
    expect(getThreats()[0]?.status).toBe('Mitigated');
  });

  it('removes a threat', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    const t  = addThreat({ elementId: el.id, title: 'Org', category: 'S', severity: 'High', description: '', mitigation: '', status: 'Open' });
    removeThreat(t.id);
    expect(getThreats()).toHaveLength(0);
  });
});

describe('Metadata', () => {
  it('updates metadata', () => {
    updateMetadata({ name: 'Mitt projekt', author: 'Alice' });
    expect(getMetadata().name).toBe('Mitt projekt');
    expect(getMetadata().author).toBe('Alice');
  });
});

describe('Methodology', () => {
  it('defaults to STRIDE', () => {
    expect(getMethodology()).toBe('STRIDE');
  });

  it('sets methodology', () => {
    setMethodology('PASTA');
    expect(getMethodology()).toBe('PASTA');
  });
});

describe('Events', () => {
  it('emits element:added', () => {
    const ids: string[] = [];
    on('element:added', (el) => ids.push(el.id));
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    expect(ids).toContain(el.id);
  });

  it('emits element:removed', () => {
    let removed = '';
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    on('element:removed', (id) => { removed = id; });
    removeElement(el.id);
    expect(removed).toBe(el.id);
  });

  it('returns unsubscribe function', () => {
    let count = 0;
    const unsub = on('element:added', () => count++);
    addElement({ type: 'Process', x: 0, y: 0 });
    unsub();
    addElement({ type: 'Process', x: 0, y: 0 });
    expect(count).toBe(1);
  });
});

describe('Serialisation roundtrip', () => {
  it('serialises and loads model', () => {
    const el  = addElement({ type: 'Process', x: 5, y: 10, label: 'Web' });
    const el2 = addElement({ type: 'DataStore', x: 200, y: 10 });
    addConnection({ from: el.id, to: el2.id });
    addThreat({ elementId: el.id, title: 'Spoofing', category: 'S', severity: 'High', description: '', mitigation: '', status: 'Open' });

    const serialised = serializeModel();
    resetModel();
    loadModel(serialised);

    expect(getElements()).toHaveLength(2);
    expect(getConnections()).toHaveLength(1);
    expect(getThreats()).toHaveLength(1);
    expect(getElements()[0]?.label).toBe('Web');
  });

  it('preserves TrustBoundary metadata.points across serialisation', () => {
    addElement({ type: 'TrustBoundary', x: 50, y: 100 });
    const serialised = serializeModel();
    resetModel();
    loadModel(serialised);
    const loaded = getElements()[0];
    expect(loaded?.metadata?.points).toBeDefined();
    expect((loaded?.metadata?.points as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});

describe('TrustZone element', () => {
  it('creates TrustZone with correct defaults', () => {
    const el = addElement({ type: 'TrustZone', x: 0, y: 0 });
    expect(el.type).toBe('TrustZone');
    expect(el.w).toBe(200);
    expect(el.h).toBe(150);
    expect(el.label).toBe('Förtroendezon');
  });
});

describe('TrustBoundary element', () => {
  it('creates TrustBoundary with two initial points', () => {
    const el = addElement({ type: 'TrustBoundary', x: 100, y: 200 });
    expect(el.type).toBe('TrustBoundary');
    const pts = el.metadata?.points as Array<{ x: number; y: number }>;
    expect(pts).toBeDefined();
    expect(pts).toHaveLength(2);
  });

  it('TrustBoundary first point matches element position', () => {
    const el = addElement({ type: 'TrustBoundary', x: 42, y: 77 });
    const pts = el.metadata?.points as Array<{ x: number; y: number }>;
    expect(pts[0]).toEqual({ x: 42, y: 77 });
  });

  it('TrustBoundary second point is to the right of first', () => {
    const el = addElement({ type: 'TrustBoundary', x: 0, y: 0 });
    const pts = el.metadata?.points as Array<{ x: number; y: number }>;
    expect(pts[1]!.x).toBeGreaterThan(pts[0]!.x);
  });
});

describe('elementDefaultSize', () => {
  it('returns correct size for Process', () => {
    expect(elementDefaultSize('Process')).toEqual({ w: 80, h: 80 });
  });

  it('returns correct size for ExternalEntity', () => {
    expect(elementDefaultSize('ExternalEntity')).toEqual({ w: 100, h: 60 });
  });

  it('returns correct size for DataStore', () => {
    expect(elementDefaultSize('DataStore')).toEqual({ w: 120, h: 50 });
  });

  it('returns correct size for TrustBoundary', () => {
    expect(elementDefaultSize('TrustBoundary')).toEqual({ w: 200, h: 4 });
  });

  it('returns correct size for TrustZone', () => {
    expect(elementDefaultSize('TrustZone')).toEqual({ w: 200, h: 150 });
  });
});

describe('Undo / Redo', () => {
  it('canUndo returns false on fresh model', () => {
    expect(canUndo()).toBe(false);
  });

  it('canUndo returns true after a mutation', () => {
    addElement({ type: 'Process', x: 0, y: 0 });
    expect(canUndo()).toBe(true);
  });

  it('undo reverts an addElement', () => {
    addElement({ type: 'Process', x: 0, y: 0 });
    undo();
    expect(getElements()).toHaveLength(0);
  });

  it('redo re-applies after undo', () => {
    addElement({ type: 'Process', x: 0, y: 0 });
    undo();
    expect(canRedo()).toBe(true);
    redo();
    expect(getElements()).toHaveLength(1);
  });

  it('undo reverts a label update', () => {
    const el = addElement({ type: 'Process', x: 0, y: 0 });
    updateElement(el.id, { label: 'Ändrad' });
    undo();
    expect(getElements()[0]?.label).toBe('Process');
  });

  it('loadModel clears history', () => {
    addElement({ type: 'Process', x: 0, y: 0 });
    loadModel({});
    expect(canUndo()).toBe(false);
  });

  it('removeConnection cascades threat deletion and undoes both', () => {
    const a  = addElement({ type: 'Process', x: 0, y: 0 });
    const b  = addElement({ type: 'Process', x: 100, y: 0 });
    const c  = addConnection({ from: a.id, to: b.id });
    addThreat({ elementId: c.id, title: 'T', category: 'I', severity: 'Low', description: '', mitigation: '', status: 'Open' });
    removeConnection(c.id);
    expect(getConnections()).toHaveLength(0);
    expect(getThreats()).toHaveLength(0);
    undo();
    expect(getConnections()).toHaveLength(1);
    expect(getThreats()).toHaveLength(1);
  });
});

describe('Grouping', () => {
  it('groupElements assigns a shared groupId to all members', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    groupElements([a.id, b.id]);
    const els = getElements();
    expect(els[0]?.groupId).toBeDefined();
    expect(els[0]?.groupId).toBe(els[1]?.groupId);
  });

  it('groupElements returns empty string for < 2 ids', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const result = groupElements([a.id]);
    expect(result).toBe('');
    expect(getElements()[0]?.groupId).toBeUndefined();
  });

  it('ungroupElements removes groupId from all members', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    const gid = groupElements([a.id, b.id]);
    ungroupElements(gid);
    getElements().forEach((el) => expect(el.groupId).toBeUndefined());
  });

  it('auto-ungroups when second-to-last member is removed', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    groupElements([a.id, b.id]);
    removeElement(a.id);
    expect(getElements()[0]?.groupId).toBeUndefined();
  });
});

describe('Z-order', () => {
  it('bringToFront moves element to end of array', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    bringToFront([a.id]);
    const ids = getElements().map((e) => e.id);
    expect(ids[ids.length - 1]).toBe(a.id);
  });

  it('sendToBack moves element to start of array', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    const b = addElement({ type: 'Process', x: 100, y: 0 });
    sendToBack([b.id]);
    expect(getElements()[0]?.id).toBe(b.id);
  });

  it('bringToFront is undoable', () => {
    const a = addElement({ type: 'Process', x: 0, y: 0 });
    addElement({ type: 'Process', x: 100, y: 0 });
    bringToFront([a.id]);
    undo();
    expect(getElements()[0]?.id).toBe(a.id);
  });
});
