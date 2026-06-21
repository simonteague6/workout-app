// routineImport.test.js — unit tests for the routine import pipeline.
//
// Creates an in-memory SQLite database, seeds exercises, and tests the
// pipeline with mocked LLM responses. The AI client is mocked; the pipeline
// logic (text extraction, JSON parsing, exercise matching) is tested for real.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createInMemoryDb } from '../../utils/db.js';
import { seedExercises } from '../../db/seed/seed.js';
import { importRoutine } from '../routineImport.js';

const ORIGINAL_FETCH = global.fetch;

// A minimal exercise dataset for testing — just a few exercises we can match
const TEST_EXERCISES = {
  exercises: [
    {
      name: 'Bench Press',
      force: 'push',
      level: 'intermediate',
      mechanic: 'compound',
      equipment: 'barbell',
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps', 'shoulders'],
      instructions: ['Lie on bench.', 'Press bar up.', 'Lower to chest.'],
      category: 'strength',
    },
    {
      name: 'Squat',
      force: 'push',
      level: 'intermediate',
      mechanic: 'compound',
      equipment: 'barbell',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes', 'hamstrings'],
      instructions: ['Stand with bar.', 'Bend knees.', 'Stand up.'],
      category: 'strength',
    },
    {
      name: 'Deadlift',
      force: 'pull',
      level: 'intermediate',
      mechanic: 'compound',
      equipment: 'barbell',
      primaryMuscles: ['lower back'],
      secondaryMuscles: ['glutes', 'hamstrings'],
      instructions: ['Hinge at hips.', 'Grip bar.', 'Stand up.'],
      category: 'strength',
    },
    {
      name: 'Pull-Up',
      force: 'pull',
      level: 'intermediate',
      mechanic: 'compound',
      equipment: 'body only',
      primaryMuscles: ['lats'],
      secondaryMuscles: ['biceps'],
      instructions: ['Hang from bar.', 'Pull up.', 'Lower down.'],
      category: 'strength',
    },
  ],
};

let db;

beforeEach(() => {
  db = createInMemoryDb();
  seedExercises(db, TEST_EXERCISES);
  global.fetch = jest.fn();
});

afterEach(() => {
  db.close();
  global.fetch = ORIGINAL_FETCH;
});

const mockAiConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
};

/**
 * Helper: set up the fetch mock to return a specific LLM response.
 */
function mockLLMResponse(jsonResponse) {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify(jsonResponse) } }],
      }),
    text: () => Promise.resolve(JSON.stringify(jsonResponse)),
  });
}

/**
 * Helper: set up the fetch mock to return HTML content (for URL fetch).
 */
function mockURLFetch(html) {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
  });
}

describe('importRoutine', () => {
  it('matches 2 of 3 exercises against the seeded DB', async () => {
    // LLM returns 3 exercises: Bench Press (exists), Squat (exists), Push-Up (does not exist)
    mockLLMResponse({
      routineName: 'Push Day',
      exercises: [
        { name: 'Bench Press', sets: 4, repsMin: 6, repsMax: 10, restSeconds: 90 },
        { name: 'Squat', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
        { name: 'Push-Up', sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60 },
      ],
    });

    const result = await importRoutine(db, mockAiConfig, 'My push day routine');

    expect(result.routineName).toBe('Push Day');
    expect(result.exercises).toHaveLength(3);

    // Bench Press — matched
    expect(result.exercises[0].name).toBe('Bench Press');
    expect(result.exercises[0].matched).toBe(true);
    expect(result.exercises[0].matchedExerciseId).toBeGreaterThan(0);
    expect(result.exercises[0].sets).toBe(4);
    expect(result.exercises[0].repsMin).toBe(6);
    expect(result.exercises[0].repsMax).toBe(10);
    expect(result.exercises[0].restSeconds).toBe(90);

    // Squat — matched
    expect(result.exercises[1].name).toBe('Squat');
    expect(result.exercises[1].matched).toBe(true);
    expect(result.exercises[1].matchedExerciseId).toBeGreaterThan(0);

    // Push-Up — unmatched
    expect(result.exercises[2].name).toBe('Push-Up');
    expect(result.exercises[2].matched).toBe(false);
    expect(result.exercises[2].matchedExerciseId).toBeNull();
  });

  it('fetches URL content and sends extracted text to LLM', async () => {
    // First call: URL fetch returns HTML
    // Second call: LLM returns JSON
    mockURLFetch('<html><body><h1>My Routine</h1><p>Bench Press 3x10</p></body></html>');
    // After URL fetch, the LLM call happens — need to set up the second response
    // Since fetch is called twice (URL + LLM), we use mockImplementationOnce
    global.fetch.mockReset();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html><body><h1>My Routine</h1><p>Bench Press 3x10</p></body></html>'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify({
              routineName: 'My Routine',
              exercises: [{ name: 'Bench Press', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 }],
            }) } }],
          }),
        text: () => Promise.resolve(''),
      });

    const result = await importRoutine(db, mockAiConfig, 'https://example.com/routine');

    // Should have called fetch twice: once for URL, once for LLM
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://example.com/routine');
    expect(global.fetch.mock.calls[1][0]).toBe('https://api.openai.com/v1/chat/completions');

    expect(result.routineName).toBe('My Routine');
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].name).toBe('Bench Press');
    expect(result.exercises[0].matched).toBe(true);
  });

  it('sends pasted text directly to LLM without fetching', async () => {
    mockLLMResponse({
      routineName: 'Leg Day',
      exercises: [
        { name: 'Squat', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
      ],
    });

    const result = await importRoutine(db, mockAiConfig, 'My leg day: Squat 3x8-12');

    // Should have called fetch once (for LLM, not URL)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.routineName).toBe('Leg Day');
  });

  it('returns raw text when LLM response is not valid JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'This is not JSON at all' } }],
        }),
      text: () => Promise.resolve(''),
    });

    const result = await importRoutine(db, mockAiConfig, 'Some routine text');

    expect(result.routineName).toBe('');
    expect(result.exercises).toHaveLength(0);
    expect(result._rawText).toBe('This is not JSON at all');
  });

  it('throws graceful error on URL fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(
      importRoutine(db, mockAiConfig, 'https://example.com/routine'),
    ).rejects.toThrow('Could not fetch URL');
  });

  it('throws graceful error on URL HTTP error', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    await expect(
      importRoutine(db, mockAiConfig, 'https://example.com/routine'),
    ).rejects.toThrow('Failed to fetch URL (403)');
  });

  it('throws on empty input', async () => {
    await expect(
      importRoutine(db, mockAiConfig, ''),
    ).rejects.toThrow('No input provided');
  });

  it('throws on whitespace-only input', async () => {
    await expect(
      importRoutine(db, mockAiConfig, '   '),
    ).rejects.toThrow('No input provided');
  });

  it('throws when LLM returns empty exercises array', async () => {
    mockLLMResponse({
      routineName: 'Empty Routine',
      exercises: [],
    });

    await expect(
      importRoutine(db, mockAiConfig, 'Some text'),
    ).rejects.toThrow('AI returned no exercises');
  });

  it('throws when LLM returns null', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'null' } }],
        }),
      text: () => Promise.resolve(''),
    });

    await expect(
      importRoutine(db, mockAiConfig, 'Some text'),
    ).rejects.toThrow('AI returned an empty or malformed response');
  });

  it('strips HTML tags from fetched content', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(
          '<html><head><script>var x=1;</script><style>.hide{display:none}</style></head>' +
          '<body><h1>Push Day</h1><ul><li>Bench Press 4x10</li><li>Squat 3x8</li></ul></body></html>',
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify({
              routineName: 'Push Day',
              exercises: [
                { name: 'Bench Press', sets: 4, repsMin: 8, repsMax: 10, restSeconds: 90 },
                { name: 'Squat', sets: 3, repsMin: 6, repsMax: 8, restSeconds: 120 },
              ],
            }) } }],
          }),
        text: () => Promise.resolve(''),
      });

    const result = await importRoutine(db, mockAiConfig, 'https://example.com');

    expect(result.routineName).toBe('Push Day');
    expect(result.exercises).toHaveLength(2);
  });

  it('uses default values when LLM omits optional fields', async () => {
    mockLLMResponse({
      routineName: 'Minimal',
      exercises: [
        { name: 'Bench Press' },
      ],
    });

    const result = await importRoutine(db, mockAiConfig, 'Bench Press');

    expect(result.exercises[0].sets).toBe(3);
    expect(result.exercises[0].repsMin).toBe(5);
    expect(result.exercises[0].repsMax).toBe(12);
    expect(result.exercises[0].restSeconds).toBe(90);
  });

  it('uses "Imported Routine" as fallback name when LLM omits routineName', async () => {
    mockLLMResponse({
      exercises: [
        { name: 'Bench Press', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 },
      ],
    });

    const result = await importRoutine(db, mockAiConfig, 'Some text');

    expect(result.routineName).toBe('Imported Routine');
  });
});
