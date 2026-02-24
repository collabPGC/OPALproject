/**
 * Ralph Mode - Autonomous Iterative Analysis for Mattermost Bots
 *
 * Based on the Ralph Wiggum technique by Geoffrey Huntley
 * https://ghuntley.com/ralph/
 *
 * "Ralph is a technique. In its purest form, Ralph is a Bash loop."
 *
 * Key Philosophy:
 * - Iteration > Perfection: Don't aim for perfect on first try
 * - Failures Are Data: Use mistakes to tune and improve
 * - Self-Referential: Each iteration sees previous work
 * - Autonomous Decision: Bot decides when deep iteration is needed
 *
 * The bot autonomously decides when to iterate based on:
 * - Complexity of the topic
 * - Quality of initial output
 * - Presence of gaps or uncertainties
 * - Depth of analysis required
 */

// Configuration
const CONFIG = {
  maxIterations: 5,
  minIterations: 1,
  gapIndicators: [
    'more research needed',
    'further investigation',
    'unclear',
    'uncertain',
    'limited information',
    'could not find',
    'need more data',
    'requires deeper',
    'surface level',
    'preliminary',
  ],
  complexityIndicators: [
    'architecture',
    'system design',
    'technical deep dive',
    'comprehensive',
    'thorough',
    'detailed analysis',
    'strategic',
    'multi-faceted',
    'compare',
    'tradeoffs',
    'pros and cons',
  ],
  completionIndicators: [
    'comprehensive analysis complete',
    'all aspects covered',
    'analysis complete',
    'RALPH_COMPLETE',
  ],
};

/**
 * Analyze if a topic requires deep iterative analysis
 * Returns: { needsIteration: boolean, suggestedIterations: number, reason: string }
 */
export function assessComplexity(topic, context = '') {
  const combined = `${topic} ${context}`.toLowerCase();

  // Check for complexity indicators
  let complexityScore = 0;
  const foundIndicators = [];

  for (const indicator of CONFIG.complexityIndicators) {
    if (combined.includes(indicator.toLowerCase())) {
      complexityScore++;
      foundIndicators.push(indicator);
    }
  }

  // Check topic length and structure
  const wordCount = topic.split(/\s+/).length;
  if (wordCount > 10) complexityScore++;
  if (topic.includes('?') && topic.split('?').length > 2) complexityScore++; // Multiple questions

  // Determine if iteration needed
  const needsIteration = complexityScore >= 2;
  const suggestedIterations = Math.min(CONFIG.maxIterations, Math.max(2, complexityScore));

  return {
    needsIteration,
    suggestedIterations,
    complexityScore,
    reason: foundIndicators.length > 0
      ? `Complex topic detected: ${foundIndicators.join(', ')}`
      : 'Standard complexity'
  };
}

/**
 * Analyze output for gaps that need addressing
 * Returns: { hasGaps: boolean, gaps: string[], confidence: number }
 */
export function analyzeForGaps(output) {
  const lower = output.toLowerCase();
  const gaps = [];

  // Check for gap indicators in output
  for (const indicator of CONFIG.gapIndicators) {
    if (lower.includes(indicator)) {
      gaps.push(indicator);
    }
  }

  // Check for hedging language
  const hedgeWords = ['might', 'perhaps', 'possibly', 'maybe', 'could be', 'not sure'];
  let hedgeCount = 0;
  for (const hedge of hedgeWords) {
    const matches = lower.split(hedge).length - 1;
    hedgeCount += matches;
  }

  // Check for missing sections (if structured output expected)
  const hasConclusion = lower.includes('conclusion') || lower.includes('recommendation') || lower.includes('summary');
  const hasEvidence = lower.includes('evidence') || lower.includes('data') || lower.includes('source');

  if (!hasConclusion && output.length > 1000) gaps.push('missing conclusion/recommendation');
  if (!hasEvidence && output.length > 500) gaps.push('missing evidence/sources');

  // Calculate confidence (inverse of gaps)
  const confidence = Math.max(0, 1 - (gaps.length * 0.15) - (hedgeCount * 0.05));

  return {
    hasGaps: gaps.length > 0 || confidence < 0.7,
    gaps,
    hedgeCount,
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * Check if output indicates analysis is complete
 */
export function isAnalysisComplete(output) {
  const lower = output.toLowerCase();

  for (const indicator of CONFIG.completionIndicators) {
    if (lower.includes(indicator.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Generate iteration context for next pass
 */
export function generateIterationContext(iteration, previousOutput, gaps) {
  let context = `\n\n---\n## RALPH MODE - Iteration ${iteration}\n\n`;
  context += `### Self-Review of Previous Analysis:\n`;
  context += `Your previous analysis was ${previousOutput.length} characters.\n\n`;

  if (gaps.gaps && gaps.gaps.length > 0) {
    context += `### Identified Gaps to Address:\n`;
    for (const gap of gaps.gaps) {
      context += `- ${gap}\n`;
    }
    context += '\n';
  }

  context += `### Confidence Assessment: ${Math.round(gaps.confidence * 100)}%\n\n`;

  context += `### Instructions for This Iteration:\n`;
  context += `1. Review your previous analysis (shown above in conversation)\n`;
  context += `2. Address the identified gaps specifically\n`;
  context += `3. Add NEW insights - don't repeat what you already covered\n`;
  context += `4. Increase depth where analysis was surface-level\n`;
  context += `5. If analysis is now comprehensive, include "ANALYSIS COMPLETE" at the end\n\n`;

  context += `### Previous Output Summary:\n`;
  context += `${previousOutput.substring(0, 500)}...\n`;

  return context;
}

/**
 * Create the Ralph system prompt enhancement
 */
export function getRalphSystemPrompt(depth = 'standard') {
  const iterationHint = depth === 'deep' ? 'multiple passes' : depth === 'quick' ? 'single focused pass' : 'iterative refinement as needed';

  return `
## RALPH MODE - Autonomous Iterative Analysis

You operate using the Ralph Wiggum technique - iterative self-improvement:

### Core Principles:
1. **Iteration > Perfection**: First pass doesn't need to be perfect
2. **Self-Referential**: Review your own work and improve it
3. **Gap Detection**: Identify what's missing and fill it
4. **Autonomous Decision**: You decide when analysis is complete

### Analysis Approach (${iterationHint}):
- Start with solid initial analysis
- Self-assess: What's missing? What could be deeper?
- If gaps exist, address them in follow-up
- When truly comprehensive, state "ANALYSIS COMPLETE"

### Quality Markers:
- Concrete evidence and examples, not just assertions
- Multiple perspectives where relevant
- Honest acknowledgment of uncertainties
- Actionable insights when applicable
- Clear structure with logical flow

### Avoid:
- Repeating the same points in different words
- Surface-level observations without depth
- Hedging excessively without substance
- Claiming completeness when gaps remain
`;
}

/**
 * Perform iterative analysis with Ralph mode
 * The bot AUTONOMOUSLY decides when to do extended iteration based on:
 * 1. Initial complexity assessment
 * 2. Quality of first-pass output
 * 3. Self-detected gaps that need addressing
 *
 * @param {Function} analysisFn - The analysis function to call (async, takes topic + context + optional ralphPrompt)
 * @param {string} topic - The research/analysis topic
 * @param {string} context - Initial context
 * @param {string} depth - 'quick', 'standard', or 'deep' (user preference)
 * @param {Function} logFn - Optional logging function
 * @returns {Promise<{output: string, iterations: number, confidence: number, extended: boolean}>}
 */
export async function iterativeAnalysis(analysisFn, topic, context, depth = 'standard', logFn = console.log) {
  // Quick mode: always single pass
  if (depth === 'quick') {
    logFn(`[Ralph] Quick mode - single pass`);
    const result = await analysisFn(topic, context, '');
    return { output: result, iterations: 1, confidence: 1, extended: false };
  }

  // First pass: do initial analysis
  logFn(`[Ralph] First pass analysis`);
  let currentOutput = await analysisFn(topic, context, '');

  // Analyze first pass for quality
  const firstPassGaps = analyzeForGaps(currentOutput);
  const complexity = assessComplexity(topic, context);

  // AUTONOMOUS DECISION: Does this need extended iteration?
  const needsExtended = (
    depth === 'deep' ||                           // User requested deep
    firstPassGaps.confidence < 0.6 ||             // Low confidence in first pass
    firstPassGaps.gaps.length >= 3 ||             // Multiple gaps detected
    complexity.complexityScore >= 3 ||            // High complexity topic
    currentOutput.length < 1500                    // Suspiciously short output
  );

  if (!needsExtended) {
    logFn(`[Ralph] First pass sufficient (confidence: ${firstPassGaps.confidence}, gaps: ${firstPassGaps.gaps.length})`);
    return {
      output: currentOutput,
      iterations: 1,
      confidence: firstPassGaps.confidence,
      extended: false
    };
  }

  // EXTENDED ITERATION MODE
  logFn(`[Ralph] Entering extended iteration mode (confidence: ${firstPassGaps.confidence}, complexity: ${complexity.complexityScore})`);

  const maxIterations = depth === 'deep' ? 5 : 3;
  let iteration = 1;
  let finalConfidence = firstPassGaps.confidence;

  while (iteration < maxIterations) {
    iteration++;

    // Generate context for this iteration
    const gaps = analyzeForGaps(currentOutput);
    const iterContext = context + generateIterationContext(iteration, currentOutput, gaps);
    const ralphPrompt = getRalphSystemPrompt(depth);

    logFn(`[Ralph] Extended iteration ${iteration}/${maxIterations} (addressing ${gaps.gaps.length} gaps)`);

    // Perform iteration
    currentOutput = await analysisFn(topic, iterContext, ralphPrompt);

    // Check for explicit completion
    if (isAnalysisComplete(currentOutput)) {
      logFn(`[Ralph] Analysis marked complete at iteration ${iteration}`);
      break;
    }

    // Re-analyze
    const newGaps = analyzeForGaps(currentOutput);
    finalConfidence = newGaps.confidence;

    // Stop if quality is good enough
    if (newGaps.confidence >= 0.85 && !newGaps.hasGaps) {
      logFn(`[Ralph] High quality achieved at iteration ${iteration}`);
      break;
    }

    // Stop if no improvement
    if (newGaps.confidence <= gaps.confidence && iteration >= 2) {
      logFn(`[Ralph] No improvement detected, stopping at iteration ${iteration}`);
      break;
    }
  }

  return {
    output: currentOutput,
    iterations: iteration,
    confidence: finalConfidence,
    extended: true,
    complexity: complexity.complexityScore
  };
}

/**
 * Simple wrapper for one-shot analysis that might iterate
 * Returns just the output string for backward compatibility
 */
export async function analyze(analysisFn, topic, context, depth = 'standard') {
  const result = await iterativeAnalysis(analysisFn, topic, context, depth);
  return result.output;
}

export default {
  assessComplexity,
  analyzeForGaps,
  isAnalysisComplete,
  generateIterationContext,
  getRalphSystemPrompt,
  iterativeAnalysis,
  analyze,
  CONFIG,
};
