'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Code2,
  LayoutDashboard,
  Sparkles,
  FolderKanban,
  Briefcase,
  Settings,
  LogOut,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/skills', label: 'Skills', icon: Sparkles },
  { href: '/admin/experience', label: 'Experience', icon: Briefcase },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex flex-1 flex-col p-6">
        {/* Brand */}
        <Link href="/" className="mb-10 flex items-center gap-2 text-primary">
          <Code2 className="h-5 w-5" />
          <span
            className="text-base tracking-tight"
            style={{ fontWeight: 600 }}
          >
            Portfolio Admin
          </span>
        </Link>

        {/* Nav list */}
        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {LINKS.map((link) => {
            const isActive =
              link.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout pinned at bottom */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-4 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
          {isSigningOut ? 'Signing out…' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
