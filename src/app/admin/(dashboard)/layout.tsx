import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { isAdminEmail } from '@/lib/admin-email';
import { createClient } from '@/lib/supabase/server';

/**
 * Gate for every authenticated admin page. `/admin/login` deliberately lives
 * OUTSIDE this `(dashboard)` route group, so this layout can hard-redirect any
 * non-admin without looping the login page through its own gate.
 *
 * This is a second, render-time enforcement point that does NOT depend on the
 * middleware: a server-validated `getUser()` runs here on every admin page, so
 * even if the middleware were ever bypassed (a matcher gap, a framework-level
 * middleware bug), the pages themselves still fail closed. RLS remains the real
 * data-access enforcement; this keeps the admin UI from rendering at all.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect('/admin/login');
  }

  return (
    <div className="dark flex min-h-dvh bg-background text-foreground">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <AdminNav />
        <main className="flex-1 overflow-auto p-6 md:p-10">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
