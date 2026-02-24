#!/usr/bin/env node
/**
 * One-time script to process existing documents in brainstorming channel
 */

import * as pdfUtils from '../shared/pdf-utils.js';
import fs from 'fs';
import path from 'path';

const API_TOKEN = '4hx9o1qu73r1mpdxxsxerzdzeo';
const BASE_URL = 'https://opal.partnergroupconsulting.com/api/v4';
const CHANNEL_ID = 'erieukccw3nyfmjgwrgm14gyre'; // Brainstorming

// PDFs to process
const pdfs = [
  { id: 'pj6ar7mw7ibgpkakc3owf5fb9y', name: 'LYNA_Demo_Clinical_Policies_v2.pdf', size: 18681 },
  { id: 'ppbfgdscjif5pbdksg1qp5k5mr', name: 'OpalLYNAExecutiveOverviewpdf.pdf', size: 1082805 }
];

// Also the DOCX
const docx = { id: 'cuba7388f7rndyxiyh6sc3sk4y', name: 'LYNA_Land_Expand_Strategy.docx', size: 14442 };

async function downloadFile(fileId) {
  const response = await fetch(`${BASE_URL}/files/${fileId}`, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });
  if (!response.ok) {
    console.error(`Failed to download ${fileId}: ${response.status}`);
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
}

async function postMessage(channelId, message) {
  const response = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channel_id: channelId, message })
  });
  return response.ok;
}

const log = (level, msg, data) => console.log(`[${level}] ${msg}`, data ? JSON.stringify(data) : '');

async function processFiles() {
  console.log('Processing existing documents in Brainstorming channel...\n');

  const memoryDir = '/opt/mattermost/bot-memory/channels';
  const channelMemoryDir = path.join(memoryDir, CHANNEL_ID);

  // Ensure directory exists
  if (!fs.existsSync(channelMemoryDir)) {
    fs.mkdirSync(channelMemoryDir, { recursive: true });
  }

  // Load existing history
  const historyPath = path.join(channelMemoryDir, 'history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {
      console.log('Could not parse existing history, starting fresh');
    }
  }

  const extractedDocs = [];

  // Process PDFs
  for (const pdf of pdfs) {
    console.log(`\nDownloading ${pdf.name}...`);
    const buffer = await downloadFile(pdf.id);
    if (!buffer) continue;

    console.log(`Parsing ${pdf.name}...`);
    const result = await pdfUtils.parsePdf(buffer, pdf.name, pdf.size, log);

    if (result && result.text) {
      extractedDocs.push({
        name: pdf.name,
        type: 'pdf',
        pages: result.pages,
        sizeMB: result.sizeMB,
        chunks: result.chunks?.length || 0,
        structured: result.structured || false
      });

      // Add to memory
      if (result.chunks && result.chunks.length > 0) {
        const memoryEntries = pdfUtils.formatChunksForMemory(pdf.name, result.chunks);
        history.push(...memoryEntries);
        console.log(`  -> Added ${result.chunks.length} chunks to memory`);
      } else {
        history.push({
          role: 'system',
          content: `[PDF Document: ${pdf.name} - ${result.pages} pages]\n${result.text.substring(0, 50000)}`,
          timestamp: Date.now()
        });
        console.log(`  -> Added full document to memory`);
      }
    }
  }

  // Process DOCX
  console.log(`\nDownloading ${docx.name}...`);
  const docxBuffer = await downloadFile(docx.id);
  if (docxBuffer) {
    console.log(`Parsing ${docx.name}...`);
    const result = await pdfUtils.parseDocx(docxBuffer, docx.name, docx.size, log);

    if (result && result.text) {
      extractedDocs.push({
        name: docx.name,
        type: 'docx',
        pages: result.pages,
        sizeMB: result.sizeMB,
        chunks: result.chunks?.length || 0,
        structured: result.structured || false
      });

      if (result.chunks && result.chunks.length > 0) {
        const memoryEntries = pdfUtils.formatChunksForMemory(docx.name, result.chunks);
        history.push(...memoryEntries);
        console.log(`  -> Added ${result.chunks.length} chunks to memory`);
      } else {
        history.push({
          role: 'system',
          content: `[DOCX Document: ${docx.name} - ~${result.pages} pages]\n${result.text.substring(0, 50000)}`,
          timestamp: Date.now()
        });
        console.log(`  -> Added full document to memory`);
      }
    }
  }

  // Save updated history
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`\nSaved updated history to ${historyPath}`);

  // Post confirmation message
  if (extractedDocs.length > 0) {
    const summaryMsg = pdfUtils.generateDocSummaryMessage(extractedDocs, 'scout');
    const fullMsg = `**Processed existing documents:**\n\n${summaryMsg}`;
    await postMessage(CHANNEL_ID, fullMsg);
    console.log('\nPosted confirmation message to Brainstorming channel');
  }

  console.log('\nDone!');
}

processFiles().catch(console.error);
