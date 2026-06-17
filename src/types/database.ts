/**
 * Schema-typed `Database` definition for the Supabase clients.
 *
 * Hand-maintained to mirror the live `portfolio` schema (the project applies
 * migrations manually — there is no `supabase gen types` step here). Wiring this
 * into the clients (`createClient<Database, 'portfolio'>`) makes `.from()`,
 * `.insert()`, `.update()`, `.eq('col', ...)`, embedded selects, and `.rpc()`
 * type-checked against the real columns, so a schema/column rename surfaces at
 * compile time instead of at runtime.
 *
 * Keep this in sync when adding migrations that change columns, tables, or RPCs.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Proficiency = 'beginner' | 'intermediate' | 'advanced';
type ExperienceKind =
  | 'Internship'
  | 'Thesis'
  | 'Working Student'
  | 'Full-time'
  | 'Freelance';

export type Database = {
  portfolio: {
    Tables: {
      projects: {
        Row: {
          id: string;
          title: string;
          description: string;
          github_url: string | null;
          live_url: string | null;
          demo_video_path: string | null;
          demo_video_poster_path: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          github_url?: string | null;
          live_url?: string | null;
          demo_video_path?: string | null;
          demo_video_poster_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          github_url?: string | null;
          live_url?: string | null;
          demo_video_path?: string | null;
          demo_video_poster_path?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          name: string;
          category: string;
          proficiency: Proficiency;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          proficiency: Proficiency;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          proficiency?: Proficiency;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      experiences: {
        Row: {
          id: string;
          role: string;
          company: string;
          company_url: string | null;
          location: string | null;
          period: string;
          kind: ExperienceKind;
          description: string;
          technologies: string[];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          company: string;
          company_url?: string | null;
          location?: string | null;
          period: string;
          kind: ExperienceKind;
          description: string;
          technologies?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          company?: string;
          company_url?: string | null;
          location?: string | null;
          period?: string;
          kind?: ExperienceKind;
          description?: string;
          technologies?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_screenshots: {
        Row: {
          id: string;
          project_id: string;
          storage_path: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          storage_path: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          storage_path?: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_screenshots_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_technologies: {
        Row: {
          project_id: string;
          skill_id: string;
        };
        Insert: {
          project_id: string;
          skill_id: string;
        };
        Update: {
          project_id?: string;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_technologies_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_technologies_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      app_config: {
        Row: {
          key: string;
          value: string;
        };
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
        Relationships: [];
      };
      page_views: {
        Row: {
          id: number;
          path: string;
          referrer: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          path: string;
          referrer?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          path?: string;
          referrer?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      reorder_projects: {
        Args: { items: Json };
        Returns: undefined;
      };
      reorder_skills: {
        Args: { items: Json };
        Returns: undefined;
      };
      reorder_experiences: {
        Args: { items: Json };
        Returns: undefined;
      };
      reorder_project_screenshots: {
        Args: { items: Json };
        Returns: undefined;
      };
      update_project_with_techs: {
        Args: {
          p_id: string;
          p_title: string;
          p_description: string;
          p_github_url: string | null;
          p_live_url: string | null;
          p_technology_ids: string[];
        };
        Returns: Database['portfolio']['Tables']['projects']['Row'];
      };
      page_view_summary: {
        Args: { p_days?: number };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
