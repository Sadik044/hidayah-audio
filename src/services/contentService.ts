import { supabase, getCoverImageUrl } from '../lib/supabase';
import type { Category, Series, Episode } from '../types/database.types';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export { getCoverImageUrl };

/**
 * Fetches all categories ordered alphabetically by name.
 * Note: Database schema does not have a `published` column on categories.
 */
export async function fetchCategories(): Promise<ServiceResult<Category[]>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error.message);
      return { data: [], error: 'ক্যাটাগরি তালিকা লোড করা সম্ভব হয়নি।' };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching categories:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Fetches featured series that are explicitly published.
 */
export async function fetchFeaturedSeries(limit = 4): Promise<ServiceResult<Series[]>> {
  try {
    const { data, error } = await supabase
      .from('series')
      .select('*, category:category_id(*)')
      .eq('published', true)
      .eq('featured', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching featured series:', error.message);
      return { data: [], error: 'ফিচার্ড সিরিজ লোড করা সম্ভব হয়নি।' };
    }

    return { data: (data as Series[]) || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching featured series:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Fetches recent series that are explicitly published.
 */
export async function fetchRecentSeries(limit = 6): Promise<ServiceResult<Series[]>> {
  try {
    const { data, error } = await supabase
      .from('series')
      .select('*, category:category_id(*)')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent series:', error.message);
      return { data: [], error: 'সাম্প্রতিক সিরিজ লোড করা সম্ভব হয়নি।' };
    }

    return { data: (data as Series[]) || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching recent series:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

export interface SeriesListFilter {
  categoryId?: string | null;
  search?: string;
}

/**
 * Fetches series list with optional category filter.
 * Strictly enforces published = true.
 */
export async function fetchSeriesList(filter?: SeriesListFilter): Promise<ServiceResult<Series[]>> {
  try {
    let query = supabase
      .from('series')
      .select('*, category:category_id(*)')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }

    if (filter?.search) {
      const trimmed = filter.search.trim();
      if (trimmed) {
        query = query.or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching series list:', error.message);
      return { data: [], error: 'সিরিজ তালিকা লোড করা সম্ভব হয়নি।' };
    }

    return { data: (data as Series[]) || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching series list:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Fetches a single series by its unique ID.
 * Strictly verifies published = true.
 */
export async function fetchSeriesById(id: string): Promise<ServiceResult<Series>> {
  try {
    const { data, error } = await supabase
      .from('series')
      .select('*, category:category_id(*)')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching series by ID:', error.message);
      return { data: null, error: 'সিরিজের তথ্য লোড করা যায়নি।' };
    }

    if (!data) {
      return { data: null, error: 'সিরিজটি খুঁজে পাওয়া যায়নি অথবা এটি অপ্রকাশিত।' };
    }

    return { data: data as Series, error: null };
  } catch (err) {
    console.error('Unexpected error fetching series by ID:', err);
    return { data: null, error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Fetches published episodes belonging to a specific published series.
 * Episodes are ordered by episode_number ascending, then created_at.
 */
export async function fetchSeriesEpisodes(seriesId: string): Promise<ServiceResult<Episode[]>> {
  try {
    // Both episode and series must be published.
    // First verify series exists and is published:
    const { data: seriesData, error: sErr } = await supabase
      .from('series')
      .select('id, published')
      .eq('id', seriesId)
      .eq('published', true)
      .maybeSingle();

    if (sErr || !seriesData) {
      return { data: [], error: 'সিরিজটি অপ্রকাশিত বা অস্তিত্বহীন।' };
    }

    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      .eq('published', true)
      .order('episode_number', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching series episodes:', error.message);
      return { data: [], error: 'পর্ব তালিকা লোড করা সম্ভব হয়নি।' };
    }

    return { data: (data as Episode[]) || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching series episodes:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Fetches an episode by ID and verifies that:
 * 1. The episode has published = true.
 * 2. The parent series exists and has published = true.
 */
export async function fetchEpisodeById(id: string): Promise<ServiceResult<Episode>> {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('*, series:series_id(*, category:category_id(*))')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching episode by ID:', error.message);
      return { data: null, error: 'পর্বের বিবরণ লোড করা যায়নি।' };
    }

    if (!data) {
      return { data: null, error: 'অনুরোধকৃত পর্বটি খুঁজে পাওয়া যায়নি অথবা এটি অপ্রকাশিত।' };
    }

    const episode = data as unknown as Episode;

    // Strict security check: Ensure parent series is published
    if (!episode.series || episode.series.published !== true) {
      return { data: null, error: 'এই পর্বের মূল সিরিজটি বর্তমানে অপ্রকাশিত।' };
    }

    return { data: episode, error: null };
  } catch (err) {
    console.error('Unexpected error fetching episode by ID:', err);
    return { data: null, error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

export interface SearchResults {
  series: Series[];
  episodes: Episode[];
}

/**
 * Real-time content search across published series and episodes.
 * Ensures episodes returned belong to published series only.
 */
export async function searchPublishedContent(searchQuery: string): Promise<ServiceResult<SearchResults>> {
  const query = searchQuery.trim();
  if (!query) {
    return { data: { series: [], episodes: [] }, error: null };
  }

  try {
    // 1. Search published series
    const { data: seriesData, error: sErr } = await supabase
      .from('series')
      .select('*, category:category_id(*)')
      .eq('published', true)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10);

    // 2. Search published episodes with series
    const { data: epData, error: epErr } = await supabase
      .from('episodes')
      .select('*, series:series_id(*)')
      .eq('published', true)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20);

    if (sErr || epErr) {
      console.error('Search error:', sErr?.message || epErr?.message);
      return {
        data: { series: [], episodes: [] },
        error: 'অনুসন্ধান প্রক্রিয়ায় ত্রুটি দেখা দিয়েছে।',
      };
    }

    // Filter episodes to ensure series is published
    const validEpisodes = ((epData as unknown as Episode[]) || []).filter(
      (ep) => ep.series && ep.series.published === true
    );

    return {
      data: {
        series: (seriesData as Series[]) || [],
        episodes: validEpisodes,
      },
      error: null,
    };
  } catch (err) {
    console.error('Unexpected search error:', err);
    return {
      data: { series: [], episodes: [] },
      error: 'অনুসন্ধানের সময় নেটওয়ার্ক সংযোগ ব্যর্থ হয়েছে।',
    };
  }
}

/**
 * Fetches episodes by an array of IDs (used for Favorites).
 * Filters out any that are not published or whose series is not published.
 */
export async function fetchEpisodesByIds(ids: string[]): Promise<ServiceResult<Episode[]>> {
  if (!ids || ids.length === 0) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('*, series:series_id(*)')
      .in('id', ids)
      .eq('published', true);

    if (error) {
      console.error('Error fetching episodes by IDs:', error.message);
      return { data: [], error: 'সংরক্ষিত পর্বসমূহ লোড করা সম্ভব হয়নি।' };
    }

    const validEpisodes = ((data as unknown as Episode[]) || []).filter(
      (ep) => ep.series && ep.series.published === true
    );

    return { data: validEpisodes, error: null };
  } catch (err) {
    console.error('Unexpected error fetching episodes by IDs:', err);
    return { data: [], error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}
