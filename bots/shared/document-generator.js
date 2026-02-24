/**
 * Document Generator - Long-form document production
 *
 * Generates documents 100-150+ pages through:
 * - Section-by-section generation
 * - Memory-based continuity tracking
 * - Outline/structure management
 * - Cross-reference tracking
 * - Progress persistence
 *
 * Philosophy: Generate in chunks, accumulate with context,
 * maintain coherence through explicit memory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import llm from './llm.js';
import * as skillLoader from './skill-loader.js';
import * as ralph from './ralph-mode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Document state storage
const DOCS_DIR = path.join(__dirname, '../documents');
const MEMORY_DIR = path.join(__dirname, '../document-memory');

/**
 * Document structure definition
 */
export class DocumentStructure {
  constructor(config) {
    this.id = config.id || `doc-${Date.now()}`;
    this.title = config.title;
    this.type = config.type || 'report'; // report, whitepaper, analysis, proposal
    this.sections = config.sections || [];
    this.metadata = config.metadata || {};
    this.created = new Date().toISOString();
    this.modified = this.created;
    this.status = 'draft';
    this.completedSections = [];
    this.currentSection = null;
  }

  addSection(section) {
    this.sections.push({
      id: section.id || `section-${this.sections.length + 1}`,
      title: section.title,
      type: section.type || 'content', // content, executive-summary, appendix, toc
      subsections: section.subsections || [],
      targetWordCount: section.targetWordCount || 3000,
      status: 'pending',
      dependencies: section.dependencies || [], // IDs of sections that must be done first
      context: section.context || {},
      content: null
    });
    return this;
  }

  getSection(id) {
    return this.sections.find(s => s.id === id);
  }

  getNextPendingSection() {
    return this.sections.find(s =>
      s.status === 'pending' &&
      s.dependencies.every(dep => this.completedSections.includes(dep))
    );
  }

  markSectionComplete(id, content) {
    const section = this.getSection(id);
    if (section) {
      section.status = 'complete';
      section.content = content;
      section.completedAt = new Date().toISOString();
      this.completedSections.push(id);
    }
    return this;
  }

  getCompletedContent() {
    return this.sections
      .filter(s => s.status === 'complete')
      .map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        wordCount: s.content ? s.content.split(/\s+/).length : 0
      }));
  }

  getTotalWordCount() {
    return this.sections.reduce((total, s) => {
      return total + (s.content ? s.content.split(/\s+/).length : 0);
    }, 0);
  }

  isComplete() {
    return this.sections.every(s => s.status === 'complete');
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      sections: this.sections,
      metadata: this.metadata,
      created: this.created,
      modified: this.modified,
      status: this.status,
      completedSections: this.completedSections,
      totalWordCount: this.getTotalWordCount()
    };
  }
}

/**
 * Document memory - tracks continuity across sections
 */
class DocumentMemory {
  constructor(docId) {
    this.docId = docId;
    this.memoryPath = path.join(MEMORY_DIR, `${docId}.json`);
    this.memory = this.load();
  }

  load() {
    if (fs.existsSync(this.memoryPath)) {
      return JSON.parse(fs.readFileSync(this.memoryPath, 'utf8'));
    }
    return {
      docId: this.docId,
      keyPoints: [],           // Important facts/conclusions established
      definitions: {},         // Terms defined in the document
      crossReferences: [],     // {from: sectionId, to: sectionId, context}
      openThreads: [],         // Topics mentioned but not yet covered
      resolvedThreads: [],     // Topics that have been addressed
      figures: [],             // {id, caption, section}
      tables: [],              // {id, caption, section}
      citations: [],           // External references used
      styleGuide: {},          // Document-specific style decisions
      summaries: {},           // Per-section summaries for context
      outline: null,           // Document outline
      lastUpdated: null
    };
  }

  save() {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    this.memory.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2));
    return this;
  }

  addKeyPoint(point, sectionId) {
    this.memory.keyPoints.push({
      point,
      section: sectionId,
      added: new Date().toISOString()
    });
    return this.save();
  }

  addDefinition(term, definition, sectionId) {
    this.memory.definitions[term] = { definition, section: sectionId };
    return this.save();
  }

  addCrossReference(from, to, context) {
    this.memory.crossReferences.push({ from, to, context });
    return this.save();
  }

  addOpenThread(topic, sectionId) {
    this.memory.openThreads.push({ topic, introducedIn: sectionId });
    return this.save();
  }

  resolveThread(topic, sectionId) {
    const idx = this.memory.openThreads.findIndex(t => t.topic === topic);
    if (idx >= 0) {
      const thread = this.memory.openThreads.splice(idx, 1)[0];
      this.memory.resolvedThreads.push({
        ...thread,
        resolvedIn: sectionId,
        resolvedAt: new Date().toISOString()
      });
    }
    return this.save();
  }

  setSectionSummary(sectionId, summary) {
    this.memory.summaries[sectionId] = summary;
    return this.save();
  }

  getContextForSection(sectionId, allSections) {
    // Build context string for generating new section
    const contextParts = [];

    // Prior sections summaries (only completed ones)
    const completedSummaries = Object.entries(this.memory.summaries)
      .filter(([id]) => id !== sectionId)
      .map(([id, summary]) => `[${id}]: ${summary}`)
      .join('\n');

    if (completedSummaries) {
      contextParts.push(`## Previous Sections Summary\n${completedSummaries}`);
    }

    // Key points established
    if (this.memory.keyPoints.length > 0) {
      const points = this.memory.keyPoints.map(p => `- ${p.point}`).join('\n');
      contextParts.push(`## Key Points Established\n${points}`);
    }

    // Definitions in use
    const defs = Object.entries(this.memory.definitions);
    if (defs.length > 0) {
      const defStr = defs.map(([term, d]) => `- **${term}**: ${d.definition}`).join('\n');
      contextParts.push(`## Terminology Established\n${defStr}`);
    }

    // Open threads to address
    if (this.memory.openThreads.length > 0) {
      const threads = this.memory.openThreads.map(t => `- ${t.topic} (from ${t.introducedIn})`).join('\n');
      contextParts.push(`## Open Topics (consider addressing)\n${threads}`);
    }

    return contextParts.join('\n\n');
  }

  getMemory() {
    return this.memory;
  }
}

/**
 * Generate document outline
 */
export async function generateOutline(topic, docType, requirements = {}, logFn = console.log) {
  logFn(`[DocGen] Generating outline for: ${topic}`);

  const outlinePrompt = `You are a document architect. Create a detailed outline for a ${docType}.

TOPIC: ${topic}

REQUIREMENTS:
- Target length: ${requirements.pages || '100-150'} pages (${requirements.wordCount || '50000-75000'} words)
- Audience: ${requirements.audience || 'Executive and technical stakeholders'}
- Purpose: ${requirements.purpose || 'Comprehensive analysis and recommendations'}

Create a structured outline with:
1. Clear section hierarchy (chapters, sections, subsections)
2. Estimated word count per section
3. Key topics each section must cover
4. Dependencies between sections (what must be written first)
5. Data/research needs per section

OUTPUT FORMAT (JSON):
{
  "title": "Document Title",
  "type": "${docType}",
  "totalEstimatedWords": 60000,
  "sections": [
    {
      "id": "exec-summary",
      "title": "Executive Summary",
      "type": "executive-summary",
      "targetWordCount": 2000,
      "dependencies": [],
      "topics": ["Key findings", "Recommendations", "Business impact"],
      "notes": "Write last - synthesize from all sections"
    },
    {
      "id": "chapter-1",
      "title": "Introduction",
      "type": "content",
      "targetWordCount": 5000,
      "dependencies": [],
      "subsections": [
        {"id": "1.1", "title": "Background", "targetWordCount": 1500},
        {"id": "1.2", "title": "Scope and Objectives", "targetWordCount": 1500},
        {"id": "1.3", "title": "Methodology", "targetWordCount": 2000}
      ],
      "topics": ["Problem statement", "Research approach", "Document structure"],
      "notes": "Sets the stage for entire document"
    }
  ]
}

Create a comprehensive outline with 8-15 major sections that would produce the target page count.`;

  const result = await llm.complete('research', [{
    role: 'user',
    content: outlinePrompt
  }], {
    maxTokens: 16384,
    temperature: 0.7
  });

  // Parse JSON from response
  let outline;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      outline = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in outline response');
    }
  } catch (error) {
    logFn(`[DocGen] Failed to parse outline: ${error.message}`);
    throw error;
  }

  // Create document structure from outline
  const doc = new DocumentStructure({
    id: `doc-${Date.now()}`,
    title: outline.title,
    type: outline.type,
    metadata: {
      topic,
      requirements,
      estimatedWords: outline.totalEstimatedWords,
      generatedAt: new Date().toISOString()
    }
  });

  // Add sections from outline
  for (const section of outline.sections) {
    doc.addSection(section);
  }

  // Save document structure
  saveDocumentState(doc);

  // Initialize memory
  const memory = new DocumentMemory(doc.id);
  memory.memory.outline = outline;
  memory.save();

  logFn(`[DocGen] Outline created: ${doc.sections.length} sections, ~${outline.totalEstimatedWords} words`);

  return doc;
}

/**
 * Generate a single section
 */
export async function generateSection(doc, sectionId, logFn = console.log) {
  const section = doc.getSection(sectionId);
  if (!section) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  // Check dependencies
  const unmetDeps = section.dependencies.filter(dep => !doc.completedSections.includes(dep));
  if (unmetDeps.length > 0) {
    throw new Error(`Unmet dependencies: ${unmetDeps.join(', ')}`);
  }

  logFn(`[DocGen] Generating section: ${section.title} (~${section.targetWordCount} words)`);

  // Get memory context
  const memory = new DocumentMemory(doc.id);
  const context = memory.getContextForSection(sectionId, doc.sections);

  // Build section prompt
  const sectionPrompt = `You are writing section "${section.title}" of a ${doc.type} titled "${doc.title}".

## Document Context
${context}

## Section Requirements
- Section ID: ${section.id}
- Title: ${section.title}
- Type: ${section.type}
- Target Word Count: ${section.targetWordCount} words (BE COMPREHENSIVE - hit this target)
- Topics to Cover: ${section.topics ? section.topics.join(', ') : 'See context'}
${section.notes ? `- Notes: ${section.notes}` : ''}

${section.subsections && section.subsections.length > 0 ? `
## Subsections to Include
${section.subsections.map(s => `- ${s.id}: ${s.title} (~${s.targetWordCount} words)`).join('\n')}
` : ''}

## Guidelines
1. Write in a professional, authoritative tone
2. Use markdown formatting with proper headers (## for main sections, ### for subsections)
3. Include concrete examples, data, and evidence where applicable
4. Maintain consistency with previously established terminology and facts
5. Reference prior sections where relevant (e.g., "As discussed in Section 2.1...")
6. If introducing new concepts or terms, define them clearly
7. Aim for the target word count - be thorough and substantive

## Output
Write the complete section content now. Start with the section header.

IMPORTANT: Produce substantial, detailed content. This is a comprehensive professional document. Short, superficial sections are NOT acceptable.`;

  // Use Ralph mode for iterative improvement on substantial sections
  let content;
  if (section.targetWordCount > 2000) {
    const ralphResult = await ralph.iterativeAnalysis(
      async (topic, ctx, prompt) => {
        const result = await llm.complete('research', [{
          role: 'user',
          content: sectionPrompt + (prompt ? `\n\n## Additional Guidance\n${prompt}` : '')
        }], {
          maxTokens: Math.min(65536, section.targetWordCount * 3), // ~3 tokens per word
          temperature: 0.7
        });
        return result.text;
      },
      section.title,
      context,
      'deep',
      logFn
    );
    content = ralphResult.output;
  } else {
    const result = await llm.complete('research', [{
      role: 'user',
      content: sectionPrompt
    }], {
      maxTokens: Math.min(65536, section.targetWordCount * 3),
      temperature: 0.7
    });
    content = result.text;
  }

  // Extract key information for memory
  await updateMemoryFromSection(memory, section, content, logFn);

  // Mark section complete
  doc.markSectionComplete(sectionId, content);
  doc.modified = new Date().toISOString();
  saveDocumentState(doc);

  const wordCount = content.split(/\s+/).length;
  logFn(`[DocGen] Section complete: ${section.title} (${wordCount} words)`);

  return {
    sectionId,
    title: section.title,
    content,
    wordCount
  };
}

/**
 * Update memory from generated section content
 */
async function updateMemoryFromSection(memory, section, content, logFn) {
  // Generate summary for memory
  const summaryPrompt = `Summarize this section in 2-3 sentences, capturing the key conclusions and facts established:

${content.substring(0, 8000)}`;

  const summaryResult = await llm.complete('flash', [{
    role: 'user',
    content: summaryPrompt
  }], {
    maxTokens: 500,
    temperature: 0.3
  });

  memory.setSectionSummary(section.id, summaryResult.text.trim());

  // Extract key points and definitions (simplified - could use LLM for better extraction)
  const definitions = content.match(/\*\*([^*]+)\*\*:\s*([^.]+\.)/g);
  if (definitions) {
    for (const def of definitions.slice(0, 5)) { // Limit to 5 per section
      const match = def.match(/\*\*([^*]+)\*\*:\s*(.+)/);
      if (match) {
        memory.addDefinition(match[1], match[2], section.id);
      }
    }
  }

  memory.save();
  logFn(`[DocGen] Memory updated for section: ${section.id}`);
}

/**
 * Generate entire document section by section
 */
export async function generateDocument(doc, options = {}, logFn = console.log) {
  const {
    startFrom = null,     // Section ID to start/resume from
    skipSections = [],    // Sections to skip
    onSectionComplete     // Callback after each section
  } = options;

  logFn(`[DocGen] Starting document generation: ${doc.title}`);
  logFn(`[DocGen] Sections: ${doc.sections.length}, Target words: ${doc.metadata.estimatedWords || 'unknown'}`);

  let startGeneration = !startFrom;

  for (const section of doc.sections) {
    // Skip until we reach startFrom
    if (!startGeneration) {
      if (section.id === startFrom) startGeneration = true;
      else continue;
    }

    // Skip specified sections
    if (skipSections.includes(section.id)) {
      logFn(`[DocGen] Skipping section: ${section.id}`);
      continue;
    }

    // Skip already completed
    if (section.status === 'complete') {
      logFn(`[DocGen] Section already complete: ${section.id}`);
      continue;
    }

    // Check dependencies
    const unmetDeps = section.dependencies.filter(dep =>
      !doc.completedSections.includes(dep) && !skipSections.includes(dep)
    );
    if (unmetDeps.length > 0) {
      logFn(`[DocGen] Waiting for dependencies: ${unmetDeps.join(', ')}`);
      continue; // Skip for now, will catch on next pass
    }

    try {
      const result = await generateSection(doc, section.id, logFn);

      if (onSectionComplete) {
        await onSectionComplete(result, doc);
      }
    } catch (error) {
      logFn(`[DocGen] Error generating section ${section.id}: ${error.message}`);
      section.status = 'error';
      section.error = error.message;
      saveDocumentState(doc);
      throw error;
    }
  }

  // Check if complete
  if (doc.isComplete()) {
    doc.status = 'complete';
    saveDocumentState(doc);
    logFn(`[DocGen] Document complete! Total words: ${doc.getTotalWordCount()}`);
  } else {
    logFn(`[DocGen] Document partially complete. Completed: ${doc.completedSections.length}/${doc.sections.length}`);
  }

  return doc;
}

/**
 * Compile document to single markdown file
 */
export function compileDocument(doc, options = {}) {
  const {
    includeToc = true,
    includeMetadata = true
  } = options;

  const parts = [];

  // Title
  parts.push(`# ${doc.title}\n`);

  // Metadata
  if (includeMetadata) {
    parts.push(`*Document Type: ${doc.type}*`);
    parts.push(`*Generated: ${doc.created}*`);
    parts.push(`*Total Words: ${doc.getTotalWordCount().toLocaleString()}*\n`);
  }

  // Table of Contents
  if (includeToc) {
    parts.push(`## Table of Contents\n`);
    for (const section of doc.sections) {
      if (section.status === 'complete') {
        parts.push(`- [${section.title}](#${section.id})`);
        if (section.subsections) {
          for (const sub of section.subsections) {
            parts.push(`  - [${sub.title}](#${sub.id})`);
          }
        }
      }
    }
    parts.push('\n---\n');
  }

  // Content
  for (const section of doc.sections) {
    if (section.status === 'complete' && section.content) {
      parts.push(section.content);
      parts.push('\n---\n');
    }
  }

  return parts.join('\n');
}

/**
 * Save document state to file
 */
function saveDocumentState(doc) {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
  const filePath = path.join(DOCS_DIR, `${doc.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(doc.toJSON(), null, 2));
}

/**
 * Load document state from file
 */
export function loadDocumentState(docId) {
  const filePath = path.join(DOCS_DIR, `${docId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const doc = new DocumentStructure(data);
  doc.sections = data.sections;
  doc.completedSections = data.completedSections || [];
  return doc;
}

/**
 * List all documents
 */
export function listDocuments() {
  if (!fs.existsSync(DOCS_DIR)) {
    return [];
  }
  return fs.readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const doc = loadDocumentState(f.replace('.json', ''));
      return doc ? {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        sections: doc.sections.length,
        completed: doc.completedSections.length,
        wordCount: doc.getTotalWordCount()
      } : null;
    })
    .filter(Boolean);
}

/**
 * Get document progress
 */
export function getDocumentProgress(docId) {
  const doc = loadDocumentState(docId);
  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    status: doc.status,
    sections: doc.sections.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      wordCount: s.content ? s.content.split(/\s+/).length : 0,
      targetWordCount: s.targetWordCount
    })),
    completedSections: doc.completedSections.length,
    totalSections: doc.sections.length,
    currentWordCount: doc.getTotalWordCount(),
    targetWordCount: doc.sections.reduce((t, s) => t + (s.targetWordCount || 0), 0),
    percentComplete: Math.round((doc.completedSections.length / doc.sections.length) * 100)
  };
}

export default {
  DocumentStructure,
  generateOutline,
  generateSection,
  generateDocument,
  compileDocument,
  loadDocumentState,
  saveDocumentState,
  listDocuments,
  getDocumentProgress,
  DOCS_DIR,
  MEMORY_DIR
};
