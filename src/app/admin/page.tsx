import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, FolderKanban, Briefcase, BarChart3 } from 'lucide-react';

import { parsePageViewSummary, type PageViewRow } from '@/lib/analytics';
import { profile } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
};

/** A ranked `label → views` list (top 8) shared by the Traffic card columns. */
function RankedList({ rows, mono }: { rows: PageViewRow[]; mono?: boolean }) {
  return (
    <ul className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <li
          key={row.label}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span
            className={`truncate text-foreground${mono ? ' font-mono' : ''}`}
          >
            {row.label}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {row.views.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: skillCount },
    { count: projectCount },
    { count: experienceCount },
    { data: analyticsData },
  ] = await Promise.all([
    supabase.from('skills').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('experiences').select('*', { count: 'exact', head: true }),
    // Admin-only SECURITY DEFINER RPC; resolves to an error (→ null) until the
    // page-view migration is applied, which the summary parser tolerates.
    supabase.rpc('page_view_summary', { p_days: 30 }),
  ]);

  const skills = skillCount ?? 0;
  const projects = projectCount ?? 0;
  const experiences = experienceCount ?? 0;
  const analytics = parsePageViewSummary(analyticsData);

  const stats = [
    {
      label: 'Projects',
      value: projects,
      icon: FolderKanban,
      href: '/admin/projects',
    },
    {
      label: 'Skills',
      value: skills,
      icon: Sparkles,
      href: '/admin/skills',
    },
    {
      label: 'Experience',
      value: experiences,
      icon: Briefcase,
      href: '/admin/experience',
    },
  ];

  return (
    <div>
      <h1 className="mb-2 font-sans text-2xl font-medium tracking-normal">
        Dashboard
      </h1>
      <p className="mb-10 text-muted-foreground">
        Welcome back, {profile.name}.
      </p>

      <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-muted-foreground/30"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-muted-foreground">{s.label}</span>
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-[2rem] font-normal tabular-nums leading-none">
                {s.value}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mb-12 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-sans text-base">Traffic</h3>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="size-4" />
            Last {analytics.days || 30} days
          </span>
        </div>

        <p className="mb-8 text-[2rem] font-normal tabular-nums leading-none">
          {analytics.total.toLocaleString()}
          <span className="ml-2 align-middle text-sm text-muted-foreground">
            page views
          </span>
        </p>

        {analytics.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No page views recorded yet.
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Top pages
              </h4>
              <RankedList rows={analytics.topPaths} mono />
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Top referrers
              </h4>
              {analytics.topReferrers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No external referrers yet.
                </p>
              ) : (
                <RankedList rows={analytics.topReferrers} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-sans text-base">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/projects"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Manage Projects
          </Link>
          <Link
            href="/admin/skills"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80"
          >
            Manage Skills
          </Link>
          <Link
            href="/admin/experience"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80"
          >
            Manage Experience
          </Link>
          <Link
            href="/"
            target="_blank"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            View Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
