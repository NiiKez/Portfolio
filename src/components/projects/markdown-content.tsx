'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  content: string;
};

// Open links from project descriptions in a new tab so they don't navigate the
// visitor away from the portfolio. rel="noopener noreferrer" guards against
// tabnabbing. Only decorates the anchor react-markdown already emits, so it
// does not reintroduce raw-HTML rendering.
const components: Components = {
  a({ href, title, children }) {
    return (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
