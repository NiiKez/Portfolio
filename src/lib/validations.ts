import { z } from 'zod';

/**
 * An optional URL field that must use https when provided.
 *
 * Accepts a string, `null`, or `undefined`. Input is trimmed first, so a blank
 * or whitespace-only value (a stray space left after deleting a URL, an
 * autofilled trailing space, etc.) is treated as empty and stored as `null` —
 * the field stays genuinely optional instead of failing with a spurious
 * "Invalid URL" error. A non-empty value must parse as a URL and start with
 * `https://`.
 *
 * `null` is normalized to empty so the schema is idempotent: the form validates
 * once on the client (turning an empty field into `null`) and sends that
 * already-normalized payload to the server action, which re-validates it. If
 * `null` were rejected here, that round-trip would fail with "Invalid input".
 */
const optionalHttpsUrl = z
  .preprocess(
    (value) => {
      if (value === null) return '';
      return typeof value === 'string' ? value.trim() : value;
    },
    z.union([
      z.url().refine((url) => url.startsWith('https://'), 'URL must use https'),
      z.literal(''),
    ]),
  )
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

export const proficiencySchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);

export const skillSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  category: z.string().trim().min(1, 'Category is required').max(50),
  proficiency: proficiencySchema,
});

export type SkillInput = z.infer<typeof skillSchema>;

export const experienceKindSchema = z.enum([
  'Internship',
  'Thesis',
  'Working Student',
  'Full-time',
  'Freelance',
]);

export const experienceSchema = z.object({
  role: z.string().trim().min(1, 'Role is required').max(150),
  company: z.string().trim().min(1, 'Company is required').max(150),
  company_url: optionalHttpsUrl,
  location: z
    .string()
    .trim()
    .max(150)
    .nullish()
    .transform((value) => (value === '' || value == null ? null : value)),
  period: z.string().trim().min(1, 'Period is required').max(100),
  kind: experienceKindSchema,
  description: z.string().trim().min(1, 'Description is required').max(5000),
  technologies: z
    .array(z.string().trim().min(1).max(50))
    .max(50)
    .optional()
    .default([]),
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

export const projectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  github_url: optionalHttpsUrl,
  live_url: optionalHttpsUrl,
  // Dedupe so a duplicate skill id can't violate the
  // project_technologies PK(project_id, skill_id) and roll back the whole
  // create/update RPC with a generic "Something went wrong".
  technology_ids: z
    .array(z.uuid())
    .optional()
    .default([])
    .transform((ids) => Array.from(new Set(ids))),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const reorderSchema = z
  .array(
    z.object({
      id: z.uuid(),
      sort_order: z.int().nonnegative().max(100000),
    }),
  )
  .max(200, 'Too many items');

export type ReorderInput = z.infer<typeof reorderSchema>;

export const screenshotSchema = z.object({
  alt_text: z.string().trim().max(200).optional(),
});

export type ScreenshotInput = z.infer<typeof screenshotSchema>;
