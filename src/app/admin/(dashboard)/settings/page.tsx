import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';

import { AccountSecurity } from '@/components/admin/account-security';
import { env } from '@/lib/env';
import { getInitials } from '@/lib/profile';
import { getBaseUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Settings',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-sans text-base font-medium">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? '—';
  const baseUrl = getBaseUrl();
  const previewGateOn = Boolean(env.SITE_PASSWORD);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-sans text-2xl font-medium tracking-normal">
        Settings
      </h1>
      <p className="mb-10 text-muted-foreground">
        Manage your admin account and review site configuration.
      </p>

      <div className="flex flex-col gap-6">
        <Card title="Account">
          <div className="mb-2 flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-medium text-primary">
              {getInitials(email === '—' ? '' : email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
          <dl>
            <Field label="Email" value={email} />
            <Field
              label="Member since"
              value={formatDateTime(user?.created_at)}
            />
            <Field
              label="Last sign-in"
              value={formatDateTime(user?.last_sign_in_at)}
            />
          </dl>
        </Card>

        <Card title="Security">
          <AccountSecurity />
        </Card>

        <Card
          title="Site"
          description="Read-only configuration for the live deployment."
        >
          <dl>
            <Field
              label="Live URL"
              value={
                <a
                  href={baseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {baseUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink className="size-3.5" />
                </a>
              }
            />
            <Field
              label="Private preview gate"
              value={
                <span
                  className={
                    previewGateOn ? 'text-amber-500' : 'text-muted-foreground'
                  }
                >
                  {previewGateOn ? 'On' : 'Off'}
                </span>
              }
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}
