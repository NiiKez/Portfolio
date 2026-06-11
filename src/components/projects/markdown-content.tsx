'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  content: string;
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}
