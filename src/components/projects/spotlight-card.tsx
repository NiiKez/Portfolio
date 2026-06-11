'use client';

import { useRef } from 'react';

type SpotlightCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SpotlightCard({
  children,
  className = '',
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--gx', `${e.clientX - rect.left}px`);
    ref.current.style.setProperty('--gy', `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/25 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(350px circle at var(--gx, 50%) var(--gy, 50%), oklch(0.74 0.16 48 / 0.07), transparent 65%)',
        }}
      />
      {children}
    </div>
  );
}
