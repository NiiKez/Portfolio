import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getClientIp } from '@/lib/client-ip';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { getBaseUrl } from '@/lib/site-url';

const schema = z.object({ email: z.email() });

const WINDOW_MS = 15 * 60 * 1000;

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: NextRequest) {
  // Same-origin guard: this endpoint is only ever called by the login form via
  // a same-origin fetch, so reject cross-site POSTs. Without this, any website
  // could trigger magic-link emails to arbitrary addresses (email bombing).
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getClientIp(request);

  const perIp = rateLimit(`send-otp:${ip}`, 5, WINDOW_MS);
  if (!perIp.allowed) {
    return tooManyRequests(perIp.retryAfter);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid email address.' },
      { status: 400 },
    );
  }

  // Also limit per target address so a spoofed/rotated x-forwarded-for cannot be
  // used to bomb a single inbox — the email is the thing actually being abused.
  const perEmail = rateLimit(
    `send-otp-email:${parsed.data.email.toLowerCase()}`,
    5,
    WINDOW_MS,
  );
  if (!perEmail.allowed) {
    return tooManyRequests(perEmail.retryAfter);
  }

  // Build the magic-link redirect from the canonical site URL (always carries an
  // http/https scheme) rather than `request.url`, whose scheme/host can be
  // mangled behind a proxy. A schemeless redirect makes Supabase hand the
  // callback to the OS as a custom protocol (xdg-open / "No Apps available" on
  // Linux) instead of opening the callback page. This `redirect_to` must also be
  // on the Supabase dashboard's Redirect URLs allowlist, or Supabase falls back
  // to the (possibly misconfigured) Site URL. See supabase/README.md.
  const redirectTo = new URL('/auth/callback', getBaseUrl()).toString();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to send sign-in link.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
