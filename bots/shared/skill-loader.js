/**
 * Skill Loader - Dynamic skill loading from file system
 *
 * Loads skills defined in MD/YAML files, enabling:
 * - Separation of prompts from code
 * - Hot-reloading of skills without restart
 * - Reusable skills across bots
 * - Version control of prompts
 *
 * Directory structure:
 * skills/
 *   research/
 *     skill.yaml    - Metadata, triggers, config
 *     prompt.md     - The actual prompt template
 *     examples.md   - Few-shot examples (optional)
 *   brainstorm/
 *   ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills');

// Cache for loaded skills
const skillCache = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Skill definition schema
 */
const DEFAULT_SKILL = {
  name: '',
  version: '1.0',
  description: '',
  triggers: [],           // Command patterns that trigger this skill
  requiredContext: [],    // What context this skill needs
  outputFormat: 'markdown',
  maxTokens: 4096,
  temperature: 0.7,
  model: 'auto',          // 'auto' uses router, or specific model
  prompt: '',             // The actual prompt template
  examples: '',           // Few-shot examples
  postProcess: null,      // Post-processing function name
  workflow: null,         // Associated workflow name
  ralphMode: 'auto',      // 'auto', 'always', 'never'
};

/**
 * Parse YAML-like frontmatter from markdown
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: content.trim() };
  }

  const yamlContent = match[1];
  const bodyContent = match[2].trim();

  // Simple YAML parser for flat key-value pairs
  const metadata = {};
  for (const line of yamlContent.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Parse arrays [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
      }
      // Parse booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (!isNaN(value) && value !== '') value = Number(value);
      // Remove quotes from strings
      else value = value.replace(/^['"]|['"]$/g, '');

      metadata[key] = value;
    }
  }

  return { metadata, content: bodyContent };
}

/**
 * Load a single skill from directory
 */
function loadSkillFromDir(skillDir, skillName) {
  const skill = { ...DEFAULT_SKILL, name: skillName };

  // Load skill.yaml or skill.md (metadata)
  const yamlPath = path.join(skillDir, 'skill.yaml');
  const metaMdPath = path.join(skillDir, 'skill.md');

  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const { metadata } = parseFrontmatter(`---\n${yamlContent}\n---\n`);
    Object.assign(skill, metadata);
  } else if (fs.existsSync(metaMdPath)) {
    const mdContent = fs.readFileSync(metaMdPath, 'utf8');
    const { metadata } = parseFrontmatter(mdContent);
    Object.assign(skill, metadata);
  }

  // Load prompt.md
  const promptPath = path.join(skillDir, 'prompt.md');
  if (fs.existsSync(promptPath)) {
    const promptContent = fs.readFileSync(promptPath, 'utf8');
    const { metadata, content } = parseFrontmatter(promptContent);
    skill.prompt = content;
    // Prompt file can also override metadata
    Object.assign(skill, metadata);
  }

  // Load examples.md (optional)
  const examplesPath = path.join(skillDir, 'examples.md');
  if (fs.existsSync(examplesPath)) {
    skill.examples = fs.readFileSync(examplesPath, 'utf8');
  }

  return skill;
}

/**
 * Load all skills from skills directory
 */
export function loadAllSkills(forceReload = false) {
  const now = Date.now();

  // Return cached if fresh
  if (!forceReload && skillCache.size > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return skillCache;
  }

  skillCache.clear();

  if (!fs.existsSync(SKILLS_DIR)) {
    console.warn(`[SkillLoader] Skills directory not found: ${SKILLS_DIR}`);
    return skillCache;
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const skillName of skillDirs) {
    try {
      const skillDir = path.join(SKILLS_DIR, skillName);
      const skill = loadSkillFromDir(skillDir, skillName);
      skillCache.set(skillName, skill);
    } catch (error) {
      console.error(`[SkillLoader] Failed to load skill ${skillName}:`, error.message);
    }
  }

  cacheTimestamp = now;
  console.log(`[SkillLoader] Loaded ${skillCache.size} skills: ${Array.from(skillCache.keys()).join(', ')}`);

  return skillCache;
}

/**
 * Get a specific skill by name
 */
export function getSkill(name) {
  loadAllSkills(); // Ensure cache is fresh
  return skillCache.get(name);
}

/**
 * Find skill that matches a trigger pattern
 */
export function findSkillByTrigger(input) {
  loadAllSkills();

  for (const [name, skill] of skillCache) {
    if (!skill.triggers || skill.triggers.length === 0) continue;

    for (const trigger of skill.triggers) {
      // Trigger can be a regex pattern or simple string
      const pattern = trigger.startsWith('/') && trigger.endsWith('/')
        ? new RegExp(trigger.slice(1, -1), 'i')
        : new RegExp(`^!${trigger}\\b`, 'i');

      if (pattern.test(input)) {
        return { skill, trigger };
      }
    }
  }

  return null;
}

/**
 * Build final prompt from skill template
 * Supports variable substitution: {{topic}}, {{context}}, {{persona}}
 */
export function buildPrompt(skill, variables = {}) {
  let prompt = skill.prompt || '';

  // Add examples if present
  if (skill.examples) {
    prompt = `${prompt}\n\n## Examples\n${skill.examples}`;
  }

  // Variable substitution
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(regex, value || '');
  }

  // Clean up any remaining unreplaced variables
  prompt = prompt.replace(/\{\{[^}]+\}\}/g, '');

  return prompt.trim();
}

/**
 * List all available skills
 */
export function listSkills() {
  loadAllSkills();
  return Array.from(skillCache.entries()).map(([name, skill]) => ({
    name,
    description: skill.description,
    triggers: skill.triggers,
    version: skill.version
  }));
}

/**
 * Reload skills from disk
 */
export function reloadSkills() {
  return loadAllSkills(true);
}

/**
 * Get skill statistics
 */
export function getStats() {
  loadAllSkills();
  return {
    totalSkills: skillCache.size,
    skills: Array.from(skillCache.keys()),
    cacheAge: Date.now() - cacheTimestamp,
    cacheTTL: CACHE_TTL
  };
}

export default {
  loadAllSkills,
  getSkill,
  findSkillByTrigger,
  buildPrompt,
  listSkills,
  reloadSkills,
  getStats,
  SKILLS_DIR
};
