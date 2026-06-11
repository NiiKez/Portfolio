import { ImageResponse } from 'next/og';

import { getInitials, profile } from '@/lib/profile';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e6a23c',
        color: '#0d0b0a',
        fontSize: 92,
        fontWeight: 700,
        borderRadius: 40,
        fontFamily: 'sans-serif',
      }}
    >
      {getInitials(profile.name)}
    </div>,
    { ...size },
  );
}
