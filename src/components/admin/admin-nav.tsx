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

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
      <Link href="/" className="flex items-center gap-2 text-primary">
        <Code2 className="h-5 w-5" />
        <span className="text-sm tracking-tight" style={{ fontWeight: 600 }}>
          Admin
        </span>
      </Link>

      <nav className="flex items-center gap-3" aria-label="Admin">
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
              aria-label={link.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label="Sign out"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </nav>
    </header>
  );
}
