// aiClient.test.js — unit tests for the AI client.
//
// Mocks global.fetch to simulate LLM API responses. Tests cover:
//   - OpenAI provider: correct URL, headers, body parsing
//   - Anthropic provider: correct URL, headers, body parsing
//   - Missing API key: throws clear error
//   - Non-JSON response: throws with raw text
//   - Markdown-wrapped JSON: parsed correctly

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { sendAIRequest, sendAIRequestWithTools, supportsToolUse } from '../aiClient.js';

const ORIGINAL_FETCH = global.fetch;

function mockFetch(responseData, status = 200) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(responseData),
      text: () => Promise.resolve(JSON.stringify(responseData)),
    }),
  );
}

function mockFetchError(status, body) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      statusText: 'Error',
      json: () => { throw new Error('not json'); },
      text: () => Promise.resolve(body || ''),
    }),
  );
}

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('sendAIRequest', () => {
  describe('OpenAI provider', () => {
    it('sends correct URL, headers, and body', async () => {
      mockFetch({
        choices: [{ message: { content: '{"name":"test"}' } }],
      });

      const result = await sendAIRequest(
        { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' },
        'system prompt',
        'user prompt',
      );

      expect(result).toEqual({ name: 'test' });

      const call = global.fetch.mock.calls[0];
      expect(call[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(call[1].headers.Authorization).toBe('Bearer sk-test');
      expect(call[1].headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(call[1].body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('system prompt');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('user prompt');
      expect(body.temperature).toBe(0);
    });

    it('uses custom endpoint when provided', async () => {
      mockFetch({
        choices: [{ message: { content: '{"ok":true}' } }],
      });

      await sendAIRequest(
        { provider: 'custom', apiKey: 'sk-test', model: 'gpt-4o-mini', endpoint: 'https://my-server.example/v1' },
        'sys',
        'user',
      );

      const call = global.fetch.mock.calls[0];
      expect(call[0]).toBe('https://my-server.example/v1/chat/completions');
    });

    it('strips trailing slash from endpoint', async () => {
      mockFetch({
        choices: [{ message: { content: '{"ok":true}' } }],
      });

      await sendAIRequest(
        { provider: 'custom', apiKey: 'sk-test', model: 'gpt-4o-mini', endpoint: 'https://my-server.example/v1/' },
        'sys',
        'user',
      );

      const call = global.fetch.mock.calls[0];
      expect(call[0]).toBe('https://my-server.example/v1/chat/completions');
    });
  });

  describe('Anthropic provider', () => {
    it('sends correct URL, headers, and body', async () => {
      mockFetch({
        content: [{ text: '{"name":"test"}' }],
      });

      const result = await sendAIRequest(
        { provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-3-haiku-20240307' },
        'system prompt',
        'user prompt',
      );

      expect(result).toEqual({ name: 'test' });

      const call = global.fetch.mock.calls[0];
      expect(call[0]).toBe('https://api.anthropic.com/v1/messages');
      expect(call[1].headers['x-api-key']).toBe('sk-ant-test');
      expect(call[1].headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(call[1].body);
      expect(body.model).toBe('claude-3-haiku-20240307');
      expect(body.max_tokens).toBe(4096);
      expect(body.system).toBe('system prompt');
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('user prompt');
    });
  });

  describe('error handling', () => {
    it('throws clear error when API key is missing', async () => {
      await expect(
        sendAIRequest({ provider: 'openai', apiKey: null }, 'sys', 'user'),
      ).rejects.toThrow('AI API key is not configured');
    });

    it('throws clear error when API key is empty string', async () => {
      await expect(
        sendAIRequest({ provider: 'openai', apiKey: '' }, 'sys', 'user'),
      ).rejects.toThrow('AI API key is not configured');
    });

    it('throws clear error for unknown provider', async () => {
      await expect(
        sendAIRequest({ provider: 'unknown', apiKey: 'sk-test' }, 'sys', 'user'),
      ).rejects.toThrow('Unknown AI provider');
    });

    it('throws with raw text when response is not valid JSON', async () => {
      mockFetch({
        choices: [{ message: { content: 'This is not JSON' } }],
      });

      await expect(
        sendAIRequest({ provider: 'openai', apiKey: 'sk-test' }, 'sys', 'user'),
      ).rejects.toThrow('AI response was not valid JSON');
    });

    it('throws with raw text when Anthropic response is not valid JSON', async () => {
      mockFetch({
        content: [{ text: 'Not JSON at all' }],
      });

      await expect(
        sendAIRequest({ provider: 'anthropic', apiKey: 'sk-ant-test' }, 'sys', 'user'),
      ).rejects.toThrow('AI response was not valid JSON');
    });

    it('parses JSON wrapped in markdown code fences', async () => {
      mockFetch({
        choices: [{
          message: {
            content: '```json\n{"name": "test", "value": 42}\n```',
          },
        }],
      });

      const result = await sendAIRequest(
        { provider: 'openai', apiKey: 'sk-test' },
        'sys',
        'user',
      );

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('throws on HTTP error with status text', async () => {
      mockFetchError(401, 'Invalid API key');

      await expect(
        sendAIRequest({ provider: 'openai', apiKey: 'sk-bad' }, 'sys', 'user'),
      ).rejects.toThrow('AI request failed (401)');
    });

    it('throws on Anthropic HTTP error', async () => {
      mockFetchError(429, 'Rate limit exceeded');

      await expect(
        sendAIRequest({ provider: 'anthropic', apiKey: 'sk-ant-test' }, 'sys', 'user'),
      ).rejects.toThrow('Anthropic request failed (429)');
    });
  });
});

describe('supportsToolUse', () => {
  it('returns true for openai', () => {
    expect(supportsToolUse({ provider: 'openai' })).toBe(true);
  });

  it('returns true for openrouter', () => {
    expect(supportsToolUse({ provider: 'openrouter' })).toBe(true);
  });

  it('returns true for anthropic', () => {
    expect(supportsToolUse({ provider: 'anthropic' })).toBe(true);
  });

  it('returns false for custom', () => {
    expect(supportsToolUse({ provider: 'custom' })).toBe(false);
  });

  it('returns false for unknown provider', () => {
    expect(supportsToolUse({ provider: 'unknown' })).toBe(false);
  });

  it('returns false when config is null', () => {
    expect(supportsToolUse(null)).toBe(false);
  });

  it('returns false when config has no provider', () => {
    expect(supportsToolUse({})).toBe(false);
  });
});

describe('sendAIRequestWithTools', () => {
  describe('OpenAI format', () => {
    it('executes tool call and returns final JSON response', async () => {
      // First response: tool_call
      // Second response: final JSON
      const executeTool = jest.fn().mockResolvedValue([{ id: 1, name: 'Bench Press' }]);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: null,
                tool_calls: [{
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'search_exercises',
                    arguments: '{"query":"Bench Press"}',
                  },
                }],
              },
            }],
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: '{"routineName":"Push Day","exercises":[{"name":"Bench Press","exerciseId":1}]}',
              },
            }],
          }),
          text: () => Promise.resolve(''),
        });

      const result = await sendAIRequestWithTools(
        { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' },
        'system prompt',
        'user prompt',
        [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
        executeTool,
      );

      expect(result).toEqual({
        routineName: 'Push Day',
        exercises: [{ name: 'Bench Press', exerciseId: 1 }],
      });

      // Should have called fetch twice
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // First call should include tools in body
      const firstCallBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(firstCallBody.tools).toBeDefined();
      expect(firstCallBody.tools[0].type).toBe('function');
      expect(firstCallBody.tools[0].function.name).toBe('search_exercises');

      // Second call should include tool result in messages
      const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      const toolMessages = secondCallBody.messages.filter((m) => m.role === 'tool');
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].tool_call_id).toBe('call_1');
      expect(JSON.parse(toolMessages[0].content)).toEqual([{ id: 1, name: 'Bench Press' }]);

      // executeTool should have been called with correct args
      expect(executeTool).toHaveBeenCalledWith('search_exercises', { query: 'Bench Press' });
    });

    it('handles multiple tool calls in one response', async () => {
      const executeTool = jest.fn()
        .mockResolvedValueOnce([{ id: 1, name: 'Bench Press' }])
        .mockResolvedValueOnce([{ id: 2, name: 'Squat' }]);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: null,
                tool_calls: [
                  { id: 'call_1', type: 'function', function: { name: 'search_exercises', arguments: '{"query":"Bench Press"}' } },
                  { id: 'call_2', type: 'function', function: { name: 'search_exercises', arguments: '{"query":"Squat"}' } },
                ],
              },
            }],
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: '{"routineName":"Leg Day","exercises":[{"name":"Bench Press","exerciseId":1},{"name":"Squat","exerciseId":2}]}',
              },
            }],
          }),
          text: () => Promise.resolve(''),
        });

      const result = await sendAIRequestWithTools(
        { provider: 'openai', apiKey: 'sk-test' },
        'system prompt',
        'user prompt',
        [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
        executeTool,
      );

      expect(result.exercises).toHaveLength(2);
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it('handles tool execution errors gracefully', async () => {
      const executeTool = jest.fn().mockRejectedValue(new Error('DB error'));

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: null,
                tool_calls: [{
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'search_exercises', arguments: '{"query":"Bench Press"}' },
                }],
              },
            }],
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: '{"routineName":"Push Day","exercises":[{"name":"Bench Press","exerciseId":null}]}',
              },
            }],
          }),
          text: () => Promise.resolve(''),
        });

      const result = await sendAIRequestWithTools(
        { provider: 'openai', apiKey: 'sk-test' },
        'system prompt',
        'user prompt',
        [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
        executeTool,
      );

      // Should still get a result — tool error is captured and sent back to LLM
      expect(result.exercises[0].exerciseId).toBeNull();
    });
  });

  describe('Anthropic format', () => {
    it('executes tool use and returns final text response', async () => {
      const executeTool = jest.fn().mockResolvedValue([{ id: 1, name: 'Bench Press' }]);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me search for that exercise.' },
              { type: 'tool_use', id: 'toolu_1', name: 'search_exercises', input: { query: 'Bench Press' } },
            ],
            model: 'claude-3-haiku-20240307',
            stop_reason: 'tool_use',
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: '{"routineName":"Push Day","exercises":[{"name":"Bench Press","exerciseId":1}]}' },
            ],
            model: 'claude-3-haiku-20240307',
            stop_reason: 'end_turn',
          }),
          text: () => Promise.resolve(''),
        });

      const result = await sendAIRequestWithTools(
        { provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-3-haiku-20240307' },
        'system prompt',
        'user prompt',
        [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
        executeTool,
      );

      expect(result).toEqual({
        routineName: 'Push Day',
        exercises: [{ name: 'Bench Press', exerciseId: 1 }],
      });

      // Should have called fetch twice
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // First call should include tools in body
      const firstCallBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(firstCallBody.tools).toBeDefined();
      expect(firstCallBody.tools[0].name).toBe('search_exercises');
      expect(firstCallBody.tools[0].input_schema).toBeDefined();

      // Second call should include tool result in messages
      const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      const lastMessage = secondCallBody.messages[secondCallBody.messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content[0].type).toBe('tool_result');
      expect(lastMessage.content[0].tool_use_id).toBe('toolu_1');

      // executeTool should have been called with correct args
      expect(executeTool).toHaveBeenCalledWith('search_exercises', { query: 'Bench Press' });
    });
  });

  describe('max iterations', () => {
    it('throws after 10 iterations of tool calls', async () => {
      const executeTool = jest.fn().mockResolvedValue([{ id: 1, name: 'Bench Press' }]);

      // Always return a tool_call response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: { name: 'search_exercises', arguments: '{"query":"Bench Press"}' },
              }],
            },
          }],
        }),
        text: () => Promise.resolve(''),
      });

      await expect(
        sendAIRequestWithTools(
          { provider: 'openai', apiKey: 'sk-test' },
          'system prompt',
          'user prompt',
          [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
          executeTool,
        ),
      ).rejects.toThrow('exceeded maximum iterations');

      // Should have called fetch 10 times (the max)
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });
  });

  describe('fallback', () => {
    it('falls back to sendAIRequest for unknown provider', async () => {
      // For unknown provider, sendAIRequestWithTools calls sendAIRequest
      // which will throw "Unknown AI provider"
      await expect(
        sendAIRequestWithTools(
          { provider: 'unknown', apiKey: 'sk-test' },
          'system prompt',
          'user prompt',
          [{ name: 'search_exercises', description: 'Search exercises', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }],
          jest.fn(),
        ),
      ).rejects.toThrow('Unknown AI provider');
    });
  });
});
