/**
 * Central state store for Hota.
 * Lightweight typed EventEmitter pattern.
 */

import { generateId } from '../utils/id.js';
import type {
  Model, DiagramElement, Connection, Threat,
  ProjectMetadata, Methodology, ElementType,
  Severity, ThreatStatus, EventMap,
} from '../types.js';

type Listener<T> = (payload: T) => void;
const _listeners = new Map<string, Set<Listener<unknown>>>();

// ── State ──────────────────────────────────────────────────

const state: Model = {

  version: '1.0',
  metadata: {
    name: 'Namnlöst projekt',
    author: '',
    version: '1.0',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    scope: '',
    assumptions: [],
    outOfScope: [],
  },
  methodology: 'STRIDE',
  elements: [],
  connections: [],
  threats: [],
};

// ── Undo / Redo history ────────────────────────────────────

const MAX_HISTORY = 50;
const _history: string[] = [];
const _redoStack: string[] = [];
let _historyPaused = false;

function pushHistory(): void {
  if (_historyPaused) return;
  _redoStack.length = 0;
  _history.push(JSON.stringify(state));
  if (_history.length > MAX_HISTORY) _history.shift();
}

export function undo(): void {
  const snap = _history.pop();
  if (!snap) return;
  _redoStack.push(JSON.stringify(state));
  _historyPaused = true;
  loadModel(JSON.parse(snap) as Partial<Model>);
  _historyPaused = false;
}

export function redo(): void {
  const snap = _redoStack.pop();
  if (!snap) return;
  _history.push(JSON.stringify(state));
  _historyPaused = true;
  loadModel(JSON.parse(snap) as Partial<Model>);
  _historyPaused = false;
}

export function canUndo(): boolean { return _history.length > 0; }
export function canRedo(): boolean { return _redoStack.length > 0; }

// ── Event emitter ──────────────────────────────────────────

export function on<K extends keyof EventMap>(
  event: K,
  fn: Listener<EventMap[K]>,
): () => void {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event)!.add(fn as Listener<unknown>);
  return () => _listeners.get(event)?.delete(fn as Listener<unknown>);
}

export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  _listeners.get(event)?.forEach((fn) => fn(payload));
  if (event !== '*') {
    _listeners.get('*')?.forEach((fn) => fn({ event, payload }));
  }
}

// ── Getters ────────────────────────────────────────────────

export const getState       = (): Model          => state;
export const getElements    = (): DiagramElement[] => state.elements;
export const getConnections = (): Connection[]    => state.connections;
export const getThreats     = (): Threat[]        => state.threats;
export const getMetadata    = (): ProjectMetadata => state.metadata;
export const getMethodology = (): Methodology     => state.methodology;

// ── Metadata ───────────────────────────────────────────────

export function updateMetadata(patch: Partial<ProjectMetadata>): void {
  pushHistory();
  Object.assign(state.metadata, patch);
  emit('metadata:updated', state.metadata);
}

// ── Methodology ────────────────────────────────────────────

export function setMethodology(method: Methodology): void {
  pushHistory();
  state.methodology = method;
  emit('methodology:changed', method);
}

// ── Elements ───────────────────────────────────────────────

interface AddElementOpts {
  type: ElementType;
  x: number;
  y: number;
  label?: string;
}

export function addElement(opts: AddElementOpts): DiagramElement {
  pushHistory();
  const def = elementDefaults(opts.type);
  const metadata: Record<string, unknown> = {};
  // TrustBoundary stores its shape as an array of absolute world-coord points
  if (opts.type === 'TrustBoundary') {
    metadata['points'] = [
      { x: opts.x,          y: opts.y },
      { x: opts.x + def.w,  y: opts.y },
    ];
  }
  const el: DiagramElement = {
    id: generateId('el'),
    type: opts.type,
    x: opts.x,
    y: opts.y,
    w: def.w,
    h: def.h,
    label: opts.label ?? def.label,
    metadata,
  };
  state.elements.push(el);
  emit('element:added', el);
  return el;
}

export function updateElement(id: string, patch: Partial<DiagramElement>): void {
  const el = state.elements.find((e) => e.id === id);
  if (!el) return;
  pushHistory();
  Object.assign(el, patch);
  emit('element:updated', el);
}

export function removeElement(id: string): void {
  const idx = state.elements.findIndex((e) => e.id === id);
  if (idx === -1) return;
  pushHistory();
  const removedGroupId = state.elements[idx]!.groupId;
  state.elements.splice(idx, 1);
  state.connections
    .filter((c) => c.from === id || c.to === id)
    .map((c) => c.id)
    .forEach(_removeConnectionInternal);
  state.threats
    .filter((t) => t.elementId === id)
    .map((t) => t.id)
    .forEach(_removeThreatInternal);
  // Auto-ungroup if only one group member remains
  if (removedGroupId) {
    const remaining = state.elements.filter((e) => e.groupId === removedGroupId);
    if (remaining.length === 1) {
      delete remaining[0]!.groupId;
      emit('element:updated', remaining[0]!);
    }
  }
  emit('element:removed', id);
}

// ── Grouping ───────────────────────────────────────────────

export function groupElements(ids: string[]): string {
  if (ids.length < 2) return '';
  pushHistory();
  const groupId = generateId('grp');
  for (const id of ids) {
    const el = state.elements.find((e) => e.id === id);
    if (el) {
      el.groupId = groupId;
      emit('element:updated', el);
    }
  }
  return groupId;
}

export function ungroupElements(groupId: string): void {
  const members = state.elements.filter((e) => e.groupId === groupId);
  if (!members.length) return;
  pushHistory();
  for (const el of members) {
    delete el.groupId;
    emit('element:updated', el);
  }
}

// ── Z-order ────────────────────────────────────────────────

export function bringToFront(ids: string[]): void {
  if (!ids.length) return;
  pushHistory();
  const toMove = state.elements.filter((e) => ids.includes(e.id));
  const rest = state.elements.filter((e) => !ids.includes(e.id));
  state.elements.splice(0, state.elements.length, ...rest, ...toMove);
  emit('element:reordered', undefined);
}

export function sendToBack(ids: string[]): void {
  if (!ids.length) return;
  pushHistory();
  const toMove = state.elements.filter((e) => ids.includes(e.id));
  const rest = state.elements.filter((e) => !ids.includes(e.id));
  state.elements.splice(0, state.elements.length, ...toMove, ...rest);
  emit('element:reordered', undefined);
}

// ── Connections ────────────────────────────────────────────

interface AddConnectionOpts {
  from: string;
  to: string;
  label?: string;
}

export function addConnection(opts: AddConnectionOpts): Connection {
  pushHistory();
  const conn: Connection = {
    id: generateId('conn'),
    from: opts.from,
    to: opts.to,
    label: opts.label ?? '',
    metadata: {},
  };
  state.connections.push(conn);
  emit('connection:added', conn);
  return conn;
}

export function updateConnection(id: string, patch: Partial<Connection>): void {
  const conn = state.connections.find((c) => c.id === id);
  if (!conn) return;
  pushHistory();
  Object.assign(conn, patch);
  emit('connection:updated', conn);
}

export function removeConnection(id: string): void {
  const idx = state.connections.findIndex((c) => c.id === id);
  if (idx === -1) return;
  pushHistory();
  state.connections.splice(idx, 1);
  state.threats
    .filter((t) => t.elementId === id)
    .map((t) => t.id)
    .forEach(_removeThreatInternal);
  emit('connection:removed', id);
}

// Internal cascade helpers — no pushHistory, used by removeElement/removeConnection
function _removeConnectionInternal(id: string): void {
  const idx = state.connections.findIndex((c) => c.id === id);
  if (idx === -1) return;
  state.connections.splice(idx, 1);
  state.threats
    .filter((t) => t.elementId === id)
    .map((t) => t.id)
    .forEach(_removeThreatInternal);
  emit('connection:removed', id);
}

function _removeThreatInternal(id: string): void {
  const idx = state.threats.findIndex((t) => t.id === id);
  if (idx === -1) return;
  state.threats.splice(idx, 1);
  emit('threat:removed', id);
}

// ── Threats ────────────────────────────────────────────────

type AddThreatOpts = Omit<Threat, 'id'>;

export function addThreat(opts: AddThreatOpts): Threat {
  pushHistory();
  const threat: Threat = {
    id: generateId('thr'),
    elementId: opts.elementId,
    title: opts.title ?? 'Nytt hot',
    description: opts.description ?? '',
    category: opts.category ?? '',
    severity: (opts.severity as Severity) ?? 'Medium',
    mitigation: opts.mitigation ?? '',
    status: (opts.status as ThreatStatus) ?? 'Open',
  };
  state.threats.push(threat);
  emit('threat:added', threat);
  return threat;
}

export function updateThreat(id: string, patch: Partial<Threat>): void {
  const t = state.threats.find((x) => x.id === id);
  if (!t) return;
  pushHistory();
  Object.assign(t, patch);
  emit('threat:updated', t);
}

export function removeThreat(id: string): void {
  const idx = state.threats.findIndex((t) => t.id === id);
  if (idx === -1) return;
  pushHistory();
  state.threats.splice(idx, 1);
  emit('threat:removed', id);
}

// ── Full model load/reset ──────────────────────────────────

export function loadModel(model: Partial<Model>): void {
  if (!_historyPaused) {
    _history.length = 0;
    _redoStack.length = 0;
  }
  state.version = model.version ?? '1.0';
  Object.assign(state.metadata, model.metadata ?? {});
  state.methodology = model.methodology ?? 'STRIDE';
  state.elements = model.elements ?? [];
  state.connections = model.connections ?? [];
  state.threats = model.threats ?? [];
  emit('model:loaded', state);
}

export function resetModel(): void {
  _history.length = 0;
  _redoStack.length = 0;
  state.metadata = {
    name: 'Namnlöst projekt',
    author: '',
    version: '1.0',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    scope: '',
    assumptions: [],
    outOfScope: [],
  };
  state.methodology = 'STRIDE';
  state.elements = [];
  state.connections = [];
  state.threats = [];
  emit('model:loaded', state);
}

export function serializeModel(): Model {
  return JSON.parse(JSON.stringify(state)) as Model;
}

// ── Helpers ────────────────────────────────────────────────

function elementDefaults(type: ElementType): { w: number; h: number; label: string } {
  switch (type) {
    case 'Process':        return { w: 80,  h: 80,  label: 'Process' };
    case 'ExternalEntity': return { w: 100, h: 60,  label: 'Extern aktör' };
    case 'DataStore':      return { w: 120, h: 50,  label: 'Datalager' };
    case 'TrustBoundary':  return { w: 200, h: 4,   label: 'Gräns' };
    case 'TrustZone':      return { w: 200, h: 150, label: 'Förtroendezon' };
  }
}

/** Returns default width/height for an element type. Used for cursor-centered placement. */
export function elementDefaultSize(type: ElementType): { w: number; h: number } {
  const { w, h } = elementDefaults(type);
  return { w, h };
}
