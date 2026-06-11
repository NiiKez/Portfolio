import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center px-6 text-center">
      <h1
        className="mb-4"
        style={{
          fontSize: '5rem',
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.04em',
        }}
      >
        404
      </h1>
      <p className="mb-8 text-muted-foreground">Page not found.</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ fontSize: '0.9rem', fontWeight: 500 }}
      >
        Go Home
      </Link>
    </div>
  );
}
