'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';

import { GitHubIcon, LinkedInIcon } from '@/components/icons/social-icons';
import { hasContactEmail, profile } from '@/lib/profile';

export function Footer() {
  const pathname = usePathname();

  // Admin section has its own layout
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <p className="text-muted-foreground" style={{ fontSize: '0.85rem' }}>
          &copy; {new Date().getFullYear()} {profile.name}. All rights reserved.
        </p>

        <nav className="flex items-center gap-5" aria-label="Social links">
          <Link
            href={profile.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="GitHub"
          >
            <GitHubIcon className="h-4 w-4" />
          </Link>
          <Link
            href={profile.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="LinkedIn"
          >
            <LinkedInIcon className="h-4 w-4" />
          </Link>
          {hasContactEmail() && (
            <Link
              href={`mailto:${profile.email}`}
              className="text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
