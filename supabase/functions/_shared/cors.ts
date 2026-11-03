/**
 * Shared CORS Configuration for Supabase Edge Functions
 * Enforces an explicit origin allowlist preventing unauthorized cross-origin requests.
 */

// Default trusted origins for Hidayah Audio
const DEFAULT_ALLOWED_ORIGINS = [
  'https://hidayah-audio.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

// Regex matching official Vercel preview deployments for this project
const VERCEL_PREVIEW_PATTERN = /^https:\/\/hidayah-audio(-[a-z0-9-]+)?\.vercel\.app$/i;

/**
 * Validates whether an incoming Origin is authorized.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // 1. Check exact match in default list
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // 2. Check environment variable overrides (comma-separated list)
  try {
    const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
    if (envOrigins) {
      const list = envOrigins.split(',').map((o) => o.trim());
      if (list.includes(origin)) {
        return true;
      }
    }
  } catch {
    // Ignore environment lookup errors if Deno.env is unavailable
  }

  // 3. Check Vercel preview domain pattern
  if (VERCEL_PREVIEW_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

/**
 * Returns appropriate CORS headers for a given request.
 * If origin is permitted, echoes that origin in Access-Control-Allow-Origin with Vary: Origin.
 * If origin is not permitted, Access-Control-Allow-Origin is omitted.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = isOriginAllowed(origin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * Handles CORS Preflight (OPTIONS) requests with origin allowlisting.
 */
export function handleCorsPreflight(req: Request): Response {
  const origin = req.headers.get('Origin');

  if (origin && !isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'CORS_ORIGIN_NOT_ALLOWED',
          message: 'The origin is not permitted by CORS policy.',
        },
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Vary': 'Origin',
        },
      }
    );
  }

  return new Response('ok', {
    status: 200,
    headers: getCorsHeaders(req),
  });
}

// Retain legacy export for backward compatibility where static headers are referenced
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
