import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Distinct from setup.ts's process.env default so the assertions below prove
// this mock (not env leakage) drives publicUrl(). The literal is inlined in the
// factory because vi.mock is hoisted above module-scope consts.
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

const setProjectVideoMock = vi.fn();
const removeProjectVideoMock = vi.fn();
const createVideoUploadUrlMock = vi.fn();
const discardVideoUploadMock = vi.fn();
vi.mock('@/actions/videos', () => ({
  setProjectVideo: (...args: unknown[]) => setProjectVideoMock(...args),
  removeProjectVideo: (...args: unknown[]) => removeProjectVideoMock(...args),
  createVideoUploadUrl: (...args: unknown[]) =>
    createVideoUploadUrlMock(...args),
  discardVideoUpload: (...args: unknown[]) => discardVideoUploadMock(...args),
}));

const uploadToSignedUrlMock = vi.fn();
const storageFromMock = vi.fn(() => ({
  uploadToSignedUrl: uploadToSignedUrlMock,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ storage: { from: storageFromMock } }),
}));

import { VideoUploader } from '@/components/admin/video-uploader';

const projectId = '11111111-1111-4111-8111-111111111111';

// 16-byte headers so File.slice(0, 16) yields a recognisable signature. An
// MP4/ISO-BMFF "ftyp" box marker sits at offset 4; the non-video bytes are a
// PDF header that no video sniff should accept.
const MP4_BYTES = [
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00,
];
const NOT_VIDEO_BYTES = [
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00,
];
// WebM / Matroska EBML header.
const WEBM_BYTES = [
  0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00,
];

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
  bytes: number[],
): File {
  const file = new File([new Uint8Array(bytes)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

const FILE_INPUT_LABEL = /Video \(MP4 or WebM/i;

beforeEach(() => {
  vi.clearAllMocks();
  // Sane defaults: authorising the upload and the signed-URL upload succeed.
  // Individual tests override these to exercise the failure paths.
  createVideoUploadUrlMock.mockResolvedValue({
    success: true,
    data: { path: `${projectId}/signed.mp4`, token: 'signed-token' },
  });
  uploadToSignedUrlMock.mockResolvedValue({ error: null });
});

describe('VideoUploader — file selection & validation', () => {
  it('rejects a file with an unsupported mime type', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeFile('doc.pdf', 'application/pdf', 1024, MP4_BYTES)],
      },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Only MP4 or WebM videos are allowed.',
      );
    });
    expect(
      screen.queryByRole('button', { name: /Upload video/i }),
    ).not.toBeInTheDocument();
  });

  it('rejects a file larger than 100MB', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('big.mp4', 'video/mp4', 100 * 1024 * 1024 + 1, MP4_BYTES),
        ],
      },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'The video must be 100MB or smaller.',
      );
    });
  });

  it('stages a file that is exactly at the 100MB cap (boundary is inclusive)', async () => {
    // The reject test above uses cap+1; pin the other side of the strict `>`
    // check so a regression to `>=` (which would reject a valid at-cap video)
    // fails here.
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('exact.mp4', 'video/mp4', 100 * 1024 * 1024, MP4_BYTES),
        ],
      },
    });

    expect(
      await screen.findByRole('button', { name: /Upload video/i }),
    ).toBeEnabled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rejects a file whose bytes are not a real video', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeFile('fake.mp4', 'video/mp4', 2048, NOT_VIDEO_BYTES)],
      },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Only MP4 or WebM videos are allowed.',
      );
    });
    expect(
      screen.queryByRole('button', { name: /Upload video/i }),
    ).not.toBeInTheDocument();
  });

  it('stages a valid MP4 and shows an Upload button', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });

    expect(
      await screen.findByRole('button', { name: /Upload video/i }),
    ).toBeEnabled();
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe('VideoUploader — uploading', () => {
  it('mints a signed upload URL, uploads to it, then records the path', async () => {
    const savedPath = `${projectId}/saved.mp4`;
    createVideoUploadUrlMock.mockResolvedValue({
      success: true,
      data: { path: savedPath, token: 'signed-token' },
    });
    setProjectVideoMock.mockResolvedValue({
      success: true,
      data: { demo_video_path: savedPath },
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(createVideoUploadUrlMock).toHaveBeenCalledWith({
        projectId,
        ext: 'mp4',
      });
    });
    expect(storageFromMock).toHaveBeenCalledWith('videos');
    const [uploadPath, token, , options] = uploadToSignedUrlMock.mock.calls[0]!;
    expect(uploadPath).toBe(savedPath);
    expect(token).toBe('signed-token');
    expect(options).toMatchObject({ contentType: 'video/mp4' });

    await waitFor(() => {
      expect(setProjectVideoMock).toHaveBeenCalledWith({
        projectId,
        storagePath: savedPath,
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Demo video uploaded');
    // The saved video is now shown via its public URL.
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.getAttribute('src')).toBe(
        `${MOCK_SUPABASE_URL}/storage/v1/object/public/videos/${savedPath}`,
      );
    });
  });

  it('surfaces an authorisation error before uploading anything', async () => {
    createVideoUploadUrlMock.mockResolvedValue({
      success: false,
      error: 'Unauthorized',
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Unauthorized');
    });
    expect(uploadToSignedUrlMock).not.toHaveBeenCalled();
    expect(setProjectVideoMock).not.toHaveBeenCalled();
  });

  it('surfaces a storage error and does not record a path', async () => {
    uploadToSignedUrlMock.mockResolvedValue({
      error: { message: 'storage exploded' },
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('storage exploded');
    });
    expect(setProjectVideoMock).not.toHaveBeenCalled();
  });

  it('discards the orphaned upload when setProjectVideo fails', async () => {
    const savedPath = `${projectId}/orphan.mp4`;
    createVideoUploadUrlMock.mockResolvedValue({
      success: true,
      data: { path: savedPath, token: 'signed-token' },
    });
    setProjectVideoMock.mockResolvedValue({
      success: false,
      error: 'could not save',
    });
    discardVideoUploadMock.mockResolvedValue({
      success: true,
      data: { discarded: true },
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('could not save');
    });
    expect(discardVideoUploadMock).toHaveBeenCalledWith({
      projectId,
      storagePath: savedPath,
    });
    // The failed save must not be reported as success, and no saved video
    // (a public-URL <video>) should appear. The staged file is kept for retry.
    expect(toastSuccess).not.toHaveBeenCalled();
    const savedVideo = Array.from(document.querySelectorAll('video')).find(
      (v) => v.getAttribute('src')?.includes('/object/public/videos/'),
    );
    expect(savedVideo).toBeUndefined();
    expect(setProjectVideoMock).toHaveBeenCalledWith({
      projectId,
      storagePath: savedPath,
    });
  });

  it('surfaces a generic error and resets when the upload flow throws', async () => {
    // A direct Supabase call rejecting (not an ActionResponse) must be caught so
    // the button does not stay stuck spinning.
    uploadToSignedUrlMock.mockRejectedValue(new Error('network died'));
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Upload failed. Please try again.',
      );
    });
    expect(setProjectVideoMock).not.toHaveBeenCalled();
    // The button is re-enabled (not stuck on "Uploading…") so a retry is possible.
    expect(
      await screen.findByRole('button', { name: /Upload video/i }),
    ).toBeEnabled();
  });

  it('uploads a WebM file with the webm content type', async () => {
    const savedPath = `${projectId}/saved.webm`;
    createVideoUploadUrlMock.mockResolvedValue({
      success: true,
      data: { path: savedPath, token: 'signed-token' },
    });
    setProjectVideoMock.mockResolvedValue({
      success: true,
      data: { demo_video_path: savedPath },
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeFile('demo.webm', 'video/webm', 4096, WEBM_BYTES)],
      },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(createVideoUploadUrlMock).toHaveBeenCalledWith({
        projectId,
        ext: 'webm',
      });
    });
    const [uploadPath, , , options] = uploadToSignedUrlMock.mock.calls[0]!;
    expect(uploadPath).toBe(savedPath);
    expect(options).toMatchObject({ contentType: 'video/webm' });
  });
});

describe('VideoUploader — byte-sniff fallbacks & edge branches', () => {
  // When the bytes are unreadable (an unusual runtime), detectVideo() falls back
  // to the already-validated declared type. A File whose arrayBuffer() rejects
  // forces that catch path.
  function makeUnreadableFile(name: string, type: string): File {
    const file = makeFile(name, type, 2048, MP4_BYTES);
    Object.defineProperty(file, 'slice', {
      value: () => ({
        arrayBuffer: () => Promise.reject(new Error('cannot read bytes')),
      }),
    });
    return file;
  }

  it('falls back to the declared MP4 type when the bytes cannot be read', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeUnreadableFile('demo.mp4', 'video/mp4')] },
    });

    // Falling back keeps the file staged (no rejection toast).
    expect(
      await screen.findByRole('button', { name: /Upload video/i }),
    ).toBeEnabled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('falls back to the declared WebM type when the bytes cannot be read', async () => {
    const savedPath = `${projectId}/fallback.webm`;
    createVideoUploadUrlMock.mockResolvedValue({
      success: true,
      data: { path: savedPath, token: 'signed-token' },
    });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeUnreadableFile('demo.webm', 'video/webm')] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    // The webm fallback is what drives the requested extension.
    await waitFor(() => {
      expect(createVideoUploadUrlMock).toHaveBeenCalledWith({
        projectId,
        ext: 'webm',
      });
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows a placeholder (no <video>) when object URLs are unavailable, and reports size in B/MB', async () => {
    // Stub URL.createObjectURL to a non-function so createPreviewUrl() returns
    // '' → the staged UI renders the VideoIcon placeholder instead of a <video>
    // preview. (happy-dom defines it non-configurably, so override rather than
    // delete.)
    const realCreate = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

      const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
      // A sub-1KB size exercises formatBytes' "B" branch.
      fireEvent.change(input, {
        target: { files: [makeFile('tiny.mp4', 'video/mp4', 512, MP4_BYTES)] },
      });

      expect(
        await screen.findByRole('button', { name: /Upload video/i }),
      ).toBeEnabled();
      // No preview <video> rendered (placeholder branch taken).
      expect(document.querySelector('video')).toBeNull();
      // formatBytes "B" branch.
      expect(screen.getByText(/tiny\.mp4 · 512 B/)).toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: realCreate,
      });
    }
  });

  it('formats a multi-megabyte staged file as MB', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    // 2.5 MB exercises formatBytes' MB branch (kb >= 1024).
    fireEvent.change(input, {
      target: {
        files: [makeFile('big.mp4', 'video/mp4', 2.5 * 1024 * 1024, MP4_BYTES)],
      },
    });

    await screen.findByRole('button', { name: /Upload video/i });
    expect(screen.getByText(/big\.mp4 · 2\.5 MB/)).toBeInTheDocument();
  });

  it('ignores a change event that carries no file', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    // `event.target.files?.[0]` is undefined → handler returns early.
    fireEvent.change(input, { target: { files: [] } });

    await waitFor(() => {
      expect(toastError).not.toHaveBeenCalled();
    });
    expect(
      screen.queryByRole('button', { name: /Upload video/i }),
    ).not.toBeInTheDocument();
  });

  it('replaces an already-staged file when a second file is picked', async () => {
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('first.mp4', 'video/mp4', 1024, MP4_BYTES)] },
    });
    await screen.findByText(/first\.mp4/);

    // Picking a second file replaces the staged one (revokes the prior preview).
    fireEvent.change(input, {
      target: {
        files: [makeFile('second.webm', 'video/webm', 4096, WEBM_BYTES)],
      },
    });
    await screen.findByText(/second\.webm/);
    expect(screen.queryByText(/first\.mp4/)).not.toBeInTheDocument();
  });

  it('falls back to the generic message when the storage error has no message', async () => {
    // An upload error object with an empty message hits the `|| 'Upload failed…'`
    // branch.
    uploadToSignedUrlMock.mockResolvedValue({ error: { message: '' } });
    const user = userEvent.setup();
    render(<VideoUploader projectId={projectId} initialVideoPath={null} />);

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('demo.mp4', 'video/mp4', 2048, MP4_BYTES)] },
    });
    await user.click(
      await screen.findByRole('button', { name: /Upload video/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Upload failed. Please try again.',
      );
    });
    expect(setProjectVideoMock).not.toHaveBeenCalled();
  });
});

describe('VideoUploader — existing video', () => {
  it('renders the current video from its public URL', () => {
    render(
      <VideoUploader
        projectId={projectId}
        initialVideoPath={`${projectId}/demo.mp4`}
      />,
    );

    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/videos/${projectId}/demo.mp4`,
    );
  });

  it('removes the video after confirming the dialog', async () => {
    removeProjectVideoMock.mockResolvedValue({
      success: true,
      data: { projectId },
    });
    const user = userEvent.setup();
    render(
      <VideoUploader
        projectId={projectId}
        initialVideoPath={`${projectId}/demo.mp4`}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove demo video' }));
    expect(
      await screen.findByRole('heading', { name: /Remove demo video\?/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(removeProjectVideoMock).toHaveBeenCalledWith({ projectId });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Demo video removed');
    await waitFor(() => {
      expect(
        screen.getByText(/No demo video yet\. Upload one above\./i),
      ).toBeInTheDocument();
    });
  });

  it('surfaces an error and keeps the video when removal fails', async () => {
    removeProjectVideoMock.mockResolvedValue({
      success: false,
      error: 'could not remove',
    });
    const user = userEvent.setup();
    render(
      <VideoUploader
        projectId={projectId}
        initialVideoPath={`${projectId}/demo.mp4`}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove demo video' }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('could not remove');
    });
    // The video is kept (still rendered) and no success toast is shown.
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/videos/${projectId}/demo.mp4`,
    );
  });

  it('closes the confirm dialog without removing when cancelled', async () => {
    const user = userEvent.setup();
    render(
      <VideoUploader
        projectId={projectId}
        initialVideoPath={`${projectId}/demo.mp4`}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove demo video' }));
    expect(
      await screen.findByRole('heading', { name: /Remove demo video\?/i }),
    ).toBeInTheDocument();

    // Cancelling closes the dialog via onOpenChange(false) without calling the
    // remove action.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /Remove demo video\?/i }),
      ).not.toBeInTheDocument();
    });
    expect(removeProjectVideoMock).not.toHaveBeenCalled();
    // The video is still present after cancelling.
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/videos/${projectId}/demo.mp4`,
    );
  });
});
