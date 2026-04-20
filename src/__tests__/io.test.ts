import { describe, it, expect } from 'vitest';
import { validateModel, exportJson, importJson } from '../io/json.js';
import { exportYaml, importYaml } from '../io/yaml.js';
import type { Model } from '../types.js';

const valid: Model = {
  version: '1.0',
  metadata: {
    name: 'Test', author: 'X', version: '1.0',
    date: '2026-01-01', description: '', scope: '',
    assumptions: [], outOfScope: [],
  },
  methodology: 'STRIDE',
  elements: [],
  connections: [],
  threats: [],
};

describe('validateModel', () => {
  it('accepts valid model', () => {
    expect(validateModel(valid).valid).toBe(true);
  });

  it('rejects non-object', () => {
    expect(validateModel('string').valid).toBe(false);
  });

  it('rejects missing version', () => {
    const { version: _version, ...noVersion } = valid;
    expect(validateModel(noVersion).valid).toBe(false);
  });

  it('rejects missing elements array', () => {
    expect(validateModel({ ...valid, elements: undefined }).valid).toBe(false);
  });
});

describe('JSON roundtrip', () => {
  it('exports and imports JSON', () => {
    const json   = exportJson(valid);
    const result = importJson(json, json.length);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.model.metadata.name).toBe('Test');
  });

  it('rejects oversized file', () => {
    const json   = exportJson(valid);
    const result = importJson(json, 10 * 1024 * 1024);
    expect(result.ok).toBe(false);
  });
});

describe('YAML roundtrip', () => {
  it('exports and imports YAML', () => {
    const yamlStr = exportYaml(valid);
    const result  = importYaml(yamlStr, yamlStr.length);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.model.methodology).toBe('STRIDE');
  });
});

describe('TrustBoundary metadata.points roundtrip', () => {
  const withBoundary: Model = {
    ...valid,
    elements: [{
      id: 'b1',
      type: 'TrustBoundary',
      x: 10, y: 20, w: 200, h: 4,
      label: 'Gräns',
      metadata: { points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 210, y: 20 }] },
    }],
  };

  it('preserves points across JSON roundtrip', () => {
    const json   = exportJson(withBoundary);
    const result = importJson(json, json.length);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const pts = result.model.elements[0]?.metadata?.points as Array<{ x: number; y: number }>;
      expect(pts).toHaveLength(3);
      expect(pts[0]).toEqual({ x: 10, y: 20 });
      expect(pts[2]).toEqual({ x: 210, y: 20 });
    }
  });

  it('preserves points across YAML roundtrip', () => {
    const yaml   = exportYaml(withBoundary);
    const result = importYaml(yaml, yaml.length);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const pts = result.model.elements[0]?.metadata?.points as Array<{ x: number; y: number }>;
      expect(pts).toHaveLength(3);
      expect(pts[1]).toEqual({ x: 110, y: 20 });
    }
  });
});
