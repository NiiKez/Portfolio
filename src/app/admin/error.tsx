'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Client boundary — cannot use the server-only winston logger. Log to the
    // console only in development so full error detail is not surfaced in an
    // end-user's console in production (mirrors the root error boundary).
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-destructive">
          Admin panel error
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
          {error.digest ? ` (ref: ${error.digest})` : null}
        </p>
      </div>
      <Button variant="outline" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
