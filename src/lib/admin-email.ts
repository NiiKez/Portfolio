import 'server-only';

import { env } from '@/lib/env';

/**
 * Case-insensitive, whitespace-tolerant admin-email check shared by every
 * app-layer authorization gate (middleware, `safeAction`, the auth callback,
 * and the two hand-rolled storage actions `uploadScreenshot` /
 * `setProjectVideoPoster`).
 *
 * Email addresses are effectively case-insensitive and Supabase stores them
 * lowercased, but the configured `ADMIN_EMAIL` env value could carry mixed case
 * or stray whitespace. Normalizing BOTH sides keeps this app-layer gate from
 * silently desyncing from the DB `portfolio.is_admin()` RLS check — a casing
 * mismatch would otherwise lock the real admin out of the UI (gate fails closed)
 * while RLS still decided differently, an avoidable foot-gun. RLS remains the
 * real enforcement layer; this gate is defence-in-depth.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return normalize(email) === normalize(env.ADMIN_EMAIL);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
