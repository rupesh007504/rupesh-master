const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Multi-Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const TOKEN_1 = process.env.TOKEN_1 || 'YOUR_TOKEN_1';
const TOKEN_2 = process.env.TOKEN_2 || process.env.TOKEN_1;

// Dono bots active rahenge aur dono me polling on rahegi
const bots = [
  new TelegramBot(TOKEN_1, { polling: true }),
  new TelegramBot(TOKEN_2, { polling: true })
];

const MAIN_ADMINS = ['7501991033', '8824915409'];
let allowedUsers = [...MAIN_ADMINS];
let pendingRequests = {};
let userState = {};
let waSock = null;
let targetName = 'TARGET';
let spamDelay = 150;

let pData = {
  whatsapp: { targets: [], active: false, timer: null, linked: false },
  telegram: { targets: [], active: false, timer: null },
  instagram: { targets: [], active: false, timer: null }
};

const templates = [
  (t) => `[ ${t} ] ➔ Teri maa ki chudai madarchod 🔥`,
  (t) => `[ ${t} ] ➔ Teri behan ke bhosde me bam blast 💥`,
  (t) => `[ ${t} ] ➔ Nalla bhikari saala ${t} 🚀`
];

// Dono bots me same commands aur buttons set karne ke liye loop
bots.forEach(bot => {
  bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id.toString();
    if (!MAIN_ADMINS.includes(chatId)) return;
    if (q.data.startsWith('approve_')) {
      const uid = q.data.replace('approve_', '');
      if (!allowedUsers.includes(uid)) allowedUsers.push(uid);
      bot.editMessageText(`✅ Approved: \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
      bot.sendMessage(uid, `🎉 Access mil gaya! /start bhejo.`);
    } else if (q.data.startsWith('deny_')) {
      const uid = q.data.replace('deny_', '');
      bot.editMessageText(`❌ Denied: \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
      bot.sendMessage(uid, `❌ Access reject kar diya gaya.`);
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim() : '';
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    if (!allowedUsers.includes(chatId)) {
      if (!pendingRequests[chatId]) {
        pendingRequests[chatId] = true;
        const kb = { reply_markup: { inline_keyboard: [[ { text: '✅ Accept', callback_data: `approve_${chatId}` }, { text: '❌ Deny', callback_data: `deny_${chatId}` } ]] } };
        MAIN_ADMINS.forEach(a => bot.sendMessage(a, `🔔 Request from: ${username} (\`${chatId}\`)`, { parse_mode: 'Markdown', ...kb }).catch(() => {}));
      }
      bot.sendMessage(chatId, `⏳ Access pending hai. Admin approval ka wait karo.`);
      return;
    }

    if (userState[chatId]) {
      const state = userState[chatId];
      if (state === 'WA_NUM') {
        delete userState[chatId];
        bot.sendMessage(chatId, `⏳ Generating pairing code...`);
        try {
          if (!waSock) await startWA();
          setTimeout(async () => {
            if (!waSock.authState.creds.registered) {
              const code = await waSock.requestPairingCode(text.replace('+', ''));
              const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
              bot.sendMessage(chatId, `✅ *Pairing Code:* \`${fmt}\``, { parse_mode: 'Markdown' });
            } else {
              pData.whatsapp.linked = true;
              bot.sendMessage(chatId, `ℹ️ WA already linked!`);
            }
          }, 3000);
        } catch (e) {
          bot.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
        return;
      }
      if (state === 'WA_TRG') {
        pData.whatsapp.targets = text.split(',').map(t => t.trim().includes('@g.us') ? t.trim() : t.trim() + '@s.whatsapp.net');
        delete userState[chatId];
        bot.sendMessage(chatId, `✅ WA Targets locked!`);
        return;
      }
      if (state === 'TG_TRG') {
        pData.telegram.targets = text.split(',').map(t => t.trim());
        delete userState[chatId];
        bot.sendMessage(chatId, `✅ Telegram Targets locked!`);
        return;
      }
      if (state === 'INSTA_TRG') {
        pData.instagram.targets = text.split(',').map(t => t.trim());
        delete userState[chatId];
        bot.sendMessage(chatId, `✅ Insta Targets locked!`);
        return;
      }
      if (state === 'TRG_NAME') {
        targetName = text.toUpperCase();
        delete userState[chatId];
        bot.sendMessage(chatId, `🎯 Target Name: *${targetName}*`, { parse_mode: 'Markdown' });
        return;
      }
    }

    if (text === '/start') {
      const kb = {
        reply_markup: {
          keyboard: [
            [{ text: '📱 Setup WA' }, { text: '🚀 Start WA Spam' }],
            [{ text: '✈️ Setup TG Targets' }, { text: '🚀 Start TG Spam' }],
            [{ text: '📸 Setup Insta Targets' }, { text: '🚀 Start Insta Spam' }],
            [{ text: '✏️ Set Target Name' }, { text: '🛑 Stop All' }],
            [{ text: '/status' }, { text: '/help' }]
          ],
          resize_keyboard: true
        },
        parse_mode: 'Markdown'
      };
      bot.sendMessage(chatId, `🤖 *RUPESH MULTI-BOT*\n🎯 Target: *${targetName}* | Speed: *${spamDelay}ms*`, kb);
    }
    else if (text === '/help') {
      bot.sendMessage(chatId, `📖 Commands:\n/setspeed <ms>\n/settarget <name>\n/status\n/stop`);
    }
    else if (text === '📱 Setup WA') {
      userState[chatId] = 'WA_NUM';
      bot.sendMessage(chatId, `📱 WhatsApp number bhejo (e.g., \`919876543210\`):`, { parse_mode: 'Markdown' });
    }
    else if (text === '✈️ Setup TG Targets') {
      userState[chatId] = 'TG_TRG';
      bot.sendMessage(chatId, `✈️ Telegram Group IDs comma separated bhejo:`);
    }
    else if (text === '📸 Setup Insta Targets') {
      userState[chatId] = 'INSTA_TRG';
      bot.sendMessage(chatId, `📸 Insta usernames/targets comma separated bhejo:`);
    }
    else if (text === '🚀 Start WA Spam') {
      if (pData.whatsapp.targets.length === 0) { userState[chatId] = 'WA_TRG'; bot.sendMessage(chatId, `❌ WA Targets set karo pehle:`); return; }
      if (!pData.whatsapp.linked) { bot.sendMessage(chatId, `❌ Pehle Setup WA karo!`); return; }
      if (pData.whatsapp.active) { bot.sendMessage(chatId, `ℹ️ WA Spam already active hai!`); return; }
      
      pData.whatsapp.active = true;
      bot.sendMessage(chatId, `🚀 WA Spam Started!`);
      let c = 1;
      const loop = async () => {
        if (!pData.whatsapp.active) return;
        try {
          const m = templates[Math.floor(Math.random() * templates.length)](targetName);
          for (let t of pData.whatsapp.targets) {
            await waSock.sendMessage(t, { text: `${m}\n\n📌 [WA:${c++}]` }).catch(() => {});
            if (t.endsWith('@g.us')) await waSock.groupUpdateSubject(t, `TARGET: ${targetName} [${c}]`).catch(() => {});
          }
        } catch (e) {}
        if (pData.whatsapp.active) pData.whatsapp.timer = setTimeout(loop, spamDelay);
      };
      loop();
    }
    else if (text === '🚀 Start TG Spam') {
      if (pData.telegram.targets.length === 0) { userState[chatId] = 'TG_TRG'; bot.sendMessage(chatId, `❌ TG Targets set karo pehle:`); return; }
      if (pData.telegram.active) { bot.sendMessage(chatId, `ℹ️ TG Spam already active hai!`); return; }

      pData.telegram.active = true;
      bot.sendMessage(chatId, `🚀 Telegram Spam Started (Dono Bots se Attack)!`);
      let c = 1;
      const loop = async () => {
        if (!pData.telegram.active) return;
        try {
          const m = templates[Math.floor(Math.random() * templates.length)](targetName);
          for (let t of pData.telegram.targets) {
            // Dono bots se spam messages jayenge double speed ke liye
            bots.forEach(async b => {
              await b.sendMessage(t, `${m}\n\n📌 [TG:${c++}]`).catch(() => {});
              await b.setChatTitle(t, `TARGET: ${targetName} [${c}]`).catch(() => {});
            });
          }
        } catch (e) {}
        if (pData.telegram.active) pData.telegram.timer = setTimeout(loop, spamDelay);
      };
      loop();
    }
    else if (text === '🚀 Start Insta Spam') {
      if (pData.instagram.targets.length === 0) { userState[chatId] = 'INSTA_TRG'; bot.sendMessage(chatId, `❌ Insta Targets set karo pehle:`); return; }
      if (pData.instagram.active) { bot.sendMessage(chatId, `ℹ️ Insta Spam already active hai!`); return; }

      pData.instagram.active = true;
      bot.sendMessage(chatId, `🚀 Instagram Spam Loop Started!`);
      let c = 1;
      const loop = async () => {
        if (!pData.instagram.active) return;
        try {
          const m = templates[Math.floor(Math.random() * templates.length)](targetName);
          for (let t of pData.instagram.targets) {
            console.log(`[INSTA SPAM to ${t}]: ${m} [${c++}]`);
          }
        } catch (e) {}
        if (pData.instagram.active) pData.instagram.timer = setTimeout(loop, spamDelay);
      };
      loop();
    }
    else if (text === '✏️ Set Target Name') {
      userState[chatId] = 'TRG_NAME';
      bot.sendMessage(chatId, `✏️ Naya Target Name bhejo:`);
    }
    else if (text === '🛑 Stop All' || text === '/stop') {
      pData.whatsapp.active = false; if (pData.whatsapp.timer) clearTimeout(pData.whatsapp.timer);
      pData.telegram.active = false; if (pData.telegram.timer) clearTimeout(pData.telegram.timer);
      pData.instagram.active = false; if (pData.instagram.timer) clearTimeout(pData.instagram.timer);
      bot.sendMessage(chatId, `🛑 Sabhi platforms ke spam rok diye gaye hain!`);
    }
    else if (text.startsWith('/setspeed')) {
      const s = parseInt(text.replace('/setspeed', '').trim());
      if (!isNaN(s) && s >= 20) { spamDelay = s; bot.sendMessage(chatId, `⚡ Speed updated to ${spamDelay}ms`); }
    }
    else if (text.startsWith('/settarget')) {
      const n = text.replace('/settarget', '').trim();
      if (n) { targetName = n.toUpperCase(); bot.sendMessage(chatId, `🎯 Target updated to ${targetName}`); }
    }
    else if (text === '/status') {
      bot.sendMessage(chatId, `📊 Status:\n- WA: ${pData.whatsapp.active}\n- TG: ${pData.telegram.active}\n- Insta: ${pData.instagram.active}\n- Target: ${targetName}\n- Speed: ${spamDelay}ms`);
    }
  });
});

async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  waSock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state });
  waSock.ev.on('creds.update', saveCreds);
  waSock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') pData.whatsapp.linked = true;
    else if (update.connection === 'close') {
      pData.whatsapp.linked = false;
      setTimeout(() => startWA(), 5000);
    }
  });
}

startWA();
