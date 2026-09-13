const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const { IgApiClient } = require('instagram-private-api');
const pino = require('pino');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Ultimate Multi-Platform Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const CONTROL_TOKEN = process.env.TOKEN_1 || process.env.TELEGRAM_BOT_TOKEN || 'YOUR_MAIN_CONTROL_BOT_TOKEN'; 
const SECOND_BOT_TOKEN = process.env.TOKEN_2 || process.env.BOT_TOKEN_2 || null;

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

// Massive Heavy Gaali List
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
  "Chutiya saala aukat bhul gaya kya ⚠️",
  "Teri maa ka bhosda faad denge 🔪",
  "Bhadwe ki aulaad aukat me reh kar baat kar 🚫",
  "Teri behan ko sadak pe nachayenge bsdk 🔥"
];

// Massive Clipboard & Dynamic Emoji Pool
const emojiList = [
  "🔥", "⚡", "🌪️", "💥", "👑", "🚀", "💀", "⚠️", 
  "🖕", "🧨", "🔪", "🚫", "😈", "👺", "💯", "💢", 
  "🔥", "⚡", "⚡", "💥", "💥", "👑", "💀", "🌪️", "🚀", "🔥"
];

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

controlBot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text ? msg.text.trim() : '';
  const lowerText = text.toLowerCase();
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  if (!pData[chatId]) {
    pData[chatId] = {
      whatsapp: { target: '', active: false, ncActive: false },
      telegram: { target: '', active: false, ncActive: false },
      instagram: { target: '', active: false, threadId: '' },
      token: SECOND_BOT_TOKEN || null
    };
    if (SECOND_BOT_TOKEN && !userSpamBots[chatId]) {
      userSpamBots[chatId] = new TelegramBot(SECOND_BOT_TOKEN, { polling: false });
    }
  }
  let uData = pData[chatId];

  if (lowerText.startsWith('/approve')) {
    if (!MAIN_ADMINS.includes(chatId)) return;
    const targetId = text.replace('/approve', '').trim();
    if (targetId && !allowedUsers.includes(targetId)) {
      allowedUsers.push(targetId);
      controlBot.sendMessage(chatId, `✅ **User \`${targetId}\` ko access mil gaya!**`, { parse_mode: 'Markdown' });
      controlBot.sendMessage(targetId, `🎉 **Access approved! /start bhejo.**`, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (!allowedUsers.includes(chatId)) {
    if (!pendingRequests[chatId]) {
      pendingRequests[chatId] = true;
      const kb = { reply_markup: { inline_keyboard: [[ { text: '✅ Accept', callback_data: `approve_${chatId}` }, { text: '❌ Deny', callback_data: `deny_${chatId}` } ]] } };
      MAIN_ADMINS.forEach(a => controlBot.sendMessage(a, `🔔 **Nayi Request:**\nName: ${username}\nID: \`${chatId}\``, { parse_mode: 'Markdown', ...kb }).catch(() => {}));
    }
    controlBot.sendMessage(chatId, `⏳ **Access pending hai. Owner ke approval ka wait karo!**`, { parse_mode: 'Markdown' });
    return;
  }

  // --- Multi-step Login State handler ---
  if (userState[chatId]) {
    const state = userState[chatId];
    if (state === 'WA_NUM') {
      delete userState[chatId];
      controlBot.sendMessage(chatId, `⏳ **WhatsApp pairing code generate ho raha hai...**`, { parse_mode: 'Markdown' });
      try {
        if (!waSock) await startWA(chatId);
        setTimeout(async () => {
          try {
            const cleanNum = text.replace(/[^0-9]/g, '');
            const code = await waSock.requestPairingCode(cleanNum);
            const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
            controlBot.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${fmt}\`\n_(Is code ko apne WhatsApp linked devices me daalo)_`, { parse_mode: 'Markdown' });
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
      controlBot.sendMessage(chatId, `🔑 **Ab apna Instagram Password bhejo:**`, { parse_mode: 'Markdown' });
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
        controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Instagram account (\`@${igUser}\`) successfully logged in! 🎉`, { parse_mode: 'Markdown' });
      } catch (e) {
        controlBot.sendMessage(chatId, `❌ **IG Login Error:** ${e.message}`, { parse_mode: 'Markdown' });
      }
      return;
    }
  }

  if (lowerText === '/start' || lowerText === '/help') {
    const guide = `🤖 **RUPESH MULTI-PLATFORM CONTROL PANEL** 🤖

🔑 **SETUP & LOGIN:**
• \`settok <token>\` ➔ Telegram Spam Bot Token set karein
• \`setup wa\` ➔ WhatsApp Link karein (Pairing Code milega)
• \`setup ig\` ➔ Instagram Login karein (User & Pass)

🎯 **TARGET SETTING:**
• \`set target <group_id>\` ➔ Telegram & WhatsApp ke liye Group ID
• \`set igtarget <thread_id>\` ➔ Instagram ke liye Thread ID

📱 **COMMANDS & SPAM:**
• \`!spam <hater>\` ➔ Active platforms par 0-DELAY se bhi fast SPAM chalu karega
• \`!nc <hater>\` ➔ Target group ka Lightning Name Change chalu karega
• \`!stop\` ➔ Sabhi running tasks turant roke
• \`/addspam <gaali>\` ➔ Nayi gaali list me add karein`;
    controlBot.sendMessage(chatId, guide, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('settok ')) {
    const token = text.replace(/settok/i, '').trim();
    uData.token = token;
    userSpamBots[chatId] = new TelegramBot(token, { polling: false });
    controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Telegram Spam Bot Token save ho gaya!`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup wa') {
    userState[chatId] = 'WA_NUM';
    controlBot.sendMessage(chatId, `📱 **WhatsApp number bhej (Country code ke sath, Jaise: \`919876543210\`):**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup ig') {
    userState[chatId] = 'IG_USER';
    controlBot.sendMessage(chatId, `📸 **Apna Instagram Username bhej:**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('set target ')) {
    const trg = text.replace(/set target/i, '').trim();
    uData.telegram.target = trg;
    uData.whatsapp.target = trg.includes('@g.us') ? trg : trg + '@g.us';
    controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Telegram & WhatsApp Target set ho gaya: \`${trg}\``, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('set igtarget ')) {
    const trg = text.replace(/set igtarget/i, '').trim();
    uData.instagram.threadId = trg;
    controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Instagram Thread ID set ho gaya: \`${trg}\``, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('/addspam')) {
    const newGaali = text.replace(/\/addspam/i, '').trim();
    if (newGaali) {
      dynamicGaaliList.push(newGaali);
      controlBot.sendMessage(chatId, `✅ **SUCCESSFUL:** Nayi gaali list me add ho gayi! Total gaaliyan: \`${dynamicGaaliList.length}\``, { parse_mode: 'Markdown' });
    }
  }

  // --- 0-DELAY MULTI-PLATFORM SPAM WITH RUNNING STATUS ---
  else if (lowerText.startsWith('!spam')) {
    const hater = text.replace(/!spam/i, '').trim() || "TARGET";
    
    let activePlatforms = [];
    if (uData.token && uData.telegram.target) activePlatforms.push("Telegram");
    if (waSock && uData.whatsapp.target) activePlatforms.push("WhatsApp");
    if (igClients[chatId] && uData.instagram.threadId) activePlatforms.push("Instagram");

    if (activePlatforms.length === 0) {
      controlBot.sendMessage(chatId, `⚠️ **Warning:** Koi bhi target ya login set nahi hai! Pehle \`set target\` ya \`set igtarget\` karein.`);
      return;
    }

    controlBot.sendMessage(chatId, `🚀 **RUNNING STATUS: 0-DELAY SPAM STARTED!**\n🎯 Hater: \`${hater}\`\n📡 Active Platforms: **${activePlatforms.join(', ')}**`, { parse_mode: 'Markdown' });
    
    uData.telegram.active = !!(uData.token && uData.telegram.target);
    uData.whatsapp.active = !!(waSock && uData.whatsapp.target);
    uData.instagram.active = !!(igClients[chatId] && uData.instagram.threadId);
    let c = 1;

    const spamLoop = () => {
      if (!uData.telegram.active && !uData.whatsapp.active && !uData.instagram.active) return;
      
      setImmediate(async () => {
        try {
          const randomGaali = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
          const randomEmoji1 = emojiList[Math.floor(Math.random() * emojiList.length)];
          const randomEmoji2 = emojiList[Math.floor(Math.random() * emojiList.length)];
          const finalMsg = `${randomEmoji1} [ ${hater} ] ➔ ${randomGaali} ${randomEmoji2} [${c++}]`;
          
          // Telegram Spam
          if (uData.telegram.active && uData.token && userSpamBots[chatId]) {
            userSpamBots[chatId].sendMessage(uData.telegram.target, finalMsg).catch(() => {});
          }
          // WhatsApp Spam
          if (uData.whatsapp.active && waSock) {
            waSock.sendMessage(uData.whatsapp.target, { text: finalMsg }).catch(() => {});
          }
          // Instagram Spam
          if (uData.instagram.active && igClients[chatId]) {
            const thread = igClients[chatId].entity.directThread(uData.instagram.threadId);
            await thread.broadcastText(finalMsg).catch(() => {});
          }
        } catch (e) {}

        if (uData.telegram.active || uData.whatsapp.active || uData.instagram.active) {
          spamLoop();
        }
      });
    };
    
    // Multi-thread parallel execution for ultimate speed
    spamLoop();
    spamLoop();
    spamLoop();
  }

  // --- 0-DELAY NAME CHANGE WITH RUNNING STATUS ---
  else if (lowerText.startsWith('!nc')) {
    const hater = text.replace(/!nc/i, '').trim() || "TARGET";
    
    let activeNcPlatforms = [];
    if (uData.token && uData.telegram.target) activeNcPlatforms.push("Telegram");
    if (waSock && uData.whatsapp.target) activeNcPlatforms.push("WhatsApp");

    if (activeNcPlatforms.length === 0) {
      controlBot.sendMessage(chatId, `⚠️ **Warning:** Telegram ya WhatsApp target set nahi hai name change ke liye!`);
      return;
    }

    controlBot.sendMessage(chatId, `🔥 **RUNNING STATUS: NAME CHANGE STARTED!**\n🎯 Hater: \`${hater}\`\n📡 Active Platforms: **${activeNcPlatforms.join(', ')}**`, { parse_mode: 'Markdown' });
    
    uData.telegram.ncActive = !!(uData.token && uData.telegram.target);
    uData.whatsapp.ncActive = !!(waSock && uData.whatsapp.target);

    const ncLoop = () => {
      if (!uData.telegram.ncActive && !uData.whatsapp.ncActive) return;

      setImmediate(async () => {
        try {
          const randomEmoji1 = emojiList[Math.floor(Math.random() * emojiList.length)];
          const randomEmoji2 = emojiList[Math.floor(Math.random() * emojiList.length)];
          const randomGaaliShort = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)].slice(0, 20);
          const dynamicTitle = `${randomEmoji1} ${hater} ➔ ${randomGaaliShort} ${randomEmoji2}`;
          
          if (uData.telegram.ncActive && uData.token && userSpamBots[chatId]) {
            userSpamBots[chatId].setChatTitle(uData.telegram.target, dynamicTitle).catch(() => {});
          }
          if (uData.whatsapp.ncActive && waSock) {
            waSock.groupUpdateSubject(uData.whatsapp.target, dynamicTitle).catch(() => {});
          }
        } catch (e) {}

        if (uData.telegram.ncActive || uData.whatsapp.ncActive) {
          ncLoop();
        }
      });
    };
    ncLoop();
  }

  // --- STOP ---
  else if (lowerText === '!stop') {
    uData.telegram.active = false;
    uData.telegram.ncActive = false;
    uData.whatsapp.active = false;
    uData.whatsapp.ncActive = false;
    uData.instagram.active = false;

    controlBot.sendMessage(chatId, `🛑 **SUCCESSFUL:** Sabhi running spam aur name change tasks turant rok diye gaye hain!`, { parse_mode: 'Markdown' });
  }
});

async function startWA(notifyChatId) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  waSock = makeWASocket({ 
    logger: pino({ level: 'silent' }), 
    auth: state, 
    printQRInTerminal: false,
    browser: ["Chrome (Linux)", "", ""]
  });
  
  waSock.ev.on('creds.update', saveCreds);
  waSock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      if(notifyChatId) controlBot.sendMessage(notifyChatId, `✅ **SUCCESSFUL:** WhatsApp Connected Successfully! 🎉`, { parse_mode: 'Markdown' });
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startWA(notifyChatId), 3000);
      } else {
        if(notifyChatId) controlBot.sendMessage(notifyChatId, `❌ **WhatsApp Logged Out! Dobara \`setup wa\` karein.**`, { parse_mode: 'Markdown' });
      }
    }
  });
}

startWA();
