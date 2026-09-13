const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Ultimate Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const CONTROL_TOKEN = process.env.TOKEN_1 || 'YOUR_MAIN_CONTROL_BOT_TOKEN'; 
let controlBot = new TelegramBot(CONTROL_TOKEN, { polling: true });
let userSpamBots = {};

const MAIN_ADMINS = ['7501991033', '8824915409']; 
let allowedUsers = [...MAIN_ADMINS];
let pendingRequests = {};
let userState = {};
let waSock = null;
let spamDelay = 100;

// Dynamic Heavy Gaali & Custom Spam List (Live /addspam command se add hogi)
let dynamicGaaliList = [
  "Teri maa ki chut madarchod 🔥",
  "Teri behan ke bhosde me bam blast 💥",
  "Nalla bhikari saala aukat me reh ⚡",
  "System faad denge be madarchod 😈",
  "Gaaand mara le bhosdike 🌪️",
  "Bikau aulaad tera baap hu main 👑"
];

// Multi-Emoji Name Change Pool
const emojiList = ["🔥", "⚡", "🌪️", "💥", "👑", "🚀", "💀", "⚠️"];

let pData = {};

// Inline Buttons for Access Approval
controlBot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id.toString();
  if (!MAIN_ADMINS.includes(chatId)) return;
  if (q.data.startsWith('approve_')) {
    const uid = q.data.replace('approve_', '');
    if (!allowedUsers.includes(uid)) allowedUsers.push(uid);
    controlBot.editMessageText(`✅ **Approved:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
    controlBot.sendMessage(uid, `🎉 **Tumhe access mil gaya hai! Ab /start bhejo.**`, { parse_mode: 'Markdown' });
  } else if (q.data.startsWith('deny_')) {
    const uid = q.data.replace('deny_', '');
    controlBot.editMessageText(`❌ **Denied:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
    controlBot.sendMessage(uid, `❌ **Tumhara access reject kar diya gaya hai.**`, { parse_mode: 'Markdown' });
  }
});

controlBot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text ? msg.text.trim() : '';
  const lowerText = text.toLowerCase();
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  if (!pData[chatId]) {
    pData[chatId] = {
      whatsapp: { target: '', active: false, ncActive: false, timer: null, ncTimer: null },
      telegram: { target: '', active: false, ncActive: false, timer: null, ncTimer: null },
      instagram: { username: '', password: '', target: '', active: false, ncActive: false, timer: null, ncTimer: null },
      token: null
    };
  }
  let uData = pData[chatId];

  // Owner Approval
  if (lowerText.startsWith('/approve')) {
    if (!MAIN_ADMINS.includes(chatId)) return;
    const targetId = text.replace('/approve', '').trim();
    if (targetId && !allowedUsers.includes(targetId)) {
      allowedUsers.push(targetId);
      controlBot.sendMessage(chatId, `✅ **User \`${targetId}\` ko access de diya gaya hai!**`, { parse_mode: 'Markdown' });
      controlBot.sendMessage(targetId, `🎉 **Owner ne access approve kar diya! /start bhejo.**`, { parse_mode: 'Markdown' });
    }
    return;
  }

  // Check Access
  if (!allowedUsers.includes(chatId)) {
    if (!pendingRequests[chatId]) {
      pendingRequests[chatId] = true;
      const kb = { reply_markup: { inline_keyboard: [[ { text: '✅ Accept', callback_data: `approve_${chatId}` }, { text: '❌ Deny', callback_data: `deny_${chatId}` } ]] } };
      MAIN_ADMINS.forEach(a => controlBot.sendMessage(a, `🔔 **Nayi Request Aayi Hai!**\nName: ${username}\nChat ID: \`${chatId}\`\n\nAccess dene ke liye click karo:`, { parse_mode: 'Markdown', ...kb }).catch(() => {}));
    }
    controlBot.sendMessage(chatId, `⏳ **Tumhara access pending hai. Owner ke approval ka wait karo!**`, { parse_mode: 'Markdown' });
    return;
  }

  // Input State Management
  if (userState[chatId]) {
    const state = userState[chatId];
    delete userState[chatId];
    if (state === 'WA_NUM') {
      controlBot.sendMessage(chatId, `⏳ **WhatsApp pairing code generate ho raha hai...**`, { parse_mode: 'Markdown' });
      try {
        if (!waSock) await startWA();
        setTimeout(async () => {
          try {
            const cleanNum = text.replace(/[^0-9]/g, '');
            const code = await waSock.requestPairingCode(cleanNum);
            const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
            controlBot.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${fmt}\`\nJaldi se WhatsApp me "Link with phone number" me daal de!`, { parse_mode: 'Markdown' });
          } catch (err) {
            controlBot.sendMessage(chatId, `❌ **Error:** ${err.message}`, { parse_mode: 'Markdown' });
          }
        }, 3000);
      } catch (e) {
        controlBot.sendMessage(chatId, `❌ **Error:** ${e.message}`, { parse_mode: 'Markdown' });
      }
      return;
    }
    if (state === 'INSTA_USER') {
      uData.instagram.username = text;
      userState[chatId] = 'INSTA_PASS';
      controlBot.sendMessage(chatId, `📸 **Ab apna Instagram Password bhejo:**`, { parse_mode: 'Markdown' });
      return;
    }
    if (state === 'INSTA_PASS') {
      uData.instagram.password = text;
      controlBot.sendMessage(chatId, `✅ **Instagram Credentials Saved!**\nUser: \`${uData.instagram.username}\`\nAb \`!spam <hater name>\` ya \`!nc <hater name>\` use kar sakte ho.`, { parse_mode: 'Markdown' });
      return;
    }
  }

  // --- COMMAND GUIDE (/start) ---
  if (lowerText === '/start' || lowerText === '/help') {
    const guide = `🤖 **RUPESH ULTIMATE BOT PANEL** 🤖

🔑 **SETUP COMMANDS:**
• \`settok <token>\` ➔ Telegram Spam Bot ka Token set karein.
• \`setup wa\` ➔ WhatsApp pairing code mangwaye.
• \`setup insta\` ➔ Instagram login credentials set karein.

📱 **WHATSAPP / TELEGRAM / INSTA COMMANDS:**
• \`!spam <hater name>\` ➔ Target par heavy gaali + emojis ke sath spam shuru kare.
• \`!nc <hater name>\` ➔ Group name / title fast speed me multi-emoji ke sath change kare.
• \`!stop\` ➔ Chal raha spam ya name change turant roke.

⚡ **CUSTOM SPAM ADD:**
• \`/addspam <gaali text>\` ➔ Nayi gaali database me add kare.`;
    controlBot.sendMessage(chatId, guide, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'settok') {
    controlBot.sendMessage(chatId, `❌ Sahi format use karo: \`settok YOUR_BOT_TOKEN\``, { parse_mode: 'Markdown' });
  }
  else if (lowerText.startsWith('settok ')) {
    const token = text.replace(/settok/i, '').trim();
    uData.token = token;
    userSpamBots[chatId] = new TelegramBot(token, { polling: false });
    controlBot.sendMessage(chatId, `✅ **Telegram Spam Bot Token successfully save ho gaya hai!**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup wa') {
    userState[chatId] = 'WA_NUM';
    controlBot.sendMessage(chatId, `📱 **Apna WhatsApp number country code ke sath bhej (Jaise: \`919876543210\`):**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText === 'setup insta') {
    userState[chatId] = 'INSTA_USER';
    controlBot.sendMessage(chatId, `📸 **Apna Instagram Username bhej:**`, { parse_mode: 'Markdown' });
  }

  else if (lowerText.startsWith('/addspam')) {
    const newGaali = text.replace(/\/addspam/i, '').trim();
    if (newGaali) {
      dynamicGaaliList.push(newGaali);
      controlBot.sendMessage(chatId, `✅ **Nayi gaali successfully add ho gayi hai!**`, { parse_mode: 'Markdown' });
    }
  }

  // --- SPAM HANDLER (!spam <hater name>) ---
  else if (lowerText.startsWith('!spam')) {
    const hater = text.replace(/!spam/i, '').trim() || "TARGET";
    
    // Determine platform based on where message came from or active config
    // (Yahan WhatsApp ya Telegram ke hisab se execute hoga)
    controlBot.sendMessage(chatId, `🚀 **Spam Started for Hater:** \`${hater}\`\nRokne ke liye \`!stop\` bhejo.`, { parse_mode: 'Markdown' });
    
    uData.telegram.active = true;
    let c = 1;
    const spamLoop = async () => {
      if (!uData.telegram.active) return;
      try {
        const randomGaali = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
        const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
        const finalMsg = `[ ${hater} ] ➔ ${randomGaali} ${randomEmoji} [${c++}]`;
        
        // Agar Telegram bot token set hai toh teli pe chalega
        if (uData.token && userSpamBots[chatId] && uData.telegram.target) {
          await userSpamBots[chatId].sendMessage(uData.telegram.target, finalMsg).catch(() => {});
        }
      } catch (e) {}
      if (uData.telegram.active) uData.telegram.timer = setTimeout(spamLoop, spamDelay);
    };
    spamLoop();
  }

  // --- NAME CHANGE HANDLER (!nc <hater name>) ---
  else if (lowerText.startsWith('!nc')) {
    const hater = text.replace(/!nc/i, '').trim() || "TARGET";
    controlBot.sendMessage(chatId, `🔥 **Name Change Started for:** \`${hater}\`\nRokne ke liye \`!stop\` bhejo.`, { parse_mode: 'Markdown' });
    
    uData.telegram.ncActive = true;
    const ncLoop = async () => {
      if (!uData.telegram.ncActive) return;
      try {
        const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
        const randomGaaliShort = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)].slice(0, 15);
        const dynamicTitle = `${randomEmoji} ${hater} | ${randomGaaliShort} ${randomEmoji}`;
        
        if (uData.token && userSpamBots[chatId] && uData.telegram.target) {
          await userSpamBots[chatId].setChatTitle(uData.telegram.target, dynamicTitle).catch(() => {});
        }
      } catch (e) {}
      if (uData.telegram.ncActive) uData.telegram.ncTimer = setTimeout(ncLoop, 1500);
    };
    ncLoop();
  }

  // --- STOP HANDLER (!stop) ---
  else if (lowerText === '!stop') {
    uData.telegram.active = false;
    uData.telegram.ncActive = false;
    uData.whatsapp.active = false;
    uData.whatsapp.ncActive = false;
    uData.instagram.active = false;
    uData.instagram.ncActive = false;

    if (uData.telegram.timer) clearTimeout(uData.telegram.timer);
    if (uData.telegram.ncTimer) clearTimeout(uData.telegram.ncTimer);
    if (uData.whatsapp.timer) clearTimeout(uData.whatsapp.timer);
    if (uData.whatsapp.ncTimer) clearTimeout(uData.whatsapp.ncTimer);

    controlBot.sendMessage(chatId, `🛑 **Sabhi tasks (Spam & Name Change) rok diye gaye hain!**`, { parse_mode: 'Markdown' });
  }
});

async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  waSock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: false });
  waSock.ev.on('creds.update', saveCreds);
  waSock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(() => startWA(), 3000);
    }
  });
}

startWA();
