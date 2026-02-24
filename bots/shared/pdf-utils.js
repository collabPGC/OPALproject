/**
 * Document Utilities - Shared module for PDF and DOCX parsing with context-aware chunking
 * Used by Scout, Spark, and other bots for document processing
 *
 * Now with vector store integration for semantic search (LanceDB)
 */

import { PDFParse } from 'pdf-parse';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

// Vector store for semantic search (lazy loaded)
let vectorStore = null;

// Configuration
const CONFIG = {
  MAX_SIZE_MB: 100,
  MAX_CHUNK_CHARS: 30000, // ~7500 tokens for memory storage
  VECTOR_CHUNK_CHARS: 1500, // ~375 tokens for embeddings (smaller for better retrieval)
  VECTOR_CHUNK_OVERLAP: 200, // Overlap between vector chunks
  PAGES_PER_CHUNK_FALLBACK: 100,
  MIN_HEADINGS_FOR_STRUCTURE: 3
};

/**
 * Initialize vector store (lazy load to avoid startup delay)
 */
async function getVectorStore() {
  if (!vectorStore) {
    try {
      vectorStore = await import('./vectorstore.js');
      await vectorStore.init();
    } catch (error) {
      console.error('[pdf-utils] Failed to load vector store:', error.message);
      return null;
    }
  }
  return vectorStore;
}

/**
 * Split text into smaller chunks for vector embeddings
 * Uses sliding window with overlap for better retrieval
 */
function splitForVectorization(text, chunkSize = CONFIG.VECTOR_CHUNK_CHARS, overlap = CONFIG.VECTOR_CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.substring(start, Math.min(end, text.length)).trim());
    start = end - overlap;
  }

  return chunks.filter(c => c.length > 50); // Skip tiny chunks
}

/**
 * Detect chapter/section headings in text
 * @param {string} text - Document text
 * @returns {Array} Array of heading objects with line, charPos, text, type
 */
export function detectDocumentStructure(text) {
  const lines = text.split('\n');
  const headings = [];

  // Patterns for chapter/section detection (ordered by priority)
  const patterns = [
    // Chapter patterns: "Chapter 1", "CHAPTER ONE", "Chapter 1:", "Chapter I"
    { regex: /^(Chapter|CHAPTER)\s+(\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)[:\s]/i, type: 'chapter' },
    // Part patterns: "Part 1", "PART ONE"
    { regex: /^(Part|PART)\s+(\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)[:\s]/i, type: 'part' },
    // Section patterns: "Section 1.1", "1.1", "1.1.1"
    { regex: /^(Section\s+)?(\d+\.)+\d*\s+[A-Z]/i, type: 'section' },
    // Numbered headings: "1. Introduction", "2. Methods"
    { regex: /^\d+\.\s+[A-Z][a-z]+/, type: 'section' },
    // All-caps headings (likely section titles) - at least 10 chars, max 60 chars
    { regex: /^[A-Z][A-Z\s]{10,60}$/, type: 'heading' },
    // Title case headings (common in academic papers)
    { regex: /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,6}$/, type: 'heading' },
    // Roman numeral sections: "I. Introduction", "II. Background"
    { regex: /^[IVXLC]+\.\s+[A-Z]/, type: 'section' },
    // Appendix patterns
    { regex: /^(Appendix|APPENDIX)\s+[A-Z0-9]/i, type: 'appendix' }
  ];

  let charPosition = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip very short lines or lines that are likely page numbers
    if (line.length < 3 || /^\d+$/.test(line)) {
      charPosition += lines[i].length + 1;
      continue;
    }

    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        headings.push({
          line: i,
          charPos: charPosition,
          text: line.substring(0, 100), // Truncate long headings
          type: pattern.type
        });
        break; // Only match first pattern per line
      }
    }
    charPosition += lines[i].length + 1; // +1 for newline
  }

  return headings;
}

/**
 * Split text by chapters/sections with max size limit
 * @param {string} text - Full document text
 * @param {Array} headings - Array of detected headings
 * @param {number} maxChunkSize - Maximum characters per chunk
 * @returns {Array|null} Array of chunks or null if no structure
 */
export function chunkByStructure(text, headings, maxChunkSize = CONFIG.MAX_CHUNK_CHARS) {
  const chunks = [];

  if (headings.length === 0) {
    return null; // No structure detected, fall back to page-based
  }

  // Group consecutive sections if they're small
  let currentChunk = { title: '', text: '', sections: [] };

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const startPos = heading.charPos;
    const endPos = nextHeading ? nextHeading.charPos : text.length;
    const sectionText = text.substring(startPos, endPos);

    // If this section alone exceeds max size, split it further
    if (sectionText.length > maxChunkSize) {
      // Save current chunk if it has content
      if (currentChunk.text.length > 0) {
        chunks.push({ ...currentChunk });
        currentChunk = { title: '', text: '', sections: [] };
      }

      // Split large section by paragraphs
      const paragraphs = sectionText.split(/\n\n+/);
      let subChunk = { title: heading.text, text: '', sections: [heading.text] };

      for (const para of paragraphs) {
        if (subChunk.text.length + para.length > maxChunkSize && subChunk.text.length > 0) {
          chunks.push({ ...subChunk });
          subChunk = { title: `${heading.text} (cont.)`, text: '', sections: [`${heading.text} (continued)`] };
        }
        subChunk.text += para + '\n\n';
      }

      if (subChunk.text.length > 0) {
        chunks.push({ ...subChunk });
      }
    } else {
      // Check if adding this section would exceed max size
      if (currentChunk.text.length + sectionText.length > maxChunkSize && currentChunk.text.length > 0) {
        chunks.push({ ...currentChunk });
        currentChunk = { title: heading.text, text: sectionText, sections: [heading.text] };
      } else {
        if (currentChunk.title === '') {
          currentChunk.title = heading.text;
        }
        currentChunk.text += sectionText;
        currentChunk.sections.push(heading.text);
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.text.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Chunk by page count (fallback when no structure detected)
 * @param {string} text - Full document text
 * @param {number} numPages - Total pages in document
 * @param {number} pagesPerChunk - Pages per chunk
 * @returns {Array} Array of page-based chunks
 */
export function chunkByPages(text, numPages, pagesPerChunk = CONFIG.PAGES_PER_CHUNK_FALLBACK) {
  const chunks = [];
  const avgCharsPerPage = text.length / numPages;
  const charsPerChunk = Math.floor(avgCharsPerPage * pagesPerChunk);
  const numChunks = Math.ceil(numPages / pagesPerChunk);

  for (let i = 0; i < numChunks; i++) {
    const startPage = i * pagesPerChunk + 1;
    const endPage = Math.min((i + 1) * pagesPerChunk, numPages);
    const startChar = i * charsPerChunk;
    const endChar = Math.min((i + 1) * charsPerChunk, text.length);

    chunks.push({
      chunkNum: i + 1,
      totalChunks: numChunks,
      title: `Pages ${startPage}-${endPage}`,
      sections: [`Pages ${startPage}-${endPage}`],
      text: text.substring(startChar, endChar),
      type: 'page-based'
    });
  }

  return chunks;
}

/**
 * Extract and parse PDF with context-aware chunking
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} fileName - Name of the file
 * @param {number} fileSize - File size in bytes
 * @param {Function} logger - Logging function (optional)
 * @returns {Object} Parsed PDF data with chunks
 */
export async function parsePdf(buffer, fileName, fileSize = 0, logger = null) {
  const log = logger || ((level, msg, data) => console.log(`[${level}] ${msg}`, data || ''));
  const sizeMB = fileSize / (1024 * 1024);

  try {
    if (sizeMB > CONFIG.MAX_SIZE_MB) {
      log('warn', 'PDF exceeds size limit', { fileName, sizeMB, maxMB: CONFIG.MAX_SIZE_MB });
      return {
        text: `[PDF too large: ${sizeMB.toFixed(1)}MB - max ${CONFIG.MAX_SIZE_MB}MB]`,
        pages: 0,
        truncated: true,
        chunks: []
      };
    }

    // pdf-parse v2 API
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const info = await parser.getInfo().catch(() => ({}));
    await parser.destroy();

    const data = {
      text: result.text,
      numpages: result.pages?.length || Math.ceil(result.text.length / 3000), // Estimate if not available
      info: info
    };

    log('info', 'Extracted PDF text', { fileName, pages: data.numpages, chars: data.text.length, sizeMB: sizeMB.toFixed(1) });

    // Try context-aware chunking first
    let chunks = [];
    const headings = detectDocumentStructure(data.text);

    if (headings.length >= CONFIG.MIN_HEADINGS_FOR_STRUCTURE) {
      // Document has structure - chunk by chapters/sections
      const structuredChunks = chunkByStructure(data.text, headings, CONFIG.MAX_CHUNK_CHARS);

      if (structuredChunks && structuredChunks.length > 0) {
        chunks = structuredChunks.map((chunk, idx) => ({
          chunkNum: idx + 1,
          totalChunks: structuredChunks.length,
          title: chunk.title,
          sections: chunk.sections,
          text: chunk.text,
          type: 'structured'
        }));

        log('info', 'Split PDF by document structure', {
          fileName,
          headingsFound: headings.length,
          chunks: chunks.length,
          sampleHeadings: headings.slice(0, 5).map(h => ({ type: h.type, text: h.text.substring(0, 50) }))
        });
      }
    }

    // Fall back to page-based chunking if no structure or chunking failed
    if (chunks.length === 0 && data.numpages > 50) {
      chunks = chunkByPages(data.text, data.numpages, CONFIG.PAGES_PER_CHUNK_FALLBACK);
      log('info', 'Split PDF by pages (no structure detected)', { fileName, pages: data.numpages, chunks: chunks.length });
    }

    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
      sizeMB: sizeMB.toFixed(1),
      chunks: chunks,
      structured: chunks.length > 0 && chunks[0].type === 'structured',
      headings: headings.slice(0, 20) // Include first 20 headings for reference
    };
  } catch (error) {
    log('error', 'Failed to parse PDF', { fileName, sizeMB, error: error.message });
    return null;
  }
}

/**
 * Extract and parse DOCX with context-aware chunking
 * @param {Buffer} buffer - DOCX file buffer
 * @param {string} fileName - Name of the file
 * @param {number} fileSize - File size in bytes
 * @param {Function} logger - Logging function (optional)
 * @returns {Object} Parsed DOCX data with chunks
 */
export async function parseDocx(buffer, fileName, fileSize = 0, logger = null) {
  const log = logger || ((level, msg, data) => console.log(`[${level}] ${msg}`, data || ''));
  const sizeMB = fileSize / (1024 * 1024);

  try {
    if (sizeMB > CONFIG.MAX_SIZE_MB) {
      log('warn', 'DOCX exceeds size limit', { fileName, sizeMB, maxMB: CONFIG.MAX_SIZE_MB });
      return {
        text: `[DOCX too large: ${sizeMB.toFixed(1)}MB - max ${CONFIG.MAX_SIZE_MB}MB]`,
        pages: 0,
        truncated: true,
        chunks: []
      };
    }

    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    // Estimate pages (~2500 chars per page)
    const estimatedPages = Math.max(1, Math.ceil(text.length / 2500));

    log('info', 'Extracted DOCX text', { fileName, estimatedPages, chars: text.length, sizeMB: sizeMB.toFixed(1) });

    // Try context-aware chunking
    let chunks = [];
    const headings = detectDocumentStructure(text);

    if (headings.length >= CONFIG.MIN_HEADINGS_FOR_STRUCTURE) {
      const structuredChunks = chunkByStructure(text, headings, CONFIG.MAX_CHUNK_CHARS);

      if (structuredChunks && structuredChunks.length > 0) {
        chunks = structuredChunks.map((chunk, idx) => ({
          chunkNum: idx + 1,
          totalChunks: structuredChunks.length,
          title: chunk.title,
          sections: chunk.sections,
          text: chunk.text,
          type: 'structured'
        }));

        log('info', 'Split DOCX by document structure', {
          fileName,
          headingsFound: headings.length,
          chunks: chunks.length,
          sampleHeadings: headings.slice(0, 5).map(h => ({ type: h.type, text: h.text.substring(0, 50) }))
        });
      }
    }

    // Fall back to size-based chunking for long documents without structure
    if (chunks.length === 0 && text.length > CONFIG.MAX_CHUNK_CHARS) {
      const numChunks = Math.ceil(text.length / CONFIG.MAX_CHUNK_CHARS);
      for (let i = 0; i < numChunks; i++) {
        const startChar = i * CONFIG.MAX_CHUNK_CHARS;
        const endChar = Math.min((i + 1) * CONFIG.MAX_CHUNK_CHARS, text.length);
        chunks.push({
          chunkNum: i + 1,
          totalChunks: numChunks,
          title: `Section ${i + 1}`,
          sections: [`Section ${i + 1}`],
          text: text.substring(startChar, endChar),
          type: 'size-based'
        });
      }
      log('info', 'Split DOCX by size (no structure detected)', { fileName, chars: text.length, chunks: chunks.length });
    }

    return {
      text: text,
      pages: estimatedPages,
      sizeMB: sizeMB.toFixed(1),
      chunks: chunks,
      structured: chunks.length > 0 && chunks[0].type === 'structured',
      headings: headings.slice(0, 20)
    };
  } catch (error) {
    log('error', 'Failed to parse DOCX', { fileName, sizeMB, error: error.message });
    return null;
  }
}

/**
 * Format chunks for storage in channel memory
 * @param {string} fileName - Document file name
 * @param {Array} chunks - Array of chunks
 * @param {number} maxCharsPerEntry - Max chars per memory entry
 * @returns {Array} Array of formatted memory entries
 */
export function formatChunksForMemory(fileName, chunks, maxCharsPerEntry = 25000) {
  const docType = fileName.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF';
  return chunks.map(chunk => {
    const sectionList = chunk.sections?.slice(0, 5).join(', ') || chunk.title;
    const header = chunk.type === 'structured'
      ? `[${docType}: ${fileName} | ${chunk.title} (Part ${chunk.chunkNum}/${chunk.totalChunks})]\nSections: ${sectionList}`
      : `[${docType}: ${fileName} | ${chunk.title} (Part ${chunk.chunkNum}/${chunk.totalChunks})]`;

    return {
      role: 'system',
      content: `${header}\n\n${chunk.text.substring(0, maxCharsPerEntry)}`,
      timestamp: Date.now()
    };
  });
}

/**
 * Generate summary message for uploaded documents (PDFs and DOCX)
 * @param {Array} extractedDocs - Array of document info objects
 * @param {string} botName - Name of the bot (for suggestions)
 * @returns {string} Formatted message
 */
export function generateDocSummaryMessage(extractedDocs, botName = 'scout') {
  const docSummary = extractedDocs.map(p => {
    const structureInfo = p.structured ? ' (by chapters/sections)' : p.chunks > 0 ? ` (${p.chunks} sections)` : '';
    const pageLabel = p.type === 'docx' ? 'pages (est.)' : 'pages';
    return `• **${p.name}** - ${p.pages} ${pageLabel}${structureInfo}`;
  }).join('\n');

  const hasStructured = extractedDocs.some(p => p.structured);
  const hasChunks = extractedDocs.some(p => p.chunks > 0);

  let note = '';
  if (hasStructured) {
    note = `\n\n_📚 Document indexed by chapters/sections for better context._`;
  } else if (hasChunks) {
    note = `\n\n_Large documents are indexed in sections._`;
  }

  const suggestions = botName === 'spark'
    ? `"@${botName} discuss the document" or "@${botName} what should we focus on?"`
    : `"@${botName} summarize the document" or "@${botName} what are the key points?"`;

  return `📄 I've read the document${extractedDocs.length > 1 ? 's' : ''}:\n${docSummary}\n\n✅ **I can now answer questions about ${extractedDocs.length > 1 ? 'these documents' : 'this document'}!**${note}\n\nTry: ${suggestions}`;
}

// Legacy alias for backwards compatibility
export const generatePdfSummaryMessage = generateDocSummaryMessage;

/**
 * Index a parsed document into the vector store for semantic search
 * @param {Object} parsedDoc - Output from parsePdf or parseDocx
 * @param {string} fileName - Document file name
 * @param {string} channelId - Channel where document was uploaded
 * @param {Function} logger - Logging function (optional)
 * @returns {Object} Indexing result with chunk count
 */
export async function indexDocument(parsedDoc, fileName, channelId, logger = null) {
  const log = logger || ((level, msg, data) => console.log(`[${level}] ${msg}`, data || ''));

  try {
    const vs = await getVectorStore();
    if (!vs) {
      log('warn', 'Vector store not available, skipping indexing', { fileName });
      return { indexed: 0, skipped: true };
    }

    // Prepare chunks for vectorization (smaller chunks than memory storage)
    const vectorChunks = [];

    if (parsedDoc.chunks && parsedDoc.chunks.length > 0) {
      // Use structured chunks but split further for embeddings
      for (const chunk of parsedDoc.chunks) {
        const subChunks = splitForVectorization(chunk.text);
        for (let i = 0; i < subChunks.length; i++) {
          vectorChunks.push({
            text: subChunks[i],
            section: chunk.title || chunk.sections?.[0] || '',
            pageNumber: chunk.chunkNum || 0
          });
        }
      }
    } else if (parsedDoc.text) {
      // No structure - split entire text
      const subChunks = splitForVectorization(parsedDoc.text);
      for (let i = 0; i < subChunks.length; i++) {
        vectorChunks.push({
          text: subChunks[i],
          section: '',
          pageNumber: Math.floor((i / subChunks.length) * (parsedDoc.pages || 1)) + 1
        });
      }
    }

    if (vectorChunks.length === 0) {
      log('warn', 'No content to index', { fileName });
      return { indexed: 0 };
    }

    log('info', 'Indexing document into vector store', {
      fileName,
      channelId,
      chunks: vectorChunks.length
    });

    const result = await vs.addDocument({
      fileName,
      channelId,
      chunks: vectorChunks
    }, log);

    log('info', 'Document indexed successfully', {
      fileName,
      indexed: result.indexed
    });

    return result;
  } catch (error) {
    log('error', 'Failed to index document', { fileName, error: error.message });
    return { indexed: 0, error: error.message };
  }
}

/**
 * Search for relevant document content using semantic search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string} options.channelId - Limit to specific channel
 * @param {string} options.fileName - Limit to specific file
 * @param {number} options.limit - Max results (default 5)
 * @returns {Array|null} Array of relevant chunks or null if vector store unavailable
 */
export async function searchDocuments(query, options = {}) {
  try {
    const vs = await getVectorStore();
    if (!vs) return null;

    return await vs.search(query, options);
  } catch (error) {
    console.error('[pdf-utils] Search failed:', error.message);
    return null;
  }
}

/**
 * Get formatted context from semantic search for use in prompts
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {string|null} Formatted context string or null
 */
export async function getSemanticContext(query, options = {}) {
  try {
    const vs = await getVectorStore();
    if (!vs) return null;

    return await vs.searchForContext(query, options);
  } catch (error) {
    console.error('[pdf-utils] Context search failed:', error.message);
    return null;
  }
}

/**
 * Get vector store statistics
 * @param {string} channelId - Optional channel filter
 * @returns {Object|null} Stats object or null
 */
export async function getVectorStats(channelId = null) {
  try {
    const vs = await getVectorStore();
    if (!vs) return null;

    return await vs.getStats(channelId);
  } catch (error) {
    console.error('[pdf-utils] Stats failed:', error.message);
    return null;
  }
}

export default {
  detectDocumentStructure,
  chunkByStructure,
  chunkByPages,
  parsePdf,
  parseDocx,
  formatChunksForMemory,
  generateDocSummaryMessage,
  generatePdfSummaryMessage,
  // Vector store functions
  indexDocument,
  searchDocuments,
  getSemanticContext,
  getVectorStats,
  CONFIG
};
