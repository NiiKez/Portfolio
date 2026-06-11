'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { toast } from 'sonner';

import { createProject, updateProject } from '@/actions/projects';
import { MarkdownEditor } from '@/components/admin/markdown-editor';
import { ScreenshotUploader } from '@/components/admin/screenshot-uploader';
import { VideoUploader } from '@/components/admin/video-uploader';
import { GitHubIcon } from '@/components/icons/social-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectSchema } from '@/lib/validations';
import type { ProjectWithDetails, Skill } from '@/types';

type ProjectFormProps = {
  project?: ProjectWithDetails;
  allSkills: Skill[];
};

type FieldErrors = Partial<
  Record<
    'title' | 'description' | 'github_url' | 'live_url' | 'technology_ids',
    string
  >
>;

export function ProjectForm({ project, allSkills }: ProjectFormProps) {
  const router = useRouter();
  const isEditing = Boolean(project);

  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [githubUrl, setGithubUrl] = useState(project?.github_url ?? '');
  const [liveUrl, setLiveUrl] = useState(project?.live_url ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(project?.technologies.map((t) => t.id) ?? []),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  function toggleSkill(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = projectSchema.safeParse({
      title,
      description,
      github_url: githubUrl,
      live_url: liveUrl,
      technology_ids: Array.from(selectedIds),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === 'title' ||
          key === 'description' ||
          key === 'github_url' ||
          key === 'live_url' ||
          key === 'technology_ids'
        ) {
          next[key] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      const response = project
        ? await updateProject({ id: project.id, ...parsed.data })
        : await createProject(parsed.data);

      if (!response.success) {
        toast.error(response.error);
        return;
      }

      toast.success(isEditing ? 'Project updated' : 'Project created');
      router.push('/admin/projects');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="project-title" className="text-base font-medium">
          Title
        </label>
        <Input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(errors.title)}
          maxLength={200}
          required
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="project-description" className="text-base font-medium">
          Description
        </label>
        <MarkdownEditor
          id="project-description"
          value={description}
          onChange={setDescription}
          disabled={isPending}
          aria-invalid={Boolean(errors.description)}
          maxLength={5000}
          rows={12}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="project-live" className="text-base font-medium">
          Live URL{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="relative">
          <Globe
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="project-live"
            type="url"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(errors.live_url)}
            aria-describedby="project-live-hint"
            placeholder="https://your-project.com"
            className="pl-9"
          />
        </div>
        {errors.live_url ? (
          <p className="text-xs text-destructive">{errors.live_url}</p>
        ) : (
          <p id="project-live-hint" className="text-xs text-muted-foreground">
            The deployed site or live demo. Shown as a prominent “Visit live
            site” button on the project page.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="project-github" className="text-base font-medium">
          GitHub URL{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="relative">
          <GitHubIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="project-github"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(errors.github_url)}
            placeholder="https://github.com/…"
            className="pl-9"
          />
        </div>
        {errors.github_url && (
          <p className="text-xs text-destructive">{errors.github_url}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-base font-medium">Technologies</p>
        {allSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No skills yet. Add skills first to associate them with projects.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allSkills.map((skill) => {
              const checked = selectedIds.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  disabled={isPending}
                  aria-pressed={checked}
                  className={`rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium transition-colors focus-visible:border-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                    checked
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {skill.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isEditing && project ? (
        <>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Screenshots</p>
            <ScreenshotUploader
              projectId={project.id}
              initialScreenshots={project.screenshots}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Demo video</p>
            <VideoUploader
              projectId={project.id}
              initialVideoPath={project.demo_video_path}
              initialPosterPath={project.demo_video_poster_path}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Screenshots &amp; demo video</p>
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Create the project first, then add images and a demo video on its
            edit page. The first image becomes the cover shown on cards.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending
            ? isEditing
              ? 'Saving…'
              : 'Creating…'
            : isEditing
              ? 'Save changes'
              : 'Create project'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/projects')}
          disabled={isPending}
          className="px-4"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
