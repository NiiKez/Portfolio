# Portfolio

A full-stack developer portfolio built with **Next.js 16** (App Router) and **Supabase**.
It pairs a polished, animated public site with a complete, security-hardened **admin
panel** that manages all content — projects, skills, work experience, screenshots, and
demo videos — without touching code.

The public site is statically rendered with ISR; the admin panel is a server-action CMS
guarded by magic-link auth, an `ADMIN_EMAIL` gate, and Postgres Row-Level Security.

---

## Highlights

- **Next.js 16 / React 19 / TypeScript** (strict mode), **Tailwind CSS 4**.
- **Dark-mode-first** design using an OKLCH color system, fluid typography, and
  `framer-motion` (`motion`) animations that respect `prefers-reduced-motion`.
- **Supabase** for Postgres, Auth (magic link / OTP), and Storage (screenshots + videos).
- **Admin CMS** with drag-to-reorder lists, markdown editing, multi-image galleries, and
  large (100 MB) demo-video uploads via signed URLs.
- **Defense-in-depth security:** RLS as the real enforcement layer, an app-level admin
  check, magic-byte file sniffing, rate-limited OTP, CSRF same-origin checks, a strict CSP,
  and HSTS.
- **Optional site-wide password gate** (HTTP Basic Auth) for private preview deployments.
- **SEO out of the box:** dynamic sitemap, robots, and generated OpenGraph/Twitter images.
- **Tested** with Vitest + Testing Library + MSW, with per-file coverage gates.

---

## Tech stack

| Area        | Choice                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| Framework   | Next.js `16.2.6` (App Router, middleware, server actions, API routes, ISR)  |
| UI          | React `19.2.4`, TypeScript `5`, Tailwind CSS `4`, `@tailwindcss/typography` |
| Components  | `@base-ui/react`, `lucide-react` icons, `sonner` toasts, `next-themes`      |
| Animation   | `motion` (Framer Motion) `12`                                               |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable`                                       |
| Markdown    | `react-markdown` + `remark-gfm`                                             |
| Backend     | Supabase — `@supabase/supabase-js`, `@supabase/ssr`                         |
| Validation  | `zod` `4`                                                                   |
| Logging     | `winston`                                                                   |
| Testing     | `vitest` `4`, `@testing-library/react`, `msw`, `@vitest/coverage-v8`        |
| Tooling     | ESLint `9` (flat config), Prettier                                          |
| Runtime     | Node.js `>= 20`                                                             |

---

## Project structure

```
src/
├── app/                     # App Router routes
│   ├── page.tsx             # Home (/)
│   ├── about/               # About hub: bio + experience + tech stack + contact
│   ├── projects/            # Projects list + [id] detail (generateStaticParams + ISR)
│   ├── admin/               # Admin panel (gated by middleware)
│   ├── api/auth/send-otp/   # Rate-limited magic-link endpoint
│   ├── auth/                # callback / signout
│   ├── sitemap.ts, robots.ts
│   └── opengraph-image.tsx, twitter-image.tsx, icon.tsx, apple-icon.tsx
├── actions/                 # Server actions (projects, skills, experience, screenshots, videos)
├── components/
│   ├── home/  about/  projects/   # Public UI
│   ├── admin/                     # Admin forms, lists, uploaders, nav
│   └── ui/                        # Base UI wrappers (dialog, select, table, toaster)
├── lib/
│   ├── supabase/            # server (authenticated), admin (service-role), middleware clients
│   ├── queries/             # Public read helpers (projects, skills, experience)
│   ├── safe-action.ts       # Server-action wrapper: auth + Zod + logging
│   ├── validations.ts       # Zod schemas
│   ├── site-url.ts          # getBaseUrl() — canonical origin
│   ├── env.ts / env.client.ts  # Lazy, validated env access
│   └── rate-limit.ts, logger.ts, profile.ts, markdown.ts
├── middleware.ts            # Site password gate + admin session/route protection
├── types/                   # Domain + database types
└── __tests__/               # Vitest suites (mirrors src/)

supabase/migrations/         # Version-controlled SQL (applied manually — see below)
public/                      # Static assets
```

---

## Getting started

### Prerequisites

- Node.js `>= 20`
- A Supabase project (this repo shares one; see [Database & security](#database--security)).

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

| Variable                        | Scope             | Purpose                                                                  |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | public            | Supabase project URL                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public            | Supabase anon (public) key                                               |
| `NEXT_PUBLIC_SITE_URL`          | public            | Canonical origin — `http://localhost:3001` locally; **required** in prod |
| `ADMIN_EMAIL`                   | server            | The only email allowed into `/admin`                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | server (secret)   | Service-role key — used only for video upload URLs / cleanup             |
| `SITE_PASSWORD`                 | server (optional) | Enables the [site-wide password gate](#site-wide-password-gate) when set |

Env vars are validated lazily with Zod (`src/lib/env.ts`), so the build won't fail just
because a runtime secret is absent — access throws a clear error at first use instead.

### 3. Run

```bash
npm run dev      # http://localhost:3001  (note: port 3001, not 3000)
```

### Scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Dev server on port **3001**                 |
| `npm run build`   | Production build                            |
| `npm start`       | Start the production server (Node required) |
| `npm run lint`    | ESLint                                      |
| `npm run format`  | Prettier write / `format:check` to verify   |
| `npm test`        | Vitest (watch)                              |
| `npm run test:ci` | Vitest run with coverage                    |

> The app **cannot be statically exported** — it relies on middleware, server actions,
> API routes, and ISR, so it needs a Node.js server runtime (`next build && next start`).

---

## Public site

| Route            | What it renders                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `/`              | Hero (animated, with social links), featured projects (spotlight cards), and "daily driver" skills      |
| `/about`         | The hub: intro narrative, experience timeline, tech stack grouped by category, and contact cards        |
| `/projects`      | Filterable project list (filter pills by technology) with a sticky desktop preview pane                 |
| `/projects/[id]` | Project detail: demo video (with poster), screenshot gallery + lightbox, markdown body, live/repo links |

- **Rendering:** public pages use ISR (`revalidate = 3600`); project detail pages are
  pre-built via `generateStaticParams()` and revalidate on demand.
- **Media:** the gallery is a keyboard-accessible carousel with a focus-trapped lightbox;
  the demo video lazy-loads behind a poster image.
- **SEO:** `getBaseUrl()` (`src/lib/site-url.ts`) drives canonical URLs, the sitemap,
  robots (which disallows `/admin`), and the generated OpenGraph/Twitter images. It falls
  back to `http://localhost:3001` in dev and **throws in production** if
  `NEXT_PUBLIC_SITE_URL` is unset — so metadata can never silently point at localhost.
- **Theming:** dark-mode-first via `next-themes`, OKLCH colors, custom Google fonts
  (DM Serif Display / Instrument Sans / Geist Mono), and reduced-motion-aware animations.
- **Profile content** (name, bio, socials, location, résumé link) lives in
  `src/lib/profile.ts`; sections degrade gracefully when a field is unset (e.g. the email
  UI hides until a real address is provided).

---

## Admin panel

A complete content-management UI for the whole portfolio, mounted under `/admin` and
hidden from the public site (excluded from the header/footer, disallowed in robots).

### Access & authentication

- **Entry point:** `/admin/login` — a magic-link (email OTP) form.
- **Send OTP** (`POST /api/auth/send-otp`): rate-limited (per-IP and per-email) and
  protected by a same-origin CSRF check, then calls Supabase `signInWithOtp()` with a
  redirect to `/auth/callback`.
- **Callback** (`/auth/callback`): exchanges the code for a session and **immediately signs
  out** if the authenticated email doesn't equal `ADMIN_EMAIL`. Only the configured admin
  can hold a session.
- **Middleware** (`src/middleware.ts`): refreshes the Supabase session on every request and
  guards `/admin/*` — unauthenticated or non-admin users are redirected to `/admin/login`;
  an already-authenticated admin on the login page is sent to `/admin`.
- **Server-side defense:** every mutating action re-checks `user.email === ADMIN_EMAIL`
  via the `safeAction` wrapper, and **RLS is the ultimate gate** at the database layer — so
  even a bypassed middleware can't write data.

### What you can manage

| Page                   | Capabilities                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/admin`               | Dashboard: counts for projects / skills / experience + quick links                                                   |
| `/admin/projects`      | List with **drag-to-reorder**, edit, and delete (with confirmation)                                                  |
| `/admin/projects/[id]` | Create/edit a project: title, markdown description, live & GitHub URLs, technology tags, screenshots, and demo video |
| `/admin/skills`        | Create/edit/delete skills (name, category, proficiency) grouped by category, with reorder                            |
| `/admin/experience`    | Create/edit/delete work history (role, company, period, kind, location, description, tech), with reorder             |
| `/admin/settings`      | Reserved (placeholder)                                                                                               |

### Project editor features

- **Markdown description** via a dedicated editor; rendered with `remark-gfm` on the public detail page.
- **Technology tags:** multi-select toggle of existing skills, persisted in the
  `project_technologies` join table.
- **Screenshot uploader:** multi-file upload (JPEG/PNG/WebP, ≤ 5 MB each) with per-image
  alt text, drag-to-reorder, delete, and a "cover" badge on the first image (used as the
  card thumbnail). Magic bytes are sniffed client- and server-side.
- **Demo video uploader:** MP4/WebM up to **100 MB**. Because that's too large for a server
  action body, the browser requests a one-time **signed upload URL** (minted server-side
  with the service-role client) and streams directly to Storage; a failed finalize is
  cleaned up automatically.
- **Video poster picker:** either upload an image or **capture a frame** from the uploaded
  video (drawn to a canvas and exported as JPEG).

### Implementation notes

- **Server actions** (`src/actions/*`) are wrapped by `safeAction` — Zod validation, admin
  check, structured `ActionResponse<T>` results, and Winston logging — and call
  `revalidatePath()` for affected routes. UI feedback is surfaced with `sonner` toasts.
- **Drag-and-drop** uses `@dnd-kit` (keyboard-accessible) through a generic `SortableList`.
- **Atomic multi-step writes** go through `SECURITY INVOKER` Postgres RPCs so they're
  transactional **and still RLS-gated** (they do _not_ bypass auth):
  - `update_project_with_techs` — update the row and replace its tech links in one transaction.
  - `reorder_projects` / `reorder_skills` / `reorder_experiences` /
    `reorder_project_screenshots` — bulk reorder in a single statement.

---

## Database & security

The backend is a **Supabase** Postgres project. All app tables live in the `portfolio`
schema. (This project shares its Supabase instance with a separate app; portfolio code and
schema are kept isolated — see `CLAUDE.md` and `supabase/README.md`.)

### Schema

| Table                  | Notes                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `projects`             | title, description, `github_url`, `live_url`, `demo_video_path`, `demo_video_poster_path`, `sort_order` |
| `skills`               | name, category, `proficiency` (`beginner` / `intermediate` / `advanced`, CHECK), `sort_order`           |
| `experiences`          | role, company, `company_url`, location, period, kind, description, `technologies text[]`, `sort_order`  |
| `project_screenshots`  | `project_id` FK (CASCADE), `storage_path`, `alt_text`, `sort_order`                                     |
| `project_technologies` | join table, `PK(project_id, skill_id)`, both FKs CASCADE                                                |
| `app_config`           | key/value; holds `admin_email`. RLS on with **no policies** (clients can't read it)                     |

FKs are indexed and cascade on delete; `updated_at` triggers exist on
projects/skills/experiences. The original DDL is version-controlled in
`supabase/migrations/20260603000000_baseline_schema.sql`.

### Row-Level Security (public read, admin write)

Every content table has exactly two policies:

- **`public_read`** — `SELECT` for `anon, authenticated`, `using (true)`.
- **`admin_write`** — `ALL` for `authenticated`, gated by `portfolio.is_admin()`.

`portfolio.is_admin()` is a `SECURITY DEFINER` function that returns true only when the
caller's verified JWT email matches the `admin_email` row in `portfolio.app_config`. Because
that table has RLS with no policies, only the definer function can read it.

> An earlier design gated writes on the `app.admin_email` Postgres GUC, but managed Supabase
> denies `ALTER DATABASE ... SET` to the dashboard role, so those policies failed closed. The
> `app_config` table replaces that approach. **To change the admin identity, update both** the
> `ADMIN_EMAIL` env var **and** the `app_config` row.

### Storage

Two public-read, admin-write buckets on `storage.objects`, gated by the same
`portfolio.is_admin()`:

- **`screenshots`** — project gallery images and video posters; uploaded via the
  **authenticated** client (RLS-enforced).
- **`videos`** — demo videos (≤ 100 MB, MP4/WebM); uploaded via the **service-role** client
  because signed upload URLs are minted server-side. The RLS policies remain a
  defense-in-depth backstop.

### Migration workflow

Migrations in `supabase/migrations/` are the **version-control record** of SQL that is
**applied manually** via the Supabase Dashboard → SQL Editor — there is no `supabase db
push` and nothing auto-applies them. Each file is written **idempotently**
(`create ... if not exists`, `drop policy if exists` before `create policy`,
`create or replace function`) so a manual re-run is a safe no-op. To make a change: write the
file, run it in the dashboard, verify, then commit.

---

## Site-wide password gate

An **optional** HTTP Basic Auth lock for private preview deployments, implemented in
`src/middleware.ts`.

- **Enabled only when `SITE_PASSWORD` is set.** Unset (the default) → the gate is a no-op
  with zero impact on local dev or a public launch.
- When enabled, every request must carry `Authorization: Basic base64("admin:<SITE_PASSWORD>")`;
  otherwise the middleware returns `401` with a `WWW-Authenticate` challenge. The comparison is
  constant-time and responses are `no-store`.
- **`/auth/*` routes are exempt** so magic-link callbacks still work from an email client.
- The gate runs **before** auth — admin routes still additionally require the
  `ADMIN_EMAIL` session. Covered by tests in `src/__tests__/middleware.test.ts`.

---

## Testing

- **Vitest** with `happy-dom`, `@testing-library/react`, and **MSW** for mocked Supabase
  requests. Tests live in `src/__tests__/` (mirroring the source tree).
- **Coverage** (v8) is enforced **per file**: 80% statements/branches/lines and a 55%
  functions floor (the functions floor is intentionally loose — v8 counts inline callbacks).
  UI components, page/layout files, and thin factories are excluded.

```bash
npm run test:ci   # single run with coverage
```
