/**
 * Daily Digest - "View from the Advisory Board"
 *
 * Generates and posts a daily advisory digest with perspectives
 * from all personas, gap identification, and recommendations.
 *
 * Advisory board tone: wise counsel, high-signal, not chatty.
 */

import cron from 'node-cron';
import companyState from './company-state.js';
import domainFrameworks from './domain-frameworks.js';
import observationMode from './observation-mode.js';
import personaRouter from './persona-router.js';
import institutionalMemory from 'bots-shared/institutional-memory';
import * as llm from 'bots-shared/llm.js';
import * as mm from 'bots-shared/mattermost.js';

let config = null;
let logger = () => {};
let scheduledJob = null;

/**
 * Initialize the daily digest system.
 */
export function init(digestConfig, log) {
  config = digestConfig;
  logger = log || (() => {});

  if (!config?.enabled) {
    logger('info', 'Daily digest disabled');
    return;
  }

  if (!config.channelId) {
    logger('warn', 'Daily digest enabled but no channelId configured');
    return;
  }

  // Schedule the digest
  const schedule = config.schedule || '0 9 * * 1-5'; // Default: 9 AM weekdays
  scheduledJob = cron.schedule(schedule, async () => {
    logger('info', 'Triggering scheduled daily digest');
    await generateAndPostDigest();
  }, {
    timezone: config.timezone || 'America/New_York',
  });

  logger('info', 'Daily digest scheduled', { schedule, timezone: config.timezone || 'America/New_York' });
}

/**
 * Stop the scheduled digest.
 */
export function stop() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    logger('info', 'Daily digest stopped');
  }
}

/**
 * Generate and post the daily digest.
 */
export async function generateAndPostDigest() {
  if (!config?.channelId) {
    logger('error', 'Cannot generate digest: no channelId configured');
    return null;
  }

  logger('info', 'Generating daily digest');

  try {
    // 1. Gather inputs
    const state = companyState.loadState();
    const observations = observationMode.getAndClearNoteworthyItems();
    const topTopics = observationMode.getTopTopics(10);
    const observedGaps = observationMode.getObservedGaps({ limit: 10 });
    const observationSummary = observationMode.getSummary();

    // Get recent events from institutional memory (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let recentEvents = [];
    try {
      recentEvents = institutionalMemory.query({
        since: yesterday,
        limit: 50,
      });
    } catch (err) {
      logger('warn', 'Failed to query institutional memory', { error: err.message });
    }

    // 2. Generate perspectives from key personas (not all 14, just those with something to say)
    const priorityPersonas = [
      'strategist',
      'product-owner',
      'clinical-advisor',
      'regulatory-affairs',
      'security-architect',
      'enterprise-architect',
    ];

    const perspectives = [];
    for (const personaKey of priorityPersonas) {
      const perspective = await generatePersonaPerspective(
        personaKey,
        state,
        observations,
        recentEvents,
        topTopics,
        observedGaps
      );
      if (perspective.hasContent) {
        perspectives.push(perspective);
      }
    }

    // 3. Check if we have anything worth posting
    const stateSummary = companyState.getSummary();
    const hasContent = perspectives.length > 0 ||
                       stateSummary.gaps.critical > 0 ||
                       observedGaps.filter(g => g.severity === 'high').length > 0;

    if (!hasContent) {
      logger('info', 'No substantive content for digest, skipping');
      return null;
    }

    // 4. Format the digest
    const digest = formatDigest(perspectives, stateSummary, observedGaps, topTopics);

    // 5. Post to channel
    await mm.postMessage(config.channelId, digest);
    logger('info', 'Daily digest posted', { perspectiveCount: perspectives.length });

    // 6. Emit digest event to institutional memory
    try {
      await institutionalMemory.emit({
        agent: 'gtm-advisory-board',
        type: 'DIGEST',
        domain: 'operations',
        title: `Daily Advisory Digest - ${new Date().toISOString().slice(0, 10)}`,
        content: digest,
        tags: ['digest', 'advisory', 'daily'],
        metadata: {
          perspectiveCount: perspectives.length,
          topTopics: topTopics.slice(0, 5).map(t => t.name),
        },
      });
    } catch (err) {
      logger('warn', 'Failed to emit digest event', { error: err.message });
    }

    return digest;
  } catch (err) {
    logger('error', 'Failed to generate digest', { error: err.message, stack: err.stack });
    return null;
  }
}

/**
 * Generate a perspective from a single persona.
 */
async function generatePersonaPerspective(personaKey, state, observations, recentEvents, topTopics, observedGaps) {
  const persona = personaRouter.getPersona(personaKey);
  if (!persona) {
    return { personaKey, hasContent: false };
  }

  const framework = domainFrameworks.getFramework(personaKey);
  const personaObservations = observations.get(personaKey) || [];

  // Get gaps for this persona
  const gaps = framework ? domainFrameworks.identifyGaps(personaKey, state, { minImportance: 'high' }) : [];

  // Filter events relevant to this persona's domain
  const relevantEvents = recentEvents.filter(e =>
    persona.domains.includes(e.domain)
  );

  // Filter observed gaps relevant to this persona's topics
  const relevantGaps = observedGaps.filter(g =>
    g.relatedTopics?.some(t =>
      framework?.topicPatterns?.some(p => p.pattern.test(t))
    )
  );

  // Skip if nothing to contribute
  if (gaps.length === 0 && personaObservations.length === 0 && relevantEvents.length === 0 && relevantGaps.length === 0) {
    return { personaKey, hasContent: false };
  }

  // Build prompt for LLM
  const contextParts = [];

  if (gaps.length > 0) {
    contextParts.push(`**Framework gaps identified (not yet addressed):**\n${gaps.slice(0, 3).map(g => `- ${g.item} (${g.importance})`).join('\n')}`);
  }

  if (relevantEvents.length > 0) {
    contextParts.push(`**Recent events in your domain:**\n${relevantEvents.slice(0, 3).map(e => `- ${e.title}`).join('\n')}`);
  }

  if (personaObservations.length > 0) {
    contextParts.push(`**Observations from conversations:**\n${personaObservations.slice(0, 3).map(o => `- ${o.type}: ${o.messagePreview?.slice(0, 80)}...`).join('\n')}`);
  }

  if (relevantGaps.length > 0) {
    contextParts.push(`**Questions/gaps detected in team conversations:**\n${relevantGaps.slice(0, 2).map(g => `- "${g.matchedText}" (${g.severity})`).join('\n')}`);
  }

  const context = contextParts.join('\n\n');

  try {
    const result = await llm.summarize([
      { role: 'user', content: `As ${persona.name} (${persona.label}), provide a brief advisory perspective for today's digest.\n\nContext:\n${context}\n\nWrite 2-3 concise bullet points of actionable counsel. Advisory board tone - wise, direct, high-signal. If nothing important to add, say "No items requiring attention today."` }
    ], {
      system: `You are ${persona.name}, the ${persona.label} for OPAL/LYNA healthcare edge AI startup. You are part of an advisory board providing daily strategic guidance. Be concise, actionable, and professional. Do not be chatty.`,
      max_tokens: 300,
    });

    const content = result.text?.trim() || '';

    if (content === 'No items requiring attention today.' || content.length < 30) {
      return { personaKey, hasContent: false };
    }

    return {
      personaKey,
      hasContent: true,
      personaName: persona.name,
      personaLabel: persona.label,
      content,
      gapCount: gaps.length,
    };
  } catch (err) {
    logger('warn', 'Failed to generate perspective', { personaKey, error: err.message });
    return { personaKey, hasContent: false };
  }
}

/**
 * Format the complete digest.
 */
function formatDigest(perspectives, stateSummary, observedGaps, topTopics) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines = [
    `## :crystal_ball: View from the Advisory Board`,
    `*${date}*`,
    '',
  ];

  // Active objectives (if any)
  if (stateSummary.objectives.length > 0) {
    lines.push('### Active Objectives');
    for (const obj of stateSummary.objectives.slice(0, 3)) {
      lines.push(`- ${obj.title}`);
    }
    lines.push('');
  }

  // Perspectives
  if (perspectives.length > 0) {
    lines.push('### Advisory Perspectives');
    lines.push('');
    for (const p of perspectives) {
      lines.push(`**${p.personaName}** *(${p.personaLabel})*`);
      lines.push('');
      lines.push(p.content);
      lines.push('');
    }
  }

  // Critical gaps
  const criticalGaps = observedGaps.filter(g => g.severity === 'high');
  if (criticalGaps.length > 0 || stateSummary.gaps.critical > 0) {
    lines.push('### :warning: Attention Needed');
    if (stateSummary.gaps.criticalList) {
      for (const gap of stateSummary.gaps.criticalList.slice(0, 3)) {
        lines.push(`- ${gap.item} *(${gap.domain})*`);
      }
    }
    for (const gap of criticalGaps.slice(0, 2)) {
      lines.push(`- Question detected: "${gap.matchedText}"`);
    }
    lines.push('');
  }

  // Topics being discussed (brief)
  if (topTopics.length > 0) {
    const topicNames = topTopics.slice(0, 5).map(t => t.name).join(', ');
    lines.push(`**Hot topics:** ${topicNames}`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*To discuss any item: `@gtm-team` + persona command (e.g., `!strategist`, `!clinical`, `!security`)*');

  return lines.join('\n');
}

/**
 * Manually trigger a digest (for testing or on-demand).
 */
export async function triggerDigest() {
  return await generateAndPostDigest();
}

export default {
  init,
  stop,
  generateAndPostDigest,
  triggerDigest,
};
