import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyEmailButton } from '@/components/about/copy-email-button';

const EMAIL = 'hello@example.com';

// jsdom implements neither `navigator.clipboard` nor `document.execCommand`, so
// each test installs controllable stubs. `configurable: true` lets afterEach
// tear them back down to undefined for isolation.
function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

function setExecCommand(impl?: () => boolean) {
  Object.defineProperty(document, 'execCommand', {
    value: impl ?? vi.fn(() => true),
    configurable: true,
    writable: true,
  });
}

describe('CopyEmailButton', () => {
  beforeEach(() => {
    setExecCommand(vi.fn(() => true));
  });

  afterEach(() => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('copies via the async Clipboard API and shows the copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    render(<CopyEmailButton email={EMAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));

    expect(
      await screen.findByRole('button', { name: 'Email copied' }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    // The async API succeeded, so the legacy fallback must not run.
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when the Clipboard API rejects, still reporting success', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    setClipboard(writeText);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    render(<CopyEmailButton email={EMAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));

    expect(
      await screen.findByRole('button', { name: 'Email copied' }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses the fallback when the Clipboard API is unavailable (insecure context)', async () => {
    setClipboard(undefined);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    render(<CopyEmailButton email={EMAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));

    expect(
      await screen.findByRole('button', { name: 'Email copied' }),
    ).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('shows an error state without an unhandled rejection when every copy path fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    setClipboard(writeText);
    setExecCommand(vi.fn(() => false));

    render(<CopyEmailButton email={EMAIL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));

    // Feedback is surfaced (the address stays visible in the card for manual
    // selection) rather than the click silently doing nothing.
    expect(
      await screen.findByRole('button', { name: /copy failed/i }),
    ).toBeInTheDocument();
  });
});
