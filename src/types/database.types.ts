export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      episodes: {
        Row: {
          audio_path: string;
          created_at: string;
          description: string | null;
          duration: number | null;
          episode_number: number | null;
          id: string;
          published: boolean;
          series_id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          audio_path: string;
          created_at?: string;
          description?: string | null;
          duration?: number | null;
          episode_number?: number | null;
          id?: string;
          published?: boolean;
          series_id: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          audio_path?: string;
          created_at?: string;
          description?: string | null;
          duration?: number | null;
          episode_number?: number | null;
          id?: string;
          published?: boolean;
          series_id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
      series: {
        Row: {
          category_id: string | null;
          cover_image: string | null;
          created_at: string;
          description: string | null;
          featured: boolean;
          id: string;
          published: boolean;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          cover_image?: string | null;
          created_at?: string;
          description?: string | null;
          featured?: boolean;
          id?: string;
          published?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          cover_image?: string | null;
          created_at?: string;
          description?: string | null;
          featured?: boolean;
          id?: string;
          published?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type Series = Database['public']['Tables']['series']['Row'] & {
  category?: Category | null;
  episodes_count?: number;
};
export type SeriesInsert = Database['public']['Tables']['series']['Insert'];
export type SeriesUpdate = Database['public']['Tables']['series']['Update'];

export type Episode = Database['public']['Tables']['episodes']['Row'] & {
  series?: Series | null;
};
export type EpisodeInsert = Database['public']['Tables']['episodes']['Insert'];
export type EpisodeUpdate = Database['public']['Tables']['episodes']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
