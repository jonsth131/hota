import yaml from 'js-yaml';
import type { Model } from '../types.js';
import { validateModel, triggerDownload, MAX_FILE_SIZE } from './json.js';

export function exportYaml(model: Model): string {
  return yaml.dump(model, { lineWidth: 120 });
}

export function importYaml(raw: string, fileSize: number): { ok: true; model: Model } | { ok: false; error: string } {
  if (fileSize > MAX_FILE_SIZE) {
    return { ok: false, error: `Filen är för stor (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch {
    return { ok: false, error: 'Ogiltig YAML-syntax' };
  }
  const v = validateModel(parsed);
  if (!v.valid) return { ok: false, error: v.error! };
  return { ok: true, model: parsed as Model };
}

export function triggerYamlDownload(model: Model, filename = 'hotmodell.yaml'): void {
  triggerDownload(exportYaml(model), filename, 'application/x-yaml');
}

export function triggerJsonDownload(model: Model, filename = 'hotmodell.json'): void {
  triggerDownload(JSON.stringify(model, null, 2), filename, 'application/json');
}
