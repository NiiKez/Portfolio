'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Code2, Menu, X } from 'lucide-react';

import { profile } from '@/lib/profile';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
] as const;

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin section has its own navigation
  if (pathname.startsWith('/admin')) return null;

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 text-primary transition-opacity hover:opacity-80"
          aria-label="Home"
        >
          <Code2 className="h-5 w-5" />
          <span className="tracking-tight" style={{ fontWeight: 600 }}>
            {profile.name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontSize: '0.9rem' }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile: hamburger */}
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav
          className="flex flex-col gap-4 border-t border-border bg-background/95 px-6 py-4 backdrop-blur-md md:hidden"
          aria-label="Mobile"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
