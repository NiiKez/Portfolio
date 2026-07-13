import { NextResponse, type NextRequest } from 'next/server';

import { isAdminEmail } from '@/lib/admin-email';
import { getClientIp } from '@/lib/client-ip';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { serializeError } from '@/lib/serialize-error';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  const ip = getClientIp(request);
  const { allowed } = rateLimit(`auth-callback:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.redirect(`${origin}/admin/login?error=rate_limited`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Login is a recurring pain point; log the exchange failure (expired code
    // vs. Supabase outage vs. allowlist mismatch) so it is diagnosable.
    logger.warn('auth.callback: code exchange failed', {
      err: serializeError(error),
    });
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    // A valid magic-link resolved to a non-admin identity — a misdirected link
    // or an intrusion attempt. Log the pseudonymous id only, never the email.
    logger.warn('auth.callback: non-admin rejected', {
      userId: user?.id ?? null,
    });
    // Local scope: revoke only the session this exchange just minted. A global
    // sign-out would revoke every refresh token for that identity across the
    // whole Supabase instance — an unrelated cross-app logout. Never let a
    // failed sign-out swallow the rejection: fail closed to the redirect.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      logger.warn('auth.callback: non-admin sign-out failed', {
        err: serializeError(error),
      });
    }
    return NextResponse.redirect(`${origin}/admin/login?error=unauthorized`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
