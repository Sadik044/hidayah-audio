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
    case 'FORBIDDEN_ELEVATION_REQUIRED':
      return 'অপ্রকাশিত অডিও প্রিভিউ করার জন্য ২-ফ্যাক্টর (AAL2) অ্যাডমিন প্রমাণীকরণ প্রয়োজন।';
    case 'RATE_LIMIT_EXCEEDED':
      return 'অতিরিক্ত অডিও অনুরোধের কারণে প্লেয়ার সাময়িক স্থগিত। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে পুনরায় চেষ্টা করুন।';
    case 'CORS_ORIGIN_NOT_ALLOWED':
      return 'অননুমোদিত ডোমেইন থেকে অডিও অনুরোধ বাতিল করা হয়েছে।';
    case 'UNAUTHORIZED':
      return 'অডিও সার্ভারে প্রমাণীকরণ ব্যর্থ হয়েছে। পুনরায় লগইন করুন।';
    case 'NOT_FOUND':
    case 'AUDIO_NOT_FOUND':
      return 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
    case 'STORAGE_ERROR':
      return 'নিরাপদ অডিও স্ট্রিম লিঙ্ক তৈরিতে সমস্যা হয়েছে।';
    case 'EXPIRED_URL':
      return 'অডিও লিংক নতুন করে তৈরি করে পুনরায় চালানোর চেষ্টা করুন।';
    case 'UNSUPPORTED_FORMAT':
      return 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।';
    case 'INVALID_INPUT':
      return 'সঠিক পর্ব আইডি পাওয়া যায়নি।';
    case 'METHOD_NOT_ALLOWED':
      return 'অনুরোধ পদ্ধতি সমর্থিত নয়।';
    default:
      if (defaultMsg && /[\u0980-\u09FF]/.test(defaultMsg)) {
        return defaultMsg;
      }
      return 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }
}

/**
 * Fetches a temporary signed stream URL for an episode from the get-audio-url edge function.
 */
export async function getEpisodeAudioUrl(episodeId: string): Promise<AudioUrlResponse> {
  // Check if client device is offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
      },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke<AudioUrlResponse>('get-audio-url', {
      body: { episode_id: episodeId },
    });

    if (error) {
      // Check if this was a network disconnection
      const isNetwork =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        /fetch|network/i.test(error.message || '');
      if (isNetwork) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
          },
        };
      }

      let friendlyMessage = 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।';
      let errorCode = 'SERVER_ERROR';

      // Check if error has context response from edge function
      const errContext = (error as { context?: Response }).context;
      if (errContext) {
        if (errContext.status === 404) {
          friendlyMessage = 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
          errorCode = 'NOT_FOUND';
        } else if (errContext.status >= 500) {
          friendlyMessage = 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।';
          errorCode = 'SERVER_ERROR';
        }

        if (typeof errContext.json === 'function') {
          try {
            const body = await errContext.json();
            if (body?.error?.code) {
              errorCode = body.error.code;
              friendlyMessage = mapAudioErrorCodeToBangla(body.error.code, body.error.message);
            }
          } catch {
            // Keep status-based message if JSON parsing fails
          }
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
    const isNetwork =
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      (err instanceof Error && /fetch|network/i.test(err.message));
    return {
      success: false,
      error: {
        code: isNetwork ? 'NETWORK_ERROR' : 'SERVER_ERROR',
        message: isNetwork
          ? 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
          : 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      },
    };
  }
}
