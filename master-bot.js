const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const { IgApiClient } = require('instagram-private-api');
const pino = require('pino');
const http = require('http');

// Render / Server keep-alive
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Ultimate Multi-Platform Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const CONTROL_TOKEN = process.env.TOKEN_1 || process.env.TELEGRAM_BOT_TOKEN || 'YOUR_MAIN_CONTROL_BOT_TOKEN'; 

let controlBot = new TelegramBot(CONTROL_TOKEN, { 
  polling: { interval: 300, autoStart: true, params: { timeout: 10 } } 
});

controlBot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    console.log('⚠️ Warning: Duplicate polling instance handled safely.');
  }
});

let userSpamBots = {};
let igClients = {};
let igStates = {};

const MAIN_ADMINS = ['7501991033', '8824915409']; 
let allowedUsers = [...MAIN_ADMINS];
let pendingRequests = {};
let userState = {};
let waSock = null;

// Global tracking for WhatsApp & Insta active tasks per group/chat
let waActiveTasks = {}; 
let igActiveTasks = {};

// Dynamic Gaali List (Telegram se /addspam karke yahan direct add hoga)
let dynamicGaaliList = [
  "Teri maa ki chut madarchod 🔥",
  "Teri behan ke bhosde me bam blast 💥",
  "Nalla bhikari saala aukat me reh ⚡",
  "System faad denge be madarchod 😈",
  "Gaaand mara le bhosdike 🌪️",
  "Bikau aulaad tera baap hu main 👑",
  "Madarchod ke pille aukat me aa ja 🖕",
  "Teri gaand me danda de denge bsdk 🧨",
  "Bikau maal hai teri behan 💀",
  "Chutiya saala aukat bhul gaya kya ⚠️"
];

const emojiList = ["🔥", "⚡", "🌪️", "💥", "👑", "🚀", "💀", "⚠️", "🖕", "🧨"];
let pData = {};

controlBot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id.toString();
  if (!MAIN_ADMINS.includes(chatId)) return;
  if (q.data.startsWith('approve_')) {
    const uid = q.data.replace('approve_', '');
    if (!allowedUsers.includes(uid)) allowedUsers.push(uid);
    controlBot.editMessageText(`✅ **Approved:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
    controlBot.sendMessage(uid, `🎉 **Access mil gaya hai! Ab /start bhejo.**`, { parse_mode: 'Markdown' });
  } else if (q.data.startsWith('deny_')) {
    const uid = q.data.replace('deny_', '');
    controlBot.editMessageText(`❌ **Denied:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
    controlBot.sendMessage(uid, `❌ **Access reject kar diya gaya hai.**`, { parse_mode: 'Markdown' });
  }
});

// ================= TELEGRAM CONTROL PANEL =================
controlBot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text ? msg.text.trim() : '';
  const lowerText = text.toLowerCase();
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  if (!pData[chatId]) {
    pData[chatId] = { telegram: { target: '', active: false }, token: null };
  }
  let uData = pData[chatId];

  if (!allowedUsers.includes(chatId)) {
    if (!pendingRequests[chatId]) {
      pendingRequests[chatId] = true;
      const kb = { reply_markup: { inline_keyboard: [[ { text: '✅ Accept', callback_data: `approve_${chatId}` }, { text: '❌ Deny', callback_data: `deny_${chatId}` } ]] } };
      MAIN_ADMINS.forEach(a => controlBot.sendMessage(a, `🔔 **Nayi Request:**\nName: ${username}\nID: \`${chatId}\``, { parse_mode: 'Markdown', ...kb }).catch(() => {}));
    }
    controlBot.sendMessage(chatId, `⏳ **Access pending hai. Owner ke approval ka wait karo!**`, { parse_mode: 'Markdown' });
    return;
  }

  if (userState[chatId]) {
    const state = userState[chatId];
    if (state === 'WA_NUM') {
      delete userState[chatId];
      controlBot.sendMessage(chatId, `⏳ **WhatsApp pairing code generate ho raha hai...**`, { parse_mode: 'Markdown' });
      try {
        if (!waSock) await startWA();
        setTimeout(async () => {
          try {
            const cleanNum = text.replace(/[^0-9]/g, '');
            const code = await waSock.requestPairingCode(cleanNum);
            const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
            controlBot.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${fmt}\``, { parse_mode: 'Markdown' });
          } catch (err) {
            controlBot.sendMessage(chatId, `❌ **WA Error:** ${err.message}`, { parse_mode: 'Markdown' });
          }
        }, 3000);
      } catch (e) {
        controlBot.sendMessage(chatId, `❌ **Error:** ${e.message}`, { parse_mode: 'Markdown' });
      }
      return;
    } else if (state === 'IG_USER') {
      igStates[chatId] = { username: text };
      userState[chatId] = 'IG_PASS';
      controlBot.sendMessage(chatId, `🔑 **Apna Instagram Password bhejo:**`, { parse_mode: 'Markdown' });
      return;
    } else if (state === 'IG_PASS') {
      delete userState[chatId];
      const igUser = igStates[chatId]?.username;
      const igPass = text;
      controlBot.sendMessage(chatId, `⏳ **Instagram login ho raha hai...**`, { parse_mode: 'Markdown' });
      try {
        const ig = new IgApiClient();
        ig.state.generateDevice(igUser);
        await ig.account.login(igUser, igPass);
        igClients[chatId] = ig;
        controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Instagram (\`@${igUser}\`) logged in! 🎉`, { parse_mode: 'Markdown' });
      } catch (e) {
        controlBot.sendMessage(chatId, `❌ **IG Login Error:** ${e.message}`, { parse_mode: 'Markdown' });
      }
      return;
    }
  }

  if (lowerText === '/start' || lowerText === '/help') {
    const guide = `🤖 **RUPESH BOT CONTROL PANEL** 🤖
• \`setup wa\` ➔ WhatsApp Link karein (Pairing Code)
• \`setup ig\` ➔ Instagram Login karein
• \`/addspam <gaali>\` ➔ **Script me direct nayi gaali/spam add karein**
• \`settok <token>\` ➔ Telegram Spam Bot Token set karein
• \`set target <group_id>\` ➔ Telegram Target Set karein
• \`!spam <hater>\` (Telegram par)

👉 **WhatsApp Group & Insta Group me direct \`!spam <hater>\` aur \`!nc <hater>\` chalao!**`;
    controlBot.sendMessage(chatId, guide, { parse_mode: 'Markdown' });
  }

  // Script me direct spam/gaali add karne ka command
  else if (lowerText.startsWith('/addspam')) {
    const newGaali = text.replace(/\/addspam/i, '').trim();
    if (newGaali) {
      dynamicGaaliList.push(newGaali);
      controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Nayi gaali script me add ho gayi!\n📦 Total gaaliyan abhi: \`${dynamicGaaliList.length}\``, { parse_mode: 'Markdown' });
    } else {
      controlBot.sendMessage(chatId, `⚠️ **Kripya gaali likhein:** \`/addspam teri maa ki...\``, { parse_mode: 'Markdown' });
    }
  }

  else if (lowerText.startsWith('settok ')) {
    const token = text.replace(/settok/i, '').trim();
    uData.token = token;
    userSpamBots[chatId] = new TelegramBot(token, { polling: false });
    controlBot.sendMessage(chatId, `✅ Telegram Spam Bot Token save ho gaya!`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup wa') {
    userState[chatId] = 'WA_NUM';
    controlBot.sendMessage(chatId, `📱 **WhatsApp number bhej (Jaise: \`919876543210\`):**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup ig') {
    userState[chatId] = 'IG_USER';
    controlBot.sendMessage(chatId, `📸 **Instagram Username bhej:**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('set target ')) {
    uData.telegram.target = text.replace(/set target/i, '').trim();
    controlBot.sendMessage(chatId, `✅ Telegram Target set: \`${uData.telegram.target}\``, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('!spam')) {
    const hater = text.replace(/!spam/i, '').trim() || "TARGET";
    if (!uData.token || !uData.telegram.target) {
      controlBot.sendMessage(chatId, `⚠️ Pehle Telegram token aur target set karein!`);
      return;
    }
    uData.telegram.active = true;
    controlBot.sendMessage(chatId, `🚀 Telegram Spam Started for \`${hater}\`!`);
    
    const spamLoop = () => {
      if (!uData.telegram.active) return;
      setImmediate(async () => {
        try {
          const msgText = `🔥 [ ${hater} ] ➔ ${dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)]}`;
          userSpamBots[chatId].sendMessage(uData.telegram.target, msgText).catch(() => {});
        } catch (e) {}
        if (uData.telegram.active) spamLoop();
      });
    };
    spamLoop(); spamLoop();
  }

  else if (lowerText === '!stop') {
    uData.telegram.active = false;
    waActiveTasks = {};
    igActiveTasks = {};
    controlBot.sendMessage(chatId, `🛑 Sabhi tasks rok diye gaye hain!`);
  }
});

// ================= WHATSAPP GROUP HANDLER =================
async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  waSock = makeWASocket({ 
    logger: pino({ level: 'silent' }), 
    auth: state, 
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '22.04.4'] 
  });
  
  waSock.ev.on('creds.update', saveCreds);
  waSock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log('✅ WhatsApp Connected Successfully!');
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(() => startWA(), 3000);
    }
  });

  waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    
    const remoteJid = m.key.remoteJid; 
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const lowerText = text.trim().toLowerCase();

    // WhatsApp Spam Command inside Group
    if (lowerText.startsWith('!spam')) {
      const hater = text.replace(/!spam/i, '').trim() || "TARGET";
      waActiveTasks[remoteJid] = { spam: true, hater, nc: waActiveTasks[remoteJid]?.nc || false };
      await waSock.sendMessage(remoteJid, { text: `🚀 **WhatsApp 0-Delay Spam Started for \`${hater}\`!**` });

      const waSpamLoop = () => {
        if (!waActiveTasks[remoteJid]?.spam) return;
        setImmediate(async () => {
          try {
            const finalMsg = `🔥 [ ${waActiveTasks[remoteJid].hater} ] ➔ ${dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)]} ⚡`;
            await waSock.sendMessage(remoteJid, { text: finalMsg });
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.spam) waSpamLoop();
        });
      };
      waSpamLoop(); waSpamLoop();
    } 
    
    // WhatsApp Name Change Command inside Group
    else if (lowerText.startsWith('!nc')) {
      const hater = text.replace(/!nc/i, '').trim() || "TARGET";
      waActiveTasks[remoteJid] = { nc: true, hater, spam: waActiveTasks[remoteJid]?.spam || false };
      await waSock.sendMessage(remoteJid, { text: `🔥 **WhatsApp Name Change Started for \`${hater}\`!**` });

      const waNcLoop = () => {
        if (!waActiveTasks[remoteJid]?.nc) return;
        setImmediate(async () => {
          try {
            const title = `🔥 ${waActiveTasks[remoteJid].hater} ➔ ${dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)].slice(0, 15)} ⚡`;
            await waSock.groupUpdateSubject(remoteJid, title);
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.nc) waNcLoop();
        });
      };
      waNcLoop();
    }

    // Target name update on the fly inside group!
    else if (lowerText.startsWith('!settarget')) {
      const newHater = text.replace(/!settarget/i, '').trim();
      if (newHater && waActiveTasks[remoteJid]) {
        waActiveTasks[remoteJid].hater = newHater;
        await waSock.sendMessage(remoteJid, { text: `🎯 **Target Updated Successfully to:** \`${newHater}\`` });
      }
    }

    else if (lowerText === '!stop') {
      waActiveTasks[remoteJid] = { spam: false, nc: false };
      await waSock.sendMessage(remoteJid, { text: `🛑 **WhatsApp Tasks Stopped!**` });
    }
  });
}

// ================= INSTAGRAM GROUP HANDLER =================
// (Insta ke liye background poll jo group messages check karke spam/nc karega)
setInterval(async () => {
  for (const chatId in igClients) {
    const ig = igClients[chatId];
    try {
      const inbox = ig.feed.directInbox();
      const threads = await inbox.items();
      for (const thread of threads) {
        const threadId = thread.thread_id;
        const lastMsg = thread.last_permanent_item?.text;
        if (!lastMsg) continue;
        const lower = lastMsg.trim().toLowerCase();

        if (lower.startsWith('!spam') && !igActiveTasks[threadId]?.running) {
          const hater = lastMsg.replace(/!spam/i, '').trim() || "TARGET";
          igActiveTasks[threadId] = { running: true, hater };
          
          const threadRef = ig.entity.directThread(threadId);
          await threadRef.broadcastText(`🚀 **Insta Spam Started for \`${hater}\`!**`).catch(()=>{});

          const igLoop = () => {
            if (!igActiveTasks[threadId]?.running) return;
            setImmediate(async () => {
              try {
                const msg = `🔥 [ ${igActiveTasks[threadId].hater} ] ➔ ${dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)]}`;
                await threadRef.broadcastText(msg);
              } catch (e) {}
              if (igActiveTasks[threadId]?.running) igLoop();
            });
          };
          igLoop(); igLoop();
        } 
        else if (lower.startsWith('!settarget') && igActiveTasks[threadId]) {
          const newHater = lastMsg.replace(/!settarget/i, '').trim();
          if (newHater) {
            igActiveTasks[threadId].hater = newHater;
            const threadRef = ig.entity.directThread(threadId);
            await threadRef.broadcastText(`🎯 **Insta Target Updated to:** \`${newHater}\``).catch(()=>{});
          }
        }
        else if (lower === '!stop' && igActiveTasks[threadId]) {
          igActiveTasks[threadId].running = false;
          const threadRef = ig.entity.directThread(threadId);
          await threadRef.broadcastText(`🛑 **Insta Tasks Stopped!**`).catch(()=>{});
        }
      }
    } catch (e) {}
  }
}, 5000);

startWA();
