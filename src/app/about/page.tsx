import type { Metadata } from 'next';
import { Download } from 'lucide-react';

import { AboutContent } from '@/components/about/about-content';
import { ContactCards } from '@/components/about/contact-cards';
import { PageHeader } from '@/components/ui/page-header';
import { profile } from '@/lib/profile';
import { getExperiences } from '@/lib/queries/experience';
import { getSkills } from '@/lib/queries/skills';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Who I am, where I have worked, the technologies I use, and how to get in touch.',
};

export const revalidate = 3600;

export default async function AboutPage() {
  const [skills, experiences] = await Promise.all([
    getSkills(),
    getExperiences(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <PageHeader title="About" description={profile.bio} className="mb-12" />

      <AboutContent skills={skills} experiences={experiences} />

      {/* Contact */}
      <section className="border-t border-border py-16">
        <h2 className="mb-2">Get in touch</h2>
        <p
          className="mb-8 max-w-2xl text-muted-foreground"
          style={{ fontSize: '0.9rem', lineHeight: 1.7 }}
        >
          Open to new roles, collaborations, or just a friendly hello.
        </p>

        {profile.resumeUrl ? (
          <a
            href={profile.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-8 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontSize: '0.875rem' }}
          >
            <Download className="h-4 w-4" />
            Download résumé
          </a>
        ) : null}

        <ContactCards />
      </section>
    </div>
  );
}
