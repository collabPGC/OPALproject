/**
 * LLM-based Reranker
 *
 * Two-stage retrieval: after hybrid search retrieves many candidates,
 * use an LLM to score and rerank for better relevance.
 *
 * Uses a fast/cheap model (gemini-2.5-flash or gpt-5.2-instant) for speed.
 */

import modelRouter from '../model-router.js';

// Reranking is triggered when we have more candidates than this
const RERANK_THRESHOLD = 5;

// Maximum candidates to send to LLM (controls cost)
const MAX_CANDIDATES = 20;

/**
 * Rerank candidates using LLM scoring
 * @param {string} query - Original search query
 * @param {Array} candidates - Array of search results with text
 * @param {number} limit - Number of results to return
 * @param {Object} options
 */
export async function rerank(query, candidates, limit = 5, options = {}) {
  const { logger = console } = options;

  // Skip reranking if few candidates
  if (candidates.length <= RERANK_THRESHOLD) {
    return candidates.slice(0, limit);
  }

  // Limit candidates to control cost
  const toRerank = candidates.slice(0, MAX_CANDIDATES);

  try {
    // Build prompt for LLM scoring
    const systemPrompt = `You are a search relevance scorer. Given a query and a list of text passages, score each passage's relevance to the query on a scale of 0-10.

Output ONLY a JSON array of scores in the same order as the passages. Nothing else.

Example output: [8, 3, 7, 5, 9]

Scoring guidelines:
- 10: Perfect match, directly answers the query
- 7-9: Highly relevant, contains key information
- 4-6: Somewhat relevant, tangentially related
- 1-3: Marginally relevant, shares some keywords
- 0: Completely irrelevant`;

    // Format candidates for the prompt
    const passageList = toRerank.map((c, i) =>
      `[${i}] ${c.text.slice(0, 500)}${c.text.length > 500 ? '...' : ''}`
    ).join('\n\n');

    const userPrompt = `Query: "${query}"

Passages:
${passageList}

Score each passage (0-10) as a JSON array:`;

    // Use a fast model for reranking
    const response = await modelRouter.complete('summary', [
      { role: 'user', content: userPrompt }
    ], {
      system: systemPrompt,
      maxTokens: 256,
      temperature: 0,
      costTier: 'budget'  // Use cheapest available
    });

    // Parse scores
    const scoreText = response.content || response.text || '';
    const scores = parseScores(scoreText, toRerank.length);

    if (scores.length !== toRerank.length) {
      logger.log?.('warn', 'Reranker score mismatch, falling back', {
        expected: toRerank.length,
        got: scores.length
      });
      return candidates.slice(0, limit);
    }

    // Attach scores and sort
    const reranked = toRerank.map((c, i) => ({
      ...c,
      rerankScore: scores[i],
      originalRank: i
    }));

    reranked.sort((a, b) => b.rerankScore - a.rerankScore);

    logger.log?.('debug', 'Reranked results', {
      query: query.slice(0, 50),
      topScore: reranked[0]?.rerankScore,
      model: response.selectedModel
    });

    return reranked.slice(0, limit);

  } catch (error) {
    logger.log?.('warn', 'Reranker failed, using original order', {
      error: error.message
    });
    return candidates.slice(0, limit);
  }
}

/**
 * Parse LLM score output into array of numbers
 * @param {string} text
 * @param {number} expectedCount
 */
function parseScores(text, expectedCount) {
  try {
    // Try to extract JSON array
    const match = text.match(/\[[\d,\s.]+\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
        return parsed.map(n => Math.min(10, Math.max(0, n)));
      }
    }

    // Fallback: extract all numbers
    const numbers = text.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length >= expectedCount) {
      return numbers.slice(0, expectedCount).map(n =>
        Math.min(10, Math.max(0, parseFloat(n)))
      );
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Check if reranking should be applied
 * @param {Array} candidates
 * @param {Object} options
 */
export function shouldRerank(candidates, options = {}) {
  const { forceRerank = false, skipRerank = false } = options;

  if (skipRerank) return false;
  if (forceRerank) return true;

  // Rerank when we have enough candidates that ordering matters
  return candidates.length > RERANK_THRESHOLD;
}

/**
 * Batch rerank multiple result sets
 * @param {string} query
 * @param {Object} resultSets - { documents: [...], conversations: [...] }
 * @param {number} limit
 * @param {Object} options
 */
export async function rerankAll(query, resultSets, limit = 5, options = {}) {
  const results = {};

  const promises = Object.entries(resultSets).map(async ([key, candidates]) => {
    if (shouldRerank(candidates, options)) {
      results[key] = await rerank(query, candidates, limit, options);
    } else {
      results[key] = candidates.slice(0, limit);
    }
  });

  await Promise.all(promises);
  return results;
}

export default {
  rerank,
  rerankAll,
  shouldRerank
};
