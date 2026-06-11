import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const uploadScreenshotMock = vi.fn();
const deleteScreenshotMock = vi.fn();
const reorderScreenshotsMock = vi.fn();
vi.mock('@/actions/screenshots', () => ({
  uploadScreenshot: (...args: unknown[]) => uploadScreenshotMock(...args),
  deleteScreenshot: (...args: unknown[]) => deleteScreenshotMock(...args),
  reorderScreenshots: (...args: unknown[]) => reorderScreenshotsMock(...args),
}));

// Captures the latest onReorder so a test can drive a drag-and-drop reorder
// without exercising @dnd-kit (which needs real pointer geometry).
let latestOnReorder: ((items: { id: string }[]) => void) | null = null;
vi.mock('@/components/admin/sortable-list', () => ({
  SortableList: <T extends { id: string }>({
    items,
    onReorder,
    renderItem,
  }: {
    items: T[];
    onReorder: (items: T[]) => void;
    renderItem: (
      item: T,
      dragHandle: React.ReactNode,
      rowProps: {
        ref: (node: HTMLElement | null) => void;
        style: React.CSSProperties;
      },
    ) => React.ReactNode;
  }) => {
    latestOnReorder = onReorder as (items: { id: string }[]) => void;
    return (
      <div>
        {items.map((item) => (
          <div key={item.id}>
            {renderItem(item, null, { ref: () => {}, style: {} })}
          </div>
        ))}
      </div>
    );
  },
}));

import { ScreenshotUploader } from '@/components/admin/screenshot-uploader';
import type { ProjectScreenshot } from '@/types';

const projectId = '11111111-1111-4111-8111-111111111111';
const screenshotId = '22222222-2222-4222-8222-222222222222';

const makeScreenshot = (
  overrides: Partial<ProjectScreenshot> = {},
): ProjectScreenshot => ({
  id: screenshotId,
  project_id: projectId,
  storage_path: `${projectId}/abc.png`,
  alt_text: 'Dashboard view',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  latestOnReorder = null;
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

const FILE_INPUT_LABEL = /Images \(JPEG, PNG, or WebP/i;

describe('ScreenshotUploader — file selection & staging', () => {
  it('rejects files with an unsupported mime type and does not stage them', async () => {
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    const badFile = makeFile('doc.pdf', 'application/pdf', 1024);
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(toastError).toHaveBeenCalledWith(
      'Only JPEG, PNG, or WebP images are allowed.',
    );
    expect(
      screen.queryByRole('button', { name: /Upload \d+ image/i }),
    ).not.toBeInTheDocument();
    expect(uploadScreenshotMock).not.toHaveBeenCalled();
  });

  it('rejects files larger than 5MB', async () => {
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    const tooBig = makeFile('big.png', 'image/png', 5 * 1024 * 1024 + 1);
    fireEvent.change(input, { target: { files: [tooBig] } });

    expect(toastError).toHaveBeenCalledWith(
      'Each image must be 5MB or smaller.',
    );
    expect(
      screen.queryByRole('button', { name: /Upload \d+ image/i }),
    ).not.toBeInTheDocument();
    expect(uploadScreenshotMock).not.toHaveBeenCalled();
  });

  it('stages multiple valid files and shows a count + upload button', async () => {
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('one.png', 'image/png', 1024),
          makeFile('two.jpg', 'image/jpeg', 2048),
        ],
      },
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByText(/2 images ready to upload/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Upload 2 images/i }),
    ).toBeEnabled();
  });

  it('stages valid files and rejects invalid ones from the same selection', async () => {
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('good.png', 'image/png', 1024),
          makeFile('bad.pdf', 'application/pdf', 1024),
        ],
      },
    });

    expect(toastError).toHaveBeenCalledWith(
      'Only JPEG, PNG, or WebP images are allowed.',
    );
    expect(screen.getByText(/1 image ready to upload/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Upload 1 image/i }),
    ).toBeInTheDocument();
  });

  it('removes a staged file when its remove button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('one.png', 'image/png', 1024)] },
    });

    expect(screen.getByText(/1 image ready to upload/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Remove one\.png/i }));

    expect(
      screen.queryByText(/image ready to upload/i),
    ).not.toBeInTheDocument();
  });
});

describe('ScreenshotUploader — uploading', () => {
  it('uploads a single staged file via a FormData payload', async () => {
    uploadScreenshotMock.mockResolvedValue({
      success: true,
      data: makeScreenshot(),
    });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const validFile = makeFile('ok.png', 'image/png', 1024);
    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [validFile] } });

    await user.click(screen.getByRole('button', { name: /Upload 1 image/i }));

    await waitFor(() => {
      expect(uploadScreenshotMock).toHaveBeenCalledTimes(1);
    });
    const fd = uploadScreenshotMock.mock.calls[0]?.[0] as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('project_id')).toBe(projectId);
    expect(fd.get('file')).toBe(validFile);
    expect(fd.get('alt_text')).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith('Screenshot uploaded');
  });

  it('uploads several staged files sequentially and reports the count', async () => {
    uploadScreenshotMock
      .mockResolvedValueOnce({
        success: true,
        data: makeScreenshot({ id: 'a', storage_path: `${projectId}/a.png` }),
      })
      .mockResolvedValueOnce({
        success: true,
        data: makeScreenshot({ id: 'b', storage_path: `${projectId}/b.png` }),
      })
      .mockResolvedValueOnce({
        success: true,
        data: makeScreenshot({ id: 'c', storage_path: `${projectId}/c.png` }),
      });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('a.png', 'image/png', 1024),
          makeFile('b.png', 'image/png', 1024),
          makeFile('c.png', 'image/png', 1024),
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: /Upload 3 images/i }));

    await waitFor(() => {
      expect(uploadScreenshotMock).toHaveBeenCalledTimes(3);
    });
    expect(toastSuccess).toHaveBeenCalledWith('3 screenshots uploaded');
    // All staged files cleared once uploaded.
    await waitFor(() => {
      expect(
        screen.queryByText(/image(s)? ready to upload/i),
      ).not.toBeInTheDocument();
    });
  });

  it('sends per-file alt text in the FormData payload', async () => {
    uploadScreenshotMock.mockResolvedValue({
      success: true,
      data: makeScreenshot(),
    });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('ok.png', 'image/png', 1024)] },
    });

    await user.type(
      screen.getByLabelText(/Alt text for ok\.png/i),
      '  Landing page hero  ',
    );
    await user.click(screen.getByRole('button', { name: /Upload 1 image/i }));

    await waitFor(() => {
      expect(uploadScreenshotMock).toHaveBeenCalledTimes(1);
    });
    const fd = uploadScreenshotMock.mock.calls[0]?.[0] as FormData;
    expect(fd.get('alt_text')).toBe('Landing page hero');
  });

  it('keeps a failed file staged and shows a per-file error', async () => {
    uploadScreenshotMock
      .mockResolvedValueOnce({
        success: true,
        data: makeScreenshot({ id: 'a', storage_path: `${projectId}/a.png` }),
      })
      .mockResolvedValueOnce({ success: false, error: 'db down' });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile('a.png', 'image/png', 1024),
          makeFile('b.png', 'image/png', 1024),
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: /Upload 2 images/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('b.png: db down');
    });
    // One succeeded, one remains staged for retry.
    expect(toastSuccess).toHaveBeenCalledWith('Screenshot uploaded');
    await waitFor(() => {
      expect(screen.getByText(/1 image ready to upload/i)).toBeInTheDocument();
    });
  });

  it('shows an "Uploading…" disabled button while uploads are in flight', async () => {
    let resolveUpload!: (value: {
      success: true;
      data: ProjectScreenshot;
    }) => void;
    uploadScreenshotMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    const input = screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('ok.png', 'image/png', 1024)] },
    });
    await user.click(screen.getByRole('button', { name: /Upload 1 image/i }));

    const pendingButton = await screen.findByRole('button', {
      name: /Uploading/i,
    });
    expect(pendingButton).toBeDisabled();

    resolveUpload({ success: true, data: makeScreenshot() });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Screenshot uploaded');
    });
  });
});

describe('ScreenshotUploader — existing screenshots list', () => {
  it('renders the "No alt text" fallback for a screenshot without alt text', () => {
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[makeScreenshot({ alt_text: null })]}
      />,
    );

    expect(screen.getByText('No alt text')).toBeInTheDocument();
  });

  it('marks the first screenshot as the cover', () => {
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[
          makeScreenshot({ id: 'a', storage_path: `${projectId}/1.png` }),
          makeScreenshot({ id: 'b', storage_path: `${projectId}/2.png` }),
        ]}
      />,
    );

    const coverBadges = screen.getAllByText('Cover');
    expect(coverBadges).toHaveLength(1);
  });

  it('renders an empty state when there are no screenshots', () => {
    render(
      <ScreenshotUploader projectId={projectId} initialScreenshots={[]} />,
    );

    expect(
      screen.getByText(/No screenshots yet\. Upload the first one above\./i),
    ).toBeInTheDocument();
  });
});

describe('ScreenshotUploader — drag-and-drop reorder', () => {
  const first = makeScreenshot({
    id: 'aaa',
    storage_path: `${projectId}/1.png`,
  });
  const second = makeScreenshot({
    id: 'bbb',
    storage_path: `${projectId}/2.png`,
  });

  it('optimistically reorders and persists the new order via reorderScreenshots', async () => {
    reorderScreenshotsMock.mockResolvedValue({ success: true });
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[first, second]}
      />,
    );

    expect(latestOnReorder).toBeTypeOf('function');

    await act(async () => {
      latestOnReorder!([second, first]);
    });

    await waitFor(() => {
      expect(reorderScreenshotsMock).toHaveBeenCalledTimes(1);
    });
    expect(reorderScreenshotsMock).toHaveBeenCalledWith([
      { id: 'bbb', sort_order: 0 },
      { id: 'aaa', sort_order: 1 },
    ]);

    // Order persisted optimistically: '2.png' (bbb) now precedes '1.png' (aaa).
    const paths = screen
      .getAllByText(new RegExp(`^${projectId}/\\d\\.png$`))
      .map((el) => el.textContent);
    expect(paths).toEqual([`${projectId}/2.png`, `${projectId}/1.png`]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rolls back to the previous order and toasts when reorderScreenshots fails', async () => {
    reorderScreenshotsMock.mockResolvedValue({
      success: false,
      error: 'reorder failed',
    });
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[first, second]}
      />,
    );

    await act(async () => {
      latestOnReorder!([second, first]);
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('reorder failed');
    });

    // Rolled back to the original order: '1.png' (aaa) precedes '2.png' (bbb).
    const paths = screen
      .getAllByText(new RegExp(`^${projectId}/\\d\\.png$`))
      .map((el) => el.textContent);
    expect(paths).toEqual([`${projectId}/1.png`, `${projectId}/2.png`]);
  });
});

describe('ScreenshotUploader — delete action', () => {
  it('opens a confirmation dialog, calls deleteScreenshot on confirm, and removes the row', async () => {
    deleteScreenshotMock.mockResolvedValue({
      success: true,
      data: { id: screenshotId },
    });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[makeScreenshot()]}
      />,
    );

    // The rendered <Image> src proves the mocked clientEnv (not env leakage)
    // drives publicUrl().
    expect(screen.getByAltText('Dashboard view').getAttribute('src')).toBe(
      `${MOCK_SUPABASE_URL}/storage/v1/object/public/screenshots/${projectId}/abc.png`,
    );

    await user.click(
      screen.getByRole('button', { name: /Delete screenshot/i }),
    );

    expect(
      await screen.findByRole('heading', { name: /Delete screenshot\?/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteScreenshotMock).toHaveBeenCalledWith({ id: screenshotId });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Screenshot deleted');
    await waitFor(() => {
      expect(screen.queryByText('Dashboard view')).not.toBeInTheDocument();
    });
  });

  it('shows an error toast and keeps the screenshot when the delete action fails', async () => {
    deleteScreenshotMock.mockResolvedValue({
      success: false,
      error: 'nope',
    });
    const user = userEvent.setup();
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[makeScreenshot()]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Delete screenshot/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('nope');
    });
    expect(screen.getByText('Dashboard view')).toBeInTheDocument();
  });

  it('closes the dialog without calling the action when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ScreenshotUploader
        projectId={projectId}
        initialScreenshots={[makeScreenshot()]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Delete screenshot/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /Delete screenshot\?/i }),
      ).not.toBeInTheDocument();
    });
    expect(deleteScreenshotMock).not.toHaveBeenCalled();
  });
});
