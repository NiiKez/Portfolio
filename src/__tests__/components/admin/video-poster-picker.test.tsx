import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Distinct from setup.ts's process.env default so the assertions below prove
// this mock (not env leakage) drives posterUrl()/videoUrl(). The literal is
// inlined in the factory because vi.mock is hoisted above module-scope consts.
vi.mock('@/lib/env.client', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://mocked-supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

const MOCK_SUPABASE_URL = 'http://mocked-supabase.test';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const setProjectVideoPosterMock = vi.fn();
const removeProjectVideoPosterMock = vi.fn();
vi.mock('@/actions/videos', () => ({
  setProjectVideoPoster: (...args: unknown[]) =>
    setProjectVideoPosterMock(...args),
  removeProjectVideoPoster: (...args: unknown[]) =>
    removeProjectVideoPosterMock(...args),
}));

// next/image renders a plain <img>, stripping the props it doesn't understand
// (fill/priority/sizes) so they don't leak onto the DOM node.
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

import { VideoPosterPicker } from '@/components/admin/video-poster-picker';

const projectId = '11111111-1111-4111-8111-111111111111';
const videoPath = `${projectId}/demo.mp4`;

function makeImageFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, {
    type,
  });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

const posterPublicUrl = (path: string) =>
  `${MOCK_SUPABASE_URL}/storage/v1/object/public/screenshots/${path}`;

beforeEach(() => {
  vi.clearAllMocks();
  // Sane defaults; individual tests override to exercise the failure paths.
  setProjectVideoPosterMock.mockResolvedValue({
    success: true,
    data: { demo_video_poster_path: `${projectId}/poster-new.jpg` },
  });
  removeProjectVideoPosterMock.mockResolvedValue({
    success: true,
    data: { projectId },
  });
  // The component guards these (typeof === 'function') but stub them so the
  // staged-preview <img> gets a src and unmount cleanup runs.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('VideoPosterPicker — rendering', () => {
  it('renders capture + upload UI and no current poster when initialPosterPath is null', () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    expect(screen.getByText('Video poster')).toBeInTheDocument();
    expect(screen.getByText('Capture a frame')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Use current frame/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Or upload an image/i)).toBeInTheDocument();

    // No current poster → no Remove button, no "Current poster" label.
    expect(
      screen.queryByRole('button', { name: 'Remove video poster' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Current poster')).not.toBeInTheDocument();
    expect(
      screen.queryByAltText('Current video poster'),
    ).not.toBeInTheDocument();
  });

  it('shows the current poster image and a Remove button when initialPosterPath is set', () => {
    const posterPath = `${projectId}/poster-initial.jpg`;
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={posterPath}
      />,
    );

    const img = screen.getByAltText('Current video poster') as HTMLImageElement;
    expect(img).toHaveAttribute('src', posterPublicUrl(posterPath));
    expect(screen.getByText('Current poster')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove video poster' }),
    ).toBeInTheDocument();
  });
});

describe('VideoPosterPicker — file validation & staging', () => {
  it('rejects a disallowed mime type and stages nothing', async () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('doc.pdf', 'application/pdf', 1024)] },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Only JPEG, PNG, or WebP images are allowed.',
      );
    });
    expect(
      screen.queryByRole('button', { name: /Set as poster/i }),
    ).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects a GIF (also a disallowed image type)', async () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('anim.gif', 'image/gif', 2048)] },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Only JPEG, PNG, or WebP images are allowed.',
      );
    });
    expect(
      screen.queryByRole('button', { name: /Set as poster/i }),
    ).not.toBeInTheDocument();
  });

  it('rejects an oversized file (> 5MB)', async () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeImageFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)],
      },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'The image must be 5MB or smaller.',
      );
    });
    expect(
      screen.queryByRole('button', { name: /Set as poster/i }),
    ).not.toBeInTheDocument();
  });

  it('stages a file exactly at the 5MB cap (boundary is inclusive)', async () => {
    // The reject test above uses cap+1; pin the other side of the strict `>`
    // check so a regression to `>=` (rejecting a valid at-cap image) fails here.
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeImageFile('exact.jpg', 'image/jpeg', 5 * 1024 * 1024)],
      },
    });

    expect(
      await screen.findByRole('button', { name: /Set as poster/i }),
    ).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('ignores a change event with no file selected', () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(toastError).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /Set as poster/i }),
    ).not.toBeInTheDocument();
  });

  it('stages a valid small JPEG: shows the file name, a formatted size, and a Set as poster button', async () => {
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    // 2048 bytes → formatBytes => "2 KB".
    fireEvent.change(input, {
      target: { files: [makeImageFile('shot.jpg', 'image/jpeg', 2048)] },
    });

    expect(
      await screen.findByRole('button', { name: /Set as poster/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/shot\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('VideoPosterPicker — uploading a staged file', () => {
  it('uploads the staged file, toasts success, and shows the new current poster', async () => {
    const newPath = `${projectId}/poster-saved.jpg`;
    setProjectVideoPosterMock.mockResolvedValue({
      success: true,
      data: { demo_video_poster_path: newPath },
    });
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    const file = makeImageFile('shot.jpg', 'image/jpeg', 2048);
    fireEvent.change(input, { target: { files: [file] } });

    await user.click(
      await screen.findByRole('button', { name: /Set as poster/i }),
    );

    await waitFor(() => {
      expect(setProjectVideoPosterMock).toHaveBeenCalledTimes(1);
    });
    const fd = setProjectVideoPosterMock.mock.calls[0]![0] as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('project_id')).toBe(projectId);
    expect(fd.get('file')).toBeInstanceOf(File);
    expect((fd.get('file') as File).name).toBe('shot.jpg');

    expect(toastSuccess).toHaveBeenCalledWith('Poster updated');
    // The new poster now shows as the current poster.
    const img = (await screen.findByAltText(
      'Current video poster',
    )) as HTMLImageElement;
    expect(img).toHaveAttribute('src', posterPublicUrl(newPath));
    // Staged preview is cleared after a successful upload.
    expect(
      screen.queryByRole('button', { name: /Set as poster/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps the staged file and toasts the error when the upload fails', async () => {
    setProjectVideoPosterMock.mockResolvedValue({
      success: false,
      error: 'nope',
    });
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('shot.jpg', 'image/jpeg', 2048)] },
    });

    await user.click(
      await screen.findByRole('button', { name: /Set as poster/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('nope');
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    // The staged file is kept for retry: Cancel + Set as poster remain.
    expect(
      screen.getByRole('button', { name: /Set as poster/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      screen.queryByAltText('Current video poster'),
    ).not.toBeInTheDocument();
  });

  it('Cancel clears the staged file', async () => {
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const input = screen.getByLabelText(
      /Or upload an image/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('shot.jpg', 'image/jpeg', 2048)] },
    });

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Set as poster/i }),
      ).not.toBeInTheDocument();
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});

describe('VideoPosterPicker — removing a poster', () => {
  it('removes the poster, clears the current image, and toasts success', async () => {
    const posterPath = `${projectId}/poster-initial.jpg`;
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={posterPath}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove video poster' }),
    );

    await waitFor(() => {
      expect(removeProjectVideoPosterMock).toHaveBeenCalledWith({ projectId });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Poster removed');
    await waitFor(() => {
      expect(
        screen.queryByAltText('Current video poster'),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Remove video poster' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the poster shown and toasts the error when removal fails', async () => {
    removeProjectVideoPosterMock.mockResolvedValue({
      success: false,
      error: 'cannot remove',
    });
    const posterPath = `${projectId}/poster-initial.jpg`;
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={posterPath}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove video poster' }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('cannot remove');
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    // The poster is still shown.
    expect(screen.getByAltText('Current video poster')).toBeInTheDocument();
  });
});

describe('VideoPosterPicker — capturing a frame', () => {
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  const realToBlob = HTMLCanvasElement.prototype.toBlob;

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = realGetContext;
    HTMLCanvasElement.prototype.toBlob = realToBlob;
  });

  it('toasts when the video is not ready (videoWidth 0)', async () => {
    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Use current frame/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'The video is still loading — try again in a moment.',
      );
    });
    expect(setProjectVideoPosterMock).not.toHaveBeenCalled();
  });

  it('captures a frame, uploads it, and toasts success when the video is ready', async () => {
    const newPath = `${projectId}/poster-captured.jpg`;
    setProjectVideoPosterMock.mockResolvedValue({
      success: true,
      data: { demo_video_poster_path: newPath },
    });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) =>
      cb(new Blob(['x'], { type: 'image/jpeg' })),
    ) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', {
      value: 640,
      configurable: true,
    });
    Object.defineProperty(video, 'videoHeight', {
      value: 360,
      configurable: true,
    });

    await user.click(
      screen.getByRole('button', { name: /Use current frame/i }),
    );

    await waitFor(() => {
      expect(setProjectVideoPosterMock).toHaveBeenCalledTimes(1);
    });
    const fd = setProjectVideoPosterMock.mock.calls[0]![0] as FormData;
    expect(fd.get('project_id')).toBe(projectId);
    expect((fd.get('file') as File).name).toBe('poster.jpg');
    expect(toastSuccess).toHaveBeenCalledWith('Poster updated');
    expect(await screen.findByAltText('Current video poster')).toHaveAttribute(
      'src',
      posterPublicUrl(newPath),
    );
  });

  it('rejects a captured frame larger than 5MB without uploading', async () => {
    // A frame captured from a high-resolution video can exceed the 5MB cap; the
    // capture path must guard it client-side (mirroring the file-pick path) so
    // the server never rejects a capture the admin never explicitly chose.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) =>
      cb(
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }),
      ),
    ) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', {
      value: 3840,
      configurable: true,
    });
    Object.defineProperty(video, 'videoHeight', {
      value: 2160,
      configurable: true,
    });

    await user.click(
      screen.getByRole('button', { name: /Use current frame/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/larger than 5MB/i),
      );
    });
    expect(setProjectVideoPosterMock).not.toHaveBeenCalled();
  });

  it('toasts when the canvas 2d context is unavailable', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', {
      value: 640,
      configurable: true,
    });
    Object.defineProperty(video, 'videoHeight', {
      value: 360,
      configurable: true,
    });

    await user.click(
      screen.getByRole('button', { name: /Use current frame/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Could not capture a frame from this video.',
      );
    });
    expect(setProjectVideoPosterMock).not.toHaveBeenCalled();
  });

  it('toasts when toBlob yields no blob', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) =>
      cb(null),
    ) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

    const user = userEvent.setup();
    render(
      <VideoPosterPicker
        projectId={projectId}
        videoPath={videoPath}
        initialPosterPath={null}
      />,
    );

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', {
      value: 640,
      configurable: true,
    });
    Object.defineProperty(video, 'videoHeight', {
      value: 360,
      configurable: true,
    });

    await user.click(
      screen.getByRole('button', { name: /Use current frame/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Could not capture a frame from this video.',
      );
    });
    expect(setProjectVideoPosterMock).not.toHaveBeenCalled();
  });
});
