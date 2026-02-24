// Scout file handling - uploads, image analysis, PDF/DOCX extraction

import * as pdfUtils from 'bots-shared/pdf-utils.js';
import * as spreadsheetUtils from 'bots-shared/spreadsheet-utils.js';
import * as fileIndex from 'bots-shared/file-index.js';
import { downloadFile as sharedDownloadFile, addReaction as sharedAddReaction } from 'bots-shared/file-handler.js';

// Download file content from Mattermost (thin wrapper over shared)
export async function downloadFile(fileId, ctx) {
  return sharedDownloadFile(ctx.config, fileId);
}

// Analyze image using Claude Vision
export async function analyzeImage(imageBuffer, mediaType, userMessage = '', ctx) {
  const { anthropic, config, log } = ctx;
  const imageBase64 = imageBuffer.toString('base64');

  const systemPrompt = `You are Scout, a helpful assistant with vision capabilities.
You can see and analyze images. When analyzing an image:
- Describe what you see clearly and concisely
- Answer any specific questions the user has
- Provide relevant insights or observations
- If it's a diagram, chart, or document, extract key information
- If it's code or a screenshot, help debug or explain
Be direct and helpful. You CAN see images.`;

  const content = [];

  if (userMessage && userMessage.trim()) {
    const cleanMessage = userMessage.replace(/@scout/gi, '').trim();
    content.push({ type: 'text', text: cleanMessage || 'What do you see in this image? Please describe it and provide any relevant insights.' });
  } else {
    content.push({ type: 'text', text: 'What do you see in this image? Please describe it and provide any relevant insights.' });
  }

  content.push({
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: imageBase64 }
  });

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: content }]
    });

    return response.content.find(c => c.type === 'text')?.text || 'I could not analyze the image.';
  } catch (error) {
    log('error', 'Image analysis failed', { error: error.message });
    return `I encountered an error analyzing the image: ${error.message}`;
  }
}

// Extract and parse PDF
export async function extractPdfText(fileId, fileName, fileSize = 0, ctx) {
  const { log } = ctx;
  try {
    const buffer = await downloadFile(fileId, ctx);
    if (!buffer) return null;
    return await pdfUtils.parsePdf(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract PDF', { fileName, error: error.message });
    return null;
  }
}

// Extract and parse DOCX
export async function extractDocxText(fileId, fileName, fileSize = 0, ctx) {
  const { log } = ctx;
  try {
    const buffer = await downloadFile(fileId, ctx);
    if (!buffer) return null;
    return await pdfUtils.parseDocx(buffer, fileName, fileSize, log);
  } catch (error) {
    log('error', 'Failed to extract DOCX', { fileName, error: error.message });
    return null;
  }
}

// Add reaction to a post (thin wrapper over shared)
export async function addReaction(postId, emojiName, ctx) {
  return sharedAddReaction(ctx.mmApi, ctx.state.botUserId, postId, emojiName);
}

// Handle file upload processing
export async function handleFileUpload(post, shouldAnalyzeImages, ctx) {
  const { mmApi, state, log, postMessage, postWithSplitting } = ctx;
  if (!post.file_ids || post.file_ids.length === 0) return;

  try {
    const files = await Promise.all(
      post.file_ids.map(async (id) => {
        const info = await mmApi(`/files/${id}/info`);
        return { ...info, fileId: id };
      })
    );

    // Add all files to the index
    for (const f of files) {
      fileIndex.addFile(f, post.channel_id);
    }

    const fileDescriptions = files.map(f => {
      const ext = f.extension?.toLowerCase() || '';
      const size = (f.size / 1024).toFixed(1);
      const mimeType = f.mime_type || '';

      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
        return { type: 'video', name: f.name, size, fileId: f.fileId, mimeType };
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const mediaTypeMap = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'gif': 'image/gif', 'webp': 'image/webp'
        };
        return { type: 'image', name: f.name, size, fileId: f.fileId, mediaType: mediaTypeMap[ext] || mimeType };
      } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return { type: 'document', name: f.name, size, fileId: f.fileId, mimeType };
      } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
        return { type: 'archive', name: f.name, size, fileId: f.fileId, mimeType };
      }
      return { type: 'file', name: f.name, size, fileId: f.fileId, mimeType };
    });

    // React to the upload
    const reactions = { video: 'movie_camera', image: 'frame_with_picture', document: 'page_facing_up', archive: 'package', file: 'paperclip' };
    for (const file of fileDescriptions) {
      await addReaction(post.id, reactions[file.type] || 'paperclip', ctx);
    }

    // Process images with Claude Vision if @scout was mentioned
    const imageFiles = fileDescriptions.filter(f => f.type === 'image');
    if (imageFiles.length > 0 && shouldAnalyzeImages) {
      await addReaction(post.id, 'eyes', ctx);
      const fileReplyTo = post.root_id || post.id;

      for (const imageFile of imageFiles) {
        log('info', 'Analyzing image with Claude Vision', { fileName: imageFile.name });
        const imageBuffer = await downloadFile(imageFile.fileId, ctx);

        if (imageBuffer) {
          const analysis = await analyzeImage(imageBuffer, imageFile.mediaType, post.message || '', ctx);
          await postMessage(post.channel_id, analysis, fileReplyTo);
        } else {
          await postMessage(post.channel_id, `I couldn't download the image **${imageFile.name}** for analysis.`, fileReplyTo);
        }
      }
      return;
    }

    // For images when not auto-analyzing, offer to help
    if (imageFiles.length > 0 && !shouldAnalyzeImages) {
      const fileReplyTo = post.root_id || post.id;
      const imageNames = imageFiles.map(f => f.name).join(', ');
      await postMessage(post.channel_id,
        `I can see you've shared an image: **${imageNames}**\n\nMention me (\`@scout\`) with the image if you'd like me to analyze it!`,
        fileReplyTo
      );
    }

    // Extract and store document content
    const pdfFiles = files.filter(f => f.extension?.toLowerCase() === 'pdf');
    const docxFiles = files.filter(f => f.extension?.toLowerCase() === 'docx');
    const extractedDocs = [];

    // Process PDFs
    for (const pdfFile of pdfFiles) {
      const pdfContent = await extractPdfText(pdfFile.id, pdfFile.name, pdfFile.size || 0, ctx);
      if (pdfContent && pdfContent.text) {
        extractedDocs.push({ name: pdfFile.name, type: 'pdf', pages: pdfContent.pages, sizeMB: pdfContent.sizeMB, chunks: pdfContent.chunks?.length || 0, structured: pdfContent.structured || false });

        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (pdfContent.chunks && pdfContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(pdfFile.name, pdfContent.chunks);
            channelState.messages.push(...memoryEntries);
          } else {
            channelState.messages.push({ role: 'system', content: `[PDF Document: ${pdfFile.name} - ${pdfContent.pages} pages]\n${pdfContent.text.substring(0, 50000)}`, timestamp: Date.now() });
          }
        }

        pdfUtils.indexDocument(pdfContent, pdfFile.name, post.channel_id, log)
          .then(result => { if (result.indexed > 0) log('info', 'PDF indexed for semantic search', { fileName: pdfFile.name, chunks: result.indexed }); })
          .catch(err => log('warn', 'PDF vector indexing failed', { fileName: pdfFile.name, error: err.message }));
      }
    }

    // Process DOCX files
    for (const docxFile of docxFiles) {
      const docxContent = await extractDocxText(docxFile.id, docxFile.name, docxFile.size || 0, ctx);
      if (docxContent && docxContent.text) {
        extractedDocs.push({ name: docxFile.name, type: 'docx', pages: docxContent.pages, sizeMB: docxContent.sizeMB, chunks: docxContent.chunks?.length || 0, structured: docxContent.structured || false });

        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (docxContent.chunks && docxContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(docxFile.name, docxContent.chunks);
            channelState.messages.push(...memoryEntries);
          } else {
            channelState.messages.push({ role: 'system', content: `[DOCX Document: ${docxFile.name} - ~${docxContent.pages} pages]\n${docxContent.text.substring(0, 50000)}`, timestamp: Date.now() });
          }
        }

        pdfUtils.indexDocument(docxContent, docxFile.name, post.channel_id, log)
          .then(result => { if (result.indexed > 0) log('info', 'DOCX indexed for semantic search', { fileName: docxFile.name, chunks: result.indexed }); })
          .catch(err => log('warn', 'DOCX vector indexing failed', { fileName: docxFile.name, error: err.message }));
      }
    }

    // Process spreadsheet files
    const spreadsheetFiles = files.filter(f => spreadsheetUtils.isSpreadsheet(f.name));
    for (const xlsFile of spreadsheetFiles) {
      try {
        const buffer = await downloadFile(xlsFile.id, ctx);
        if (buffer) {
          const result = spreadsheetUtils.processSpreadsheetAttachment(buffer, xlsFile.name, { maxRowsPerSheet: 100, format: 'markdown' });

          if (result.success) {
            extractedDocs.push({ name: xlsFile.name, type: result.type.replace('.', ''), pages: result.sheetCount, sizeMB: (buffer.length / 1024 / 1024).toFixed(2), chunks: 1, structured: true });

            const channelState = state.channels.get(post.channel_id);
            if (channelState) {
              channelState.messages.push({ role: 'system', content: `[Spreadsheet: ${xlsFile.name} - ${result.sheetCount} sheets, ${result.rowCount} rows]\n${result.context.substring(0, 50000)}`, timestamp: Date.now() });
            }

            fileIndex.markProcessed(xlsFile.id);

            const xlsContent = { text: result.context, chunks: [{ text: result.context, pageNum: 1, heading: `Spreadsheet: ${xlsFile.name}` }] };
            pdfUtils.indexDocument(xlsContent, xlsFile.name, post.channel_id, log)
              .catch(err => log('warn', 'Spreadsheet vector indexing failed', { fileName: xlsFile.name, error: err.message }));
          }
        }
      } catch (error) {
        log('error', 'Failed to process spreadsheet', { fileName: xlsFile.name, error: error.message });
      }
    }

    // Generate summary message
    const fileReplyTo = post.root_id || post.id;
    if (extractedDocs.length > 0) {
      const summaryMsg = pdfUtils.generateDocSummaryMessage(extractedDocs, 'scout');
      await postMessage(post.channel_id, summaryMsg, fileReplyTo);
    } else if (fileDescriptions.some(f => f.type === 'document')) {
      const docNames = fileDescriptions.filter(f => f.type === 'document').map(f => f.name).join(', ');
      await postMessage(post.channel_id, `\u{1F4C4} I see you've shared: **${docNames}**\n\nNeed me to help discuss or analyze what's in there? Just ask!`, fileReplyTo);
    }

    if (fileDescriptions.some(f => f.type === 'video')) {
      await postMessage(post.channel_id, `\u{1F3AC} Video uploaded! If you want the team to watch and discuss, I can set a reminder or create a discussion thread.`, fileReplyTo);
    }

  } catch (error) {
    log('error', 'Failed to handle file upload', { error: error.message });
  }
}
