/**
 * File Index System
 *
 * Tracks and indexes uploaded files for Scout/Spark bots.
 * Enables on-demand processing and retrieval of historical files.
 */

import fs from 'fs';
import path from 'path';
import * as spreadsheetUtils from './spreadsheet-utils.js';
import * as pdfUtils from './pdf-utils.js';

const INDEX_PATH = '/opt/mattermost/bots-v2/shared/data/file-index.json';
const DATA_DIR = path.dirname(INDEX_PATH);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File index structure
let fileIndex = {
  files: {},           // fileId -> file metadata
  byChannel: {},       // channelId -> [fileIds]
  processed: new Set() // Set of processed file IDs
};

// Load index from disk
function loadIndex() {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
      fileIndex.files = data.files || {};
      fileIndex.byChannel = data.byChannel || {};
      fileIndex.processed = new Set(data.processed || []);
    }
  } catch (err) {
    console.error('[FileIndex] Failed to load index:', err.message);
  }
}

// Save index to disk
function saveIndex() {
  try {
    const data = {
      files: fileIndex.files,
      byChannel: fileIndex.byChannel,
      processed: [...fileIndex.processed]
    };
    fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[FileIndex] Failed to save index:', err.message);
  }
}

// Initialize
loadIndex();

/**
 * Add a file to the index
 */
export function addFile(fileInfo, channelId) {
  const fileId = fileInfo.id;

  fileIndex.files[fileId] = {
    id: fileId,
    name: fileInfo.name,
    extension: fileInfo.extension,
    size: fileInfo.size,
    mimeType: fileInfo.mime_type,
    channelId,
    uploadedAt: fileInfo.create_at,
    indexedAt: Date.now()
  };

  if (!fileIndex.byChannel[channelId]) {
    fileIndex.byChannel[channelId] = [];
  }
  if (!fileIndex.byChannel[channelId].includes(fileId)) {
    fileIndex.byChannel[channelId].push(fileId);
  }

  saveIndex();
  return fileIndex.files[fileId];
}

/**
 * Mark a file as processed
 */
export function markProcessed(fileId) {
  fileIndex.processed.add(fileId);
  saveIndex();
}

/**
 * Check if a file has been processed
 */
export function isProcessed(fileId) {
  return fileIndex.processed.has(fileId);
}

/**
 * Get files for a channel
 */
export function getChannelFiles(channelId, options = {}) {
  const fileIds = fileIndex.byChannel[channelId] || [];
  let files = fileIds.map(id => fileIndex.files[id]).filter(Boolean);

  if (options.unprocessedOnly) {
    files = files.filter(f => !fileIndex.processed.has(f.id));
  }

  if (options.extension) {
    const ext = options.extension.toLowerCase().replace('.', '');
    files = files.filter(f => f.extension?.toLowerCase() === ext);
  }

  if (options.types) {
    const types = Array.isArray(options.types) ? options.types : [options.types];
    files = files.filter(f => types.includes(getFileType(f)));
  }

  return files.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
}

/**
 * Get all unprocessed files
 */
export function getUnprocessedFiles() {
  return Object.values(fileIndex.files)
    .filter(f => !fileIndex.processed.has(f.id))
    .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
}

/**
 * Get file by ID
 */
export function getFile(fileId) {
  return fileIndex.files[fileId];
}

/**
 * Search files by name
 */
export function searchFiles(query, channelId = null) {
  const q = query.toLowerCase();
  let files = Object.values(fileIndex.files);

  if (channelId) {
    files = files.filter(f => f.channelId === channelId);
  }

  return files.filter(f =>
    f.name?.toLowerCase().includes(q) ||
    f.extension?.toLowerCase().includes(q)
  );
}

/**
 * Determine file type category
 */
export function getFileType(file) {
  const ext = (file.extension || '').toLowerCase();

  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'ods'].includes(ext)) {
    return 'spreadsheet';
  }
  if (['pdf'].includes(ext)) {
    return 'pdf';
  }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return 'document';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return 'archive';
  }
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'].includes(ext)) {
    return 'code';
  }
  if (['json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) {
    return 'data';
  }
  if (['md', 'txt', 'log'].includes(ext)) {
    return 'text';
  }

  return 'other';
}

/**
 * Process a file and return extracted content
 */
export async function processFile(fileInfo, buffer, options = {}) {
  const fileType = getFileType(fileInfo);
  const log = options.log || console.log;

  try {
    switch (fileType) {
      case 'spreadsheet': {
        const result = spreadsheetUtils.processSpreadsheetAttachment(
          buffer,
          fileInfo.name,
          {
            maxRowsPerSheet: options.maxRows || 100,
            format: 'markdown',
            includeFormulas: true,
            includeAdvanced: true
          }
        );

        if (result.success) {
          markProcessed(fileInfo.id);
          return {
            success: true,
            type: 'spreadsheet',
            name: fileInfo.name,
            summary: {
              sheets: result.sheetCount,
              rows: result.rowCount,
              formulas: result.formulaCount,
              hasComplexFormulas: result.hasComplexFormulas
            },
            context: result.context,
            fullResult: result
          };
        } else {
          return { success: false, error: result.error };
        }
      }

      case 'pdf': {
        const result = await pdfUtils.parsePdf(buffer, fileInfo.name, fileInfo.size, log);
        if (result && result.text) {
          markProcessed(fileInfo.id);
          return {
            success: true,
            type: 'pdf',
            name: fileInfo.name,
            summary: {
              pages: result.pages,
              chunks: result.chunks?.length || 0
            },
            context: result.text,
            fullResult: result
          };
        } else {
          return { success: false, error: 'Failed to parse PDF' };
        }
      }

      case 'document': {
        if (fileInfo.extension?.toLowerCase() === 'docx') {
          const result = await pdfUtils.parseDocx(buffer, fileInfo.name, fileInfo.size, log);
          if (result && result.text) {
            markProcessed(fileInfo.id);
            return {
              success: true,
              type: 'document',
              name: fileInfo.name,
              summary: {
                pages: result.pages,
                chunks: result.chunks?.length || 0
              },
              context: result.text,
              fullResult: result
            };
          }
        }
        return { success: false, error: 'Unsupported document format' };
      }

      default:
        return {
          success: false,
          error: `Unsupported file type: ${fileType}`,
          type: fileType
        };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Scan channel for files via API and add to index
 */
export async function scanChannelFiles(channelId, mmApi, options = {}) {
  const log = options.log || console.log;
  const limit = options.limit || 100;

  try {
    // Fetch recent posts with files
    const posts = await mmApi(`/channels/${channelId}/posts?per_page=${limit}`);

    if (!posts || !posts.posts) {
      return { scanned: 0, added: 0 };
    }

    let added = 0;
    for (const postId of Object.keys(posts.posts)) {
      const post = posts.posts[postId];
      if (post.file_ids && post.file_ids.length > 0) {
        for (const fileId of post.file_ids) {
          if (!fileIndex.files[fileId]) {
            try {
              const fileInfo = await mmApi(`/files/${fileId}/info`);
              if (fileInfo) {
                addFile(fileInfo, channelId);
                added++;
                log('info', 'Indexed file', { name: fileInfo.name, id: fileId });
              }
            } catch (err) {
              log('warn', 'Failed to get file info', { fileId, error: err.message });
            }
          }
        }
      }
    }

    return { scanned: Object.keys(posts.posts).length, added };
  } catch (err) {
    log('error', 'Channel file scan failed', { channelId, error: err.message });
    return { scanned: 0, added: 0, error: err.message };
  }
}

/**
 * Get index statistics
 */
export function getStats() {
  const files = Object.values(fileIndex.files);
  const byType = {};

  for (const f of files) {
    const type = getFileType(f);
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    totalFiles: files.length,
    processedFiles: fileIndex.processed.size,
    unprocessedFiles: files.length - fileIndex.processed.size,
    channelCount: Object.keys(fileIndex.byChannel).length,
    byType
  };
}

export default {
  addFile,
  markProcessed,
  isProcessed,
  getChannelFiles,
  getUnprocessedFiles,
  getFile,
  searchFiles,
  getFileType,
  processFile,
  scanChannelFiles,
  getStats
};
