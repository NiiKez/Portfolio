import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const createSkillMock = vi.fn();
const updateSkillMock = vi.fn();
vi.mock('@/actions/skills', () => ({
  createSkill: (...args: unknown[]) => createSkillMock(...args),
  updateSkill: (...args: unknown[]) => updateSkillMock(...args),
}));

import { SkillForm } from '@/components/admin/skill-form';
import type { Skill } from '@/types';

const existingSkill: Skill = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'TypeScript',
  category: 'Languages',
  proficiency: 'advanced',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SkillForm (create mode)', () => {
  it('renders empty fields and the create button', () => {
    render(<SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Create skill' }),
    ).toBeInTheDocument();
  });

  it('shows a validation error and does not call the action for an empty name', async () => {
    const user = userEvent.setup();
    render(<SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Category'), 'Languages');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createSkillMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for an empty category', async () => {
    const user = userEvent.setup();
    render(<SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Name'), 'Go');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    expect(screen.getByLabelText('Category')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createSkillMock).not.toHaveBeenCalled();
  });

  it('submits valid data, shows a success toast, and calls onSuccess', async () => {
    createSkillMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SkillForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Name'), 'Go');
    await user.type(screen.getByLabelText('Category'), 'Languages');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    await waitFor(() => {
      expect(createSkillMock).toHaveBeenCalledTimes(1);
    });
    expect(createSkillMock).toHaveBeenCalledWith({
      name: 'Go',
      category: 'Languages',
      proficiency: 'intermediate',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Skill created');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows an error toast when the action returns a failure', async () => {
    createSkillMock.mockResolvedValue({ success: false, error: 'Boom' });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SkillForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Name'), 'Go');
    await user.type(screen.getByLabelText('Category'), 'Languages');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Boom');
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SkillForm onSuccess={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('ignores a re-submit while the first create is still pending (no duplicate row)', async () => {
    createSkillMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { container } = render(
      <SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Name'), 'Go');
    await user.type(screen.getByLabelText('Category'), 'Languages');
    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    await screen.findByRole('button', { name: 'Creating…' });

    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createSkillMock).toHaveBeenCalledTimes(1);
  });

  it('submits the proficiency chosen via the Select instead of the default', async () => {
    createSkillMock.mockResolvedValue({
      success: true,
      data: { id: 'new-id' },
    });
    const user = userEvent.setup();
    render(<SkillForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Name'), 'Rust');
    await user.type(screen.getByLabelText('Category'), 'Languages');

    // Open the proficiency Select and pick a non-default option.
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Advanced' }));

    await user.click(screen.getByRole('button', { name: 'Create skill' }));

    await waitFor(() => {
      expect(createSkillMock).toHaveBeenCalledTimes(1);
    });
    expect(createSkillMock).toHaveBeenCalledWith({
      name: 'Rust',
      category: 'Languages',
      proficiency: 'advanced',
    });
  });

  it('renders category autocomplete options from the categories prop', () => {
    render(
      <SkillForm
        categories={['Frontend', 'Backend', 'DevOps']}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const categoryInput = screen.getByLabelText('Category');
    expect(categoryInput).toHaveAttribute('list', 'skill-categories');

    const datalist = document.getElementById('skill-categories');
    expect(datalist?.tagName).toBe('DATALIST');
    const optionValues = Array.from(
      datalist?.querySelectorAll('option') ?? [],
    ).map((option) => option.getAttribute('value'));
    expect(optionValues).toEqual(['Frontend', 'Backend', 'DevOps']);
  });
});

describe('SkillForm (edit mode)', () => {
  it('pre-populates fields from the existing skill and shows the save button', () => {
    render(
      <SkillForm
        skill={existingSkill}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('TypeScript');
    expect(screen.getByLabelText('Category')).toHaveValue('Languages');
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).toBeInTheDocument();
  });

  it('calls updateSkill with the skill id on submit', async () => {
    updateSkillMock.mockResolvedValue({
      success: true,
      data: { id: existingSkill.id },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SkillForm
        skill={existingSkill}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateSkillMock).toHaveBeenCalledTimes(1);
    });
    expect(updateSkillMock).toHaveBeenCalledWith({
      id: existingSkill.id,
      name: 'TypeScript',
      category: 'Languages',
      proficiency: 'advanced',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Skill updated');
    expect(onSuccess).toHaveBeenCalled();
  });
});
