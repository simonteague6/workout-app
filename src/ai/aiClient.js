// aiClient — unified HTTP client for OpenAI, OpenRouter, Anthropic, and
// custom OpenAI-compatible endpoints.
//
// Every function takes a config object (not the db) since the AI client
// never touches the database directly. The config shape matches what
// settingsStore.ai provides:
//   { provider: string|null, apiKey: string|null, model: string|null, endpoint: string|null }
//
// Uses fetch() (built into React Native) for all HTTP calls.

const DEFAULT_BASE_URLS = Object.freeze({
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
});

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Send a prompt to the configured provider and return parsed JSON.
 * @param {{ provider?: string|null, apiKey?: string|null, model?: string|null, endpoint?: string|null }} config
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<object>} parsed JSON response
 */
export async function sendAIRequest(config, systemPrompt, userPrompt) {
  const { provider, apiKey, model, endpoint } = config || {};

  if (!apiKey) {
    throw new Error('AI API key is not configured. Set your API key in Settings > AI & API Keys.');
  }

  if (provider === 'anthropic') {
    return sendAnthropicRequest(apiKey, model || 'claude-3-haiku-20240307', systemPrompt, userPrompt);
  }

  // OpenAI, OpenRouter, or custom OpenAI-compatible
  const baseURL = endpoint || DEFAULT_BASE_URLS[provider];
  if (!baseURL) {
    throw new Error(
      `Unknown AI provider "${provider}". Supported: openai, openrouter, anthropic, custom.`,
    );
  }

  return sendOpenAICompatibleRequest(baseURL, apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt);
}

/**
 * POST to an OpenAI-compatible /chat/completions endpoint.
 */
async function sendOpenAICompatibleRequest(baseURL, apiKey, model, systemPrompt, userPrompt) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI request failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('AI response missing content in choices[0].message.content');
  }

  return parseJSONResponse(raw);
}

/**
 * POST to the Anthropic Messages API.
 */
async function sendAnthropicRequest(apiKey, model, systemPrompt, userPrompt) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic request failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json();
  const raw = data?.content?.[0]?.text;
  if (!raw) {
    throw new Error('Anthropic response missing content[0].text');
  }

  return parseJSONResponse(raw);
}

/**
 * Parse a string as JSON. Throws with the raw text on failure so callers
 * can surface it for debugging / manual entry.
 * @param {string} raw
 * @returns {object}
 */
function parseJSONResponse(raw) {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Some LLMs wrap JSON in markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // fall through to throw
      }
    }
    throw new Error(`AI response was not valid JSON:\n${raw}`);
  }
}
