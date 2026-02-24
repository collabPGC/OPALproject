import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File info
const FILE_ID = 's8b51sogyty99ygceimw5wetoe';
const FILE_NAME = 'LYNA_Master_Financial_Model.xlsx';
const CHANNEL_ID = 'erieukccw3nyfmjgwrgm14gyre';
const TOKEN = '4hx9o1qu73r1mpdxxsxerzdzeo'; // Scout token for API calls

// Import Scout's model router
const modelRouter = (await import('./model-router.js')).default;
const { publishPDF } = await import('./publish-pdf.js');

const log = (level, msg, data) => console.log(JSON.stringify({ level, msg, ...data }));

// Download file
async function downloadFile(fileId) {
  const response = await fetch(`https://opal.partnergroupconsulting.com/api/v4/files/${fileId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Parse Excel
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let content = '';
  let totalRows = 0;
  let formulaCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rows = range.e.r - range.s.r + 1;
    totalRows += rows;

    content += `\n## Sheet: ${sheetName}\n`;
    content += `Rows: ${rows}, Columns: ${range.e.c + 1}\n\n`;

    // Extract data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (let i = 0; i < Math.min(data.length, 100); i++) {
      const row = data[i];
      if (row.some(cell => cell !== '')) {
        content += row.map(c => String(c).substring(0, 50)).join(' | ') + '\n';
      }
    }
    if (data.length > 100) {
      content += `... (${data.length - 100} more rows)\n`;
    }

    // Count formulas
    for (const cell in sheet) {
      if (cell[0] !== '!' && sheet[cell].f) formulaCount++;
    }
  }

  return {
    content,
    sheets: workbook.SheetNames.length,
    totalRows,
    formulaCount,
    sheetNames: workbook.SheetNames
  };
}

// Deep analysis using model router (chunked for full coverage)
async function generateDeepAnalysis(content, log) {
  const chunks = [];

  log('info', 'Starting deep analysis', { contentLength: content.length });

  const tableFormat = `
TABLE FORMAT: Use proper markdown pipe tables:
| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

Always include header separator row with dashes.`;

  // Chunk 1: Executive Summary & Business Overview
  const prompt1 = `You are a senior McKinsey consultant analyzing this spreadsheet for a Fortune 500 client.

${tableFormat}

SPREADSHEET DATA:
${content.substring(0, 50000)}

Generate Part 1 of the analysis:

## Executive Summary
[3-4 paragraph comprehensive summary of key findings, strategic implications, and recommendations]

## Business Overview
[What business/project is this spreadsheet modeling? What are the key assumptions?]

## Financial Model Structure
[Describe how the model is organized, what each sheet represents]

## Key Metrics Analysis
[Identify and analyze the most important KPIs and metrics in the model]

Use specific numbers and data from the spreadsheet. Format tables properly.`;

  log('info', 'Generating chunk 1: Executive Summary');
  await modelRouter.init();
  const resp1 = await modelRouter.complete('research', [{ role: 'user', content: prompt1 }], {
    maxTokens: 16000,
    temperature: 0.3
  });
  // Extract text from Anthropic response format: { content: [{ type: 'text', text: '...' }] }
  const text1 = typeof resp1 === 'string' ? resp1 :
    (Array.isArray(resp1.content) ? resp1.content.map(c => c.text || c).join('') : resp1.content || '');
  chunks.push(text1);
  log('info', 'Chunk 1 complete', { length: text1.length });

  // Chunk 2: Financial Deep Dive
  const prompt2 = `You are a Harvard Business School financial analyst.

${tableFormat}

SPREADSHEET DATA:
${content.substring(0, 50000)}

Generate Part 2 of the analysis:

## Revenue Model Analysis
[Detailed breakdown of revenue streams, pricing, growth assumptions]

## Cost Structure
[Fixed vs variable costs, unit economics, burn rate analysis]

## Scenario Analysis
[Compare different scenarios if present, or suggest what scenarios should be modeled]

## Financial Projections
[Year-by-year analysis, growth rates, key drivers]

Use specific numbers. Create tables where appropriate.`;

  log('info', 'Generating chunk 2: Financial Deep Dive');
  const resp2 = await modelRouter.complete('research', [{ role: 'user', content: prompt2 }], {
    maxTokens: 16000,
    temperature: 0.3
  });
  const text2 = typeof resp2 === 'string' ? resp2 :
    (Array.isArray(resp2.content) ? resp2.content.map(c => c.text || c).join('') : resp2.content || '');
  chunks.push(text2);
  log('info', 'Chunk 2 complete', { length: text2.length });

  // Chunk 3: Strategic Recommendations
  const prompt3 = `You are a strategy partner at McKinsey.

${tableFormat}

Based on the spreadsheet analysis, generate Part 3:

## Strategic Recommendations
[5-7 specific, actionable recommendations with implementation priority]

## Risk Analysis
[Key risks to the financial model assumptions and mitigation strategies]

## Investment Thesis
[If this is a startup/company, what is the investment case?]

## Next Steps
[Specific action items for the team]

---
*Analysis completed using McKinsey 7S framework and HBS financial analysis standards.*`;

  log('info', 'Generating chunk 3: Strategic Recommendations');
  const resp3 = await modelRouter.complete('research', [{ role: 'user', content: prompt3 }], {
    maxTokens: 16000,
    temperature: 0.3
  });
  const text3 = typeof resp3 === 'string' ? resp3 :
    (Array.isArray(resp3.content) ? resp3.content.map(c => c.text || c).join('') : resp3.content || '');
  chunks.push(text3);
  log('info', 'Chunk 3 complete', { length: text3.length });

  return chunks.join('\n\n---\n\n');
}

// Post message to channel
async function postMessage(channelId, message, rootId = null) {
  const body = { channel_id: channelId, message };
  if (rootId) body.root_id = rootId;
  
  const resp = await fetch('https://opal.partnergroupconsulting.com/api/v4/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return resp.json();
}

// Upload file to channel
async function uploadFile(channelId, filePath, filename) {
  const form = new FormData();
  form.append('files', fs.createReadStream(filePath), filename);
  form.append('channel_id', channelId);

  const resp = await fetch('https://opal.partnergroupconsulting.com/api/v4/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...form.getHeaders()
    },
    body: form
  });
  return resp.json();
}

// Main
async function main() {
  try {
    console.log('=== LYNA Deep Analysis ===\n');
    
    // 1. Download
    console.log('1. Downloading file...');
    const buffer = await downloadFile(FILE_ID);
    console.log(`   Downloaded ${buffer.length} bytes`);
    
    // 2. Parse
    console.log('2. Parsing Excel...');
    const parsed = parseExcel(buffer);
    console.log(`   Sheets: ${parsed.sheets}, Rows: ${parsed.totalRows}, Formulas: ${parsed.formulaCount}`);
    
    // 3. Post status
    console.log('3. Posting status update...');
    await postMessage(CHANNEL_ID, 
      `🔍 **Starting Deep Analysis**: ${FILE_NAME}\n\n` +
      `This will generate a comprehensive 30+ page report with:\n` +
      `• Executive Summary & Business Overview\n` +
      `• Financial Deep Dive\n` +
      `• Strategic Recommendations & Risk Analysis\n\n` +
      `_This may take 2-3 minutes..._`
    );
    
    // 4. Generate deep analysis
    console.log('4. Generating deep analysis (3 chunks via Opus 4.5)...');
    const analysis = await generateDeepAnalysis(parsed.content, log);
    console.log(`   Analysis complete: ${analysis.length} chars`);
    
    // 5. Generate PDF
    console.log('5. Generating PDF...');
    const pdfFileName = `LYNA_Analysis_${Date.now()}.pdf`;
    const pdfPath = `/tmp/${pdfFileName}`;
    
    const pdfTitle = `Financial Analysis: ${FILE_NAME}`;
    await publishPDF(pdfTitle, analysis, pdfPath, { style: 'professional' });
    
    const pdfStats = fs.statSync(pdfPath);
    console.log(`   PDF generated: ${(pdfStats.size / 1024).toFixed(1)} KB`);
    
    // 6. Upload PDF
    console.log('6. Uploading PDF to channel...');
    const uploadResult = await uploadFile(CHANNEL_ID, pdfPath, pdfFileName);
    
    if (uploadResult.file_infos && uploadResult.file_infos.length > 0) {
      const fileId = uploadResult.file_infos[0].id;
      
      // 7. Post with PDF attachment
      console.log('7. Posting analysis with PDF...');
      const summaryLength = Math.min(analysis.length, 4000);
      const postBody = {
        channel_id: CHANNEL_ID,
        message: `## 📊 Deep Analysis Complete: ${FILE_NAME}\n\n` +
          `**Analysis Summary** (${analysis.length.toLocaleString()} characters, ${Math.ceil(analysis.length / 3000)} pages)\n\n` +
          analysis.substring(0, summaryLength) +
          (analysis.length > summaryLength ? '\n\n_...Full analysis in attached PDF..._' : ''),
        file_ids: [fileId]
      };
      
      await fetch('https://opal.partnergroupconsulting.com/api/v4/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postBody)
      });
      
      console.log('\n✅ Deep analysis complete!');
      console.log(`   - Analysis: ${analysis.length.toLocaleString()} chars`);
      console.log(`   - PDF: ${pdfFileName} (${(pdfStats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.error('Upload failed:', uploadResult);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
