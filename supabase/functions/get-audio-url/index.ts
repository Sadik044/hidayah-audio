import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// UUID v4 format validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Signed URL expiry duration: 300 seconds (5 minutes)
const SIGNED_URL_EXPIRES_IN = 300;

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

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. HTTP Method restriction: Only GET and POST are supported
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // 3. Extract episode identifier from request (Query parameter or JSON body)
    let episodeId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      episodeId = url.searchParams.get('episode_id') || url.searchParams.get('id');
    } else if (req.method === 'POST') {
      try {
        const body = await req.json();
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 4. Request validation: ensure episodeId exists and matches UUID pattern
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanEpisodeId = episodeId.trim();

    // 5. Environment configuration check (No secret keys are hardcoded)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Initialize Supabase Admin client with service_role key (server-side only)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 7. Query episode along with its parent series publication status
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const episode = data as unknown as EpisodeRecord;
    const parentSeries = episode.series;

    // 8. Verify parent series exists
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 9. Security Rule: Both episode AND series MUST be published
    // Draft or unpublished content is strictly forbidden
    if (episode.published !== true || parentSeries.published !== true) {
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 10. Verify audio path is defined
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 11. Security Rule: Create Signed URL from private 'audio' bucket valid for 300 seconds
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 12. Return successful response with signed URL
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          episode_id: episode.id,
          title: episode.title,
          series_title: parentSeries.title,
          signed_url: signedData.signedUrl,
          expires_in: SIGNED_URL_EXPIRES_IN,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
