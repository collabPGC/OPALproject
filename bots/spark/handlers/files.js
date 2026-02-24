// File upload handling for Spark
import * as pdfUtils from 'bots-shared/pdf-utils.js';
import * as spreadsheetUtils from 'bots-shared/spreadsheet-utils.js';
import { downloadFile as sharedDownloadFile, addReaction as sharedAddReaction } from 'bots-shared/file-handler.js';

// Download file content from Mattermost (thin wrapper over shared)
async function downloadFile(fileId, ctx) {
  return sharedDownloadFile(ctx.config, fileId);
}

// Extract and parse PDF
async function extractPdfText(fileId, fileName, fileSize, ctx) {
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
async function extractDocxText(fileId, fileName, fileSize, ctx) {
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
async function addReaction(postId, emojiName, ctx) {
  return sharedAddReaction(ctx.mmApi, ctx.state.botUserId, postId, emojiName);
}

export async function handleFileUpload(post, ctx) {
  const { mmApi, state, postMessage, log } = ctx;

  if (!post.file_ids || post.file_ids.length === 0) return;

  try {
    const files = await Promise.all(
      post.file_ids.map(id => mmApi(`/files/${id}/info`))
    );

    const fileTypes = files.map(f => {
      const ext = f.extension?.toLowerCase() || '';
      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
      return 'file';
    });

    // React based on file type
    const reactions = { video: 'movie_camera', image: 'frame_with_picture', document: 'page_facing_up', file: 'paperclip' };
    for (const type of fileTypes) {
      await addReaction(post.id, reactions[type] || 'paperclip', ctx);
    }

    // Extract and store document content
    const pdfFiles = files.filter(f => f.extension?.toLowerCase() === 'pdf');
    const docxFiles = files.filter(f => f.extension?.toLowerCase() === 'docx');
    const extractedDocs = [];

    // Process PDFs
    for (const pdfFile of pdfFiles) {
      const pdfContent = await extractPdfText(pdfFile.id, pdfFile.name, pdfFile.size || 0, ctx);
      if (pdfContent && pdfContent.text) {
        extractedDocs.push({
          name: pdfFile.name,
          type: 'pdf',
          pages: pdfContent.pages,
          sizeMB: pdfContent.sizeMB,
          chunks: pdfContent.chunks?.length || 0,
          structured: pdfContent.structured || false
        });

        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (pdfContent.chunks && pdfContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(pdfFile.name, pdfContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored PDF chunks in channel memory', { fileName: pdfFile.name, chunks: pdfContent.chunks.length, structured: pdfContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[PDF Document: ${pdfFile.name} - ${pdfContent.pages} pages]\n${pdfContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }
      }
    }

    // Process DOCX files
    for (const docxFile of docxFiles) {
      const docxContent = await extractDocxText(docxFile.id, docxFile.name, docxFile.size || 0, ctx);
      if (docxContent && docxContent.text) {
        extractedDocs.push({
          name: docxFile.name,
          type: 'docx',
          pages: docxContent.pages,
          sizeMB: docxContent.sizeMB,
          chunks: docxContent.chunks?.length || 0,
          structured: docxContent.structured || false
        });

        const channelState = state.channels.get(post.channel_id);
        if (channelState) {
          if (docxContent.chunks && docxContent.chunks.length > 0) {
            const memoryEntries = pdfUtils.formatChunksForMemory(docxFile.name, docxContent.chunks);
            channelState.messages.push(...memoryEntries);
            log('info', 'Stored DOCX chunks in channel memory', { fileName: docxFile.name, chunks: docxContent.chunks.length, structured: docxContent.structured });
          } else {
            channelState.messages.push({
              role: 'system',
              content: `[DOCX Document: ${docxFile.name} - ~${docxContent.pages} pages]\n${docxContent.text.substring(0, 50000)}`,
              timestamp: Date.now()
            });
          }
        }
      }
    }

    // Process spreadsheet files (XLS, XLSX, CSV)
    const spreadsheetFiles = files.filter(f => spreadsheetUtils.isSpreadsheet(f.name));
    for (const xlsFile of spreadsheetFiles) {
      try {
        const buffer = await downloadFile(xlsFile.id, ctx);
        if (buffer) {
          const result = spreadsheetUtils.processSpreadsheetAttachment(buffer, xlsFile.name, {
            maxRowsPerSheet: 100,
            format: 'markdown',
            includeFormulas: true,
            includeAdvanced: true
          });

          if (result.success) {
            extractedDocs.push({
              name: xlsFile.name,
              type: result.type.replace('.', ''),
              pages: result.sheetCount,
              sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
              chunks: 1,
              structured: true
            });

            const channelState = state.channels.get(post.channel_id);
            if (channelState) {
              channelState.messages.push({
                role: 'system',
                content: `[Spreadsheet: ${xlsFile.name} - ${result.sheetCount} sheets, ${result.rowCount} rows, ${result.formulaCount} formulas]\n${result.context.substring(0, 50000)}`,
                timestamp: Date.now()
              });
              log('info', 'Stored spreadsheet in channel memory', {
                fileName: xlsFile.name,
                sheets: result.sheetCount,
                rows: result.rowCount,
                formulas: result.formulaCount
              });
            }

            // Index into vector store (non-blocking)
            const xlsContent = {
              text: result.context,
              chunks: [{
                text: result.context,
                pageNum: 1,
                heading: `Spreadsheet: ${xlsFile.name}`
              }]
            };
            pdfUtils.indexDocument(xlsContent, xlsFile.name, post.channel_id, log)
              .then(indexResult => {
                if (indexResult.indexed > 0) {
                  log('info', 'Spreadsheet indexed for semantic search', { fileName: xlsFile.name });
                }
              })
              .catch(err => log('warn', 'Spreadsheet vector indexing failed', { fileName: xlsFile.name, error: err.message }));
          } else {
            log('warn', 'Spreadsheet parsing failed', { fileName: xlsFile.name, error: result.error });
          }
        }
      } catch (error) {
        log('error', 'Failed to process spreadsheet', { fileName: xlsFile.name, error: error.message });
      }
    }

    // Generate summary message
    const fileReplyTo = post.root_id || post.id;
    if (extractedDocs.length > 0) {
      const summaryMsg = pdfUtils.generateDocSummaryMessage(extractedDocs, 'spark');
      await postMessage(post.channel_id, summaryMsg, fileReplyTo);
    } else if (fileTypes.includes('document')) {
      await postMessage(post.channel_id,
        `\ud83d\udcc4 Document shared! Need to:\n\u2022 Start a discussion thread?\n\u2022 Get team consensus on it?\n\u2022 Schedule a review session?`,
        fileReplyTo
      );
    }

    if (fileTypes.includes('video')) {
      await postMessage(post.channel_id,
        `\ud83c\udfac Video uploaded! Want me to:\n\u2022 \`!discuss\` the content with the team?\n\u2022 \`!poll\` to get reactions?\n\u2022 \`!remindme\` to watch it later?`,
        fileReplyTo
      );
    }

  } catch (error) {
    log('error', 'Failed to handle file upload', { error: error.message });
  }
}

export { addReaction };
