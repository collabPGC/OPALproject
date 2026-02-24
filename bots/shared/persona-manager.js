/**
 * Persona Manager - Manages bot personalities and adaptive expertise
 *
 * Personas are MD files that define:
 * - Core personality traits
 * - Communication style
 * - Domain expertise (adaptive)
 * - Behavioral guidelines
 *
 * Directory structure:
 * personas/
 *   scout.md        - Scout's core personality
 *   spark.md        - Spark's core personality
 *   domain/
 *     frontend.md   - Frontend expert persona
 *     backend.md    - Backend expert persona
 *     devops.md     - DevOps expert persona
 *     business.md   - Business/Strategy persona
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS_DIR = path.join(__dirname, 'personas');

// Cache for loaded personas
const personaCache = new Map();

/**
 * Parse persona from markdown file
 */
function parsePersona(content, name) {
  const persona = {
    name,
    core: '',
    traits: [],
    style: '',
    expertise: [],
    guidelines: '',
    examples: ''
  };

  // Extract sections from markdown
  const sections = content.split(/^##\s+/m);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const header = lines[0]?.toLowerCase() || '';
    const body = lines.slice(1).join('\n').trim();

    if (header.includes('core') || header.includes('identity')) {
      persona.core = body;
    } else if (header.includes('trait')) {
      persona.traits = body.split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*/, '').trim());
    } else if (header.includes('style') || header.includes('communication')) {
      persona.style = body;
    } else if (header.includes('expertise') || header.includes('domain')) {
      persona.expertise = body.split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*/, '').trim());
    } else if (header.includes('guideline') || header.includes('behavior')) {
      persona.guidelines = body;
    } else if (header.includes('example')) {
      persona.examples = body;
    }
  }

  // If no sections, treat entire content as core
  if (!persona.core && !sections.some(s => s.includes('##'))) {
    persona.core = content.trim();
  }

  return persona;
}

/**
 * Load persona from file
 */
function loadPersona(name) {
  if (personaCache.has(name)) {
    return personaCache.get(name);
  }

  // Try direct file (e.g., "scout" -> "personas/scout.md")
  let filePath = path.join(PERSONAS_DIR, `${name}.md`);

  // Try as subdirectory path (e.g., "gtm/strategist" -> "personas/gtm/strategist.md")
  if (!fs.existsSync(filePath) && name.includes('/')) {
    filePath = path.join(PERSONAS_DIR, `${name}.md`);
  }

  // Try domain subdirectory (e.g., "frontend" -> "personas/domain/frontend.md")
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PERSONAS_DIR, 'domain', `${name}.md`);
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const persona = parsePersona(content, name);
  personaCache.set(name, persona);

  return persona;
}

/**
 * Get bot persona (Scout, Spark, etc.)
 */
export function getBotPersona(botName) {
  return loadPersona(botName.toLowerCase());
}

/**
 * Get domain expert persona
 */
export function getDomainPersona(domain) {
  return loadPersona(domain.toLowerCase());
}

/**
 * Detect domain from content
 */
export function detectDomain(content) {
  const lower = content.toLowerCase();

  const domainPatterns = {
    frontend: ['react', 'vue', 'angular', 'css', 'html', 'javascript', 'typescript', 'dom', 'component', 'ui', 'ux', 'responsive', 'tailwind', 'webpack', 'vite'],
    backend: ['api', 'server', 'database', 'endpoint', 'rest', 'graphql', 'node', 'python', 'java', 'go', 'rust', 'microservice', 'authentication', 'authorization'],
    devops: ['docker', 'kubernetes', 'k8s', 'ci/cd', 'pipeline', 'deployment', 'infrastructure', 'terraform', 'aws', 'gcp', 'azure', 'monitoring', 'logging'],
    data: ['sql', 'nosql', 'postgres', 'mongodb', 'redis', 'analytics', 'etl', 'data pipeline', 'warehouse', 'schema', 'query', 'index'],
    ml: ['machine learning', 'ml', 'model', 'training', 'inference', 'neural', 'deep learning', 'pytorch', 'tensorflow', 'llm', 'embedding'],
    mobile: ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'mobile app', 'app store'],
    security: ['security', 'vulnerability', 'authentication', 'encryption', 'oauth', 'jwt', 'ssl', 'tls', 'penetration', 'audit'],
    business: ['strategy', 'market', 'revenue', 'growth', 'competitive', 'stakeholder', 'roadmap', 'okr', 'kpi', 'investor', 'funding', 'valuation']
  };

  const scores = {};
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    scores[domain] = patterns.filter(p => lower.includes(p)).length;
  }

  // Find highest scoring domain
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';

  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || 'general';
}

/**
 * Build system prompt from persona + domain expertise
 */
export function buildSystemPrompt(botName, options = {}) {
  const parts = [];

  // Get bot persona
  const botPersona = getBotPersona(botName);
  if (botPersona) {
    if (botPersona.core) {
      parts.push(`## Identity\n${botPersona.core}`);
    }
    if (botPersona.traits.length > 0) {
      parts.push(`## Traits\n${botPersona.traits.map(t => `- ${t}`).join('\n')}`);
    }
    if (botPersona.style) {
      parts.push(`## Communication Style\n${botPersona.style}`);
    }
    if (botPersona.guidelines) {
      parts.push(`## Guidelines\n${botPersona.guidelines}`);
    }
  }

  // Add domain expertise if specified or detected
  const domain = options.domain || (options.content ? detectDomain(options.content) : null);
  if (domain && domain !== 'general') {
    const domainPersona = getDomainPersona(domain);
    if (domainPersona) {
      parts.push(`## Domain Expertise: ${domain.toUpperCase()}\n${domainPersona.core || ''}`);
      if (domainPersona.expertise.length > 0) {
        parts.push(`### Focus Areas\n${domainPersona.expertise.map(e => `- ${e}`).join('\n')}`);
      }
    } else {
      // Fallback to inline domain expertise
      parts.push(getInlineDomainExpertise(domain));
    }
  }

  // Add any custom context
  if (options.additionalContext) {
    parts.push(options.additionalContext);
  }

  return parts.join('\n\n');
}

/**
 * Inline domain expertise (fallback when no MD file exists)
 */
function getInlineDomainExpertise(domain) {
  const expertise = {
    frontend: `## Domain Expertise: FRONTEND
You are a Senior Frontend Architect with deep expertise in:
- Component architecture and state management
- Performance optimization (bundle size, rendering, lazy loading)
- Accessibility (WCAG, ARIA)
- Modern frameworks (React, Vue, Svelte) and build tools
- CSS architecture (modules, utility-first, design systems)
Focus on: component patterns, performance, UX implementation, accessibility`,

    backend: `## Domain Expertise: BACKEND
You are a Principal Backend Engineer with deep expertise in:
- API design (REST, GraphQL, gRPC)
- Database design and optimization
- Distributed systems and microservices
- Security (authentication, authorization, data protection)
- Performance and scalability
Focus on: API design, data modeling, concurrency, error handling`,

    devops: `## Domain Expertise: DEVOPS
You are a Staff SRE/Platform Engineer with deep expertise in:
- Container orchestration (Kubernetes, Docker)
- CI/CD pipelines and deployment strategies
- Infrastructure as Code (Terraform, Pulumi)
- Observability (monitoring, logging, tracing)
- Security hardening and compliance
Focus on: deployment strategies, scaling, reliability, security`,

    data: `## Domain Expertise: DATA
You are a Data Architect with deep expertise in:
- Database design (SQL and NoSQL)
- Query optimization and indexing
- Data pipelines and ETL
- Data modeling and schema design
- Analytics and reporting
Focus on: schema design, query performance, data integrity`,

    ml: `## Domain Expertise: ML/AI
You are an ML Engineer with deep expertise in:
- Model architecture and selection
- Training pipelines and optimization
- Model deployment and serving
- Evaluation metrics and testing
- MLOps practices
Focus on: model selection, training, evaluation, deployment`,

    security: `## Domain Expertise: SECURITY
You are a Security Engineer with deep expertise in:
- Threat modeling and risk assessment
- Secure coding practices
- Authentication and authorization
- Vulnerability assessment
- Compliance (SOC2, GDPR, HIPAA)
Focus on: threat modeling, vulnerabilities, secure coding`,

    business: `## Domain Expertise: BUSINESS/STRATEGY
You are a McKinsey Senior Partner with deep expertise in:
- Market analysis and competitive positioning
- Growth strategy and unit economics
- Stakeholder management
- Strategic frameworks (Porter's, SWOT, Jobs-to-be-Done)
Focus on: market dynamics, business models, strategic recommendations`
  };

  return expertise[domain] || '';
}

/**
 * List available personas
 */
export function listPersonas() {
  const personas = [];

  if (fs.existsSync(PERSONAS_DIR)) {
    // Root personas
    const rootFiles = fs.readdirSync(PERSONAS_DIR)
      .filter(f => f.endsWith('.md'));
    personas.push(...rootFiles.map(f => f.replace('.md', '')));

    // Scan all subdirectories for persona files
    const entries = fs.readdirSync(PERSONAS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(PERSONAS_DIR, entry.name);
        const subFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.md'));
        personas.push(...subFiles.map(f => `${entry.name}/${f.replace('.md', '')}`));
      }
    }
  }

  return personas;
}

/**
 * Reload persona cache
 */
export function reloadPersonas() {
  personaCache.clear();
  return listPersonas();
}

export default {
  getBotPersona,
  getDomainPersona,
  detectDomain,
  buildSystemPrompt,
  listPersonas,
  reloadPersonas,
  PERSONAS_DIR
};
