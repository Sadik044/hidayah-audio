/**
 * HIDAYAH AUDIO — AUDIO ERROR RESOLUTION & RESILIENCE
 *
 * Provides production-grade error categorization and user-friendly Bangla messages
 * for HTML5 Audio playback, Supabase Edge Function URL retrieval, and network interruptions.
 */

/**
 * Determines if an error is an expected play interruption (e.g. source switch or pause while loading).
 * Browser media engines (Chromium, WebKit, Gecko) reject pending HTMLMediaElement.play() promises
 * with an AbortError when a new source is loaded or when pause() is invoked before buffering completes.
 */
export function isAbortError(err: unknown): boolean {
  if (!err) return false;

  if (err instanceof DOMException && (err.name === 'AbortError' || err.code === 20)) {
    return true;
  }

  if (typeof err === 'object') {
    const e = err as { name?: string; code?: number; message?: string };
    if (e.name === 'AbortError' || e.code === 20) return true;
    if (typeof e.message === 'string') {
      const msg = e.message.toLowerCase();
      if (
        msg.includes('interrupted by a new load request') ||
        msg.includes('interrupted by a call to pause') ||
        msg.includes('aborterror') ||
        msg.includes('the operation was aborted')
      ) {
        return true;
      }
    }
  }

  if (typeof err === 'string') {
    const msg = err.toLowerCase();
    if (msg.includes('interrupted') || msg.includes('aborterror') || msg.includes('aborted')) {
      return true;
    }
  }

  return false;
}

/**
 * Determines if an error is caused by browser autoplay policy prevention.
 */
export function isNotAllowedError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return true;
  }
  if (typeof err === 'object' && (err as { name?: string }).name === 'NotAllowedError') {
    return true;
  }
  return false;
}

/**
 * Resolves any audio playback or loading failure into a clear, friendly Bangla message.
 * Strictly guarantees that internal URLs, English DOMExceptions, and raw stack traces
 * are never exposed to public users.
 */
export function resolveAudioErrorMessage(
  err: unknown,
  audio?: HTMLAudioElement | null
): string {
  // 1. Check if user is offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
  }

  // 2. Check HTMLMediaElement.error if available
  const mediaErr = audio?.error;
  if (mediaErr) {
    switch (mediaErr.code) {
      case 1: // MEDIA_ERR_ABORTED
        return '';
      case 2: // MEDIA_ERR_NETWORK
        return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
      case 3: // MEDIA_ERR_DECODE
        return 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।';
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        return 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
    }
  }

  // 3. Check error object properties or codes
  if (err && typeof err === 'object') {
    const errorObj = err as { code?: string; message?: string; status?: number };
    const code = errorObj.code?.toUpperCase();

    if (code === 'FORBIDDEN') {
      return 'এই অডিও পর্বটি অথবা এর মূল সিরিজটি বর্তমানে অপ্রকাশিত।';
    }
    if (code === 'FORBIDDEN_ELEVATION_REQUIRED') {
      return 'অপ্রকাশিত অডিও প্রিভিউ করার জন্য ২-ফ্যাক্টর (AAL2) প্রমাণীকরণ প্রয়োজন।';
    }
    if (code === 'RATE_LIMIT_EXCEEDED') {
      return 'অতিরিক্ত অডিও অনুরোধের কারণে প্লেয়ার সাময়িক স্থগিত। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে পুনরায় চেষ্টা করুন।';
    }
    if (code === 'NOT_FOUND' || code === 'AUDIO_NOT_FOUND' || errorObj.status === 404) {
      return 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
    }
    if (code === 'EXPIRED_URL' || code === 'SIGNED_URL_EXPIRED') {
      return 'অডিও লিংক নতুন করে তৈরি করে পুনরায় চালানোর চেষ্টা করুন।';
    }
    if (code === 'UNSUPPORTED_FORMAT') {
      return 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।';
    }
    if (
      code === 'NETWORK_ERROR' ||
      code === 'OFFLINE' ||
      /network|fetch|internet/i.test(errorObj.message || '')
    ) {
      return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
    }
    if (
      code === 'SERVER_ERROR' ||
      code === 'FUNCTION_ERROR' ||
      errorObj.status === 500 ||
      errorObj.status === 502 ||
      errorObj.status === 503 ||
      errorObj.status === 504
    ) {
      return 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    }
    // If message already contains a Bengali translation from mapAudioErrorCodeToBangla, preserve it
    if (errorObj.message && /[\u0980-\u09FF]/.test(errorObj.message)) {
      return errorObj.message;
    }
  }

  // 4. Default fallback
  return 'অডিও চালানো সম্ভব হয়নি। আবার চেষ্টা করুন।';
}
