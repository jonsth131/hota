/**
 * LocalStorage persistence for the active diagram.
 *
 * Auto-saves on every model change (debounced 400 ms).
 * Call `loadFromStorage()` once at startup to restore previous work.
 */
import { on, serializeModel, loadModel } from './model.js';
import { importJson } from '../io/json.js';

const STORAGE_KEY = 'hota-model';
const SAVE_DEBOUNCE_MS = 400;

/** Storage backend — defaults to browser localStorage, overridable for tests. */
let _store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = null;

function getStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (_store) return _store;
  try { return window.localStorage; } catch { return null; }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _skipNextSave = false;

function scheduleSave(): void {
  if (_skipNextSave) { _skipNextSave = false; return; }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      getStore()?.setItem(STORAGE_KEY, JSON.stringify(serializeModel()));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Subscribe to all model events and auto-save on any change.
 * @param storage - Override storage backend (for testing).
 */
export function initPersistence(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
  if (storage) _store = storage;
  _skipNextSave = false;
  on('*', scheduleSave);
}

/**
 * Restore model from localStorage.
 * Returns true if a saved model was found and loaded.
 */
export function loadFromStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): boolean {
  const store = storage ?? getStore();
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return false;
    const result = importJson(raw, raw.length);
    if (result.ok && (
      result.model.elements.length > 0 ||
      result.model.threats.length > 0
    )) {
      // Suppress the save that would be triggered by model:loaded
      _skipNextSave = true;
      loadModel(result.model);
      return true;
    }
  } catch {
    // Corrupt data — start fresh
  }
  return false;
}

/** Remove persisted model from localStorage (used when user clears the canvas). */
export function clearStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  try {
    (storage ?? getStore())?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

