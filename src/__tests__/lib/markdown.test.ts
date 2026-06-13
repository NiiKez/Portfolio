import { describe, expect, it } from 'vitest';

import { markdownToPlainText } from '@/lib/markdown';

describe('markdownToPlainText', () => {
  it('strips headings, emphasis, links, code and list markers into one plain line', () => {
    const md = [
      '# Project Heading',
      '',
      'A **bold** _intro_ with a [link](https://example.com) and `inline code`.',
      '',
      '```ts',
      'const secret = "should not appear";',
      '```',
      '',
      '- first bullet',
      '- second bullet',
      '',
      '1. numbered item',
      '> a quote',
    ].join('\n');

    const text = markdownToPlainText(md);

    expect(text).toContain('Project Heading');
    expect(text).toContain('A bold intro with a link and inline code.');
    expect(text).toContain('first bullet');
    expect(text).toContain('numbered item');
    expect(text).toContain('a quote');
    // Fenced code block contents are dropped entirely.
    expect(text).not.toContain('should not appear');
    // No raw markdown punctuation survives.
    expect(text).not.toMatch(/[#*`>]/);
    expect(text).not.toContain('](');
  });

  it('keeps image alt text out and drops the image entirely', () => {
    expect(markdownToPlainText('![alt text](/img.png) caption')).toBe(
      'caption',
    );
  });

  it('collapses runs of whitespace and trims the result', () => {
    expect(markdownToPlainText('  hello   \n\n   world  ')).toBe('hello world');
  });

  it('returns an empty string for empty input', () => {
    expect(markdownToPlainText('')).toBe('');
  });
});
