import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.client', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://mocked-supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

// Mock motion so useReducedMotion is toggleable; motion.div just renders its
// children (the animation props are intentionally dropped).
const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => motionState.reduce,
}));

const MOCK_SUPABASE_URL = 'http://mocked-supabase.test';

import { ProjectVideo } from '@/components/projects/project-video';

beforeEach(() => {
  vi.clearAllMocks();
  motionState.reduce = false;
});

describe('ProjectVideo', () => {
  it('renders the video and screenshot poster from their public URLs', () => {
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/videos/proj/demo.mp4`,
    );
    expect(video?.getAttribute('poster')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/screenshots/proj/hero.png`,
    );
  });

  it('omits the poster when there is no screenshot', () => {
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath={null}
        projectTitle="Prodstack"
      />,
    );

    expect(document.querySelector('video')?.hasAttribute('poster')).toBe(false);
  });

  it('shows a play affordance and Demo badge before playback', () => {
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    expect(
      screen.getByRole('button', { name: /Play demo video for Prodstack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
    // Controls are handed off only once playback starts.
    expect(document.querySelector('video')?.hasAttribute('controls')).toBe(
      false,
    );
  });

  it('hands off to native controls after the play button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Play demo video for Prodstack/i }),
    );

    expect(
      screen.queryByRole('button', { name: /Play demo video/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    expect(document.querySelector('video')?.hasAttribute('controls')).toBe(
      true,
    );
  });

  it('calls video.play() when the play button is clicked', async () => {
    const user = userEvent.setup();
    const playSpy = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockResolvedValue(undefined);
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Play demo video for Prodstack/i }),
    );

    expect(playSpy).toHaveBeenCalledTimes(1);

    playSpy.mockRestore();
  });

  it('swallows a rejected play() promise without throwing', async () => {
    const user = userEvent.setup();
    // Simulate an autoplay-blocked browser: play() rejects. The component must
    // swallow it (native controls are now visible) rather than surface an
    // unhandled rejection.
    const playSpy = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Play demo video for Prodstack/i }),
    );
    // Let the rejected microtask settle so an unhandled rejection would surface.
    await Promise.resolve();

    expect(playSpy).toHaveBeenCalledTimes(1);
    // Playback still hands off to native controls despite the rejection.
    expect(document.querySelector('video')?.hasAttribute('controls')).toBe(
      true,
    );

    playSpy.mockRestore();
  });

  it('hands off to native controls when playback starts via the video element', () => {
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    const video = document.querySelector('video')!;
    // The native play event (e.g. spacebar on the focused element) must also
    // dismiss the overlay, not just the custom play button.
    fireEvent.play(video);

    expect(
      screen.queryByRole('button', { name: /Play demo video/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    expect(video.hasAttribute('controls')).toBe(true);
  });

  it('still renders the player when reduced motion is preferred', () => {
    motionState.reduce = true;
    render(
      <ProjectVideo
        videoPath="proj/demo.mp4"
        posterPath="proj/hero.png"
        projectTitle="Prodstack"
      />,
    );

    expect(document.querySelector('video')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /Play demo video for Prodstack/i }),
    ).toBeInTheDocument();
  });
});
