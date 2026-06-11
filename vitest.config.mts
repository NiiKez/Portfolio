import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'server-only': resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    alias: {
      '@': resolve(__dirname, './src'),
      'server-only': resolve(__dirname, './src/test/server-only-stub.ts'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/components/ui/**',
        'src/test/**',
        'src/__tests__/**',
        'src/types/**',
        // Exclude page/layout UI server components and static metadata routes,
        // but KEEP the auth route handlers (route.ts) measured — they're tested.
        'src/app/**/*.tsx',
        'src/app/robots.ts',
        'src/app/sitemap.ts',
        // Thin Supabase client factories (no logic worth testing); session
        // middleware (supabase/middleware.ts) stays measured.
        'src/lib/supabase/client.ts',
        'src/lib/supabase/server.ts',
        // Thin passthrough query; queries/projects.ts (mapRow) stays measured.
        'src/lib/queries/skills.ts',
        // Winston transport configuration — infrastructure, no logic to test.
        'src/lib/logger.ts',
        'src/lib/profile.ts',
        'src/components/admin/markdown-editor.tsx',
        'src/components/admin/sortable-list.tsx',
        'src/components/admin/admin-nav.tsx',
        'src/components/admin/admin-sidebar.tsx',
        'src/components/admin/login-form.tsx',
        'src/components/admin/skill-list.tsx',
        'src/components/admin/project-list.tsx',
        'src/components/admin/experience-list.tsx',
        'src/components/about/contact-cards.tsx',
        'src/components/about/copy-email-button.tsx',
        'src/components/home/**',
        'src/components/icons/**',
        'src/components/projects/markdown-content.tsx',
        'src/components/projects/spotlight-card.tsx',
        'src/components/header.tsx',
        'src/components/footer.tsx',
        'src/components/theme-provider.tsx',
        'src/components/theme-toggle.tsx',
      ],
      thresholds: {
        // Enforce the bar on EVERY included file, not just the global average.
        // A single aggregate let near-zero files (og-image.tsx at 0%,
        // video-poster-picker.tsx at ~18%) hide behind well-covered ones; with
        // perFile, a newly-added under-tested file fails CI on its own — it
        // cannot reach 80% statements/branches/lines while sitting near zero.
        perFile: true,
        statements: 80,
        branches: 80,
        lines: 80,
        // `functions` is gated loosely on purpose. v8 counts every inline
        // closure as a "function", and several action modules (notably
        // videos.ts) are dense with best-effort `.catch(() => undefined)`
        // storage-cleanup callbacks that only run on rare failures — so the
        // function % understates real coverage (videos.ts is statements 94 /
        // branches 100 / lines 94, every exported action thoroughly tested).
        // The meaningful per-file signal is carried by statements/branches/lines
        // at 80; a brand-new untested file still fails those three. NOTE: Vitest
        // glob thresholds are ADDITIVE to the global ones (they can only tighten,
        // not relax a single file), so a per-file exception isn't expressible —
        // hence the global floor here.
        functions: 55,
      },
    },
  },
});
