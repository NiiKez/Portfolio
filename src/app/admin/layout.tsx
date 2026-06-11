import type { ReactNode } from 'react';

import { AdminNav } from '@/components/admin/admin-nav';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== env.ADMIN_EMAIL) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
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
