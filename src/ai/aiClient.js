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

/**
 * Check whether the given provider supports tool-use / function-calling.
 * @param {{ provider?: string|null }} config
 * @returns {boolean}
 */
export function supportsToolUse(config) {
  const provider = config?.provider;
  return provider === 'openai' || provider === 'openrouter' || provider === 'anthropic';
}

/**
 * Send a prompt with tool-use / function-calling support.
 *
 * For providers that support tool-use (OpenAI, OpenRouter, Anthropic), the LLM
 * can call tools defined in the `tools` array. The `executeTool` callback is
 * called for each tool invocation and its result is fed back to the LLM.
 *
 * Loops until the LLM produces a final text response (no more tool calls),
 * with a maximum of 10 iterations to prevent infinite loops.
 *
 * Falls back to sendAIRequest for providers that don't support tool-use.
 *
 * @param {{ provider?: string|null, apiKey?: string|null, model?: string|null, endpoint?: string|null }} config
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Array<object>} tools - tool definitions
 * @param {(name: string, args: object) => Promise<any>} executeTool - callback to execute a tool
 * @returns {Promise<object>} parsed JSON response
 */
export async function sendAIRequestWithTools(config, systemPrompt, userPrompt, tools, executeTool) {
  const { provider, apiKey, model, endpoint } = config || {};

  if (!apiKey) {
    throw new Error('AI API key is not configured. Set your API key in Settings > AI & API Keys.');
  }

  if (provider === 'anthropic') {
    return sendAnthropicWithTools(apiKey, model || 'claude-3-haiku-20240307', systemPrompt, userPrompt, tools, executeTool);
  }

  // OpenAI, OpenRouter, or custom OpenAI-compatible
  const baseURL = endpoint || DEFAULT_BASE_URLS[provider];
  if (!baseURL) {
    // Provider doesn't support tool-use — fall back to non-agentic
    return sendAIRequest(config, systemPrompt, userPrompt);
  }

  return sendOpenAIWithTools(baseURL, apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt, tools, executeTool);
}

/**
 * POST to an OpenAI-compatible /chat/completions endpoint with tool-use.
 * Loops until the LLM produces a final text response (no more tool_calls).
 */
async function sendOpenAIWithTools(baseURL, apiKey, model, systemPrompt, userPrompt, tools, executeTool) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  // Wrap tools in OpenAI function-calling format
  const openaiTools = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openaiTools,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI request failed (${response.status}): ${body || response.statusText}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;

    if (!message) {
      throw new Error('AI response missing choices[0].message');
    }

    // No tool_calls → final response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) {
        throw new Error('AI response missing content in final message');
      }
      return parseJSONResponse(message.content);
    }

    // Add assistant message with tool_calls to history
    messages.push({
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.tool_calls,
    });

    // Execute each tool and add results
    for (const tc of message.tool_calls) {
      let result;
      try {
        const args = JSON.parse(tc.function.arguments);
        result = await executeTool(tc.function.name, args);
      } catch (err) {
        result = { error: err.message };
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error('AI tool call loop exceeded maximum iterations (10)');
}

/**
 * POST to the Anthropic Messages API with tool-use.
 * Loops until the LLM produces a final text response (no more tool_use blocks).
 */
async function sendAnthropicWithTools(apiKey, model, systemPrompt, userPrompt, tools, executeTool) {
  // Wrap tools in Anthropic tool-use format
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const messages = [
    { role: 'user', content: userPrompt },
  ];

  for (let iteration = 0; iteration < 10; iteration++) {
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
        messages,
        tools: anthropicTools,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Anthropic request failed (${response.status}): ${body || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.content;

    if (!Array.isArray(content)) {
      throw new Error('Anthropic response missing content array');
    }

    const toolUseBlocks = content.filter((c) => c.type === 'tool_use');

    // No tool_use blocks → final response
    if (toolUseBlocks.length === 0) {
      const textBlocks = content.filter((c) => c.type === 'text');
      const text = textBlocks.map((t) => t.text).join('\n');
      if (!text) {
        throw new Error('Anthropic response missing text content');
      }
      return parseJSONResponse(text);
    }

    // Add assistant message with tool_use blocks
    messages.push({ role: 'assistant', content });

    // Build tool results
    const toolResults = [];
    for (const block of toolUseBlocks) {
      let result;
      try {
        result = await executeTool(block.name, block.input);
      } catch (err) {
        result = { error: err.message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    // Add user message with tool results
    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error('AI tool call loop exceeded maximum iterations (10)');
}
