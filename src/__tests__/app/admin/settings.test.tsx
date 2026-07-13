import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

// env is server-only; stub just the field the page reads.
const envState = { SITE_PASSWORD: undefined as string | undefined };
vi.mock('@/lib/env', () => ({
  get env() {
    return envState;
  },
}));

// The security card is a client component with its own tests; stub it so the
// page test stays focused on the account/site cards it renders.
vi.mock('@/components/admin/account-security', () => ({
  AccountSecurity: () => <div data-testid="account-security" />,
}));

import SettingsPage from '@/app/admin/(dashboard)/settings/page';

beforeEach(() => {
  vi.clearAllMocks();
  envState.SITE_PASSWORD = undefined;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example.com';
  getUser.mockResolvedValue({
    data: {
      user: {
        email: 'admin@example.com',
        created_at: '2026-01-15T10:00:00Z',
        last_sign_in_at: '2026-06-13T08:30:00Z',
      },
    },
  });
});

async function renderPage() {
  render(await SettingsPage());
}

describe('SettingsPage', () => {
  it('renders the signed-in admin account details', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Administrator')).toBeVisible();
    expect(screen.getByTestId('account-security')).toBeInTheDocument();
    // Dates are formatted, not raw ISO.
    expect(screen.queryByText('2026-01-15T10:00:00Z')).not.toBeInTheDocument();
  });

  it('links to the live site resolved from NEXT_PUBLIC_SITE_URL', async () => {
    await renderPage();

    const link = screen.getByRole('link', {
      name: /portfolio\.example\.com/,
    });
    expect(link).toHaveAttribute('href', 'https://portfolio.example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the private preview gate as Off when SITE_PASSWORD is unset', async () => {
    await renderPage();
    expect(screen.getByText('Off')).toBeVisible();
  });

  it('shows the private preview gate as On when SITE_PASSWORD is set', async () => {
    envState.SITE_PASSWORD = 'hunter2';
    await renderPage();
    expect(screen.getByText('On')).toBeVisible();
  });

  it('falls back to a placeholder when there is no signed-in user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await renderPage();

    const account = screen
      .getByRole('heading', { name: 'Account' })
      .closest('section') as HTMLElement;
    // Email + both dates render as the em-dash placeholder.
    expect(within(account).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
