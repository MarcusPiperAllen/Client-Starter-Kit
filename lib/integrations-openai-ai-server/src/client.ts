import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Returns true when an OpenAI client can be constructed - either through
 * Replit's managed "AI Integrations" connector (base URL + key) or through
 * a standard OPENAI_API_KEY (e.g. when running outside Replit, such as on
 * Vercel). Use this to decide whether to attempt an AI call or fall back,
 * without triggering a throw.
 */
export function isOpenAIConfigured(): boolean {
  const hasReplitIntegration = Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
  const hasStandardKey = Boolean(process.env.OPENAI_API_KEY);
  return hasReplitIntegration || hasStandardKey;
}

/**
 * Lazily constructs and returns the OpenAI client. Initialization is deferred
 * to first call (not module import) so that a missing integration cannot crash
 * the server at boot - callers can catch the throw and fall back gracefully.
 *
 * Prefers Replit's managed "AI Integrations" connector when present (so this
 * keeps working unchanged on Replit). Falls back to a standard OPENAI_API_KEY
 * (using OpenAI's default base URL) for environments like Vercel where the
 * Replit-only connector variables don't exist.
 */
export function getOpenAI(): OpenAI {
  if (_client) return _client;

  const replitBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const standardApiKey = process.env.OPENAI_API_KEY;

  if (replitBaseURL && replitApiKey) {
    _client = new OpenAI({ apiKey: replitApiKey, baseURL: replitBaseURL });
    return _client;
  }

  if (standardApiKey) {
    _client = new OpenAI({ apiKey: standardApiKey });
    return _client;
  }

  throw new Error(
    "OpenAI is not configured. Set AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY (on Replit), or OPENAI_API_KEY (everywhere else, e.g. Vercel).",
  );
}
