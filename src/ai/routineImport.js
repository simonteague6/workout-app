// routineImport — full pipeline: URL/text → extract text → LLM prompt →
// parse JSON → match exercises against the Exercise library.
//
// The pipeline is tested as pure functions with mocked LLM responses (not UI
// rendering). The AI client is mocked in tests; the pipeline logic (text
// extraction, JSON parsing, exercise matching) is tested for real.

import { searchExercises } from '../db/queries/exerciseQueries.js';
import { sendAIRequest } from './aiClient.js';

/**
 * @typedef {Object} ImportResult
 * @property {string} routineName
 * @property {Array<{
 *   name: string,
 *   sets: number,
 *   repsMin: number,
 *   repsMax: number,
 *   restSeconds: number,
 *   matchedExerciseName: string|null,
 *   matched: boolean,
 * }>} exercises
 */


/**
 * Full pipeline: URL/text → extract text → LLM prompt → parse JSON → match
 * exercises against the Exercise library.
 *
 * @param {import('../utils/db.js').DbAdapter} db
 * @param {{ provider?: string|null, apiKey?: string|null, model?: string|null, endpoint?: string|null }} aiConfig
 * @param {string} input - URL or pasted text
 * @returns {Promise<ImportResult>}
 */
export async function importRoutine(db, aiConfig, input) {
  if (!input || !input.trim()) {
    throw new Error('No input provided. Paste a routine URL or text.');
  }

  const trimmed = input.trim();

  // Step 1: Detect URL and fetch content
  let content = trimmed;
  if (isURL(trimmed)) {
    content = await fetchURLContent(trimmed);
  }

  // Step 2: Build system prompt
  const systemPrompt =
    'You are a fitness routine parser. Extract the workout routine as JSON with this schema: ' +
    '{ routineName: string, exercises: [{ name: string, sets: number, repsMin: number, repsMax: number, restSeconds: number }] }';

  // Step 3: Call LLM
  let parsed;
  try {
    parsed = await sendAIRequest(aiConfig, systemPrompt, content);
  } catch (err) {
    // If the error contains raw text (non-JSON), surface it for manual entry
    if (err.message && err.message.startsWith('AI response was not valid JSON')) {
      return {
        routineName: '',
        exercises: [],
        _rawText: err.message.replace('AI response was not valid JSON:\n', ''),
      };
    }
    throw err;
  }

  // Validate parsed structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI returned an empty or malformed response.');
  }

  const routineName = (parsed.routineName || '').toString().trim() || 'Imported Routine';
  const rawExercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];

  if (rawExercises.length === 0) {
    throw new Error('AI returned no exercises. The input may not contain a recognizable routine.');
  }

  // Step 4: Match exercises against the Exercise library
  const exercises = [];
  for (const ex of rawExercises) {
    const name = (ex.name || '').toString().trim();
    if (!name) continue;

    const matched = findExactMatch(db, name);
    exercises.push({
      name,
      sets: Number(ex.sets) || 3,
      repsMin: Number(ex.repsMin) || 5,
      repsMax: Number(ex.repsMax) || 12,
      restSeconds: Number(ex.restSeconds) || 90,
      matchedExerciseName: matched ? matched.name : null,
      matchedExerciseId: matched ? matched.id : null,
      matched: !!matched,
    });
  }

  return { routineName, exercises };
}

/**
 * Check if a string looks like a URL.
 * @param {string} s
 * @returns {boolean}
 */
function isURL(s) {
  return /^https?:\/\//i.test(s);
}

/**
 * Fetch content from a URL and extract readable text by stripping HTML tags.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchURLContent(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not fetch URL "${url}". Check the URL and your internet connection.`);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch URL (${response.status}). The site may require authentication or block automated access.`,
    );
  }

  const html = await response.text();
  return stripHTML(html);
}

/**
 * Strip HTML tags from a string using a simple regex.
 * In React Native there's no DOMParser, so this is a pragmatic alternative.
 * @param {string} html
 * @returns {string}
 */
function stripHTML(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find an exact (case-insensitive) name match in the Exercise table.
 * @param {import('../utils/db.js').DbAdapter} db
 * @param {string} name
 * @returns {{ id: number, name: string }|null}
 */
function findExactMatch(db, name) {
  const results = searchExercises(db, { query: name, limit: 10 });
  const lower = name.toLowerCase();
  for (const row of results) {
    if (row.name.toLowerCase() === lower) {
      return { id: row.id, name: row.name };
    }
  }
  return null;
}
