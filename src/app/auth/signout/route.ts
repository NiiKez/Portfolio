import { NextResponse, type NextRequest } from 'next/server';

import { isSameOrigin } from '@/lib/same-origin';
import { createClient } from '@/lib/supabase/server';

async function signOut(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const POST = signOut;
