'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { TRACK_ENDPOINT, isKnownPublicRoute } from '@/lib/analytics';

/**
 * Fires one privacy-friendly page-view beacon per client-side navigation.
 *
 * Mounted once in the root layout. It uses `navigator.sendBeacon` (which
 * survives page unload and never blocks navigation), falling back to a
 * `keepalive` fetch. The payload is same-origin, carries no cookies, and sends
 * only the pathname plus `document.referrer`; the server reduces the referrer to
 * a bare host and stores nothing else. Admin/API paths are never tracked, and a
 * ref dedupes a repeat effect run for the same path (e.g. React Strict Mode's
 * double-invoked mount effect in dev).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const firstFire = useRef(true);

  useEffect(() => {
    // Only beacon the site's real routes — a 404/scanner-probe path (`/cmd_sco`
    // …) never reaches the server, and the ingest re-checks authoritatively.
    if (!pathname || !isKnownPublicRoute(pathname)) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    // `document.referrer` is the external entry referrer and never updates on
    // client-side (pushState) navigation. Attach it only to the FIRST beacon of
    // the session — re-sending it on every in-app nav would re-count one
    // external referral once per page browsed, inflating the referrer report.
    const referrer = firstFire.current
      ? document.referrer || undefined
      : undefined;
    firstFire.current = false;

    const payload = JSON.stringify({ path: pathname, referrer });

    try {
      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(
          TRACK_ENDPOINT,
          new Blob([payload], { type: 'application/json' }),
        );
      } else {
        void fetch(TRACK_ENDPOINT, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Analytics must never break navigation.
    }
  }, [pathname]);

  return null;
}
