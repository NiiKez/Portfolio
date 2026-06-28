import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Sparkles,
  FolderKanban,
  Briefcase,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

import {
  RankedList,
  type RankedListItem,
} from '@/components/admin/ranked-list';
import { TrafficChart } from '@/components/admin/traffic-chart';
import {
  parsePageViewSummary,
  averagePerDay,
  busiestDay,
  trafficTrend,
  humanizePath,
  faviconUrl,
} from '@/lib/analytics';
import { profile } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: skillCount },
    { count: projectCount, data: projectRows },
    { count: experienceCount },
    { data: analyticsData },
  ] = await Promise.all([
    supabase.from('skills').select('*', { count: 'exact', head: true }),
    // Fetch rows AND count in one round-trip: the count drives the stat card and
    // the rows build the title map that humanizes `/projects/{uuid}` traffic. The
    // authenticated/admin client sees every project (incl. drafts) — correct here.
    supabase.from('projects').select('id, title', { count: 'exact' }),
    supabase.from('experiences').select('*', { count: 'exact', head: true }),
    // Admin-only SECURITY DEFINER RPC; resolves to an error (→ null) until the
    // page-view migration is applied, which the summary parser tolerates.
    supabase.rpc('page_view_summary', { p_days: 30 }),
  ]);

  const skills = skillCount ?? 0;
  const projects = projectCount ?? 0;
  const experiences = experienceCount ?? 0;
  const analytics = parsePageViewSummary(analyticsData);

  const projectTitles = new Map<string, string>(
    (projectRows ?? []).map((p) => [p.id as string, p.title as string]),
  );

  const trend = trafficTrend(analytics.total, analytics.previousTotal);
  const avgPerDay = averagePerDay(analytics);
  const busiest = busiestDay(analytics.daily);

  const pageItems: RankedListItem[] = analytics.topPaths.map((row) => {
    const label = humanizePath(row.label, projectTitles);
    const resolved = label !== row.label;
    return { label, views: row.views, sub: resolved ? row.label : undefined };
  });
  const referrerItems: RankedListItem[] = analytics.topReferrers.map((row) => ({
    label: row.label,
    views: row.views,
    href: `https://${row.label}`,
    iconUrl: faviconUrl(row.label),
  }));

  // Trend badge presentation, keyed off direction (null → no badge).
  const TrendIcon =
    trend === null
      ? null
      : trend.direction === 'up'
        ? TrendingUp
        : trend.direction === 'down'
          ? TrendingDown
          : Minus;
  const trendClass =
    trend === null
      ? ''
      : trend.direction === 'up'
        ? 'bg-emerald-500/10 text-emerald-500'
        : trend.direction === 'down'
          ? 'bg-red-500/10 text-red-500'
          : 'bg-muted-foreground/10 text-muted-foreground';

  const busiestLabel = busiest
    ? `${new Date(`${busiest.date}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })} · ${busiest.views} ${busiest.views === 1 ? 'view' : 'views'}`
    : '—';

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

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <p className="text-[2rem] font-normal tabular-nums leading-none">
            {analytics.total.toLocaleString()}
            <span className="ml-2 align-middle text-sm text-muted-foreground">
              page views
            </span>
          </p>
          {trend && TrendIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm tabular-nums',
                trendClass,
              )}
            >
              <TrendIcon className="size-3.5" />
              {Math.abs(trend.pct)}%
              <span className="text-muted-foreground">
                vs prev {analytics.days || 30}d
              </span>
            </span>
          )}
        </div>

        {analytics.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No page views recorded yet.
          </p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Avg / day</span>
                <span className="font-medium tabular-nums">
                  {avgPerDay.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Busiest day</span>
                <span className="font-medium tabular-nums">{busiestLabel}</span>
              </div>
            </div>

            {analytics.daily.length > 0 && (
              <div className="mb-8">
                <TrafficChart data={analytics.daily} />
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Top pages
                </h4>
                <RankedList items={pageItems} />
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Top referrers
                </h4>
                {referrerItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No external referrers yet.
                  </p>
                ) : (
                  <RankedList items={referrerItems} />
                )}
              </div>
            </div>
          </>
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
