import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const createProjectMock = vi.fn();
const updateProjectMock = vi.fn();
vi.mock('@/actions/projects', () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
  updateProject: (...args: unknown[]) => updateProjectMock(...args),
}));

// Stub the ScreenshotUploader child: it pulls in server-only deps
// (@/lib/supabase/server via @/actions/screenshots). We only need to assert
// whether ProjectForm renders it (edit mode) or not (create mode).
vi.mock('@/components/admin/screenshot-uploader', () => ({
  ScreenshotUploader: ({ projectId }: { projectId: string }) => (
    <div data-testid="screenshot-uploader">uploader:{projectId}</div>
  ),
}));

// Stub the VideoUploader child for the same reason: it pulls in the browser
// Supabase client and the @/actions/videos server action.
vi.mock('@/components/admin/video-uploader', () => ({
  VideoUploader: ({ projectId }: { projectId: string }) => (
    <div data-testid="video-uploader">video:{projectId}</div>
  ),
}));

import { ProjectForm } from '@/components/admin/project-form';
import type { ProjectWithDetails, Skill } from '@/types';

const makeSkill = (id: string, name: string): Skill => ({
  id,
  name,
  category: 'Languages',
  proficiency: 'advanced',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const skillUuid1 = '11111111-1111-4111-8111-111111111111';
const skillUuid2 = '22222222-2222-4222-8222-222222222222';

const allSkills: Skill[] = [
  makeSkill(skillUuid1, 'TypeScript'),
  makeSkill(skillUuid2, 'React'),
];

const existingProject: ProjectWithDetails = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Existing Project',
  description: 'Existing description',
  github_url: 'https://github.com/me/existing',
  live_url: 'https://existing.example.com',
  demo_video_path: null,
  demo_video_poster_path: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  screenshots: [],
  technologies: [makeSkill(skillUuid1, 'TypeScript')],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectForm (create mode)', () => {
  it('renders empty fields and the create button', () => {
    render(<ProjectForm allSkills={allSkills} />);

    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Create project' }),
    ).toBeInTheDocument();
  });

  it('shows a validation error and does not call the action for an empty title', async () => {
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Description'), 'Some description');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for a malformed github_url', async () => {
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'Something');
    await user.type(screen.getByLabelText(/GitHub URL/i), 'not-a-real-url');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.getByLabelText(/GitHub URL/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('rejects a javascript: scheme github_url at the form layer and does not submit', async () => {
    // Defence-in-depth at the user-facing entry point: the URL fields feed an
    // href, so a `javascript:`/`data:` scheme must be caught by the form's
    // validation (optionalHttpsUrl) before the action is ever called — not only
    // by the server schema. Surfaces as aria-invalid with no action call.
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'Something');
    await user.type(
      screen.getByLabelText(/GitHub URL/i),
      'javascript:alert(1)',
    );
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.getByLabelText(/GitHub URL/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for a malformed live_url', async () => {
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'Something');
    await user.type(screen.getByLabelText(/Live URL/i), 'not-a-real-url');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.getByLabelText(/Live URL/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('submits the entered live_url with the rest of the project', async () => {
    createProjectMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'A description');
    await user.type(
      screen.getByLabelText(/Live URL/i),
      'https://my-project.com',
    );
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledTimes(1);
    });
    expect(createProjectMock.mock.calls[0]?.[0]).toMatchObject({
      live_url: 'https://my-project.com',
    });
  });

  it('submits valid data, shows a success toast, and navigates back to the list', async () => {
    createProjectMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'A description');
    await user.click(screen.getByRole('button', { name: 'TypeScript' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledTimes(1);
    });
    expect(createProjectMock).toHaveBeenCalledWith({
      title: 'My Project',
      description: 'A description',
      github_url: null,
      live_url: null,
      technology_ids: [skillUuid1],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Project created');
    expect(pushMock).toHaveBeenCalledWith('/admin/projects');
  });

  it('toggles a technology off when clicked twice before submitting', async () => {
    createProjectMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'A description');

    const tsButton = screen.getByRole('button', { name: 'TypeScript' });
    await user.click(tsButton);
    await user.click(tsButton);

    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledTimes(1);
    });
    expect(createProjectMock.mock.calls[0]?.[0]).toMatchObject({
      technology_ids: [],
    });
  });

  it('shows an error toast when the action returns a failure', async () => {
    createProjectMock.mockResolvedValue({
      success: false,
      error: 'Boom',
    });
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'A description');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Boom');
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows an informational note when there are no skills to select', () => {
    render(<ProjectForm allSkills={[]} />);

    expect(
      screen.getByText(/No skills yet\. Add skills first/i),
    ).toBeInTheDocument();
  });

  it('navigates back to the list when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(pushMock).toHaveBeenCalledWith('/admin/projects');
  });

  it('shows a disabled "Creating…" button and disables inputs while submitting', async () => {
    let resolveCreate!: (value: {
      success: true;
      data: { id: string };
    }) => void;
    createProjectMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ProjectForm allSkills={allSkills} />);

    await user.type(screen.getByLabelText('Title'), 'My Project');
    await user.type(screen.getByLabelText('Description'), 'A description');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const pendingButton = await screen.findByRole('button', {
      name: 'Creating…',
    });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveCreate({ success: true, data: { id: 'new-id' } });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Project created');
    });
  });

  it('does not render the ScreenshotUploader in create mode', () => {
    render(<ProjectForm allSkills={allSkills} />);

    expect(screen.queryByTestId('screenshot-uploader')).not.toBeInTheDocument();
  });
});

describe('ProjectForm (edit mode)', () => {
  it('pre-populates fields from the existing project', () => {
    render(<ProjectForm project={existingProject} allSkills={allSkills} />);

    expect(screen.getByLabelText('Title')).toHaveValue('Existing Project');
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Existing description',
    );
    expect(screen.getByLabelText(/GitHub URL/i)).toHaveValue(
      'https://github.com/me/existing',
    );
    expect(screen.getByLabelText(/Live URL/i)).toHaveValue(
      'https://existing.example.com',
    );
    expect(screen.getByRole('button', { name: 'TypeScript' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).toBeInTheDocument();
  });

  it('calls updateProject with the project id on submit', async () => {
    updateProjectMock.mockResolvedValue({
      success: true,
      data: { id: existingProject.id },
    });
    const user = userEvent.setup();
    render(<ProjectForm project={existingProject} allSkills={allSkills} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProjectMock).toHaveBeenCalledTimes(1);
    });
    expect(updateProjectMock.mock.calls[0]?.[0]).toMatchObject({
      id: existingProject.id,
      title: 'Existing Project',
      description: 'Existing description',
      github_url: 'https://github.com/me/existing',
      live_url: 'https://existing.example.com',
      technology_ids: [skillUuid1],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Project updated');
    expect(pushMock).toHaveBeenCalledWith('/admin/projects');
  });

  it('renders the ScreenshotUploader for the project in edit mode', () => {
    render(<ProjectForm project={existingProject} allSkills={allSkills} />);

    const uploader = screen.getByTestId('screenshot-uploader');
    expect(uploader).toBeInTheDocument();
    expect(uploader).toHaveTextContent(`uploader:${existingProject.id}`);
  });

  it('renders the VideoUploader for the project in edit mode', () => {
    render(<ProjectForm project={existingProject} allSkills={allSkills} />);

    const uploader = screen.getByTestId('video-uploader');
    expect(uploader).toBeInTheDocument();
    expect(uploader).toHaveTextContent(`video:${existingProject.id}`);
  });

  it('does not render the VideoUploader in create mode', () => {
    render(<ProjectForm allSkills={allSkills} />);

    expect(screen.queryByTestId('video-uploader')).not.toBeInTheDocument();
  });
});
