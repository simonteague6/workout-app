// instructionGenerate — given an exercise name, ask the LLM for default
// instructions. The user can edit the result before saving.

import { sendAIRequest } from './aiClient.js';

/**
 * Generate default instructions for an exercise.
 * @param {{ provider?: string|null, apiKey?: string|null, model?: string|null, endpoint?: string|null }} aiConfig
 * @param {string} exerciseName
 * @returns {Promise<string>} instruction text
 */
export async function generateInstructions(aiConfig, exerciseName) {
  if (!exerciseName || !exerciseName.trim()) {
    throw new Error('Exercise name is required.');
  }

  const systemPrompt =
    'You are a fitness expert. Provide clear, concise exercise instructions. ' +
    'Return only the instructions as plain text, no JSON, no markdown formatting.';

  const userPrompt = `Describe how to perform the "${exerciseName.trim()}" exercise. Include setup, movement, and breathing cues. Keep it to 3-5 short paragraphs.`;

  try {
    const response = await sendAIRequest(aiConfig, systemPrompt, userPrompt);
    // sendAIRequest returns parsed JSON, but we asked for plain text.
    // If the LLM returned a string, use it directly.
    if (typeof response === 'string') {
      return response;
    }
    // If it returned an object with an instructions/text field, extract it.
    if (response && typeof response === 'object') {
      return response.instructions || response.text || JSON.stringify(response);
    }
    return String(response);
  } catch {
    // If the LLM call fails, return a generic template
    return `Perform the ${exerciseName.trim()} exercise with proper form. Focus on controlled movement and full range of motion.`;
  }
}
