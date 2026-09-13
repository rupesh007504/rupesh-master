const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const { IgApiClient } = require('instagram-private-api');
const pino = require('pino');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Flexible Multi-Bot System Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

const TOKEN_1 = process.env.TOKEN_1 || 'YOUR_FIRST_BOT_TOKEN';
const TOKEN_2 = process.env.TOKEN_2 || ''; 

let bot1 = null;
let bot2 = null;

if (TOKEN_1 && TOKEN_1 !== 'YOUR_FIRST_BOT_TOKEN') {
  bot1 = new TelegramBot(TOKEN_1, { polling: { interval: 300, autoStart: true, params: { timeout: 10 } } });
  bot1.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.log('⚠️ Warning: Bot 1 polling conflict handled safely.');
    }
  });
}

if (TOKEN_2 && TOKEN_2.length > 5) {
  bot2 = new TelegramBot(TOKEN_2, { polling: { interval: 300, autoStart: true, params: { timeout: 10 } } });
  bot2.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.log('⚠️ Warning: Bot 2 polling conflict handled safely.');
    }
  });
}

let igClients = {};
let igStates = {};

const MAIN_ADMINS = ['7501991033', '8824915409']; 
let allowedUsers = [...MAIN_ADMINS];
let pendingRequests = {};
let userState = {};
let waSock = null;

let waActiveTasks = {}; 
let igActiveTasks = {};

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

let botData = {};

function setupCallbacks(botInstance) {
  if (!botInstance) return;
  botInstance.on('callback_query', async (q) => {
    const chatId = q.message.chat.id.toString();
    if (!MAIN_ADMINS.includes(chatId)) return;
    if (q.data.startsWith('approve_')) {
      const uid = q.data.replace('approve_', '');
      if (!allowedUsers.includes(uid)) allowedUsers.push(uid);
      botInstance.editMessageText(`✅ **Approved:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
      botInstance.sendMessage(uid, `🎉 **Access mil gaya hai! Ab /start bhejo.**`, { parse_mode: 'Markdown' });
    } else if (q.data.startsWith('deny_')) {
      const uid = q.data.replace('deny_', '');
      botInstance.editMessageText(`❌ **Denied:** \`${uid}\``, { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown' });
      botInstance.sendMessage(uid, `❌ **Access reject kar diya gaya hai.**`, { parse_mode: 'Markdown' });
    }
  });
}

setupCallbacks(bot1);
setupCallbacks(bot2);

function handleBotCommands(botInstance) {
  if (!botInstance) return;
  botInstance.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim() : '';
    const lowerText = text.toLowerCase();
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    if (!botData[chatId]) {
      botData[chatId] = { target: '', active: false };
    }
    let uData = botData[chatId];

    if (!allowedUsers.includes(chatId)) {
      if (!pendingRequests[chatId]) {
        pendingRequests[chatId] = true;
        const kb = { reply_markup: { inline_keyboard: [[ { text: '✅ Accept', callback_data: `approve_${chatId}` }, { text: '❌ Deny', callback_data: `deny_${chatId}` } ]] } };
        MAIN_ADMINS.forEach(a => {
          if(bot1) bot1.sendMessage(a, `🔔 **Nayi Access Request:**\nName: ${username}\nID: \`${chatId}\``, { parse_mode: 'Markdown', ...kb }).catch(() => {});
        });
      }
      botInstance.sendMessage(chatId, `⏳ **Access pending hai. Owner ke approval ka wait karo!**`, { parse_mode: 'Markdown' });
      return;
    }

    if (userState[chatId]) {
      const state = userState[chatId];
      if (state === 'WA_NUM') {
        delete userState[chatId];
        botInstance.sendMessage(chatId, `⏳ **WhatsApp pairing code generate ho raha hai...**`, { parse_mode: 'Markdown' });
        try {
          if (!waSock) await startWA();
          setTimeout(async () => {
            try {
              const cleanNum = text.replace(/[^0-9]/g, '');
              const code = await waSock.requestPairingCode(cleanNum);
              const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
              botInstance.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${fmt}\``, { parse_mode: 'Markdown' });
            } catch (err) {
              botInstance.sendMessage(chatId, `❌ **WA Error:** ${err.message}`, { parse_mode: 'Markdown' });
            }
          }, 3000);
        } catch (e) {
          botInstance.sendMessage(chatId, `❌ **Error:** ${e.message}`, { parse_mode: 'Markdown' });
        }
        return;
      } else if (state === 'IG_USER') {
        igStates[chatId] = { username: text };
        userState[chatId] = 'IG_PASS';
        botInstance.sendMessage(chatId, `🔑 **Apna Instagram Password bhejo:**`, { parse_mode: 'Markdown' });
        return;
      } else if (state === 'IG_PASS') {
        delete userState[chatId];
        const igUser = igStates[chatId]?.username;
        const igPass = text;
        botInstance.sendMessage(chatId, `⏳ **Instagram login ho raha hai...**`, { parse_mode: 'Markdown' });
        try {
          const ig = new IgApiClient();
          ig.state.generateDevice(igUser);
          await ig.account.login(igUser, igPass);
          igClients[chatId] = ig;
          botInstance.sendMessage(chatId, `✅ **SUCCESSFUL:** Instagram (\`@${igUser}\`) logged in! 🎉`, { parse_mode: 'Markdown' });
        } catch (e) {
          botInstance.sendMessage(chatId, `❌ **IG Login Error:** ${e.message}`, { parse_mode: 'Markdown' });
        }
        return;
      }
    }

    if (lowerText === '/start' || lowerText === '/help') {
      const guide = `🤖 **RUPESH FLEXIBLE BOT PANEL** 🤖
• \`setup wa\` ➔ WhatsApp Link karein (Pairing Code)
• \`setup ig\` ➔ Instagram Login karein
• \`/addspam <gaali>\` ➔ Script me direct nayi gaali add karein
• \`set target <chat_id>\` ➔ Is bot ke liye Telegram Target Set karein
• \`.spam / .spm / !spam / !spm <hater>\` ➔ Telegram par spam chalu karein

👉 **WhatsApp & Insta Group me direct spam/stop commands chalayein!**`;
      botInstance.sendMessage(chatId, guide, { parse_mode: 'Markdown' });
    }

    else if (lowerText.startsWith('/addspam')) {
      const newGaali = text.replace(/\/addspam/i, '').trim();
      if (newGaali) {
        dynamicGaaliList.push(newGaali);
        botInstance.sendMessage(chatId, `✅ **SUCCESSFUL:** Nayi gaali add ho gayi! Total: \`${dynamicGaaliList.length}\``, { parse_mode: 'Markdown' });
      } else {
        botInstance.sendMessage(chatId, `⚠️ **Kripya gaali likhein:** \`/addspam teri maa ki...\``, { parse_mode: 'Markdown' });
      }
    }

    else if (lowerText === 'setup wa') {
      userState[chatId] = 'WA_NUM';
      botInstance.sendMessage(chatId, `📱 **WhatsApp number bhej (Jaise: \`919876543210\`):**`, { parse_mode: 'Markdown' });
    }

    else if (lowerText === 'setup ig') {
      userState[chatId] = 'IG_USER';
      botInstance.sendMessage(chatId, `📸 **Instagram Username bhej:**`, { parse_mode: 'Markdown' });
    }

    else if (lowerText.startsWith('set target ')) {
      uData.target = text.replace(/set target/i, '').trim();
      botInstance.sendMessage(chatId, `✅ Telegram Target set for this bot: \`${uData.target}\``, { parse_mode: 'Markdown' });
    }

    // Support for .spam, !spam, .spm, !spm
    else if (/^(!spam|\.spam|!spm|\.spm)/i.test(lowerText)) {
      const hater = text.replace(/^(!spam|\.spam|!spm|\.spm)/i, '').trim() || "TARGET";
      if (!uData.target) {
        botInstance.sendMessage(chatId, `⚠️ Pehle target chat id set karein! (\`set target <chat_id>\`)`);
        return;
      }
      uData.active = true;
      botInstance.sendMessage(chatId, `🚀 Telegram Spam Started for \`${hater}\` using this bot!`);
      
      const spamLoop = () => {
        if (!uData.active) return;
        setImmediate(async () => {
          try {
            const msgText = `🔥 [ ${hater} ] ➔ ${dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)]}`;
            botInstance.sendMessage(uData.target, msgText).catch(() => {});
          } catch (e) {}
          if (uData.active) spamLoop();
        });
      };
      spamLoop(); spamLoop();
    }

    else if (/^(!stop|\.stop)/i.test(lowerText)) {
      uData.active = false;
      waActiveTasks = {};
      igActiveTasks = {};
      botInstance.sendMessage(chatId, `🛑 Sabhi tasks rok diye gaye hain!`);
    }
  });
}

handleBotCommands(bot1);
handleBotCommands(bot2);

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
    const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    // Support for .spam, !spam, .spm, !spm on WhatsApp
    if (/^(!spam|\.spam|!spm|\.spm)/i.test(lowerText)) {
      const hater = cleanText.replace(/^(!spam|\.spam|!spm|\.spm)/i, '').trim() || waActiveTasks[remoteJid]?.hater || "TARGET";
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
    
    else if (/^(!nc|\.nc)/i.test(lowerText)) {
      const hater = cleanText.replace(/^(!nc|\.nc)/i, '').trim() || waActiveTasks[remoteJid]?.hater || "TARGET";
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

    else if (/^(!settarget|\.settarget)/i.test(lowerText)) {
      const newHater = cleanText.replace(/^(!settarget|\.settarget)/i, '').trim();
      if (newHater) {
        if (!waActiveTasks[remoteJid]) waActiveTasks[remoteJid] = {};
        waActiveTasks[remoteJid].hater = newHater;
        await waSock.sendMessage(remoteJid, { text: `🎯 **Target Updated Successfully to:** \`${newHater}\`` });
      }
    }

    else if (/^(!stop|\.stop)/i.test(lowerText)) {
      waActiveTasks[remoteJid] = { spam: false, nc: false };
      await waSock.sendMessage(remoteJid, { text: `🛑 **WhatsApp Tasks Stopped!**` });
    }
  });
}

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
        const cleanMsg = lastMsg.trim();
        const lower = cleanMsg.toLowerCase();

        // Support for .spam, !spam, .spm, !spm on Instagram
        if ((/^(!spam|\.spam|!spm|\.spm)/i.test(lower)) && !igActiveTasks[threadId]?.running) {
          const hater = cleanMsg.replace(/^(!spam|\.spam|!spm|\.spm)/i, '').trim() || "TARGET";
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
        else if ((/^(!settarget|\.settarget)/i.test(lower)) && igActiveTasks[threadId]) {
          const newHater = cleanMsg.replace(/^(!settarget|\.settarget)/i, '').trim();
          if (newHater) {
            igActiveTasks[threadId].hater = newHater;
            const threadRef = ig.entity.directThread(threadId);
            await threadRef.broadcastText(`🎯 **Insta Target Updated to:** \`${newHater}\``).catch(()=>{});
          }
        }
        else if (/^(!stop|\.stop)/i.test(lower)) {
          if (igActiveTasks[threadId]) igActiveTasks[threadId].running = false;
          const threadRef = ig.entity.directThread(threadId);
          await threadRef.broadcastText(`🛑 **Insta Tasks Stopped!**`).catch(()=>{});
        }
      }
    } catch (e) {}
  }
}, 5000);

startWA();
