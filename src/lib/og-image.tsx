import { ImageResponse } from 'next/og';

import { getInitials, profile } from '@/lib/profile';

/**
 * Shared 1200×630 social card rendered by both the `opengraph-image` and
 * `twitter-image` route conventions. It pulls the name/title/location from
 * `@/lib/profile`, so the card updates automatically once the profile is
 * filled in — no static binary asset to regenerate.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';
export const OG_ALT = `${profile.name} — ${profile.title}`;

// Hex approximations of the dark theme (Satori, the engine behind
// ImageResponse, does not reliably support oklch()).
const BG = '#0d0b0a';
const FG = '#f5f4f1';
const GOLD = '#e6a23c';
const MUTED = '#a8a29b';

export function createOgImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BG,
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '88px',
            height: '88px',
            borderRadius: '20px',
            background: GOLD,
            color: BG,
            fontSize: '42px',
            fontWeight: 700,
          }}
        >
          {getInitials(profile.name)}
        </div>
        <div
          style={{
            display: 'flex',
            color: MUTED,
            fontSize: '26px',
            letterSpacing: '0.22em',
          }}
        >
          PORTFOLIO
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div
          style={{
            display: 'flex',
            color: FG,
            fontSize: '92px',
            fontWeight: 700,
            lineHeight: 1.04,
          }}
        >
          {profile.name}
        </div>
        <div
          style={{
            display: 'flex',
            color: GOLD,
            fontSize: '44px',
            fontWeight: 600,
          }}
        >
          {profile.title}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: MUTED,
          fontSize: '28px',
        }}
      >
        {profile.location}
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
