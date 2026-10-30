import { supabase, getCoverImageUrl } from '../lib/supabase';
import type {
  Series,
  Category,
  Episode,
} from '../types/database.types';

export interface AdminMetrics {
  categoriesCount: number;
  seriesCount: number;
  episodesCount: number;
  publishedEpisodesCount: number;
}

export interface CategoryWithCount extends Category {
  series_count?: number;
}

export interface SeriesWithCount extends Series {
  episodes_count?: number;
}

export interface AdminDashboardData {
  metrics: AdminMetrics;
  recentSeries: Series[];
  categories: Category[];
  recentEpisodes: Episode[];
}

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

// Exact storage bucket constraints matching Supabase storage.buckets configuration:
// - 'covers': max 5MB (5242880 bytes), allowed: ['image/jpeg', 'image/png', 'image/webp']
// - 'audio': max 100MB (104857600 bytes), allowed: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']
export const COVERS_BUCKET_LIMIT_BYTES = 5242880; // 5 MB
export const AUDIO_BUCKET_LIMIT_BYTES = 104857600; // 100 MB

const ALLOWED_COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
];

/**
 * Normalizes image MIME type to match the Supabase 'covers' bucket configuration.
 */
export function resolveCoverMimeType(file: File): string | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'image/jpeg' || type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (type === 'image/png' || name.endsWith('.png')) {
    return 'image/png';
  }
  if (type === 'image/webp' || name.endsWith('.webp')) {
    return 'image/webp';
  }

  if (ALLOWED_COVER_MIME_TYPES.includes(type)) {
    return type;
  }

  return null;
}

/**
 * Normalizes audio MIME type to strictly match the Supabase 'audio' bucket allowed_mime_types:
 * ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']
 */
export function resolveAudioMimeType(file: File): string | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // MP3
  if (type === 'audio/mpeg' || type === 'audio/mp3' || name.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  // M4A / MP4 Audio
  if (
    type === 'audio/mp4' ||
    type === 'audio/x-m4a' ||
    type === 'audio/m4a' ||
    name.endsWith('.m4a') ||
    name.endsWith('.mp4')
  ) {
    return 'audio/mp4';
  }
  // AAC
  if (type === 'audio/aac' || type === 'audio/x-aac' || name.endsWith('.aac')) {
    return 'audio/aac';
  }
  // OGG
  if (type === 'audio/ogg' || type === 'audio/vorbis' || name.endsWith('.ogg')) {
    return 'audio/ogg';
  }
  // WAV
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave' || name.endsWith('.wav')) {
    return 'audio/wav';
  }

  if (ALLOWED_AUDIO_MIME_TYPES.includes(type)) {
    return type;
  }

  return null;
}

// ----------------------------------------------------
// 1. Dashboard Metrics
// ----------------------------------------------------
export async function fetchAdminDashboardData(): Promise<{
  data: AdminDashboardData | null;
  error: string | null;
}> {
  try {
    const [catRes, sRes, epRes, pubEpRes] = await Promise.all([
      supabase.from('categories').select('*', { count: 'exact' }).order('name'),
      supabase.from('series').select('*, category:category_id(*)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('episodes').select('*, series:series_id(*)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('published', true),
    ]);

    return {
      data: {
        metrics: {
          categoriesCount: catRes.count || 0,
          seriesCount: sRes.count || 0,
          episodesCount: epRes.count || 0,
          publishedEpisodesCount: pubEpRes.count || 0,
        },
        recentSeries: (sRes.data as Series[]) || [],
        categories: (catRes.data as Category[]) || [],
        recentEpisodes: (epRes.data as Episode[]) || [],
      },
      error: null,
    };
  } catch (err) {
    console.error('Unexpected error fetching admin dashboard data:', err);
    return {
      data: null,
      error: 'অ্যাডমিন ড্যাশবোর্ড ডাটা লোড করতে ব্যর্থ হয়েছে।',
    };
  }
}

// ----------------------------------------------------
// 2. Category Management
// ----------------------------------------------------
export async function fetchAdminCategories(): Promise<ServiceResponse<CategoryWithCount[]>> {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*, series(count)')
      .order('name');

    if (error) {
      console.error('Error fetching admin categories:', error.message);
      return { data: null, error: 'ক্যাটাগরি তালিকা লোড করা সম্ভব হয়নি।' };
    }

    const transformed: CategoryWithCount[] = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      created_at: cat.created_at,
      series_count: cat.series?.[0]?.count ?? 0,
    }));

    return { data: transformed, error: null };
  } catch (err) {
    console.error('Unexpected error fetching admin categories:', err);
    return { data: null, error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<ServiceResponse<Category>> {
  try {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: input.name.trim(),
        slug: cleanSlug,
        description: input.description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error.message);
      if (error.code === '23505') {
        return { data: null, error: 'এই স্লাগ (slug) দিয়ে ইতিমধ্যে একটি ক্যাটাগরি রয়েছে।' };
      }
      return { data: null, error: 'ক্যাটাগরি তৈরি করতে ব্যর্থ হয়েছে।' };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error creating category:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

export async function updateCategory(
  id: string,
  input: {
    name: string;
    slug: string;
    description?: string | null;
  }
): Promise<ServiceResponse<Category>> {
  try {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: input.name.trim(),
        slug: cleanSlug,
        description: input.description?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error.message);
      if (error.code === '23505') {
        return { data: null, error: 'এই স্লাগ (slug) ইতিমধ্যে অন্য ক্যাটাগরিতে ব্যবহৃত হয়েছে।' };
      }
      return { data: null, error: 'ক্যাটাগরি তথ্য হালনাগাদ করা সম্ভব হয়নি।' };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error updating category:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

export async function deleteCategory(id: string): Promise<ServiceResponse<boolean>> {
  try {
    // Foreign-key safety check: Does any series reference this category?
    const { count, error: countErr } = await supabase
      .from('series')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countErr) {
      return { data: null, error: 'ক্যাটাগরির নির্ভরতা যাচাই করতে ব্যর্থ হয়েছে।' };
    }

    if (count && count > 0) {
      return {
        data: false,
        error: `এই ক্যাটাগরিতে ${count} টি সিরিজ বিদ্যমান। দুর্ঘটনাজনিত ডেটা ক্ষতি এড়াতে আগে সিরিজগুলো থেকে এই ক্যাটাগরি পরিবর্তন বা অপসারণ করুন।`,
      };
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error.message);
      return { data: null, error: 'ক্যাটাগরি মুছে ফেলা সম্ভব হয়নি।' };
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Unexpected error deleting category:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

// ----------------------------------------------------
// 3. Storage Utilities (Covers & Audio)
// ----------------------------------------------------
export interface UploadResult {
  path: string;
  publicUrl?: string;
}

export async function uploadCoverImage(file: File): Promise<ServiceResponse<UploadResult>> {
  try {
    // 1. Validate file type against Supabase 'covers' bucket allowed_mime_types
    const resolvedMime = resolveCoverMimeType(file);
    if (!resolvedMime) {
      return { data: null, error: 'শুধুমাত্র JPG, PNG অথবা WEBP ফরম্যাটের ছবি আপলোড করুন।' };
    }

    // 2. Validate file size (exact Supabase limit: 5 MB / 5242880 bytes)
    if (file.size > COVERS_BUCKET_LIMIT_BYTES) {
      return { data: null, error: 'ছবির ফাইলের আকার ৫ মেগাবাইটের (5MB) কম হতে হবে।' };
    }

    // 3. Generate safe path
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9]/g, '_');
    const path = `series/${Date.now()}-${cleanName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, file, {
        contentType: resolvedMime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading cover:', uploadError.message);
      return { data: null, error: 'কভার ইমেজ আপলোড ব্যর্থ হয়েছে: ' + uploadError.message };
    }

    const publicUrl = getCoverImageUrl(path) || '';
    return { data: { path, publicUrl }, error: null };
  } catch (err) {
    console.error('Unexpected error uploading cover:', err);
    return { data: null, error: 'ছবি আপলোডের সময় ত্রুটি ঘটেছে।' };
  }
}

export async function deleteStorageFile(bucket: 'covers' | 'audio', path: string): Promise<ServiceResponse<boolean>> {
  try {
    if (!path) return { data: true, error: null };

    // If path is full URL, extract relative path
    let relativePath = path;
    if (path.includes(`/${bucket}/`)) {
      relativePath = path.split(`/${bucket}/`)[1];
    }

    const { error } = await supabase.storage.from(bucket).remove([relativePath]);

    if (error) {
      console.error(`Error deleting from ${bucket}:`, error.message);
      return {
        data: false,
        error: `স্টোরেজ থেকে ফাইল (${relativePath}) মুছে ফেলতে ব্যর্থ হয়েছে: ${error.message}`,
      };
    }

    return { data: true, error: null };
  } catch (err) {
    console.error(`Unexpected error deleting storage object from ${bucket}:`, err);
    return { data: false, error: 'স্টোরেজ অবজেক্ট মুছে ফেলতে অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

export async function uploadAudioFile(file: File): Promise<ServiceResponse<{ path: string }>> {
  try {
    // 1. Validate file extension and MIME type against Supabase 'audio' bucket allowed_mime_types
    // Allowed: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']
    const resolvedMime = resolveAudioMimeType(file);
    if (!resolvedMime) {
      return {
        data: null,
        error: 'শুধুমাত্র অনুমোদিত অডিও ফরম্যাট (MP3, M4A, WAV, AAC, OGG) আপলোড করা যাবে।',
      };
    }

    // 2. Validate file size (exact Supabase limit: 100 MB / 104857600 bytes)
    if (file.size > AUDIO_BUCKET_LIMIT_BYTES) {
      return {
        data: null,
        error: 'অডিও ফাইলের আকার ১০০ মেগাবাইটের (100MB) কম হতে হবে।',
      };
    }

    // 3. Unique path in private 'audio' bucket strictly conforming to database check constraint:
    // audio_path ~ '^[a-z0-9_-]+/[a-z0-9_-]+\.(mp3|m4a|aac|ogg|wav)$'
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const rawBase = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();
    const cleanName = rawBase
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'audio';
    const path = `episodes/${Date.now()}-${cleanName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(path, file, {
        contentType: resolvedMime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading audio file to storage:', uploadError);
      return { data: null, error: `অডিও ফাইল আপলোড ব্যর্থ হয়েছে: ${uploadError.message}` };
    }

    return { data: { path }, error: null };
  } catch (err) {
    console.error('Unexpected error uploading audio:', err);
    return { data: null, error: 'অডিও আপলোডের সময় ত্রুটি ঘটেছে।' };
  }
}

// ----------------------------------------------------
// 4. Series Management
// ----------------------------------------------------
export async function fetchAdminSeriesList(): Promise<ServiceResponse<SeriesWithCount[]>> {
  try {
    const { data: seriesList, error } = await supabase
      .from('series')
      .select('*, category:category_id(*), episodes(count)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin series list:', error.message);
      return { data: null, error: 'সিরিজ তালিকা লোড করা সম্ভব হয়নি।' };
    }

    const transformed: SeriesWithCount[] = (seriesList || []).map((s: any) => ({
      ...s,
      episodes_count: s.episodes?.[0]?.count ?? 0,
    }));

    return { data: transformed, error: null };
  } catch (err) {
    console.error('Unexpected error fetching admin series list:', err);
    return { data: null, error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

export async function createSeries(input: {
  title: string;
  slug: string;
  category_id?: string | null;
  description?: string | null;
  cover_image?: string | null;
  featured?: boolean;
  published?: boolean;
}): Promise<ServiceResponse<Series>> {
  try {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const { data, error } = await supabase
      .from('series')
      .insert({
        title: input.title.trim(),
        slug: cleanSlug,
        category_id: input.category_id || null,
        description: input.description?.trim() || null,
        cover_image: input.cover_image?.trim() || null,
        featured: input.featured ?? false,
        published: input.published ?? false,
      })
      .select('*, category:category_id(*)')
      .single();

    if (error) {
      console.error('Error creating series:', error.message);
      if (error.code === '23505') {
        return { data: null, error: 'এই স্লাগ (slug) দিয়ে ইতিমধ্যে একটি সিরিজ রয়েছে।' };
      }
      return { data: null, error: 'নতুন সিরিজ তৈরি করতে ব্যর্থ হয়েছে।' };
    }

    return { data: data as Series, error: null };
  } catch (err) {
    console.error('Unexpected error creating series:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

export async function updateSeries(
  id: string,
  input: {
    title: string;
    slug: string;
    category_id?: string | null;
    description?: string | null;
    cover_image?: string | null;
    featured?: boolean;
    published?: boolean;
  },
  previousCoverToCleanup?: string | null
): Promise<ServiceResponse<Series>> {
  try {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    
    // 1. Update database record FIRST so it never points to an invalid/deleted file
    const { data, error } = await supabase
      .from('series')
      .update({
        title: input.title.trim(),
        slug: cleanSlug,
        category_id: input.category_id || null,
        description: input.description?.trim() || null,
        cover_image: input.cover_image !== undefined ? input.cover_image : null,
        featured: input.featured ?? false,
        published: input.published ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, category:category_id(*)')
      .single();

    if (error) {
      console.error('Error updating series:', error.message);
      if (error.code === '23505') {
        return { data: null, error: 'এই স্লাগ (slug) ইতিমধ্যে অন্য সিরিজে ব্যবহৃত হয়েছে।' };
      }
      return { data: null, error: 'সিরিজ তথ্য হালনাগাদ করা যায়নি।' };
    }

    // 2. Only after DB update succeeds, clean up previous cover from Storage
    if (previousCoverToCleanup && previousCoverToCleanup !== input.cover_image) {
      const cleanRes = await deleteStorageFile('covers', previousCoverToCleanup);
      if (!cleanRes.data) {
        console.warn('Old cover cleanup warning:', cleanRes.error);
      }
    }

    return { data: data as Series, error: null };
  } catch (err) {
    console.error('Unexpected error updating series:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

export async function toggleSeriesPublish(id: string, published: boolean): Promise<ServiceResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('series')
      .update({ published, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { data: null, error: 'পাবলিকেশন অবস্থা পরিবর্তন করা যায়নি।' };
    }
    return { data: true, error: null };
  } catch {
    return { data: null, error: 'নেটওয়ার্ক ত্রুটি।' };
  }
}

export async function toggleSeriesFeatured(id: string, featured: boolean): Promise<ServiceResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('series')
      .update({ featured, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { data: null, error: 'ফিচার্ড অবস্থা পরিবর্তন করা যায়নি।' };
    }
    return { data: true, error: null };
  } catch {
    return { data: null, error: 'নেটওয়ার্ক ত্রুটি।' };
  }
}

export async function deleteSeries(id: string): Promise<ServiceResponse<boolean>> {
  try {
    // Foreign-key & accidental deletion protection:
    // Check if the series has existing episodes
    const { count: epCount, error: countErr } = await supabase
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('series_id', id);

    if (countErr) {
      return { data: null, error: 'সিরিজের পর্ব যাচাই করতে ব্যর্থ হয়েছে।' };
    }

    if (epCount && epCount > 0) {
      return {
        data: false,
        error: `এই সিরিজে ${epCount} টি পর্ব ও সংশ্লিষ্ট অডিও ফাইল রয়েছে। দুর্ঘটনাজনিত ডেটা ক্ষতি এড়াতে আগে পর্বগুলো পৃথকভাবে মুছে ফেলুন অথবা অন্য সিরিজে সরিয়ে নিন।`,
      };
    }

    // 1. Fetch series cover path before deleting row
    const { data: sData, error: sErr } = await supabase
      .from('series')
      .select('id, cover_image')
      .eq('id', id)
      .single();

    if (sErr || !sData) {
      return { data: null, error: 'সিরিজের তথ্য পাওয়া যায়নি।' };
    }

    const coverImage = (sData as any).cover_image;

    // 2. Delete database row
    const { error: delErr } = await supabase
      .from('series')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('Error deleting series row:', delErr.message);
      return { data: null, error: 'সিরিজ মুছে ফেলতে ডেটাবেজ ত্রুটি: ' + delErr.message };
    }

    // 3. Storage cleanup: Delete cover image if exists
    if (coverImage) {
      const covRes = await deleteStorageFile('covers', coverImage);
      if (!covRes.data) {
        return {
          data: false,
          error: `সিরিজের ডেটাবেজ রেকর্ড মুছে ফেলা হয়েছে, কিন্তু কভার ইমেজ ফাইল (${coverImage}) ডিলিট করতে ব্যর্থ হয়েছে।`,
        };
      }
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Unexpected error deleting series:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

// ----------------------------------------------------
// 5. Episode Management
// ----------------------------------------------------
export async function fetchAdminEpisodesList(seriesId?: string): Promise<ServiceResponse<Episode[]>> {
  try {
    let query = supabase
      .from('episodes')
      .select('*, series:series_id(*)')
      .order('created_at', { ascending: false });

    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching admin episodes:', error.message);
      return { data: null, error: 'পর্ব তালিকা লোড করা সম্ভব হয়নি।' };
    }

    return { data: (data as Episode[]) || [], error: null };
  } catch (err) {
    console.error('Unexpected error fetching admin episodes:', err);
    return { data: null, error: 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
  }
}

/**
 * Strictly sanitizes slug to comply with Postgres check constraint:
 * slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
 */
export function sanitizeSlug(slug: string, fallbackId?: string | number | null): string {
  const cleaned = (slug || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (cleaned) {
    return cleaned;
  }

  if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) {
    const fallbackCleaned = String(fallbackId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (fallbackCleaned) {
      return `episode-${fallbackCleaned}`;
    }
  }

  return `episode-${Date.now()}`;
}

export async function createEpisode(input: {
  series_id: string;
  title: string;
  slug: string;
  description?: string | null;
  episode_number?: number | null;
  audio_path: string;
  duration?: number | null;
  published?: boolean;
}): Promise<ServiceResponse<Episode>> {
  try {
    const cleanSlug = sanitizeSlug(input.slug, input.episode_number);
    const audioPathClean = input.audio_path.trim().toLowerCase();

    const insertPayload = {
      series_id: input.series_id,
      title: input.title.trim(),
      slug: cleanSlug,
      description: input.description?.trim() || null,
      episode_number: input.episode_number && input.episode_number > 0 ? input.episode_number : null,
      audio_path: audioPathClean,
      duration:
        input.duration !== undefined && input.duration !== null && input.duration >= 0
          ? input.duration
          : null,
      published: input.published ?? false,
    };

    console.log('Inserting episode into Supabase:', insertPayload);

    const { data, error } = await supabase
      .from('episodes')
      .insert(insertPayload)
      .select('*, series:series_id(*)')
      .single();

    if (error) {
      console.error('Supabase error creating episode:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      // Cleanup newly uploaded orphaned audio file from storage on database insert failure
      if (input.audio_path) {
        console.warn('Cleaning up orphaned audio file from storage:', input.audio_path);
        const delRes = await deleteStorageFile('audio', input.audio_path);
        if (!delRes.data) {
          console.error('Failed to cleanup orphaned audio file:', delRes.error);
        }
      }

      // Handle duplicate violations (code 23505)
      if (error.code === '23505') {
        if (
          error.message.includes('episodes_series_number_key') ||
          error.details?.includes('episode_number')
        ) {
          return {
            data: null,
            error: `এই সিরিজে ${input.episode_number} নম্বর পর্বটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য পর্ব নম্বর দিন।`,
          };
        }
        if (
          error.message.includes('episodes_series_slug_key') ||
          error.details?.includes('slug')
        ) {
          return {
            data: null,
            error: `এই সিরিজে '${cleanSlug}' স্লাগটি (slug) ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে ভিন্ন স্লাগ দিন।`,
          };
        }
        return { data: null, error: `একই তথ্য দিয়ে ইতিমধ্যে একটি পর্ব বিদ্যমান (${error.message})।` };
      }

      // Handle check constraint violations (code 23514)
      if (error.code === '23514') {
        if (error.message.includes('episodes_audio_path_format')) {
          return {
            data: null,
            error:
              'অডিও ফাইলের পাথ ফরম্যাট সঠিক নয়। শুধুমাত্র ছোট হাতের ইংরেজি বর্ণ, সংখ্যা ও এক্সটেনশন অনুমোদিত।',
          };
        }
        if (error.message.includes('episodes_slug_format')) {
          return {
            data: null,
            error: `স্লাগ '${cleanSlug}' ফরম্যাট সঠিক নয়। স্লাগ শুধুমাত্র ছোট হাতের ইংরেজি বর্ণ, সংখ্যা ও হাইফেন হতে পারবে।`,
          };
        }
        if (error.message.includes('episodes_episode_number_check')) {
          return { data: null, error: 'পর্বের নম্বর অবশ্যই শূন্যের চেয়ে বড় (১, ২, ৩...) হতে হবে।' };
        }
        if (error.message.includes('episodes_duration_check')) {
          return { data: null, error: 'পর্বের সময়কাল শূন্য বা তার বেশি হতে হবে।' };
        }
        return { data: null, error: `ডেটাবেজ কনস্ট্রেইন্ট যাচাই ব্যর্থ হয়েছে: ${error.message}` };
      }

      // Handle permission / RLS errors
      if (
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission') ||
        error.message.toLowerCase().includes('row-level security')
      ) {
        return {
          data: null,
          error: `অ্যাডমিন অনুমতি যাচাই ব্যর্থ হয়েছে (${error.message})। অনুগ্রহ করে আবার লগইন করুন।`,
        };
      }

      return { data: null, error: `নতুন পর্ব তৈরি করতে ব্যর্থ হয়েছে: ${error.message}` };
    }

    return { data: data as Episode, error: null };
  } catch (err: any) {
    console.error('Unexpected error creating episode:', err);
    return { data: null, error: `অপ্রত্যাশিত ত্রুটি ঘটেছে: ${err?.message || err}` };
  }
}

export async function updateEpisode(
  id: string,
  input: {
    series_id: string;
    title: string;
    slug: string;
    description?: string | null;
    episode_number?: number | null;
    audio_path?: string;
    duration?: number | null;
    published?: boolean;
  },
  previousAudioPathToCleanup?: string | null
): Promise<ServiceResponse<Episode>> {
  try {
    const cleanSlug = sanitizeSlug(input.slug, input.episode_number);
    const updatePayload: any = {
      series_id: input.series_id,
      title: input.title.trim(),
      slug: cleanSlug,
      description: input.description?.trim() || null,
      episode_number: input.episode_number && input.episode_number > 0 ? input.episode_number : null,
      duration:
        input.duration !== undefined && input.duration !== null && input.duration >= 0
          ? input.duration
          : null,
      published: input.published ?? false,
      updated_at: new Date().toISOString(),
    };

    if (input.audio_path) {
      updatePayload.audio_path = input.audio_path.trim().toLowerCase();
    }

    console.log('Updating episode in Supabase:', id, updatePayload);

    // 1. Update database record FIRST so it always references an existing valid audio file
    const { data, error } = await supabase
      .from('episodes')
      .update(updatePayload)
      .eq('id', id)
      .select('*, series:series_id(*)')
      .single();

    if (error) {
      console.error('Supabase error updating episode:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      if (error.code === '23505') {
        if (
          error.message.includes('episodes_series_number_key') ||
          error.details?.includes('episode_number')
        ) {
          return {
            data: null,
            error: `এই সিরিজে ${input.episode_number} নম্বর পর্বটি ইতিমধ্যে ব্যবহৃত হয়েছে।`,
          };
        }
        if (
          error.message.includes('episodes_series_slug_key') ||
          error.details?.includes('slug')
        ) {
          return {
            data: null,
            error: `এই সিরিজে '${cleanSlug}' স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।`,
          };
        }
        return { data: null, error: `একই তথ্য দিয়ে ইতিমধ্যে একটি পর্ব বিদ্যমান (${error.message})।` };
      }

      if (error.code === '23514') {
        return { data: null, error: `ডেটাবেজ ভ্যালিডেশন ব্যর্থ হয়েছে: ${error.message}` };
      }

      return { data: null, error: `পর্বের তথ্য হালনাগাদ করা সম্ভব হয়নি: ${error.message}` };
    }

    // 2. Only after DB update succeeds, clean up previous audio file from 'audio' bucket
    if (previousAudioPathToCleanup && input.audio_path && previousAudioPathToCleanup !== input.audio_path) {
      const cleanRes = await deleteStorageFile('audio', previousAudioPathToCleanup);
      if (!cleanRes.data) {
        console.warn('Old audio storage cleanup warning:', cleanRes.error);
      }
    }

    return { data: data as Episode, error: null };
  } catch (err: any) {
    console.error('Unexpected error updating episode:', err);
    return { data: null, error: `অপ্রত্যাশিত ত্রুটি ঘটেছে: ${err?.message || err}` };
  }
}

export async function toggleEpisodePublish(id: string, published: boolean): Promise<ServiceResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('episodes')
      .update({ published, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { data: null, error: 'পর্বের পাবলিকেশন অবস্থা পরিবর্তন করা যায়নি।' };
    }
    return { data: true, error: null };
  } catch {
    return { data: null, error: 'নেটওয়ার্ক ত্রুটি।' };
  }
}

export async function deleteEpisode(id: string): Promise<ServiceResponse<boolean>> {
  try {
    // 1. Fetch episode record first to retrieve exact audio_path
    const { data: ep, error: fetchErr } = await supabase
      .from('episodes')
      .select('id, title, audio_path')
      .eq('id', id)
      .single();

    if (fetchErr || !ep) {
      return { data: null, error: 'অনুরোধকৃত পর্বটি খুঁজে পাওয়া যায়নি।' };
    }

    const epRow = ep as { id: string; title: string; audio_path: string };

    // 2. Delete database row FIRST so frontend state doesn't point to deleted storage prematurely
    const { error: dbErr } = await supabase
      .from('episodes')
      .delete()
      .eq('id', id);

    if (dbErr) {
      console.error('Error deleting episode row:', dbErr.message);
      return { data: null, error: 'পর্বটি ডেটাবেজ থেকে মুছতে ব্যর্থ হয়েছে: ' + dbErr.message };
    }

    // 3. Delete storage file separately and handle failure strictly
    if (epRow.audio_path) {
      const storageRes = await deleteStorageFile('audio', epRow.audio_path);
      if (!storageRes.data) {
        // Report honestly that Storage deletion failed
        return {
          data: false,
          error: `পর্বটি ডেটাবেজ থেকে মুছে ফেলা হয়েছে, কিন্তু স্টোরেজের অডিও ফাইল (${epRow.audio_path}) ডিলিট করতে ব্যর্থ হয়েছে: ${storageRes.error || 'অজানা স্টোরেজ ত্রুটি'}`,
        };
      }
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Unexpected error deleting episode:', err);
    return { data: null, error: 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}
