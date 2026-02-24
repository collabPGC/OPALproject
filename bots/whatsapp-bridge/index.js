import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pinoLogger = pino({ level: 'silent' });

// QR code state for web display
let currentQR = null;
let isConnected = false;
const QR_PORT = 3388;

// Get server IP for QR URL
function getServerIP() {
  // Return the configured URL hostname
  try {
    const url = new URL(config.mattermost.url);
    return url.hostname;
  } catch {
    return 'localhost';
  }
}
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// State
const state = {
  waSocket: null,
  mmSocket: null,
  mmBotUserId: null,
  selectedGroupId: config.whatsapp.groupId,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000
};

// Logging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
}

// ============ MATTERMOST CONNECTION ============

async function connectMattermost() {
  const wsUrl = `${config.mattermost.wsUrl}/api/v4/websocket`;

  log('info', 'Connecting to Mattermost WebSocket', { url: wsUrl });

  state.mmSocket = new WebSocket(wsUrl);

  state.mmSocket.on('open', () => {
    log('info', 'Mattermost WebSocket connected');
    // Authenticate
    state.mmSocket.send(JSON.stringify({
      seq: 1,
      action: 'authentication_challenge',
      data: { token: config.mattermost.botToken }
    }));
  });

  state.mmSocket.on('message', async (data) => {
    try {
      const event = JSON.parse(data.toString());
      await handleMattermostEventWithCommands(event);
    } catch (err) {
      log('error', 'Failed to parse Mattermost event', { error: err.message });
    }
  });

  state.mmSocket.on('close', () => {
    log('warn', 'Mattermost WebSocket closed, reconnecting...');
    setTimeout(connectMattermost, state.reconnectDelay);
  });

  state.mmSocket.on('error', (err) => {
    log('error', 'Mattermost WebSocket error', { error: err.message });
  });

  // Get bot user ID
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/users/me`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    const user = await response.json();
    state.mmBotUserId = user.id;
    log('info', 'Bot user ID retrieved', { userId: user.id, username: user.username });
  } catch (err) {
    log('error', 'Failed to get bot user ID', { error: err.message });
  }
}

async function handleMattermostEvent(event) {
  if (event.event !== 'posted') return;

  const post = JSON.parse(event.data.post);

  // Ignore own messages
  if (post.user_id === state.mmBotUserId) return;

  // Only process messages from our bridged channel
  if (post.channel_id !== config.mattermost.channelId) return;

  // Don't bridge if no WhatsApp group selected
  if (!state.selectedGroupId) {
    log('debug', 'No WhatsApp group selected, ignoring MM message');
    return;
  }

  // Get sender name
  let senderName = 'Unknown';
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/users/${post.user_id}`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    const user = await response.json();
    senderName = user.first_name || user.username || 'Unknown';
  } catch (err) {
    log('error', 'Failed to get sender name', { error: err.message });
  }

  // Format and send to WhatsApp
  const waMessage = `${config.bridge.mmToWaPrefix} ${senderName}: ${post.message}`;
  await sendToWhatsApp(waMessage);
}

async function sendToMattermost(message) {
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.mattermost.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel_id: config.mattermost.channelId,
        message: message
      })
    });

    if (!response.ok) {
      const err = await response.text();
      log('error', 'Failed to post to Mattermost', { error: err });
    }
  } catch (err) {
    log('error', 'Error posting to Mattermost', { error: err.message });
  }
}

// ============ WHATSAPP CONNECTION ============

async function connectWhatsApp() {
  const authDir = path.join(__dirname, config.whatsapp.sessionDir);

  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log('info', 'Connecting to WhatsApp', { version });

  state.waSocket = makeWASocket({
    version,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, pinoLogger)
    },
    printQRInTerminal: false,
    logger: pinoLogger,
    generateHighQualityLinkPreview: false
  });

  // Handle connection updates
  state.waSocket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      isConnected = false;
      log('info', 'QR Code received - scan with WhatsApp');
      console.log('\n========================================');
      console.log('  SCAN THIS QR CODE WITH WHATSAPP');
      console.log(`  Or visit: http://localhost:${QR_PORT}`);
      console.log('========================================\n');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('\n========================================\n');

      // Post QR URL to Mattermost channel
      await sendToMattermost(`🔗 **WhatsApp Bridge Setup**\n\nQR Code is ready for scanning.\n\n**Scan URL:** https://${getServerIP()}/whatsapp-qr\n\nOr check server logs: \`sudo journalctl -u whatsapp-bridge -f\``);
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      log('warn', 'WhatsApp connection closed', { reason });

      if (reason === DisconnectReason.loggedOut) {
        log('error', 'WhatsApp logged out, clearing session');
        fs.rmSync(authDir, { recursive: true, force: true });
        process.exit(1);
      } else {
        // Reconnect
        setTimeout(connectWhatsApp, state.reconnectDelay);
      }
    } else if (connection === 'open') {
      currentQR = null;
      isConnected = true;
      log('info', 'WhatsApp connected successfully');
      await sendToMattermost('✅ **WhatsApp Bridge Connected**\n\nWhatsApp is now linked.');

      // List groups if no group selected
      if (!state.selectedGroupId) {
        await listGroups();
      }
    }
  });

  // Save credentials when updated
  state.waSocket.ev.on('creds.update', saveCreds);

  // Handle incoming WhatsApp messages
  state.waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      await handleWhatsAppMessage(msg);
    }
  });
}

async function handleWhatsAppMessage(msg) {
  // Ignore if no group selected or message not from selected group
  if (!state.selectedGroupId) return;
  if (!msg.key.remoteJid?.endsWith('@g.us')) return;
  if (msg.key.remoteJid !== state.selectedGroupId) return;

  // Ignore own messages
  if (msg.key.fromMe && config.bridge.ignoreOwnMessages) return;

  // Get message content
  const content = msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption ||
                  msg.message?.videoMessage?.caption ||
                  null;

  if (!content) return; // Skip non-text messages for now

  // Get sender name
  let senderName = 'Unknown';
  try {
    const senderId = msg.key.participant || msg.key.remoteJid;
    // Try to get contact name
    const contact = await state.waSocket.onWhatsApp(senderId.replace('@s.whatsapp.net', ''));
    if (msg.pushName) {
      senderName = msg.pushName;
    }
  } catch (err) {
    log('debug', 'Could not get sender name', { error: err.message });
  }

  // Format and send to Mattermost
  const mmMessage = `**${senderName}**: ${content}`;
  await sendToMattermost(mmMessage);

  log('info', 'Bridged WA→MM', { from: senderName, preview: content.slice(0, 50) });
}

async function sendToWhatsApp(message) {
  if (!state.waSocket || !state.selectedGroupId) {
    log('warn', 'Cannot send to WhatsApp - not connected or no group selected');
    return;
  }

  try {
    await state.waSocket.sendMessage(state.selectedGroupId, { text: message });
    log('info', 'Bridged MM→WA', { preview: message.slice(0, 50) });
  } catch (err) {
    log('error', 'Failed to send WhatsApp message', { error: err.message });
  }
}

async function listGroups() {
  log('info', 'Fetching WhatsApp groups...');

  try {
    const groups = await state.waSocket.groupFetchAllParticipating();
    const groupList = Object.values(groups);

    if (groupList.length === 0) {
      await sendToMattermost('⚠️ No WhatsApp groups found. Make sure the linked account is in at least one group.');
      return;
    }

    let message = '📋 **Available WhatsApp Groups**\n\nReply with `!wa select <number>` to choose a group:\n\n';

    groupList.forEach((group, index) => {
      const participantCount = group.participants?.length || 0;
      message += `**${index + 1}.** ${group.subject} (${participantCount} members)\n`;
    });

    // Store groups for selection
    state.availableGroups = groupList;

    await sendToMattermost(message);
    log('info', 'Listed groups', { count: groupList.length });
  } catch (err) {
    log('error', 'Failed to fetch groups', { error: err.message });
    await sendToMattermost('❌ Failed to fetch WhatsApp groups. Try reconnecting.');
  }
}

// Handle commands from Mattermost
async function handleCommand(post) {
  const text = post.message.trim();

  if (text.startsWith('!wa select ')) {
    const num = parseInt(text.replace('!wa select ', ''));
    if (state.availableGroups && num >= 1 && num <= state.availableGroups.length) {
      const group = state.availableGroups[num - 1];
      state.selectedGroupId = group.id;

      // Save to config
      config.whatsapp.groupId = group.id;
      fs.writeFileSync(
        path.join(__dirname, 'config.json'),
        JSON.stringify(config, null, 2)
      );

      await sendToMattermost(`✅ **Group Selected**: ${group.subject}\n\nMessages will now sync between this channel and the WhatsApp group.`);
      log('info', 'Group selected', { groupId: group.id, subject: group.subject });
    } else {
      await sendToMattermost('❌ Invalid group number. Use `!wa list` to see available groups.');
    }
  } else if (text === '!wa list') {
    await listGroups();
  } else if (text === '!wa status') {
    const waStatus = state.waSocket?.user ? 'Connected' : 'Disconnected';
    const groupName = state.availableGroups?.find(g => g.id === state.selectedGroupId)?.subject || 'None';
    await sendToMattermost(`📊 **WhatsApp Bridge Status**\n\n- WhatsApp: ${waStatus}\n- Linked Group: ${groupName}`);
  } else if (text === '!wa disconnect') {
    await sendToMattermost('🔌 Disconnecting WhatsApp...');
    state.waSocket?.logout();
  }
}

// Override Mattermost handler to include commands
const originalHandler = handleMattermostEvent;
async function handleMattermostEventWithCommands(event) {
  if (event.event !== 'posted') return;

  const post = JSON.parse(event.data.post);

  // Ignore own messages
  if (post.user_id === state.mmBotUserId) return;

  // Only process messages from our bridged channel
  if (post.channel_id !== config.mattermost.channelId) return;

  // Check for commands
  if (post.message.startsWith('!wa ')) {
    await handleCommand(post);
    return;
  }

  // Don't bridge if no WhatsApp group selected
  if (!state.selectedGroupId) {
    return;
  }

  // Get sender name
  let senderName = 'Unknown';
  try {
    const response = await fetch(`${config.mattermost.url}/api/v4/users/${post.user_id}`, {
      headers: { 'Authorization': `Bearer ${config.mattermost.botToken}` }
    });
    const user = await response.json();
    senderName = user.first_name || user.username || 'Unknown';
  } catch (err) {
    log('error', 'Failed to get sender name', { error: err.message });
  }

  // Format and send to WhatsApp
  const waMessage = `${config.bridge.mmToWaPrefix} ${senderName}: ${post.message}`;
  await sendToWhatsApp(waMessage);
}

// ============ QR WEB SERVER ============

function startQRServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/qr') {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      if (isConnected) {
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Bridge</title>
            <meta http-equiv="refresh" content="5">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                     display: flex; justify-content: center; align-items: center; min-height: 100vh;
                     margin: 0; background: #f0f2f5; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .status { font-size: 48px; margin-bottom: 20px; }
              h1 { color: #25D366; margin: 0; }
              p { color: #667781; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="status">✅</div>
              <h1>WhatsApp Connected</h1>
              <p>The bridge is active and syncing messages.</p>
            </div>
          </body>
          </html>
        `);
      } else if (currentQR) {
        const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 400, margin: 2 });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Bridge - Scan QR</title>
            <meta http-equiv="refresh" content="10">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                     display: flex; justify-content: center; align-items: center; min-height: 100vh;
                     margin: 0; background: #f0f2f5; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #25D366; margin: 0 0 10px 0; }
              p { color: #667781; margin: 0 0 20px 0; }
              img { border-radius: 8px; }
              .instructions { font-size: 14px; color: #8696a0; margin-top: 20px; max-width: 300px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>WhatsApp Bridge</h1>
              <p>Scan with WhatsApp to link</p>
              <img src="${qrDataUrl}" alt="QR Code" />
              <p class="instructions">Open WhatsApp → Settings → Linked Devices → Link a Device</p>
            </div>
          </body>
          </html>
        `);
      } else {
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp Bridge</title>
            <meta http-equiv="refresh" content="3">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                     display: flex; justify-content: center; align-items: center; min-height: 100vh;
                     margin: 0; background: #f0f2f5; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .spinner { font-size: 48px; animation: spin 1s linear infinite; display: inline-block; }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              h1 { color: #25D366; margin: 20px 0 0 0; }
              p { color: #667781; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="spinner">⏳</div>
              <h1>Connecting...</h1>
              <p>Waiting for QR code. Page will refresh automatically.</p>
            </div>
          </body>
          </html>
        `);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(QR_PORT, '0.0.0.0', () => {
    log('info', 'QR Server started', { port: QR_PORT });
  });
}

// ============ MAIN ============

async function main() {
  log('info', 'WhatsApp Bridge starting...');

  // Start QR web server
  startQRServer();

  // Connect to both platforms
  await connectMattermost();
  await connectWhatsApp();
}

main().catch(err => {
  log('error', 'Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
