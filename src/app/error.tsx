'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Next.js strips server error details to a `digest` in production; only log
    // the full error (incl. client-side render errors) in development so it is
    // not surfaced in end users' consoles.
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while rendering this page.
        {error.digest ? ` Reference: ${error.digest}` : null}
      </p>
      <Button onClick={() => unstable_retry()}>Try again</Button>
    </div>
  );
}
