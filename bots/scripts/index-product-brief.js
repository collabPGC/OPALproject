#!/usr/bin/env node
/**
 * Index the product brief into the doc store for semantic search.
 * Run: node /opt/mattermost/bots-v2/scripts/index-product-brief.js
 */
import fs from 'fs';
import { init as initDocStore, addDocument, deleteDocument } from '../shared/stores/doc-store.js';

const BRIEF_PATH = '/opt/mattermost/bots-v2/shared/data/product-brief.md';
const CHANNEL_ID = 'global'; // Available to all channels
const FILE_NAME = 'product-brief.md';

async function chunkMarkdown(text) {
  // Split by ## headers into logical sections
  const sections = text.split(/(?=^## )/m).filter(s => s.trim());
  const chunks = [];

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const header = lines[0].replace(/^#+\s*/, '').trim();

    // If section is short enough, keep as one chunk
    if (section.length < 1500) {
      chunks.push({ text: section.trim(), section: header });
    } else {
      // Split by ### sub-headers
      const subsections = section.split(/(?=^### )/m).filter(s => s.trim());
      for (const sub of subsections) {
        const subLines = sub.trim().split('\n');
        const subHeader = subLines[0].replace(/^#+\s*/, '').trim();
        if (sub.length < 2000) {
          chunks.push({ text: sub.trim(), section: `${header} > ${subHeader}` });
        } else {
          // Split into ~1000 char chunks with overlap
          const words = sub.split(/\s+/);
          let current = [];
          let currentLen = 0;
          for (const word of words) {
            current.push(word);
            currentLen += word.length + 1;
            if (currentLen > 1000) {
              chunks.push({ text: current.join(' '), section: `${header} > ${subHeader}` });
              // Keep last 100 chars as overlap
              const overlap = current.slice(-15);
              current = [...overlap];
              currentLen = overlap.join(' ').length;
            }
          }
          if (current.length > 0) {
            chunks.push({ text: current.join(' '), section: `${header} > ${subHeader}` });
          }
        }
      }
    }
  }

  return chunks;
}

async function main() {
  console.log('[IndexBrief] Starting...');

  const briefText = fs.readFileSync(BRIEF_PATH, 'utf-8');
  console.log(`[IndexBrief] Read ${briefText.length} chars from ${BRIEF_PATH}`);

  const chunks = await chunkMarkdown(briefText);
  console.log(`[IndexBrief] Split into ${chunks.length} chunks`);

  await initDocStore(console);

  // Remove old version if exists
  try {
    await deleteDocument(FILE_NAME, CHANNEL_ID);
    console.log('[IndexBrief] Removed old index');
  } catch {
    // First time
  }

  const result = await addDocument({
    fileName: FILE_NAME,
    channelId: CHANNEL_ID,
    chunks,
  });

  console.log(`[IndexBrief] Indexed ${result.indexed} chunks as "${FILE_NAME}" in channel "${CHANNEL_ID}"`);
  console.log('[IndexBrief] Done.');
}

main().catch(err => {
  console.error('[IndexBrief] Failed:', err);
  process.exit(1);
});
