import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const signOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { AccountSecurity } from '@/components/admin/account-security';

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe('AccountSecurity', () => {
  it('signs out the local session and redirects to the login page', async () => {
    const user = userEvent.setup();
    render(<AccountSecurity />);

    await user.click(
      screen.getByRole('button', { name: 'Sign out this device' }),
    );

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Signed out on this device.');
    expect(replace).toHaveBeenCalledWith('/admin/login');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('requires confirmation before signing out of all devices (global scope)', async () => {
    const user = userEvent.setup();
    render(<AccountSecurity />);

    // The trigger only opens the dialog — it must not sign out on its own.
    await user.click(
      screen.getByRole('button', { name: 'Sign out everywhere' }),
    );
    expect(signOut).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Sign out everywhere' }),
    );

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Signed out of all devices.');
    expect(replace).toHaveBeenCalledWith('/admin/login');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error and does not redirect when sign-out fails', async () => {
    signOut.mockResolvedValue({ error: { message: 'network down' } });
    const user = userEvent.setup();
    render(<AccountSecurity />);

    await user.click(
      screen.getByRole('button', { name: 'Sign out this device' }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Could not sign out: network down',
      );
    });
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
