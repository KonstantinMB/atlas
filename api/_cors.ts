/**
 * CORS Middleware for Vercel Edge Functions
 *
 * Wraps edge function handlers with CORS headers.
 * Allowlist: localhost (all ports) + production domains
 */

export const config = { runtime: 'edge' };

// Allowed origins - localhost for dev + production domains
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost:\d+$/,           // localhost any port
  /^http:\/\/127\.0\.0\.1:\d+$/,        // 127.0.0.1 any port
  /^https:\/\/.*\.vercel\.app$/,        // Vercel preview/production
  // Add production domains here when available
  // /^https:\/\/atlas\.yourdomain\.com$/,
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
}

/**
 * Get CORS headers for the response
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * CORS wrapper for edge function handlers
 *
 * Usage:
 * export default withCors(async (req: Request) => {
 *   return new Response(JSON.stringify({ data }), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * });
 */
export function withCors(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const origin = req.headers.get('origin');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    try {
      // Execute the actual handler
      const response = await handler(req);

      // Clone response to add CORS headers
      const headers = new Headers(response.headers);
      const corsHeaders = getCorsHeaders(origin);

      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Return error with CORS headers
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';

      return new Response(
        JSON.stringify({
          error: errorMessage,
          timestamp: Date.now(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin),
          },
        }
      );
    }
  };
}
