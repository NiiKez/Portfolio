'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { deleteExperience, reorderExperiences } from '@/actions/experience';
import { ExperienceForm } from '@/components/admin/experience-form';
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
import type { Experience } from '@/types';

type FormDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; experience: Experience };

type ExperienceListProps = {
  initialExperiences: Experience[];
};

export function ExperienceList({ initialExperiences }: ExperienceListProps) {
  const [experiences, setExperiences] = useState(initialExperiences);
  const [formState, setFormState] = useState<FormDialogState>({
    mode: 'closed',
  });
  const [pendingDelete, setPendingDelete] = useState<Experience | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [, startReorderTransition] = useTransition();

  useEffect(() => {
    setExperiences(initialExperiences);
  }, [initialExperiences]);

  function handleReorder(reordered: Experience[]) {
    const previous = experiences;
    setExperiences(reordered);
    startReorderTransition(async () => {
      const items = reordered.map((e, i) => ({ id: e.id, sort_order: i }));
      const response = await reorderExperiences(items);
      if (!response.success) {
        toast.error(response.error);
        setExperiences(previous);
      }
    });
  }

  function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;

    startDeleteTransition(async () => {
      const response = await deleteExperience({ id: target.id });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      toast.success(`Deleted "${target.role}"`);
      setPendingDelete(null);
    });
  }

  return (
    <div>
      {/* Page header */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-medium tracking-normal">
            Experience
          </h1>
          <p className="text-muted-foreground">
            {experiences.length} entr{experiences.length !== 1 ? 'ies' : 'y'}{' '}
            total
          </p>
        </div>
        <Button
          size="lg"
          className="px-4"
          onClick={() => setFormState({ mode: 'create' })}
        >
          <PlusIcon />
          Add Experience
        </Button>
      </header>

      {/* Experience list body */}
      {experiences.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No experience yet. Add your first entry to get started.
        </div>
      ) : (
        <div className="space-y-2">
          <SortableList
            items={experiences}
            onReorder={handleReorder}
            renderItem={(experience, dragHandle, rowProps) => (
              <div
                ref={rowProps.ref as React.RefCallback<HTMLDivElement>}
                style={rowProps.style}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
              >
                {/* Drag handle */}
                <span className="shrink-0 text-muted-foreground">
                  {dragHandle}
                </span>

                {/* Summary */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {experience.role}
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-secondary-foreground">
                      {experience.kind}
                    </span>
                  </div>
                  <p className="truncate text-[0.85rem] text-muted-foreground">
                    {experience.company} · {experience.period}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFormState({ mode: 'edit', experience })}
                    aria-label={`Edit ${experience.role}`}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingDelete(experience)}
                    aria-label={`Delete ${experience.role}`}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={formState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setFormState({ mode: 'closed' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formState.mode === 'edit' ? 'Edit experience' : 'New experience'}
            </DialogTitle>
            <DialogDescription>
              {formState.mode === 'edit'
                ? 'Update the details for this experience entry.'
                : 'Add a new entry to your work history.'}
            </DialogDescription>
          </DialogHeader>
          {formState.mode !== 'closed' && (
            <ExperienceForm
              experience={
                formState.mode === 'edit' ? formState.experience : undefined
              }
              onSuccess={() => setFormState({ mode: 'closed' })}
              onCancel={() => setFormState({ mode: 'closed' })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete experience?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.role}" at ${pendingDelete.company} will be removed from your portfolio.`
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
