type Profile = {
  name: string;
  title: string;
  bio: string;
  /** Longer narrative shown at the top of the About page. */
  about: string;
  email: string;
  github: string;
  linkedin: string;
  location: string;
  /** Optional path to a résumé/CV (e.g. '/resume.pdf' placed in /public). */
  resumeUrl?: string;
};

/**
 * Seeded placeholder for {@link Profile.email}. Replace it with your real
 * address to surface the contact email; while it's still this value the email
 * UI stays hidden (see {@link hasContactEmail}).
 */
const EMAIL_PLACEHOLDER = 'you@example.com';

export const profile: Profile = {
  name: 'Fatih Dev Portfolio',
  title: 'Software Engineer',
  bio: 'I build modern applications with a focus on clean code, great user experiences, and scalable architecture.',
  about: 'TODO',
  // Real contact address — every email affordance (the About contact card, the
  // footer + hero mail icons) is now live because this differs from
  // EMAIL_PLACEHOLDER, so `hasContactEmail()` returns true. Reset it to
  // EMAIL_PLACEHOLDER to hide them again.
  email: 'oncufatih26@gmail.com',
  github: 'https://github.com/NiiKez',
  linkedin: 'https://www.linkedin.com/in/fatih-oe/',
  location: 'Germany/Remote',
  // TODO: drop a PDF in /public and set e.g. '/resume.pdf' to show a
  // "Download résumé" button. Leave empty to hide the button.
  resumeUrl: '',
};

/**
 * True once {@link Profile.email} holds a real address — i.e. it's been filled
 * in and is no longer blank or the {@link EMAIL_PLACEHOLDER} seed. The contact
 * card, footer icon and hero icon all gate on this so a not-yet-set address
 * never renders a dead `mailto:` link.
 */
export function hasContactEmail(): boolean {
  const email = profile.email.trim();
  return email.length > 0 && email !== EMAIL_PLACEHOLDER;
}

/**
 * Initials derived from a name, used for the generated favicon/app icons.
 * Falls back to 'P' (Portfolio) when the name is empty.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  const initials = last ? first.charAt(0) + last.charAt(0) : first.slice(0, 2);
  return initials.toUpperCase() || 'P';
}
