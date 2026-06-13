import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

const setThemeMock = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: setThemeMock }),
}));

import { Header } from '@/components/header';

afterEach(() => {
  pathnameMock.mockReturnValue('/');
  setThemeMock.mockClear();
});

describe('Header', () => {
  it('renders the primary navigation links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
  });

  it('renders the theme toggle (regression: it was previously never mounted)', () => {
    render(<Header />);

    expect(
      screen.getByRole('button', { name: /switch to/i }),
    ).toBeInTheDocument();
  });

  it('cycles the theme when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /switch to/i }));

    // theme='dark' → next in the cycle is 'system'.
    expect(setThemeMock).toHaveBeenCalledWith('system');
  });

  it('renders nothing on admin routes (admin has its own nav)', () => {
    pathnameMock.mockReturnValue('/admin/projects');

    const { container } = render(<Header />);

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole('button', { name: /switch to/i }),
    ).not.toBeInTheDocument();
  });
});
