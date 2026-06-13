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

  it('preserves intraword underscores in identifiers (not emphasis)', () => {
    expect(markdownToPlainText('Use snake_case_names and MAX_SIZE here.')).toBe(
      'Use snake_case_names and MAX_SIZE here.',
    );
  });

  it('strips _emphasis_ that is flanked by non-word characters', () => {
    expect(markdownToPlainText('A truly _bold_ claim.')).toBe(
      'A truly bold claim.',
    );
  });

  it('keeps a literal > used mid-sentence (only strips blockquote markers)', () => {
    expect(markdownToPlainText('5 > 3 holds.')).toBe('5 > 3 holds.');
  });

  it('does not leak a trailing ) from a link URL that contains parens', () => {
    expect(
      markdownToPlainText(
        'See [Wikipedia](https://en.wikipedia.org/wiki/Foo_(bar)) now.',
      ),
    ).toBe('See Wikipedia now.');
  });

  it('collapses runs of whitespace and trims the result', () => {
    expect(markdownToPlainText('  hello   \n\n   world  ')).toBe('hello world');
  });

  it('returns an empty string for empty input', () => {
    expect(markdownToPlainText('')).toBe('');
  });

  it('strips <script> tags and their contents, keeping surrounding text', () => {
    const text = markdownToPlainText('<script>alert(1)</script> hello');

    // The <script>…</script> block is removed entirely (tags + contents).
    expect(text).toBe('hello');
    expect(text).not.toContain('<script');
    expect(text).not.toContain('</script');
    expect(text).not.toContain('alert(1)');
    // No raw angle brackets survive.
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  it('strips an <img onerror=…> tag, keeping the caption text', () => {
    const text = markdownToPlainText('<img src=x onerror=alert(1)> caption');

    expect(text).toBe('caption');
    expect(text).not.toContain('onerror');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  it('strips paired HTML tags but keeps their inner text', () => {
    expect(markdownToPlainText('<b>bold</b> text')).toBe('bold text');
  });
});
