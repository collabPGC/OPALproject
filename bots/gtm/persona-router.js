/**
 * Persona Router - Routes messages to the appropriate GTM persona
 *
 * Routing priority:
 * 1. Explicit command: !strategist, !finance, !growth, !sales, !product, !compliance, !ops
 * 2. Channel mapping (config-driven)
 * 3. @mention with role: "@gtm strategist", "@gtm finance"
 * 4. Topic detection (keyword patterns)
 * 5. Default: strategist
 */

import personaManager from 'bots-shared/persona-manager.js';

// Persona definitions with routing metadata
const PERSONAS = {
  strategist: {
    key: 'strategist',
    personaFile: 'gtm/strategist',
    name: 'Athena',
    label: 'Strategist',
    domains: ['strategy'],
    emits: ['INSIGHT', 'PREDICTION', 'CONTEXT_CHANGE'],
    commands: ['!strategist', '!strategy', '!athena'],
    mentionPatterns: ['strategist', 'strategy', 'athena'],
  },
  'product-owner': {
    key: 'product-owner',
    personaFile: 'gtm/product-owner',
    name: 'Priya',
    label: 'Product Owner',
    domains: ['product'],
    emits: ['DECISION', 'ACTION', 'ARTIFACT'],
    commands: ['!product', '!product-owner', '!priya', '!po'],
    mentionPatterns: ['product', 'product owner', 'priya', 'po'],
  },
  'growth-lead': {
    key: 'growth-lead',
    personaFile: 'gtm/growth-lead',
    name: 'Maya',
    label: 'Growth Lead',
    domains: ['gtm'],
    emits: ['ACTION', 'PREDICTION', 'ARTIFACT'],
    commands: ['!growth', '!marketing', '!gtm', '!maya'],
    mentionPatterns: ['growth', 'marketing', 'gtm', 'maya', 'launch'],
  },
  'sales-bd': {
    key: 'sales-bd',
    personaFile: 'gtm/sales-bd',
    name: 'Rex',
    label: 'Sales & BD',
    domains: ['gtm', 'operations'],
    emits: ['ACTION', 'INSIGHT', 'PREDICTION'],
    commands: ['!sales', '!bd', '!rex', '!deals'],
    mentionPatterns: ['sales', 'bd', 'business development', 'rex', 'pipeline', 'deal'],
  },
  'finance-analyst': {
    key: 'finance-analyst',
    personaFile: 'gtm/finance-analyst',
    name: 'Kai',
    label: 'Finance Analyst',
    domains: ['finance'],
    emits: ['INSIGHT', 'PREDICTION', 'ARTIFACT'],
    commands: ['!finance', '!kai', '!budget', '!runway'],
    mentionPatterns: ['finance', 'kai', 'budget', 'runway', 'investor', 'fundrais'],
  },
  'compliance-ops': {
    key: 'compliance-ops',
    personaFile: 'gtm/compliance-ops',
    name: 'Suki',
    label: 'Compliance & Ops',
    domains: ['compliance', 'operations'],
    emits: ['INSIGHT', 'ACTION', 'CONTEXT_CHANGE'],
    commands: ['!compliance', '!ops', '!suki', '!legal'],
    mentionPatterns: ['compliance', 'ops', 'operations', 'suki', 'fcc', 'legal', 'supply chain'],
  },

  // === TECHNICAL SUB-TEAM ===

  'software-architect': {
    key: 'software-architect',
    personaFile: 'gtm/software-architect',
    name: 'Marcus',
    label: 'Software Architect',
    domains: ['engineering'],
    emits: ['INSIGHT', 'DECISION', 'ARTIFACT'],
    commands: ['!software', '!architect', '!marcus', '!code'],
    mentionPatterns: ['software', 'architect', 'marcus', 'api', 'architecture', 'system design'],
  },
  'enterprise-architect': {
    key: 'enterprise-architect',
    personaFile: 'gtm/enterprise-architect',
    name: 'Helena',
    label: 'Enterprise Architect (Healthcare)',
    domains: ['healthcare-systems'],
    emits: ['INSIGHT', 'DECISION', 'ARTIFACT'],
    commands: ['!enterprise', '!ehr', '!fhir', '!hl7', '!helena'],
    mentionPatterns: ['enterprise', 'ehr', 'emr', 'fhir', 'hl7', 'helena', 'epic', 'cerner', 'integration'],
  },
  'security-architect': {
    key: 'security-architect',
    personaFile: 'gtm/security-architect',
    name: 'Cyrus',
    label: 'Security & Privacy Architect',
    domains: ['security'],
    emits: ['INSIGHT', 'ACTION', 'GAP'],
    commands: ['!security', '!hipaa', '!privacy', '!cyrus'],
    mentionPatterns: ['security', 'hipaa', 'privacy', 'cyrus', 'encryption', 'authentication', 'breach'],
  },
  'cloud-architect': {
    key: 'cloud-architect',
    personaFile: 'gtm/cloud-architect',
    name: 'Nimbus',
    label: 'Cloud Architect',
    domains: ['infrastructure'],
    emits: ['INSIGHT', 'DECISION', 'ARTIFACT'],
    commands: ['!cloud', '!infra', '!infrastructure', '!nimbus', '!aws', '!azure', '!gcp'],
    mentionPatterns: ['cloud', 'infrastructure', 'nimbus', 'aws', 'azure', 'gcp', 'kubernetes', 'serverless'],
  },
  'healthcare-analyst': {
    key: 'healthcare-analyst',
    personaFile: 'gtm/healthcare-analyst',
    name: 'Vera',
    label: 'Healthcare Industry Analyst',
    domains: ['healthcare-industry'],
    emits: ['INSIGHT', 'PREDICTION', 'CONTEXT_CHANGE'],
    commands: ['!healthcare', '!industry', '!vera', '!market-intel'],
    mentionPatterns: ['healthcare', 'vera', 'epic', 'cerner', 'vendor', 'incumbent', 'market intel'],
  },
  'clinical-advisor': {
    key: 'clinical-advisor',
    personaFile: 'gtm/clinical-advisor',
    name: 'Dr. Claire',
    label: 'Clinical Advisor',
    domains: ['clinical'],
    emits: ['INSIGHT', 'GAP', 'DECISION'],
    commands: ['!clinical', '!claire', '!doctor', '!clinician'],
    mentionPatterns: ['clinical', 'claire', 'doctor', 'clinician', 'nurse', 'physician', 'patient', 'workflow'],
  },
  'ml-engineer': {
    key: 'ml-engineer',
    personaFile: 'gtm/ml-engineer',
    name: 'Tensor',
    label: 'ML/AI Engineer',
    domains: ['ai-ml'],
    emits: ['INSIGHT', 'DECISION', 'ARTIFACT'],
    commands: ['!ml', '!ai', '!tensor', '!model'],
    mentionPatterns: ['ml', 'machine learning', 'ai', 'tensor', 'model', 'inference', 'training', 'edge ai'],
  },
  'regulatory-affairs': {
    key: 'regulatory-affairs',
    personaFile: 'gtm/regulatory-affairs',
    name: 'Regina',
    label: 'Regulatory Affairs Specialist',
    domains: ['regulatory'],
    emits: ['INSIGHT', 'ACTION', 'GAP'],
    commands: ['!fda', '!510k', '!regina', '!regulatory-affairs', '!samd'],
    mentionPatterns: ['fda', '510k', 'de novo', 'regina', 'samd', 'clearance', 'submission', 'mdr'],
  },
};

// Topic keywords for automatic persona detection
const TOPIC_PATTERNS = {
  strategist: [
    'competitive', 'positioning', 'market entry', 'strategic', 'differentiation',
    'moat', 'vision', 'blue ocean', 'swot', 'porter', 'tam', 'sam', 'som',
    'market size', 'market share', 'first mover', 'platform strategy',
  ],
  'product-owner': [
    'feature', 'roadmap', 'user story', 'backlog', 'sprint', 'mvp', 'prototype',
    'esp32', 'firmware', 'beta', 'acceptance criteria', 'rice', 'moscow',
    'product-market fit', 'pmf', 'amoled', 'user experience', 'ux',
  ],
  'growth-lead': [
    'launch', 'campaign', 'marketing', 'acquisition', 'funnel', 'content',
    'social media', 'crowdfunding', 'kickstarter', 'community', 'developer relations',
    'seo', 'pr', 'press', 'influencer', 'cac', 'conversion',
  ],
  'sales-bd': [
    'pipeline', 'deal', 'partnership', 'distributor', 'oem', 'prospect',
    'outreach', 'close', 'contract', 'pricing', 'volume', 'wholesale',
    'b2b', 'enterprise', 'procurement', 'rfp', 'rfi',
  ],
  'finance-analyst': [
    'revenue', 'cost', 'margin', 'fundraising', 'investor', 'valuation',
    'burn', 'runway', 'bom', 'unit economics', 'cogs', 'ltv',
    'financial model', 'p&l', 'cash flow', 'series a', 'seed',
  ],
  'compliance-ops': [
    'fcc', 'ce mark', 'certification', 'legal', 'patent',
    'supply chain', 'manufacturing', 'quality', 'rohs', 'ul', 'iec',
    'shipping', 'customs', 'export', 'fulfillment', 'yield',
  ],

  // === TECHNICAL SUB-TEAM ===

  'software-architect': [
    'architecture', 'api design', 'system design', 'microservice', 'monolith',
    'database', 'scalability', 'latency', 'rtos', 'firmware', 'embedded',
    'code review', 'technical debt', 'refactor', 'ci cd', 'devops',
  ],
  'enterprise-architect': [
    'hl7', 'fhir', 'ehr', 'emr', 'epic', 'cerner', 'meditech', 'allscripts',
    'interoperability', 'adt', 'orm', 'oru', 'patient matching', 'mpi',
    'smart on fhir', 'carequality', 'commonwell', 'hie',
  ],
  'security-architect': [
    'hipaa', 'security', 'privacy', 'encryption', 'authentication', 'authorization',
    'audit log', 'phi', 'breach', 'vulnerability', 'penetration', 'soc 2',
    'hitrust', 'access control', 'zero trust', 'key management',
  ],
  'cloud-architect': [
    'aws', 'azure', 'gcp', 'cloud', 'infrastructure', 'kubernetes', 'docker',
    'serverless', 'lambda', 'terraform', 'iac', 'disaster recovery', 'ha',
    'availability', 'sla', 'cost optimization', 'finops', 'baa',
  ],
  'healthcare-analyst': [
    'healthcare market', 'epic market', 'cerner market', 'ehr vendor', 'competitor',
    'market share', 'incumbent', 'acquisition', 'funding round', 'digital health',
    'telehealth', 'remote monitoring', 'population health', 'value based care',
  ],
  'clinical-advisor': [
    'clinical workflow', 'clinician', 'physician', 'nurse', 'patient',
    'bedside', 'clinical validation', 'clinical evidence', 'alert fatigue',
    'clinical decision support', 'patient safety', 'patient outcome',
  ],
  'ml-engineer': [
    'machine learning', 'model', 'inference', 'training', 'edge ai', 'tinyml',
    'tensorflow', 'quantization', 'pruning', 'mlops', 'dataset', 'labeling',
    'accuracy', 'precision', 'recall', 'bias', 'federated learning',
  ],
  'regulatory-affairs': [
    'fda', '510k', 'de novo', 'pma', 'samd', 'software as medical device',
    'presubmission', 'clinical trial', 'predicate', 'classification',
    'post-market', 'qms', 'mdr', 'ce marking medical', 'notified body',
  ],
};

// Channel-to-persona mapping (configured in config.json, set at init)
let channelPersonaMap = {};

/**
 * Initialize the router with channel mappings from config.
 */
export function init(config = {}) {
  channelPersonaMap = config.channelPersonaMap || {};
}

/**
 * Route a message to the appropriate persona.
 *
 * @param {string} text - Message text
 * @param {string} channelId - Channel where the message was sent
 * @param {Object} [options] - Additional context
 * @returns {{ persona: Object, reason: string, strippedText: string }}
 */
export function route(text, channelId, options = {}) {
  const lower = text.toLowerCase().trim();

  // 1. Explicit command
  for (const [key, def] of Object.entries(PERSONAS)) {
    for (const cmd of def.commands) {
      if (lower.startsWith(cmd)) {
        const strippedText = text.slice(cmd.length).trim();
        return {
          persona: def,
          reason: `command:${cmd}`,
          strippedText: strippedText || text,
        };
      }
    }
  }

  // 2. Channel mapping
  if (channelPersonaMap[channelId] && PERSONAS[channelPersonaMap[channelId]]) {
    return {
      persona: PERSONAS[channelPersonaMap[channelId]],
      reason: `channel:${channelId}`,
      strippedText: text,
    };
  }

  // 3. @mention with role (e.g., "@gtm strategist" or "strategist,")
  for (const [key, def] of Object.entries(PERSONAS)) {
    for (const pattern of def.mentionPatterns) {
      // Match patterns like "strategist" or "@gtm strategist" near the start
      const mentionRegex = new RegExp(`(?:@gtm[- ])?${pattern}[,:]?\\s`, 'i');
      if (mentionRegex.test(lower.slice(0, 50))) {
        const strippedText = text.replace(mentionRegex, '').trim();
        return {
          persona: def,
          reason: `mention:${pattern}`,
          strippedText: strippedText || text,
        };
      }
    }
  }

  // 4. Topic detection (score-based)
  const scores = {};
  for (const [key, patterns] of Object.entries(TOPIC_PATTERNS)) {
    scores[key] = patterns.filter(p => lower.includes(p)).length;
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    const topPersona = Object.entries(scores).find(([, score]) => score === maxScore)?.[0];
    if (topPersona && PERSONAS[topPersona]) {
      return {
        persona: PERSONAS[topPersona],
        reason: `topic:${topPersona} (score:${maxScore})`,
        strippedText: text,
      };
    }
  }

  // 5. Default: strategist
  return {
    persona: PERSONAS.strategist,
    reason: 'default',
    strippedText: text,
  };
}

/**
 * Get a persona definition by key.
 */
export function getPersona(key) {
  return PERSONAS[key] || null;
}

/**
 * Get all persona definitions.
 */
export function getAllPersonas() {
  return { ...PERSONAS };
}

/**
 * Load the full persona markdown content for a given persona key.
 */
export function loadPersonaContent(key) {
  const def = PERSONAS[key];
  if (!def) return null;
  return personaManager.getBotPersona(def.personaFile);
}

/**
 * Build a system prompt for a specific persona.
 */
export function buildSystemPrompt(personaKey, options = {}) {
  const persona = loadPersonaContent(personaKey);
  if (!persona) return '';

  const parts = [];

  if (persona.core) {
    parts.push(`## Identity\n${persona.core}`);
  }
  if (persona.traits && persona.traits.length > 0) {
    parts.push(`## Traits\n${persona.traits.map(t => `- ${t}`).join('\n')}`);
  }
  if (persona.style) {
    parts.push(`## Communication Style\n${persona.style}`);
  }
  if (persona.expertise && persona.expertise.length > 0) {
    parts.push(`## Domain Expertise\n${persona.expertise.map(e => `- ${e}`).join('\n')}`);
  }
  if (persona.guidelines) {
    parts.push(`## Guidelines\n${persona.guidelines}`);
  }

  if (options.additionalContext) {
    parts.push(options.additionalContext);
  }

  return parts.join('\n\n');
}

/**
 * List all available persona keys.
 */
export function listPersonaKeys() {
  return Object.keys(PERSONAS);
}

export default {
  init,
  route,
  getPersona,
  getAllPersonas,
  loadPersonaContent,
  buildSystemPrompt,
  listPersonaKeys,
  PERSONAS,
};
