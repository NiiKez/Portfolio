'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createExperience, updateExperience } from '@/actions/experience';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { experienceSchema } from '@/lib/validations';
import type { Experience, ExperienceKind } from '@/types';

const KINDS: ReadonlyArray<{ value: ExperienceKind; label: string }> = [
  { value: 'Internship', label: 'Internship' },
  { value: 'Working Student', label: 'Working Student' },
  { value: 'Thesis', label: 'Thesis' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Freelance', label: 'Freelance' },
];

type ExperienceFormProps = {
  experience?: Experience;
  onSuccess: () => void;
  onCancel: () => void;
};

type FieldKey =
  | 'role'
  | 'company'
  | 'company_url'
  | 'location'
  | 'period'
  | 'kind'
  | 'description'
  | 'technologies';

type FieldErrors = Partial<Record<FieldKey, string>>;

export function ExperienceForm({
  experience,
  onSuccess,
  onCancel,
}: ExperienceFormProps) {
  const [role, setRole] = useState(experience?.role ?? '');
  const [company, setCompany] = useState(experience?.company ?? '');
  const [companyUrl, setCompanyUrl] = useState(experience?.company_url ?? '');
  const [location, setLocation] = useState(experience?.location ?? '');
  const [period, setPeriod] = useState(experience?.period ?? '');
  const [kind, setKind] = useState<ExperienceKind>(
    experience?.kind ?? 'Internship',
  );
  const [description, setDescription] = useState(experience?.description ?? '');
  const [technologies, setTechnologies] = useState(
    experience?.technologies?.join(', ') ?? '',
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(experience);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = experienceSchema.safeParse({
      role,
      company,
      company_url: companyUrl,
      location,
      period,
      kind,
      description,
      technologies: technologies
        .split(',')
        .map((tech) => tech.trim())
        .filter(Boolean),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') {
          next[key as FieldKey] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      const response = experience
        ? await updateExperience({ id: experience.id, ...parsed.data })
        : await createExperience(parsed.data);

      if (!response.success) {
        toast.error(response.error);
        return;
      }

      toast.success(isEditing ? 'Experience updated' : 'Experience created');
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Role */}
      <div className="space-y-1.5">
        <label htmlFor="experience-role" className="text-base font-medium">
          Role
        </label>
        <Input
          id="experience-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.role)}
          maxLength={150}
          placeholder="e.g. Software Engineering Intern"
          required
        />
        {errors.role && (
          <p className="text-xs text-destructive">{errors.role}</p>
        )}
      </div>

      {/* Company */}
      <div className="space-y-1.5">
        <label htmlFor="experience-company" className="text-base font-medium">
          Company
        </label>
        <Input
          id="experience-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.company)}
          maxLength={150}
          placeholder="e.g. Acme Corp"
          required
        />
        {errors.company && (
          <p className="text-xs text-destructive">{errors.company}</p>
        )}
      </div>

      {/* Company URL */}
      <div className="space-y-1.5">
        <label
          htmlFor="experience-company-url"
          className="text-base font-medium"
        >
          Company URL
        </label>
        <Input
          id="experience-company-url"
          type="url"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.company_url)}
          placeholder="https://example.com (optional)"
        />
        {errors.company_url && (
          <p className="text-xs text-destructive">{errors.company_url}</p>
        )}
      </div>

      {/* Period + Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="experience-period" className="text-base font-medium">
            Period
          </label>
          <Input
            id="experience-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(errors.period)}
            maxLength={100}
            placeholder="e.g. Jun 2024 – Sep 2024"
            required
          />
          {errors.period && (
            <p className="text-xs text-destructive">{errors.period}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-base font-medium">Type</label>
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as ExperienceKind)}
            disabled={isPending}
          >
            <SelectTrigger className="h-11 w-full rounded-lg px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.kind && (
            <p className="text-xs text-destructive">{errors.kind}</p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label htmlFor="experience-location" className="text-base font-medium">
          Location
        </label>
        <Input
          id="experience-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.location)}
          maxLength={150}
          placeholder="e.g. Berlin, Germany or Remote (optional)"
        />
        {errors.location && (
          <p className="text-xs text-destructive">{errors.location}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label
          htmlFor="experience-description"
          className="text-base font-medium"
        >
          Description
        </label>
        <Textarea
          id="experience-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.description)}
          rows={5}
          maxLength={5000}
          placeholder="One achievement per paragraph, separated by a blank line…"
          required
        />
        <p className="text-xs text-muted-foreground">
          Separate each achievement with a blank line — each block becomes a
          bullet point. A single block renders as a paragraph.
        </p>
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description}</p>
        )}
      </div>

      {/* Technologies */}
      <div className="space-y-1.5">
        <label
          htmlFor="experience-technologies"
          className="text-base font-medium"
        >
          Technologies
        </label>
        <Input
          id="experience-technologies"
          value={technologies}
          onChange={(e) => setTechnologies(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.technologies)}
          placeholder="Comma-separated, e.g. React, TypeScript, PostgreSQL"
        />
        {errors.technologies && (
          <p className="text-xs text-destructive">{errors.technologies}</p>
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
              : 'Create experience'}
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
