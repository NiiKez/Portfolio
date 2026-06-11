import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Distinct from setup.ts's process.env default so we can prove this mock is the
// value actually driving publicUrl(), not env leakage. The literal is inlined
// in the factory because vi.mock is hoisted above module-scope consts.
vi.mock('@/lib/env.client', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://mocked-supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

const MOCK_SUPABASE_URL = 'http://mocked-supabase.test';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => {
    const allowed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key === 'fill' || key === 'priority' || key === 'sizes') continue;
      allowed[key] = value;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...allowed} />;
  },
}));

import { ProjectGallery } from '@/components/projects/project-gallery';
import type { ProjectScreenshot } from '@/types';

const makeShot = (
  id: string,
  altText: string | null = null,
): ProjectScreenshot => ({
  id,
  project_id: 'project-1',
  storage_path: `project-1/${id}.png`,
  alt_text: altText,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
});

describe('ProjectGallery', () => {
  it('renders nothing when there are no screenshots', () => {
    const { container } = render(
      <ProjectGallery screenshots={[]} projectTitle="Portfolio" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single screenshot without navigation controls or thumbnails', () => {
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    const image = screen.getByAltText('Dashboard');
    expect(image).toBeInTheDocument();
    // Proves the mocked clientEnv (not process.env leakage) drives publicUrl().
    expect(image.getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/screenshots/project-1/a.png`,
    );
    expect(
      screen.queryByRole('button', { name: /Next screenshot/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Previous screenshot/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Screenshot thumbnails/i),
    ).not.toBeInTheDocument();
  });

  it('falls back to a generated alt text using the project title when alt_text is null', () => {
    render(
      <ProjectGallery screenshots={[makeShot('a')]} projectTitle="Portfolio" />,
    );

    expect(screen.getByAltText('Portfolio screenshot 1')).toBeInTheDocument();
  });

  it('advances to the next screenshot when the Next button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[
          makeShot('a', 'One'),
          makeShot('b', 'Two'),
          makeShot('c', 'Three'),
        ]}
        projectTitle="Portfolio"
      />,
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next screenshot/i }));

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('wraps from the last to the first screenshot when clicking Next on the last slide', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a'), makeShot('b')]}
        projectTitle="Portfolio"
      />,
    );

    const next = screen.getByRole('button', { name: /Next screenshot/i });
    await user.click(next);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    await user.click(next);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('wraps from the first to the last screenshot when clicking Previous on the first slide', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a'), makeShot('b'), makeShot('c')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Previous screenshot/i }),
    );

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('jumps to a screenshot when its thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a'), makeShot('b'), makeShot('c')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View screenshot 3' }));

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    const activeThumb = screen.getByRole('button', {
      name: 'View screenshot 3',
    });
    expect(activeThumb).toHaveAttribute('aria-current', 'true');
  });
});

describe('ProjectGallery — lightbox', () => {
  it('opens a full-screen dialog when the main image is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Close full screen view/i }),
    ).toBeInTheDocument();
  });

  it('closes the lightbox when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the lightbox when the close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /Close full screen view/i }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates between images inside the lightbox', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a'), makeShot('b'), makeShot('c')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Next image' }),
    );
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Previous image' }),
    );
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
  });

  it('moves focus to the close button when the lightbox opens', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );

    expect(
      screen.getByRole('button', { name: /Close full screen view/i }),
    ).toHaveFocus();
  });

  it('restores focus to the trigger when the lightbox closes', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a', 'Dashboard')]}
        projectTitle="Portfolio"
      />,
    );

    const trigger = screen.getByRole('button', {
      name: /View image full screen/i,
    });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('traps Tab focus within the lightbox, wrapping at both ends', async () => {
    const user = userEvent.setup();
    render(
      <ProjectGallery
        screenshots={[makeShot('a'), makeShot('b'), makeShot('c')]}
        projectTitle="Portfolio"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /View image full screen/i }),
    );

    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', {
      name: /Close full screen view/i,
    });
    const next = within(dialog).getByRole('button', { name: 'Next image' });

    // Focus starts on the close button (first focusable). Shift+Tab from the
    // first element wraps to the last focusable (the Next button).
    expect(close).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(next).toHaveFocus();

    // Tab from the last focusable wraps back to the first (the close button).
    await user.keyboard('{Tab}');
    expect(close).toHaveFocus();
  });
});
