import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Returns true when the OpenAI AI integration is provisioned (both the base URL
 * and API key are present). Use this to decide whether to attempt an AI call or
 * fall back, without triggering a throw.
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
}

/**
 * Lazily constructs and returns the OpenAI client. Initialization is deferred
 * to first call (not module import) so that a missing integration cannot crash
 * the server at boot — callers can catch the throw and fall back gracefully.
 */
export function getOpenAI(): OpenAI {
  if (_client) return _client;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(
      "OpenAI AI integration is not configured (AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set). Did you forget to provision the OpenAI AI integration?",
    );
  }

  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}
