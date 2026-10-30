import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in environment variables. Check .env configuration.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Returns the public URL for an image stored in the 'covers' bucket,
 * with sanitation and reliable fallback.
 */
export function getCoverImageUrl(path: string | null | undefined): string {
  if (!path || typeof path !== 'string' || !path.trim()) {
    return '/cover-placeholder.svg';
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  let cleanPath = path.trim().replace(/^\/+/, '');
  if (cleanPath.startsWith('covers/')) {
    cleanPath = cleanPath.substring('covers/'.length).replace(/^\/+/, '');
  }
  
  const { data } = supabase.storage.from('covers').getPublicUrl(cleanPath);
  return data?.publicUrl || '/cover-placeholder.svg';
}

export interface AudioUrlResponse {
  success: boolean;
  data?: {
    episode_id: string;
    title: string;
    series_title: string;
    signed_url: string;
    expires_in: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Translates backend error codes to user-friendly Bangla messages.
 */
function mapAudioErrorCodeToBangla(code?: string, defaultMsg?: string): string {
  switch (code) {
    case 'FORBIDDEN':
      return 'এই অডিও পর্বটি অথবা এর মূল সিরিজটি বর্তমানে অপ্রকাশিত।';
    case 'NOT_FOUND':
      return 'অনুরোধকৃত অডিও পর্বটি খুঁজে পাওয়া যায়নি।';
    case 'AUDIO_NOT_FOUND':
      return 'এই পর্বের জন্য কোনো অডিও ফাইল সংযুক্ত করা হয়নি।';
    case 'STORAGE_ERROR':
      return 'নিরাপদ অডিও স্ট্রিম লিঙ্ক তৈরিতে সমস্যা হয়েছে।';
    case 'INVALID_INPUT':
      return 'সঠিক পর্ব আইডি পাওয়া যায়নি।';
    case 'METHOD_NOT_ALLOWED':
      return 'অনুরোধ পদ্ধতি সমর্থিত নয়।';
    default:
      return defaultMsg || 'অডিও লিঙ্ক প্রস্তুত করা সম্ভব হচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }
}

/**
 * Fetches a temporary signed stream URL for an episode from the get-audio-url edge function.
 */
export async function getEpisodeAudioUrl(episodeId: string): Promise<AudioUrlResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<AudioUrlResponse>('get-audio-url', {
      body: { episode_id: episodeId },
    });

    if (error) {
      let friendlyMessage = 'অডিও সার্ভারের সাথে যোগাযোগ করা যায়নি।';
      let errorCode = 'FUNCTION_ERROR';

      // Check if error has context response from edge function
      const errContext = (error as { context?: Response }).context;
      if (errContext && typeof errContext.json === 'function') {
        try {
          const body = await errContext.json();
          if (body?.error?.code) {
            errorCode = body.error.code;
            friendlyMessage = mapAudioErrorCodeToBangla(body.error.code, body.error.message);
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: friendlyMessage,
        },
      };
    }

    if (!data?.success) {
      const code = data?.error?.code;
      return {
        success: false,
        error: {
          code: code || 'UNKNOWN_ERROR',
          message: mapAudioErrorCodeToBangla(code, data?.error?.message),
        },
      };
    }

    return data;
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'অপ্রত্যাশিত নেটওয়ার্ক ত্রুটি ঘটেছে।',
      },
    };
  }
}
