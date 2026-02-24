/**
 * Task Worker - Runs in separate thread
 *
 * This file is spawned as a worker thread.
 * It imports all dependencies needed to execute tasks.
 */

import { parentPort, workerData } from 'worker_threads';
import * as llm from './llm.js';

// Initialize LLM on worker start
let llmReady = false;
async function ensureLLM() {
  if (!llmReady) {
    await llm.init({ log: (level, msg, data) => log(level, msg, data) });
    llmReady = true;
  }
}

// Utilities passed from main thread via messages
let postMessage = async (channelId, message, threadId) => {
  return new Promise((resolve) => {
    parentPort.postMessage({ type: 'postMessage', channelId, message, threadId });
    // Can't wait for response in worker, fire and forget
    resolve();
  });
};

let log = (level, msg, data) => {
  parentPort.postMessage({ type: 'log', level, msg, data });
};

// Dynamic fetch function (loaded on demand)
let fetchWebPage = null;

async function loadFetchWebPage() {
  if (!fetchWebPage) {
    try {
      // Try Spark's url_utils first
      const sparkUtils = await import('/opt/mattermost/bots-v2/spark/url_utils.js');
      fetchWebPage = sparkUtils.fetchWebPage;
    } catch {
      // Fallback to basic fetch
      fetchWebPage = async (url) => {
        const { default: fetch } = await import('node-fetch');
        const resp = await fetch(url, { timeout: 30000 });
        return await resp.text();
      };
    }
  }
  return fetchWebPage;
}

// Task handlers by type
const handlers = {
  // RESEARCH handler
  async research(task) {
    await ensureLLM(); // Initialize LLM in worker

    const { topic, context: taskContext, urls } = task.data;
    const fetch = await loadFetchWebPage();

    await postMessage(task.channelId, `🔍 **Starting research:** ${task.title}\n\nAnalyzing sources...`);

    let researchPrompt = topic || task.description;
    if (taskContext) researchPrompt += `\n\nContext: ${taskContext}`;

    // Fetch URLs
    let urlContent = '';
    if (urls && urls.length > 0) {
      for (const url of urls) {
        try {
          log('info', `Fetching URL: ${url}`);
          const content = await fetch(url);
          if (content && content.length > 100) {
            urlContent += `\n\n--- Content from ${url} ---\n${content.substring(0, 15000)}`;
          }
        } catch (err) {
          log('warn', `Failed to fetch URL: ${url}`, { error: err.message });
        }
      }
    }

    if (urlContent) {
      researchPrompt += `\n\n## Source Materials\n${urlContent}`;
    }

    // Use llm.research() which routes to appropriate model
    // Messages must be an array of {role, content} objects
    const messages = [{ role: 'user', content: researchPrompt }];
    const response = await llm.research(messages, {
      system: `You are a senior research analyst. Provide comprehensive, well-structured research findings. Focus on actionable insights and specific details.`
    });

    const result = response.text || response.content || response;
    await postMessage(task.channelId, `📋 **Research Complete:** ${task.title}\n\n${result}`);

    return { success: true, result: { summary: result.substring(0, 500) } };
  },

  // FOLLOW_UP handler
  async follow_up(task) {
    const { item } = task.data;
    await postMessage(task.channelId, `📌 **Follow-up reminder:** ${item}`);
    return { success: true };
  },

  // REMINDER handler
  async reminder(task) {
    const { message } = task.data;
    await postMessage(task.channelId, `⏰ **Reminder:** ${message}`);
    return { success: true };
  },

  // ANALYSIS handler
  async analysis(task) {
    await ensureLLM();

    const { content, type: analysisType } = task.data;

    await postMessage(task.channelId, `🔬 **Starting analysis:** ${task.title}...`);

    const messages = [{ role: 'user', content }];
    const response = await llm.research(messages, {
      system: `You are an expert analyst. Provide thorough ${analysisType || 'general'} analysis.`
    });

    const result = response.text || response.content || response;
    await postMessage(task.channelId, `📊 **Analysis Complete:** ${task.title}\n\n${result}`);

    return { success: true, result: { summary: result.substring(0, 500) } };
  }
};

// Main worker execution
(async () => {
  const { task } = workerData;

  try {
    log('info', `Worker starting task: ${task.type}`, { id: task.id });

    const handler = handlers[task.type];
    if (!handler) {
      throw new Error(`No handler for task type: ${task.type}`);
    }

    const result = await handler(task);
    parentPort.postMessage({ type: 'complete', result });

  } catch (err) {
    log('error', `Worker task failed: ${err.message}`, { id: task.id });
    parentPort.postMessage({ type: 'error', error: err.message });
  }
})();
