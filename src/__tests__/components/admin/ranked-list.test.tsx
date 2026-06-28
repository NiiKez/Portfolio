import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  RankedList,
  type RankedListItem,
} from '@/components/admin/ranked-list';

/** Width of a row's proportion-bar fill, e.g. "50%", in DOM order. */
function fillWidths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div[style]')).map(
    (el) => el.style.width,
  );
}

describe('RankedList', () => {
  it('renders at most the first 8 rows', () => {
    const items: RankedListItem[] = Array.from({ length: 12 }, (_, i) => ({
      label: `Item ${i}`,
      views: 12 - i,
    }));

    render(<RankedList items={items} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 7')).toBeInTheDocument();
    expect(screen.queryByText('Item 8')).not.toBeInTheDocument();
  });

  it('shows the label, sub line, and a thousands-formatted view count', () => {
    render(
      <RankedList
        items={[{ label: 'Projects', sub: '/projects', views: 1234 }]}
      />,
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
    const sub = screen.getByText('/projects');
    expect(sub).toBeInTheDocument();
    // A path-like sub renders monospaced.
    expect(sub).toHaveClass('font-mono');
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('does not monospace a non-path sub line', () => {
    render(
      <RankedList items={[{ label: 'Home', sub: 'Landing', views: 3 }]} />,
    );

    expect(screen.getByText('Landing')).not.toHaveClass('font-mono');
  });

  it('renders a favicon img only when iconUrl is provided', () => {
    const { container } = render(
      <RankedList
        items={[
          {
            label: 'github.com',
            views: 5,
            iconUrl: 'https://icons.example/gh.png',
          },
        ]}
      />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://icons.example/gh.png');
    expect(img).toHaveAttribute('width', '16');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders no img when iconUrl is absent', () => {
    const { container } = render(
      <RankedList items={[{ label: 'github.com', views: 5 }]} />,
    );

    expect(container.querySelector('img')).toBeNull();
  });

  it('sizes each proportion bar by views / max (top = 100%, half ≈ 50%)', () => {
    const { container } = render(
      <RankedList
        items={[
          { label: 'Top', views: 100 },
          { label: 'Half', views: 50 },
          { label: 'Tenth', views: 10 },
        ]}
      />,
    );

    expect(fillWidths(container)).toEqual(['100%', '50%', '10%']);
  });

  it('uses the explicit maxViews scale when provided', () => {
    const { container } = render(
      <RankedList items={[{ label: 'Top', views: 50 }]} maxViews={100} />,
    );

    // Scaled against 100, not against its own 50.
    expect(fillWidths(container)).toEqual(['50%']);
  });

  it('renders 0%-wide bars without dividing by zero on an all-zero series', () => {
    const { container } = render(
      <RankedList
        items={[
          { label: 'A', views: 0 },
          { label: 'B', views: 0 },
        ]}
      />,
    );

    expect(fillWidths(container)).toEqual(['0%', '0%']);
  });

  it('opens an external href in a new tab with safe rel', () => {
    render(
      <RankedList
        items={[
          {
            label: 'news.ycombinator.com',
            views: 9,
            href: 'https://news.ycombinator.com',
          },
        ]}
      />,
    );

    const link = screen.getByRole('link', { name: 'news.ycombinator.com' });
    expect(link).toHaveAttribute('href', 'https://news.ycombinator.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders an internal href as a same-tab link', () => {
    render(
      <RankedList
        items={[{ label: 'Projects', views: 9, href: '/projects' }]}
      />,
    );

    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link).toHaveAttribute('href', '/projects');
    expect(link).not.toHaveAttribute('target');
  });

  it('renders a plain label (no link) when href is absent', () => {
    render(<RankedList items={[{ label: 'Plain', views: 1 }]} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Plain')).toBeInTheDocument();
  });
});
