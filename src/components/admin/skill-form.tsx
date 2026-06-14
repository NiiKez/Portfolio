'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createSkill, updateSkill } from '@/actions/skills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { skillSchema } from '@/lib/validations';
import type { Proficiency, Skill } from '@/types';

const PROFICIENCIES: ReadonlyArray<{ value: Proficiency; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

type SkillFormProps = {
  skill?: Skill;
  categories?: string[];
  onSuccess: () => void;
  onCancel: () => void;
};

type FieldErrors = Partial<Record<'name' | 'category' | 'proficiency', string>>;

export function SkillForm({
  skill,
  categories,
  onSuccess,
  onCancel,
}: SkillFormProps) {
  const [name, setName] = useState(skill?.name ?? '');
  const [category, setCategory] = useState(skill?.category ?? '');
  const [proficiency, setProficiency] = useState<Proficiency>(
    skill?.proficiency ?? 'intermediate',
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(skill);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guard against a fast double-submit firing two writes before the pending
    // state disables the button (it only flips after the transition re-renders).
    if (isPending) return;
    setErrors({});

    const parsed = skillSchema.safeParse({ name, category, proficiency });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name' || key === 'category' || key === 'proficiency') {
          next[key] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      const response = skill
        ? await updateSkill({ id: skill.id, ...parsed.data })
        : await createSkill(parsed.data);

      if (!response.success) {
        toast.error(response.error);
        return;
      }

      toast.success(isEditing ? 'Skill updated' : 'Skill created');
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="skill-name" className="text-base font-medium">
          Name
        </label>
        <Input
          id="skill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.name)}
          maxLength={100}
          required
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="skill-category" className="text-base font-medium">
          Category
        </label>
        {categories && categories.length > 0 && (
          <datalist id="skill-categories">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        )}
        <Input
          id="skill-category"
          list={
            categories && categories.length > 0 ? 'skill-categories' : undefined
          }
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.category)}
          maxLength={50}
          placeholder="e.g. Frontend, Backend, DevOps"
          required
        />
        {errors.category && (
          <p className="text-xs text-destructive">{errors.category}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-base font-medium">Proficiency</label>
        <Select
          value={proficiency}
          onValueChange={(value) => setProficiency(value as Proficiency)}
          disabled={isPending}
        >
          <SelectTrigger className="h-11 w-full rounded-lg px-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFICIENCIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.proficiency && (
          <p className="text-xs text-destructive">{errors.proficiency}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending
            ? isEditing
              ? 'Saving…'
              : 'Creating…'
            : isEditing
              ? 'Save changes'
              : 'Create skill'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="px-4"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
