import { describe, it, expect } from 'vitest';
import { esc } from '../utils/sanitize.js';

describe('esc', () => {
  it('escapes ampersand', () => {
    expect(esc('a&b')).toBe('a&amp;b');
  });

  it('escapes less-than', () => {
    expect(esc('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes greater-than', () => {
    expect(esc('3 > 2')).toBe('3 &gt; 2');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#x27;s');
  });

  it('leaves safe strings unchanged', () => {
    expect(esc('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('neutralises XSS script injection', () => {
    const payload = '<script>alert("xss")</script>';
    const out = esc(payload);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('"');
  });

  it('neutralises img onerror pattern', () => {
    const payload = '<img src=x onerror=\'alert(1)\'>';
    const out = esc(payload);
    expect(out).not.toContain('<');
    expect(out).not.toContain("'");
  });

  it('escapes all special chars in one string', () => {
    expect(esc('<a href="/" class=\'x\'>A&B</a>')).toBe(
      '&lt;a href=&quot;/&quot; class=&#x27;x&#x27;&gt;A&amp;B&lt;/a&gt;',
    );
  });
});
