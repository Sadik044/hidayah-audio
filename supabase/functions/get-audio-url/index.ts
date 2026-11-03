import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflight, isOriginAllowed } from "../_shared/cors.ts";

// UUID v4 format validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Signed URL expiry duration: 7200 seconds (2 hours)
// Standard for secure audio streaming sessions: allows listening to 30-60 min
// episodes, pausing, seeking, and resuming without mid-playback 403 range-request failures.
const SIGNED_URL_EXPIRES_IN = 7200;

// Maximum allowed request payload size (2 KB)
const MAX_PAYLOAD_BYTES = 2048;

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 60;     // 60 requests per minute per IP

interface EpisodeRecord {
  id: string;
  title: string;
  audio_path: string;
  published: boolean;
  series_id: string;
  series: {
    id: string;
    title: string;
    published: boolean;
  } | null;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ==============================================================================
// 1. REUSABLE MODULE-LEVEL INITIALIZATION (SEC-SB-07)
// ==============================================================================
// Initialize environment configuration and reusable singleton admin client
// once at module load time to avoid repetitive client instantiation per request.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Module-level singleton client for server-side operations (queries & storage signing)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ==============================================================================
// 2. ABUSE PROTECTION & RATE LIMITING (SEC-SB-01)
// ==============================================================================
// ARCHITECTURAL LIMITATION & HONEST DISCLOSURE:
// This in-memory sliding-window counter resides in Deno isolate memory.
// It effectively limits burst spikes and rapid scraping loops hitting this container.
// However, Edge Function instances are ephemeral and horizontally auto-scaled.
// A truly distributed, globally coordinated rate limiter requires a distributed
// key-value store (e.g., Upstash Redis with @upstash/ratelimit) or Cloudflare WAF.
const rateLimitMap = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return 'unknown-ip';
}

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();

  // Periodic garbage collection of expired entries (every 5 minutes)
  if (now - lastCleanup > 5 * 60 * 1000) {
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(ip);
      }
    }
    lastCleanup = now;
  }

  const existing = rateLimitMap.get(clientIp);

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfter,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - existing.count,
    retryAfterSeconds: 0,
  };
}

// ==============================================================================
// 3. MAIN REQUEST HANDLER
// ==============================================================================
Deno.serve(async (req: Request) => {
  // A. Handle CORS Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  // B. Verify Origin if present (reject unapproved cross-origin requests)
  const origin = req.headers.get('Origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN_ORIGIN',
          message: 'The request origin is not permitted by CORS policy.',
        },
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' },
      }
    );
  }

  const cors = getCorsHeaders(req);

  // C. HTTP Method restriction: Only GET and POST are supported
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} is not allowed. Use GET or POST.`,
        },
      }),
      {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }

  // D. Payload size validation for POST requests (DoS prevention)
  if (req.method === 'POST') {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request payload exceeds maximum allowed size of ${MAX_PAYLOAD_BYTES} bytes.`,
          },
        }),
        {
          status: 413,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // E. Rate limiting check per client IP
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many audio requests from your IP address. Please wait before trying again.',
        },
      }),
      {
        status: 429,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    // F. Extract episode identifier from request (Query parameter or JSON body)
    let episodeId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      episodeId = url.searchParams.get('episode_id') || url.searchParams.get('id');
    } else if (req.method === 'POST') {
      try {
        const bodyText = await req.text();
        if (bodyText.length > MAX_PAYLOAD_BYTES) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request payload exceeds maximum allowed size.',
              },
            }),
            {
              status: 413,
              headers: { ...cors, 'Content-Type': 'application/json' },
            }
          );
        }

        const body = bodyText ? JSON.parse(bodyText) : null;
        if (body && typeof body === 'object') {
          episodeId = body.episode_id || body.id;
        }
      } catch (_jsonError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Invalid JSON payload provided in request body.',
            },
          }),
          {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // G. Request validation: ensure episodeId exists and matches UUID pattern
    if (!episodeId || typeof episodeId !== 'string' || !UUID_REGEX.test(episodeId.trim())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'A valid UUID episode identifier is required (parameter: episode_id or id).',
          },
        }),
        {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanEpisodeId = episodeId.trim();

    // H. Verify server configuration exists
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SERVER_CONFIGURATION_ERROR',
            message: 'Server environment configuration is incomplete.',
          },
        }),
        {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // I. Query episode along with its parent series publication status
    const { data, error: dbError } = await supabaseAdmin
      .from('episodes')
      .select(`
        id,
        title,
        audio_path,
        published,
        series_id,
        series:series_id (
          id,
          title,
          published
        )
      `)
      .eq('id', cleanEpisodeId)
      .maybeSingle();

    if (dbError) {
      console.error('Database query error:', dbError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'An error occurred while fetching episode records.',
          },
        }),
        {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // If episode not found
    if (!data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Episode not found.',
          },
        }),
        {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    const episode = data as unknown as EpisodeRecord;
    const parentSeries = episode.series;

    // Verify parent series exists
    if (!parentSeries) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SERIES_NOT_FOUND',
            message: 'Parent series associated with this episode was not found.',
          },
        }),
        {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify audio path is defined
    if (!episode.audio_path) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            message: 'No audio file reference is associated with this episode.',
          },
        }),
        {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==============================================================================
    // 4. AUTHORIZATION EVALUATION & DRAFT PREVIEW (SEC-SB-06)
    // ==============================================================================
    const isPublishedContent = episode.published === true && parentSeries.published === true;

    if (!isPublishedContent) {
      // Unpublished content requires verified AAL2 administrator authentication
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      // If no token or only the public anon key was supplied
      if (!token || token === supabaseAnonKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'This audio content is unpublished or currently unavailable.',
            },
          }),
          {
            status: 403,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }

      // Step 1: Validate token authenticity via Supabase Auth server
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid, expired, or untrusted authentication token.',
            },
          }),
          {
            status: 401,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }

      // Step 2: Cryptographically verify AAL2 and Admin role via database is_admin_aal2() RPC
      // Uses short-lived user-scoped client carrying the caller's JWT
      const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: isAdminAal2, error: rpcError } = await userClient.rpc('is_admin_aal2');

      if (rpcError || isAdminAal2 !== true) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN_ELEVATION_REQUIRED',
              message: 'Elevated AAL2 administrator authentication is required to preview unpublished audio.',
            },
          }),
          {
            status: 403,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ==============================================================================
    // 5. SIGNED URL GENERATION (PRIVATE 'audio' BUCKET)
    // ==============================================================================
    const { data: signedData, error: storageError } = await supabaseAdmin
      .storage
      .from('audio')
      .createSignedUrl(episode.audio_path, SIGNED_URL_EXPIRES_IN);

    if (storageError || !signedData?.signedUrl) {
      console.error('Storage signed URL generation error:', storageError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'STORAGE_ERROR',
            message: 'Failed to generate secure signed URL for the audio stream.',
          },
        }),
        {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==============================================================================
    // 6. RETURN SUCCESS RESPONSE
    // ==============================================================================
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          episode_id: episode.id,
          title: episode.title,
          series_title: parentSeries.title,
          signed_url: signedData.signedUrl,
          expires_in: SIGNED_URL_EXPIRES_IN,
          ...(isPublishedContent ? {} : { is_preview: true }),
        },
      }),
      {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': isPublishedContent ? 'private, max-age=120' : 'no-store',
        },
      }
    );
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unhandled Edge Function error:', errMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while processing the request.',
        },
      }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }
});
