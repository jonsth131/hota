import { describe, it, expect } from 'vitest';
import { generateId } from '../utils/id.js';

describe('generateId', () => {
  it('uses the provided prefix', () => {
    expect(generateId('el').startsWith('el-')).toBe(true);
    expect(generateId('conn').startsWith('conn-')).toBe(true);
  });

  it('defaults to "id" prefix when none given', () => {
    expect(generateId().startsWith('id-')).toBe(true);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = Array.from({ length: 100 }, () => generateId('x'));
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });

  it('produces IDs with three hyphen-separated parts', () => {
    const parts = generateId('test').split('-');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('test');
  });
});
