const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const { IgApiClient } = require('instagram-private-api');
const pino = require('pino');
const http = require('http');
const fs = require('fs');

// 24/7 Cloud Uptime Server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Ultimate God of Spam Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

// ================= CONFIG & TOKENS =================
const TOKEN_1 = process.env.TOKEN_1 || '';
const TOKEN_2 = process.env.TOKEN_2 || ''; 

let bot1 = null;
let bot2 = null;

if (TOKEN_1 && TOKEN_1.length > 5) {
  bot1 = new TelegramBot(TOKEN_1, { polling: { interval: 200, autoStart: true } });
  bot1.on('polling_error', () => {});
}
if (TOKEN_2 && TOKEN_2.length > 5) {
  bot2 = new TelegramBot(TOKEN_2, { polling: { interval: 200, autoStart: true } });
  bot2.on('polling_error', () => {});
}

const MAIN_ADMINS = ['7501991033', '8824915409'];
let allowedUsers = [...MAIN_ADMINS];
let pendingRequests = {};
let userState = {};
let waSock = null;

let waActiveTasks = {}; 
let botData = {};

// ================= TERE SARE DIALOGUES & SPAM LINES ADDED =================
let dynamicGaaliList = [
  "⚡️🖤 RUPESH 𝐃𝐀𝐃𝐃𝐘 𝐈s 𝐇ᴇʀᴇ 💫🎭",
  "🌙𒈒 (alpha ke hater) 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨",
  "💥😈 (alpha ke hater) 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥",
  "🔥👑 RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥",
  "👑🔥 RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥",
  "Teri maa ki chut madarchod 🔥",
  "Teri behan ke bhosde me bam blast 💥",
  "Nalla bhikari saala aukat me reh ⚡",
  "System faad denge be madarchod 😈",
  "Gaaand mara le bhosdike 🌪️",
  "Bikau aulaad tera baap hu main 👑",
  "Madarchod ke pille aukat me aa ja 🖕",
  "Teri gaand me danda de denge bsdk 🧨"
];

// ================= TELEGRAM HANDLER =================
function setupTelegram(botInstance) {
  if (!botInstance) return;
  
  botInstance.on('callback_query', async (q) => {
    const chatId = q.message.chat.id.toString();
    if (!MAIN_ADMINS.includes(chatId)) return;
    if (q.data.startsWith('approve_')) {
      const uid = q.data.replace('approve_', '');
      if (!allowedUsers.includes(uid)) allowedUsers.push(uid);
      botInstance.editMessageText(`✅ Approved: \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
      botInstance.sendMessage(uid, `🎉 Access mil gaya hai! Ab /start bhejo.`, { parse_mode: 'Markdown' });
    }
  });

  botInstance.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim() : '';
    const lowerText = text.toLowerCase();

    if (!botData[chatId]) botData[chatId] = { target: '', hater: 'TARGET', active: false };

    if (!allowedUsers.includes(chatId)) {
      if (!pendingRequests[chatId]) {
        pendingRequests[chatId] = true;
        MAIN_ADMINS.forEach(a => {
          bot1?.sendMessage(a, `🔔 Nayi Access Request: \`${chatId}\``).catch(()=>{});
        });
      }
      botInstance.sendMessage(chatId, `⏳ Access pending hai!`);
      return;
    }

    if (userState[chatId] === 'WA_NUM') {
      delete userState[chatId];
      botInstance.sendMessage(chatId, `⏳ WhatsApp pairing code generate ho raha hai...`);
      try {
        if (!waSock) await startWhatsApp();
        setTimeout(async () => {
          try {
            const cleanNum = text.replace(/[^0-9]/g, '');
            const code = await waSock.requestPairingCode(cleanNum);
            const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
            botInstance.sendMessage(chatId, `✅ WhatsApp Pairing Code: \`${fmt}\``, { parse_mode: 'Markdown' });
          } catch (err) {
            botInstance.sendMessage(chatId, `❌ WA Error: ${err.message}`);
          }
        }, 3000);
      } catch (e) {
        botInstance.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
      return;
    }

    if (lowerText === '/start') {
      botInstance.sendMessage(chatId, `👑 **RUPESH SARKAR BOT PANEL** 👑\n• \`setup wa\` ➔ WhatsApp Link karein\n• \`/addspam <text>\` ➔ Nayi line add karein`, { parse_mode: 'Markdown' });
    } else if (lowerText === 'setup wa') {
      userState[chatId] = 'WA_NUM';
      botInstance.sendMessage(chatId, `📱 Apna WhatsApp number bhej (Jaise: \`919876543210\`):`, { parse_mode: 'Markdown' });
    } else if (lowerText.startsWith('/addspam')) {
      const g = text.replace(/\/addspam/i, '').trim();
      if (g) {
        dynamicGaaliList.push(g);
        botInstance.sendMessage(chatId, `✅ New Spam Line Added! Total: ${dynamicGaaliList.length}`);
      }
    }
  });
}

setupTelegram(bot1);
setupTelegram(bot2);

// ================= WHATSAPP HIGH-SPEED GC HANDLER =================
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  
  waSock = makeWASocket({ 
    logger: pino({ level: 'silent' }), 
    auth: state, 
    printQRInTerminal: false,
    browser: ['Chrome', 'Windows', '10.0'] 
  });
  
  waSock.ev.on('creds.update', saveCreds);
  
  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log('✅ WhatsApp Connected & Ready for High-Speed Spam!');
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 3000);
      } else {
        console.log('❌ Logged out. Resetting auth session...');
        try { fs.rmSync('auth_baileys', { recursive: true, force: true }); } catch(e){}
        setTimeout(() => startWhatsApp(), 3000);
      }
    }
  });

  waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    
    const remoteJid = m.key.remoteJid; 
    const text = m.message.conversation || 
                 m.message.extendedTextMessage?.text || 
                 m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || '';
                 
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();
    if (!cleanText) return;

    if (!waActiveTasks[remoteJid]) {
      waActiveTasks[remoteJid] = { spam: false, nc: false, hater: 'TARGET' };
    }

    // 1. Target Command
    if (/^(!target|\.target)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      parts.shift();
      const newHater = parts.join(' ').trim();
      if (newHater) {
        waActiveTasks[remoteJid].hater = newHater;
        await waSock.sendMessage(remoteJid, { text: `🎯 Target Set Successfully: ${newHater}` });
      }
      return;
    }

    // 2. High-Speed Flood Spam Command
    if (/^(!spam|\.spam|!spm|\.spm)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const inlineHater = parts.join(' ').trim();
        if (inlineHater) waActiveTasks[remoteJid].hater = inlineHater;
      }
      
      waActiveTasks[remoteJid].spam = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🚀 RUPESH SARKAR SPAM STARTED for ${currentHater}!` });

      // Ultra-Fast Flood Loop
      const floodSpam = () => {
        if (!waActiveTasks[remoteJid]?.spam) return;
        setImmediate(async () => {
          try {
            const randomLine = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
            await waSock.sendMessage(remoteJid, { text: `🔥 [ ${currentHater} ] ➔ ${randomLine}` });
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.spam) floodSpam();
        });
      };
      // Multi-threading threads for ultra fast speed
      floodSpam();
      floodSpam();
      floodSpam();
      return;
    }

    // 3. Name Change Flood Command
    if (/^(!nc|\.nc)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        waActiveTasks[remoteJid].hater = parts.join(' ');
      }
      
      waActiveTasks[remoteJid].nc = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🔥 GC Name Change Started for \`${currentHater}\`!` });

      const ncLoop = () => {
        if (!waActiveTasks[remoteJid]?.nc) return;
        setImmediate(async () => {
          try {
            const randomLine = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
            const title = `🔥 ${waActiveTasks[remoteJid].hater} ➔ ${randomLine.slice(0, 15)} ⚡`;
            await waSock.groupUpdateSubject(remoteJid, title);
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.nc) ncLoop();
        });
      };
      ncLoop();
      return;
    }

    // 4. Stop Command
    if (lowerText === '!stop' || lowerText === '.stop') {
      waActiveTasks[remoteJid].spam = false;
      waActiveTasks[remoteJid].nc = false;
      await waSock.sendMessage(remoteJid, { text: `🛑 All Tasks Stopped Successfully!` });
      return;
    }
  });
}

startWhatsApp();
