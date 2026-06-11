'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { deleteProject, reorderProjects } from '@/actions/projects';
import { SortableList } from '@/components/admin/sortable-list';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProjectWithDetails } from '@/types';

/** Strip markdown syntax for a plain-text preview excerpt. */
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

type ProjectListProps = {
  initialProjects: ProjectWithDetails[];
};

export function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [pendingDelete, setPendingDelete] = useState<ProjectWithDetails | null>(
    null,
  );
  const [isDeleting, startDeleteTransition] = useTransition();
  const [, startReorderTransition] = useTransition();

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  function handleReorder(reordered: ProjectWithDetails[]) {
    const previous = projects;
    setProjects(reordered);
    startReorderTransition(async () => {
      const items = reordered.map((p, i) => ({ id: p.id, sort_order: i }));
      const response = await reorderProjects(items);
      if (!response.success) {
        toast.error(response.error);
        setProjects(previous);
      }
    });
  }

  function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;

    startDeleteTransition(async () => {
      const response = await deleteProject({ id: target.id });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      toast.success(`Deleted "${target.title}"`);
      setPendingDelete(null);
    });
  }

  return (
    <div>
      {/* Page header */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-medium tracking-normal">
            Projects
          </h1>
          <p className="text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          size="lg"
          className="px-4"
          render={<Link href="/admin/projects/new" />}
        >
          <PlusIcon />
          Add Project
        </Button>
      </header>

      {/* Project list body */}
      {projects.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No projects yet. Add your first one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          <SortableList
            items={projects}
            onReorder={handleReorder}
            renderItem={(project, dragHandle, rowProps) => {
              const excerpt = stripMarkdown(project.description).slice(0, 140);
              return (
                <div
                  ref={rowProps.ref as React.RefCallback<HTMLDivElement>}
                  style={rowProps.style}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/30"
                >
                  {/* Drag handle */}
                  <span className="shrink-0 text-muted-foreground">
                    {dragHandle}
                  </span>

                  {/* Content */}
                  <div className="mr-4 min-w-0 flex-1">
                    <h3 className="mb-1 truncate font-sans text-base font-medium">
                      {project.title}
                    </h3>
                    {excerpt && (
                      <p className="truncate text-[0.85rem] text-muted-foreground">
                        {excerpt}
                      </p>
                    )}
                    {project.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {project.technologies.map((tech) => (
                          <span
                            key={tech.id}
                            className="rounded-md bg-accent px-2 py-0.5 text-[0.7rem] text-accent-foreground"
                          >
                            {tech.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={
                        <Link
                          href={`/admin/projects/${project.id}`}
                          aria-label={`Edit ${project.title}`}
                        />
                      }
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingDelete(project)}
                      aria-label={`Delete ${project.title}`}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" and all its screenshots will be permanently removed.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={isDeleting}>
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
