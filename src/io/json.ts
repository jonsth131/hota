import type { Model } from '../types.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const CURRENT_VERSION = '1.0';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateModel(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Ogiltig filstruktur: förväntar ett JSON-objekt' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj['version'] !== 'string') {
    return { valid: false, error: 'Saknar fält: version' };
  }
  if (!Array.isArray(obj['elements'])) {
    return { valid: false, error: 'Saknar fält: elements (ska vara en array)' };
  }
  if (!Array.isArray(obj['connections'])) {
    return { valid: false, error: 'Saknar fält: connections (ska vara en array)' };
  }
  if (!Array.isArray(obj['threats'])) {
    return { valid: false, error: 'Saknar fält: threats (ska vara en array)' };
  }
  return { valid: true };
}

export function exportJson(model: Model): string {
  return JSON.stringify(model, null, 2);
}

export function importJson(raw: string, fileSize: number): { ok: true; model: Model } | { ok: false; error: string } {
  if (fileSize > MAX_FILE_SIZE) {
    return { ok: false, error: `Filen är för stor (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Ogiltig JSON-syntax' };
  }
  const v = validateModel(parsed);
  if (!v.valid) {
    return { ok: false, error: v.error! };
  }
  const model = parsed as Model;
  if (!model.metadata) {
    model.metadata = {
      name: 'Importerat projekt',
      author: '',
      version: CURRENT_VERSION,
      date: new Date().toISOString().slice(0, 10),
      description: '',
      scope: '',
      assumptions: [],
      outOfScope: [],
    };
  }
  return { ok: true, model };
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
