import { describe, it, expect } from 'vitest';
import { severityClass, statusClass } from '../ui/report.js';

describe('severityClass', () => {
  it('maps Critical', () => expect(severityClass('Critical')).toBe('sev-critical'));
  it('maps High',     () => expect(severityClass('High')).toBe('sev-high'));
  it('maps Medium',   () => expect(severityClass('Medium')).toBe('sev-medium'));
  it('maps Low',      () => expect(severityClass('Low')).toBe('sev-low'));
  it('maps Informational', () => expect(severityClass('Informational')).toBe('sev-info'));
  it('returns empty string for unknown severity', () => {
    expect(severityClass('Unknown')).toBe('');
  });
});

describe('statusClass', () => {
  it('lowercases the status', () => {
    expect(statusClass('Open')).toBe('status-open');
  });

  it('replaces spaces with hyphens', () => {
    expect(statusClass('In Progress')).toBe('status-in-progress');
  });

  it('handles already lowercase single-word status', () => {
    expect(statusClass('mitigated')).toBe('status-mitigated');
  });

  it('collapses multiple spaces', () => {
    expect(statusClass('Not  Started')).toBe('status-not-started');
  });
});
