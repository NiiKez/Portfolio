import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getClientIp } from '@/lib/client-ip';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { isSameOrigin } from '@/lib/same-origin';
import { serializeError } from '@/lib/serialize-error';
import { getBaseUrl } from '@/lib/site-url';

// Cap the local-part/domain length (RFC 5321 max) so a caller can't mint an
// unbounded rate-limit key or hand an absurd string to the auth provider.
const schema = z.object({ email: z.email().max(254) });

const WINDOW_MS = 15 * 60 * 1000;

// Auth responses must never be cached by an intermediary.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter), ...NO_STORE },
    },
  );
}

export async function POST(request: NextRequest) {
  // Same-origin guard: this endpoint is only ever called by the login form via
  // a same-origin fetch, so reject cross-site POSTs. Without this, any website
  // could trigger magic-link emails to arbitrary addresses (email bombing).
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: NO_STORE },
    );
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
      { status: 400, headers: NO_STORE },
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
    // The admin's only login path. Log the failure (an SMTP outage, a
    // redirect-allowlist mismatch, or a `shouldCreateUser:false` rejection all
    // collapse into one server-side log line) so login breakage is diagnosable.
    // Never log the email address (PII).
    logger.error('send-otp: signInWithOtp failed', {
      err: serializeError(error),
    });
  }

  // Always return the same 200 whether or not the address exists. With
  // `shouldCreateUser:false`, the provider errors for an address with no
  // account — surfacing that as a distinct status would turn this endpoint into
  // a registered-vs-unregistered enumeration oracle (probe-able against any
  // account on the instance, including the admin). The client shows the same
  // "check your inbox" copy regardless; failures are only visible server-side.
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
