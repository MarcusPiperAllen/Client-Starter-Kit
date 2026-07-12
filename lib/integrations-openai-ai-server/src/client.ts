import OpenAI from "openai";

let _client: OpenAI | null = null;

const DEFAULT_MODEL = "gpt-5.4";

/**
 * Resolves credentials from whichever environment this is running in:
 * - Replit's managed AI integration (AI_INTEGRATIONS_OPENAI_BASE_URL / _API_KEY)
 * - A standard OpenAI key (OPENAI_API_KEY, optionally OPENAI_BASE_URL), used
 *   anywhere outside Replit (e.g. Vercel)
 * Replit's variables take precedence when both are present.
 */
function resolveCredentials(): { apiKey: string; baseURL?: string } | null {
  const replitBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (replitBaseURL && replitApiKey) {
    return { apiKey: replitApiKey, baseURL: replitBaseURL };
  }

  const standardApiKey = process.env.OPENAI_API_KEY;
  if (standardApiKey) {
    return { apiKey: standardApiKey, baseURL: process.env.OPENAI_BASE_URL };
  }

  return null;
}

/**
 * Returns true when either the Replit AI integration or a standard OpenAI key
 * is configured. Use this to decide whether to attempt an AI call or fall
 * back, without triggering a throw.
 */
export function isOpenAIConfigured(): boolean {
  return resolveCredentials() !== null;
}

/**
 * The chat model to use — overridable via OPENAI_MODEL for environments where
 * the default model name isn't available under the configured account/key.
 */
export function getModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/**
 * Lazily constructs and returns the OpenAI client. Initialization is deferred
 * to first call (not module import) so that a missing integration cannot crash
 * the server at boot — callers can catch the throw and fall back gracefully.
 */
export function getOpenAI(): OpenAI {
  if (_client) return _client;

  const creds = resolveCredentials();

  if (!creds) {
    throw new Error(
      "OpenAI is not configured. Set AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY (Replit) or OPENAI_API_KEY (standard, e.g. Vercel).",
    );
  }

  _client = new OpenAI(creds);
  return _client;
}
