import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const createExperienceMock = vi.fn();
const updateExperienceMock = vi.fn();
vi.mock('@/actions/experience', () => ({
  createExperience: (...args: unknown[]) => createExperienceMock(...args),
  updateExperience: (...args: unknown[]) => updateExperienceMock(...args),
}));

import { ExperienceForm } from '@/components/admin/experience-form';
import type { Experience } from '@/types';

const existingExperience: Experience = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'Software Engineer',
  company: 'Acme Corp',
  company_url: 'https://acme.example.com',
  location: 'Berlin, Germany',
  period: 'Jan 2024 – Dec 2024',
  kind: 'Full-time',
  description: 'Built and shipped things.',
  technologies: ['TypeScript', 'React'],
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExperienceForm (create mode)', () => {
  it('renders empty fields and the create button', () => {
    render(<ExperienceForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Role')).toHaveValue('');
    expect(screen.getByLabelText('Company')).toHaveValue('');
    expect(screen.getByLabelText('Period')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Create experience' }),
    ).toBeInTheDocument();
  });

  it('shows a validation error and does not call the action for an empty role', async () => {
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Company'), 'Acme Corp');
    await user.type(screen.getByLabelText('Period'), 'Jan 2024 – Dec 2024');
    await user.type(screen.getByLabelText('Description'), 'Did the work.');
    await user.click(screen.getByRole('button', { name: 'Create experience' }));

    expect(screen.getByLabelText('Role')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createExperienceMock).not.toHaveBeenCalled();
  });

  it('submits valid data, shows a success toast, and calls onSuccess', async () => {
    createExperienceMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Role'), 'Software Engineer');
    await user.type(screen.getByLabelText('Company'), 'Acme Corp');
    await user.type(screen.getByLabelText('Period'), 'Jan 2024 – Dec 2024');
    await user.type(screen.getByLabelText('Description'), 'Did the work.');
    await user.click(screen.getByRole('button', { name: 'Create experience' }));

    await waitFor(() => {
      expect(createExperienceMock).toHaveBeenCalledTimes(1);
    });
    expect(createExperienceMock).toHaveBeenCalledWith({
      role: 'Software Engineer',
      company: 'Acme Corp',
      company_url: null,
      location: null,
      period: 'Jan 2024 – Dec 2024',
      kind: 'Internship',
      description: 'Did the work.',
      technologies: [],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Experience created');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('splits the comma-separated technologies into an array', async () => {
    createExperienceMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.type(screen.getByLabelText('Company'), 'Acme Corp');
    await user.type(screen.getByLabelText('Period'), 'Summer 2024');
    await user.type(screen.getByLabelText('Description'), 'Did the work.');
    await user.type(
      screen.getByLabelText('Technologies'),
      'React, TypeScript ,  PostgreSQL',
    );
    await user.click(screen.getByRole('button', { name: 'Create experience' }));

    await waitFor(() => {
      expect(createExperienceMock).toHaveBeenCalledTimes(1);
    });
    expect(createExperienceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        technologies: ['React', 'TypeScript', 'PostgreSQL'],
      }),
    );
  });

  it('shows an error toast when the action returns a failure', async () => {
    createExperienceMock.mockResolvedValue({ success: false, error: 'Boom' });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.type(screen.getByLabelText('Company'), 'Acme Corp');
    await user.type(screen.getByLabelText('Period'), 'Summer 2024');
    await user.type(screen.getByLabelText('Description'), 'Did the work.');
    await user.click(screen.getByRole('button', { name: 'Create experience' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Boom');
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('submits the kind chosen via the Select instead of the default', async () => {
    createExperienceMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<ExperienceForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.type(screen.getByLabelText('Company'), 'Acme Corp');
    await user.type(screen.getByLabelText('Period'), 'Summer 2024');
    await user.type(screen.getByLabelText('Description'), 'Did the work.');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Full-time' }));

    await user.click(screen.getByRole('button', { name: 'Create experience' }));

    await waitFor(() => {
      expect(createExperienceMock).toHaveBeenCalledTimes(1);
    });
    expect(createExperienceMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'Full-time' }),
    );
  });
});

describe('ExperienceForm (edit mode)', () => {
  it('pre-populates fields from the existing experience and shows the save button', () => {
    render(
      <ExperienceForm
        experience={existingExperience}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Role')).toHaveValue('Software Engineer');
    expect(screen.getByLabelText('Company')).toHaveValue('Acme Corp');
    expect(screen.getByLabelText('Company URL')).toHaveValue(
      'https://acme.example.com',
    );
    expect(screen.getByLabelText('Technologies')).toHaveValue(
      'TypeScript, React',
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).toBeInTheDocument();
  });

  it('calls updateExperience with the experience id on submit', async () => {
    updateExperienceMock.mockResolvedValue({
      success: true,
      data: { id: existingExperience.id },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <ExperienceForm
        experience={existingExperience}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateExperienceMock).toHaveBeenCalledTimes(1);
    });
    expect(updateExperienceMock).toHaveBeenCalledWith({
      id: existingExperience.id,
      role: 'Software Engineer',
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      location: 'Berlin, Germany',
      period: 'Jan 2024 – Dec 2024',
      kind: 'Full-time',
      description: 'Built and shipped things.',
      technologies: ['TypeScript', 'React'],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Experience updated');
    expect(onSuccess).toHaveBeenCalled();
  });
});
