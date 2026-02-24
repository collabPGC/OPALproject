import fs from 'fs';
import { init as initDocStore, addDocument, deleteDocument } from '../shared/stores/doc-store.js';

const FILE_PATH = '/opt/mattermost/bots-v2/shared/data/opalpass-website-content.md';
const CHANNEL_ID = 'global';
const FILE_NAME = 'opalpass-website-content.md';

async function chunkMarkdown(text) {
  const sections = text.split(/(?=^## )/m).filter(s => s.trim());
  const chunks = [];
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const header = lines[0].replace(/^#+\s*/, '').trim();
    if (section.length < 1500) {
      chunks.push({ text: section.trim(), section: header });
    } else {
      const subsections = section.split(/(?=^### )/m).filter(s => s.trim());
      for (const sub of subsections) {
        const subHeader = sub.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
        if (sub.length < 2000) {
          chunks.push({ text: sub.trim(), section: `${header} > ${subHeader}` });
        } else {
          // further split by ####
          const parts = sub.split(/(?=^#### )/m).filter(s => s.trim());
          for (const part of parts) {
            const partHeader = part.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
            chunks.push({ text: part.trim().slice(0, 2000), section: `${header} > ${subHeader} > ${partHeader}` });
          }
        }
      }
    }
  }
  return chunks;
}

async function main() {
  console.log('[IndexOpalpass] Starting...');
  const text = fs.readFileSync(FILE_PATH, 'utf-8');
  console.log(`[IndexOpalpass] Read ${text.length} chars`);
  const chunks = await chunkMarkdown(text);
  console.log(`[IndexOpalpass] Split into ${chunks.length} chunks`);
  await initDocStore(console);
  try { await deleteDocument(FILE_NAME, CHANNEL_ID); } catch {}
  const result = await addDocument({ fileName: FILE_NAME, channelId: CHANNEL_ID, chunks });
  console.log(`[IndexOpalpass] Indexed ${result.indexed} chunks`);
}

main().catch(err => { console.error('[IndexOpalpass] Failed:', err); process.exit(1); });
