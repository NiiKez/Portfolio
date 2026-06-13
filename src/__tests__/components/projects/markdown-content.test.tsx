import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from '@/components/projects/markdown-content';

describe('MarkdownContent', () => {
  it('does not turn raw HTML into live elements (no rehype-raw → no stored XSS)', () => {
    // The whole point of this component NOT enabling rehype-raw: raw HTML in the
    // stored markdown must never become live DOM. These are the classic stored-
    // XSS payloads — a <script>, an <img onerror> (fires even with no src), and
    // an arbitrary attributed element. If someone added rehype-raw, each of
    // these `querySelector` checks would start finding a live node and fail.
    const content = [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(1)">',
      '<div data-evil onclick="alert(1)">raw</div>',
    ].join('\n\n');
    const { container } = render(<MarkdownContent content={content} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('div[data-evil]')).toBeNull();
    // No inline event handler leaked onto any rendered node.
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });

  it('neutralizes dangerous link schemes while keeping real markdown', () => {
    // react-markdown@10's default urlTransform strips javascript:/data: hrefs.
    // Separate blocks so the leading content isn't parsed as one HTML block,
    // which would leave the trailing `**bold**` unparsed.
    const content = [
      '[a](javascript:alert(1))',
      '[b](data:text/html,<script>alert(1)</script>)',
      '[ok](https://example.com)',
      '**bold**',
    ].join('\n\n');
    const { container } = render(<MarkdownContent content={content} />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href') ?? '').not.toMatch(
        /^(javascript|data):/i,
      );
    }
    // The safe https link survives untouched.
    expect(
      container.querySelector('a[href="https://example.com"]'),
    ).not.toBeNull();

    // markdown itself still renders: **bold** becomes a <strong>.
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });
});
