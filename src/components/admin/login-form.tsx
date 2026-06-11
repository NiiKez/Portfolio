'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const RESEND_COOLDOWN_SECONDS = 60;

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Sign-in link is invalid or expired. Request a new one.',
  rate_limited: 'Too many attempts. Please wait before trying again.',
  unauthorized: 'Access denied.',
};

type LoginFormProps = {
  initialError?: string;
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? 'Sign-in failed.') : null,
  );
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    if (cooldown > 0) return;

    setStatus('sending');
    setError(null);

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus('error');
      setError(
        (data as { error?: string }).error ??
          'Sign-in failed. Please try again.',
      );
      return;
    }

    setStatus('sent');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  const disabled = status === 'sending' || cooldown > 0;

  return (
    <div className="w-full max-w-sm">
      {/* Centered icon + heading */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-accent">
          <Lock className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to receive a magic link.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending'}
            className="bg-card text-left"
            placeholder="you@example.com"
          />
        </div>

        <Button type="submit" disabled={disabled} className="h-11 w-full">
          {status === 'sending'
            ? 'Signing in…'
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : status === 'sent'
                ? 'Resend link'
                : 'Send magic link'}
        </Button>
      </form>

      {status === 'sent' && !error && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Check your inbox for a sign-in link.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 text-center text-sm text-destructive"
          data-testid="login-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
