import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

async function signOut(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!origin || !host || new URL(origin).host !== host) {
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
