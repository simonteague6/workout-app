// aiClient.test.js — unit tests for the AI client.
//
// Mocks global.fetch to simulate LLM API responses. Tests cover:
//   - OpenAI provider: correct URL, headers, body parsing
//   - Anthropic provider: correct URL, headers, body parsing
//   - Missing API key: throws clear error
//   - Non-JSON response: throws with raw text
//   - Markdown-wrapped JSON: parsed correctly

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { sendAIRequest } from '../aiClient.js';

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
