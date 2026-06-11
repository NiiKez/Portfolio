import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full min-w-0 rounded-lg border border-input bg-background px-4 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
