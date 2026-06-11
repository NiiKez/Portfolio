'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EyeIcon, PencilIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type Mode = 'write' | 'preview';

type MarkdownEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
  'aria-invalid'?: boolean;
};

export function MarkdownEditor({
  id,
  value,
  onChange,
  disabled,
  maxLength,
  placeholder = 'Write your description…',
  rows = 12,
  'aria-invalid': ariaInvalid,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('write');

  return (
    <div
      className="rounded-lg border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
      aria-invalid={ariaInvalid}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => setMode('write')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
            mode === 'write'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PencilIcon className="size-3" />
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
            mode === 'preview'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <EyeIcon className="size-3" />
          Preview
        </button>

        {maxLength && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {value.length} / {maxLength}
          </span>
        )}
      </div>

      {/* Editor / Preview */}
      {mode === 'write' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={rows}
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none disabled:pointer-events-none disabled:opacity-50"
        />
      ) : (
        <div
          className={cn(
            'min-h-[var(--preview-min-h)] px-3 py-2 text-sm leading-relaxed text-foreground',
            'prose prose-sm prose-neutral dark:prose-invert max-w-none',
            '[--preview-min-h:theme(spacing.40)]',
          )}
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value.trim() === '' ? (
            <p className="text-muted-foreground italic">Nothing to preview.</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}
