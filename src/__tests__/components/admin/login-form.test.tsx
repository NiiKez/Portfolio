import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/admin/login-form';

// The component calls `fetch('/api/auth/send-otp')` directly. We stub global
// fetch per-test so we can drive the success / !res.ok / thrown-fetch branches
// without hitting the MSW network tripwire.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse() {
  return { ok: true, json: async () => ({}) } as unknown as Response;
}

function errorResponse(body: Record<string, unknown>, status = 400) {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

async function submit(email = 'admin@example.com') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send magic link' }));
  return user;
}

describe('LoginForm', () => {
  it('posts the email and shows the inbox prompt on success', async () => {
    fetchMock.mockResolvedValue(okResponse());
    render(<LoginForm />);

    await submit('me@example.com');

    await waitFor(() => {
      expect(
        screen.getByText('Check your inbox for a sign-in link.'),
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/send-otp',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'me@example.com' }),
      }),
    );
    // On success the button flips to a cooldown "Resend in …" state.
    expect(
      screen.getByRole('button', { name: /Resend in \d+s/ }),
    ).toBeDisabled();
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });

  it('surfaces the server error message and re-enables the button on !res.ok', async () => {
    fetchMock.mockResolvedValue(errorResponse({ error: 'Too many attempts.' }));
    render(<LoginForm />);

    await submit();

    const alert = await screen.findByTestId('login-error');
    expect(alert).toHaveTextContent('Too many attempts.');
    // Not on cooldown after a failure, so the user can retry immediately.
    const button = screen.getByRole('button', { name: 'Send magic link' });
    expect(button).toBeEnabled();
  });

  it('falls back to a generic message when the error body has no message', async () => {
    fetchMock.mockResolvedValue(errorResponse({}));
    render(<LoginForm />);

    await submit();

    const alert = await screen.findByTestId('login-error');
    expect(alert).toHaveTextContent('Sign-in failed. Please try again.');
  });

  // Regression test for the H1 fix: a thrown fetch (offline / DNS / server
  // unreachable) must NOT leave the button stuck on "Signing in…".
  it('recovers and re-enables the button when fetch itself throws', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LoginForm />);

    await submit();

    const alert = await screen.findByTestId('login-error');
    expect(alert).toHaveTextContent(
      'Could not reach the server. Check your connection and try again.',
    );

    // The button must be back to its actionable state, not stuck disabled.
    const button = screen.getByRole('button', { name: 'Send magic link' });
    expect(button).toBeEnabled();
    expect(screen.getByLabelText('Email')).toBeEnabled();

    // And a retry is possible: a subsequent success works.
    fetchMock.mockResolvedValue(okResponse());
    await userEvent.setup().click(button);
    await waitFor(() => {
      expect(
        screen.getByText('Check your inbox for a sign-in link.'),
      ).toBeInTheDocument();
    });
  });

  it('renders an initial error passed from the server redirect', () => {
    render(<LoginForm initialError="auth_failed" />);
    expect(screen.getByTestId('login-error')).toHaveTextContent(
      'Sign-in link is invalid or expired. Request a new one.',
    );
  });
});
