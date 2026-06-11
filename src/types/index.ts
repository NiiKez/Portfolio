export type Proficiency = 'beginner' | 'intermediate' | 'advanced';

export type Skill = {
  id: string;
  name: string;
  category: string;
  proficiency: Proficiency;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ExperienceKind =
  | 'Internship'
  | 'Thesis'
  | 'Working Student'
  | 'Full-time'
  | 'Freelance';

export type Experience = {
  id: string;
  role: string;
  company: string;
  company_url: string | null;
  location: string | null;
  period: string;
  kind: ExperienceKind;
  /** Raw text; each non-empty line renders as a bullet on the About page. */
  description: string;
  technologies: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  github_url: string | null;
  live_url: string | null;
  /** Path to the project's demo video inside the `videos` storage bucket. */
  demo_video_path: string | null;
  /**
   * Path (inside the `screenshots` bucket) to the still shown before the demo
   * video plays. Independent of the gallery screenshots — uploaded directly or
   * captured from a video frame. Null = show the video's own first frame.
   */
  demo_video_poster_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectScreenshot = {
  id: string;
  project_id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
};

export type ProjectWithDetails = Project & {
  screenshots: ProjectScreenshot[];
  technologies: Skill[];
};
