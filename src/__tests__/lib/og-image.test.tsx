import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// `next/og`'s ImageResponse renders the card to a real PNG via Satori, which
// needs fonts and is heavy/non-deterministic — and the global MSW setup
// (`onUnhandledRequest: 'error'`) would error on any font/network fetch. So we
// replace ImageResponse with a spy that simply records the React element and
// options it was constructed with, without rendering anything. The spy is
// created inside the factory because vi.mock is hoisted above module-scope
// consts; we read it back via the mocked import below.
vi.mock('next/og', () => ({
  // `createOgImage` calls `new ImageResponse(...)`, so the mock must be
  // constructable — a `function` (not an arrow) used with `mockImplementation`
  // records element + options on the instance it builds.
  ImageResponse: vi.fn().mockImplementation(function (
    this: { element: unknown; options: unknown },
    element: unknown,
    options: unknown,
  ) {
    this.element = element;
    this.options = options;
  }),
}));

// Import the module under test AFTER the mock is registered so it picks up the
// spy rather than the real ImageResponse.
import { ImageResponse } from 'next/og';

import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  createOgImage,
} from '@/lib/og-image';
import { getInitials, profile } from '@/lib/profile';

// The mocked ImageResponse is a vi.fn() spy — cast it so we can read its calls.
const imageResponseMock = vi.mocked(ImageResponse);

describe('og-image', () => {
  it('exports the canonical 1200×630 size, PNG content type, and alt text', () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_CONTENT_TYPE).toBe('image/png');
    expect(OG_ALT).toBe(`${profile.name} — ${profile.title}`);
  });

  it('constructs ImageResponse with the OG_SIZE options', () => {
    imageResponseMock.mockClear();

    createOgImage();

    expect(imageResponseMock).toHaveBeenCalledTimes(1);
    const [, options] = imageResponseMock.mock.calls[0]!;
    expect(options).toEqual({ width: 1200, height: 630 });
  });

  it('builds a card containing the profile name, title, location, initials, and PORTFOLIO label', () => {
    imageResponseMock.mockClear();

    createOgImage();

    // The mocked ImageResponse records the React element it was handed; it's
    // plain <div>s with inline styles, so happy-dom renders it directly.
    const [element] = imageResponseMock.mock.calls[0]!;
    render(element);

    expect(screen.getByText(profile.name)).toBeInTheDocument();
    expect(screen.getByText(profile.title)).toBeInTheDocument();
    expect(screen.getByText(profile.location)).toBeInTheDocument();
    expect(screen.getByText('PORTFOLIO')).toBeInTheDocument();
    expect(screen.getByText(getInitials(profile.name))).toBeInTheDocument();
  });
});
