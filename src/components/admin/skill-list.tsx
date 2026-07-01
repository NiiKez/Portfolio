'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { deleteSkill, reorderSkills } from '@/actions/skills';
import { SkillForm } from '@/components/admin/skill-form';
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
import type { Proficiency, Skill } from '@/types';

const PROFICIENCY_LABEL: Record<Proficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const PROFICIENCY_PERCENT: Record<Proficiency, number> = {
  beginner: 33,
  intermediate: 66,
  advanced: 100,
};

type FormDialogState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; skill: Skill };

type SkillListProps = {
  initialSkills: Skill[];
};

export function SkillList({ initialSkills }: SkillListProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [formState, setFormState] = useState<FormDialogState>({
    mode: 'closed',
  });
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [, startReorderTransition] = useTransition();

  useEffect(() => {
    setSkills(initialSkills);
  }, [initialSkills]);

  function handleReorder(reordered: Skill[]) {
    const previous = skills;
    setSkills(reordered);
    startReorderTransition(async () => {
      const items = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
      const response = await reorderSkills(items);
      if (!response.success) {
        toast.error(response.error);
        setSkills(previous);
      }
    });
  }

  function handleCategoryReorder(category: string, reordered: Skill[]) {
    const categoryOrder = Array.from(new Set(skills.map((s) => s.category)));
    const grouped = new Map<string, Skill[]>();
    for (const cat of categoryOrder) {
      grouped.set(
        cat,
        skills.filter((s) => s.category === cat),
      );
    }
    grouped.set(category, reordered);
    const merged = categoryOrder.flatMap((cat) => grouped.get(cat) ?? []);
    handleReorder(merged);
  }

  function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;

    startDeleteTransition(async () => {
      const response = await deleteSkill({ id: target.id });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      toast.success(`Deleted "${target.name}"`);
      setPendingDelete(null);
    });
  }

  const categories = Array.from(new Set(skills.map((s) => s.category)));
  const uniqueCategories = Array.from(
    new Set(initialSkills.map((s) => s.category)),
  );

  return (
    <div>
      {/* Page header */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-medium tracking-normal">
            Skills
          </h1>
          <p className="text-muted-foreground">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          size="lg"
          className="px-4"
          onClick={() => setFormState({ mode: 'create' })}
        >
          <PlusIcon />
          Add Skill
        </Button>
      </header>

      {/* Skill list body */}
      {skills.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No skills yet. Add your first one to get started.
        </div>
      ) : (
        <div>
          {categories.map((category) => {
            const categorySkills = skills.filter(
              (s) => s.category === category,
            );
            return (
              <section key={category} className="mb-8">
                <h3 className="mb-4 font-sans text-base text-muted-foreground">
                  {category}
                </h3>
                <div className="space-y-2">
                  <SortableList
                    items={categorySkills}
                    onReorder={(reordered) =>
                      handleCategoryReorder(category, reordered)
                    }
                    renderItem={(skill, dragHandle, rowProps) => (
                      <div
                        ref={rowProps.ref as React.RefCallback<HTMLDivElement>}
                        style={rowProps.style}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
                      >
                        {/* Drag handle */}
                        <span className="shrink-0 text-muted-foreground">
                          {dragHandle}
                        </span>

                        {/* Name + progress bar */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="truncate">{skill.name}</span>
                            <span className="shrink-0 text-[0.8rem] text-muted-foreground">
                              {PROFICIENCY_LABEL[skill.proficiency]}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${PROFICIENCY_PERCENT[skill.proficiency]}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setFormState({ mode: 'edit', skill })
                            }
                            aria-label={`Edit ${skill.name}`}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPendingDelete(skill)}
                            aria-label={`Delete ${skill.name}`}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </section>
            );
          })}
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
              {formState.mode === 'edit' ? 'Edit skill' : 'New skill'}
            </DialogTitle>
            <DialogDescription>
              {formState.mode === 'edit'
                ? 'Update the details for this skill.'
                : 'Add a new skill to your portfolio.'}
            </DialogDescription>
          </DialogHeader>
          {formState.mode !== 'closed' && (
            <SkillForm
              skill={formState.mode === 'edit' ? formState.skill : undefined}
              categories={uniqueCategories}
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
            <DialogTitle>Delete skill?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed from your portfolio and any projects linked to it.`
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
