import { NextResponse, type NextRequest } from 'next/server';

import { isAdminEmail } from '@/lib/admin-email';
import { getClientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';
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
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/admin/login?error=unauthorized`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
