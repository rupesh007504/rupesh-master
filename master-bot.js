const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const TelegramBot = require("node-telegram-bot-api");
const { IgApiClient } = require('instagram-private-api');
const pino = require("pino");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;

// Tere dono permanent admin IDs hardcoded
const ADMINS = new Set(['7501991033', '8824915409']);

const bots = [];
let waSock = null;
let igClient = null;
let userState = {};
let activeTasks = {};

// Platform speed configuration
let speedConfig = {
  WA: 'fast',
  IG: 'fast',
  TG: 'fast'
};

// Tere saare original custom spam aur gaali database
let spamList = [
  "⚡️🖤 RUPESH 𝐃𝐀𝐃𝐃𝐘 𝐈s 𝐇ᴇʀᴇ 💫🎭",
  "🌙𒈒 (alpha ke hater) 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨",
  "💥😈 (alpha ke hater) 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 H̱𝑈𝑁 ⚡️🔥",
  "🔥👑 RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥",
  "👑🔥 RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥",
  "Teri maa ki chut madarchod 🔥",
  "Teri behan ke bhosde me bam blast 💥",
  "Nalla bhikari saala aukat me reh ⚡",
  "System faad denge be madarchod 😈",
  "Gaaand mara le bhosdike 🌪️"
];

function isAdmin(msg) {
  return ADMINS.has(String(msg.from?.id));
}

// ================= 1. WHATSAPP ENGINE (PAIRING FIXED) =================
async function startWhatsApp() {
  const authFolder = 'auth_baileys';
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  
  waSock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    // Updated browser settings to fix "Couldn't link device" error
    browser: Browsers.appropriate('Chrome')
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 3000);
      } else {
        try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch(e){}
        setTimeout(() => startWhatsApp(), 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Connected Successfully!');
    }
  });

  waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    
    const jid = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    if (!activeTasks[jid]) {
      activeTasks[jid] = { spam: false, nc: false, hater: 'TARGET' };
    }

    if (lower.startsWith('!target') || lower.startsWith('.target')) {
      const parts = cleanText.split(' ');
      parts.shift();
      const targetName = parts.join(' ').trim();
      if (targetName) {
        activeTasks[jid].hater = targetName;
        await waSock.sendMessage(jid, { text: `🎯 Target Set: ${targetName}` });
      }
      return;
    }

    if (lower.startsWith('!speed') || lower.startsWith('.speed')) {
      const parts = cleanText.split(' ');
      if (parts[1]) {
        const spd = parts[1].toLowerCase();
        if (spd === 'slow' || spd === 'normal' || spd === 'fast') {
          speedConfig.WA = spd;
          await waSock.sendMessage(jid, { text: `⚡ WhatsApp Speed updated to: ${spd}` });
        }
      }
      return;
    }

    // Spam Loop with dynamic speed handling
    if (lower.startsWith('!spam') || lower.startsWith('.spam')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].spam = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🚀 RUPESH WA SPAM STARTED (${speedConfig.WA}) for ${haterName}!` });

      const runSpamLoop = () => {
        if (!activeTasks[jid]?.spam) return;
        const delay = speedConfig.WA === 'slow' ? 1500 : (speedConfig.WA === 'normal' ? 500 : 0);
        
        setTimeout(async () => {
          if (!activeTasks[jid]?.spam) return;
          try {
            const line = spamList[Math.floor(Math.random() * spamList.length)];
            await waSock.sendMessage(jid, { text: `🔥 [ ${haterName} ] ➔ ${line}` });
          } catch(e){}
          if (activeTasks[jid]?.spam) runSpamLoop();
        }, delay);
      };

      runSpamLoop();
      if (speedConfig.WA === 'fast') {
        runSpamLoop(); // Multi-thread for ultra-fast speed
      }
      return;
    }

    if (lower.startsWith('!nc') || lower.startsWith('.nc')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        activeTasks[jid].hater = parts.join(' ');
      }

      activeTasks[jid].nc = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🔥 Name Change Loop Started for ${haterName}!` });

      const runNcLoop = () => {
        if (!activeTasks[jid]?.nc) return;
        setTimeout(async () => {
          if (!activeTasks[jid]?.nc) return;
          try {
            const line = spamList[Math.floor(Math.random() * spamList.length)];
            const newTitle = `🔥 ${haterName} ➔ ${line.slice(0, 12)} ⚡`;
            await waSock.groupUpdateSubject(jid, newTitle);
          } catch(e){}
          if (activeTasks[jid]?.nc) runNcLoop();
        }, 3000);
      };
      runNcLoop();
      return;
    }

    if (lower === '!stop' || lower === '.stop') {
      activeTasks[jid].spam = false;
      activeTasks[jid].nc = false;
      await waSock.sendMessage(jid, { text: `🛑 All Tasks Stopped in this Chat!` });
      return;
    }
  });
}

startWhatsApp();

// ================= 2. INSTAGRAM ENGINE =================
async function startInstagram() {
  try {
    igClient = new IgApiClient();
    igClient.state.generateDevice(process.env.IG_USERNAME || 'rupesh_bot');
    if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
      await igClient.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
      console.log('✅ Instagram Logged In Successfully!');
    }
  } catch (err) {
    console.log('ℹ️ Instagram standalone mode active.');
  }
}
startInstagram();

// ================= 3. TELEGRAM MULTI-BOT & COMMAND STRUCTURE =================
function createBot(token, name) {
  if (!token) return;

  const bot = new TelegramBot(token, { polling: true });
  bots.push(bot);

  bot.onText(/^\/start$/, msg => {
    if (!isAdmin(msg)) return;

    bot.sendMessage(msg.chat.id, `
🤖 RUPESH MULTI-PLATFORM PANEL (${name})

📱 WHATSAPP
/wa_login - Get WhatsApp Pairing Code
/wa_status - Check WA Connection
/wa_speed <slow|normal|fast> - Set WA Speed
/wa_commands - View WA guide

📸 INSTAGRAM
/ig_connect - IG Connect Info
/ig_status - Check IG Status
/ig_speed <slow|normal|fast> - Set IG Speed
/ig_commands - View IG guide

✈️ TELEGRAM
/tg_status - Telegram Bot Status
/tg_speed <slow|normal|fast> - Set TG Speed
/tg_commands - View TG guide

⚙️ GENERAL
/status - System Health
/addadmin <id> - Add Admin
/removeadmin <id> - Remove Admin
/admins - List Admins
/addspam <text> - Add new spam line
/spamlist - Total lines count

📋 COMMAND HELP
/commands
`);
  });

  bot.onText(/^\/commands$/, msg => {
    if (!isAdmin(msg)) return;

    bot.sendMessage(msg.chat.id, `
📱 MAIN COMMANDS LIST
• \`/wa_commands\` - WhatsApp specific commands
• \`/ig_commands\` - Instagram specific commands
• \`/tg_commands\` - Telegram specific commands
• \`/status\` - System check
• \`/admins\` - View admins list
• \`/spamlist\` - View loaded spam database
`);
  });

  bot.onText(/^\/wa_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📱 WHATSAPP COMMANDS (Use inside GC):
• \`!spam <target>\` - Start Spam Flood
• \`!nc <target>\` - Fast Name Change Loop
• \`!target <name>\` - Set Target Name
• \`!speed <slow|normal|fast>\` - Set Speed
• \`!stop\` - Stop active tasks
`);
  });

  bot.onText(/^\/ig_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📸 INSTAGRAM COMMANDS:
• \`/ig_connect\` - Connect info
• \`/ig_status\` - Check login status
• \`/ig_speed <slow|normal|fast>\` - Set IG Speed
`);
  });

  bot.onText(/^\/tg_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
✈️ TELEGRAM COMMANDS (Use inside GC):
• \`!spam <target>\` - Telegram High-Speed Spam
• \`!stop\` - Stop Telegram tasks
• \`/tg_speed <slow|normal|fast>\` - Set TG Speed
`);
  });

  bot.onText(/^\/status$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `✅ Control bot ${name} online\n🕐 ${new Date().toISOString()}\n🚀 Speeds -> WA: ${speedConfig.WA} | TG: ${speedConfig.TG} | IG: ${speedConfig.IG}`);
  });

  bot.onText(/^\/admins$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `👑 Admins:\n${[...ADMINS].map(x => `• ${x}`).join("\n")}`);
  });

  bot.onText(/^\/addadmin\s+(\d+)$/, msg => {
    if (!isAdmin(msg)) return;
    const newAdmin = msg.match[1];
    ADMINS.add(newAdmin);
    bot.sendMessage(msg.chat.id, `✅ Admin added: ${newAdmin}`);
  });

  bot.onText(/^\/removeadmin\s+(\d+)$/, msg => {
    if (!isAdmin(msg)) return;
    const remAdmin = msg.match[1];
    ADMINS.delete(remAdmin);
    bot.sendMessage(msg.chat.id, `✅ Admin removed: ${remAdmin}`);
  });

  bot.onText(/^\/wa_login$/, msg => {
    if (!isAdmin(msg)) return;
    const chatId = msg.chat.id.toString();
    userState[chatId] = 'WAITING_WA_NUM';
    bot.sendMessage(chatId, `📱 Apna WhatsApp number bhej (Jaise: \`919876543210\`):`, { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/wa_status$/, msg => {
    if (!isAdmin(msg)) return;
    const status = waSock ? "🟢 Connected / Ready" : "🔴 Disconnected";
    bot.sendMessage(msg.chat.id, `📱 WhatsApp Status: ${status}`);
  });

  bot.onText(/^\/(wa|tg|ig)_speed(?:\s+(slow|normal|fast))?$/i, msg => {
    if (!isAdmin(msg)) return;
    const platform = msg.match[1].toUpperCase();
    const speed = msg.match[2];
    
    if (!speed) {
      bot.sendMessage(msg.chat.id, `⚡ Current ${platform} Speed is: **${speedConfig[platform]}**\nTo change use: \`/${platform.toLowerCase()}_speed <slow|normal|fast>\``, { parse_mode: 'Markdown' });
      return;
    }

    speedConfig[platform] = speed.toLowerCase();
    bot.sendMessage(msg.chat.id, `⚡ ${platform} Speed successfully changed to: ${speed.toLowerCase()}`);
  });

  bot.onText(/^\/ig_connect$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, "📸 Instagram credentials are set via environment variables (IG_USERNAME & IG_PASSWORD).");
  });

  bot.onText(/^\/ig_status$/, msg => {
    if (!isAdmin(msg)) return;
    const status = igClient ? "🟢 Connected" : "🔴 Not Configured";
    bot.sendMessage(msg.chat.id, `📸 Instagram Status: ${status}`);
  });

  bot.onText(/^\/tg_status$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `✈️ Telegram Bot ${name} is Active & Running!`);
  });

  bot.onText(/^\/spamlist$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `📋 Total Spam Lines Loaded: ${spamList.length}`);
  });

  bot.on('message', async msg => {
    if (!isAdmin(msg)) return;
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim() : '';
    const lower = text.toLowerCase();

    if (userState[chatId] === 'WAITING_WA_NUM') {
      delete userState[chatId];
      bot.sendMessage(chatId, `⏳ Generating WhatsApp Pairing Code...`);
      try {
        setTimeout(async () => {
          try {
            const cleanNum = text.replace(/[^0-9]/g, '');
            const code = await waSock.requestPairingCode(cleanNum);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            bot.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${formattedCode}\``, { parse_mode: 'Markdown' });
          } catch (e) {
            bot.sendMessage(chatId, `❌ Code Error: ${e.message}`);
          }
        }, 3000);
      } catch (e) {
        bot.sendMessage(botAdmin = chatId, `❌ Error: ${e.message}`);
      }
      return;
    }

    if (lower.startsWith('/addspam')) {
      const newLine = text.replace(/\/addspam/i, '').trim();
      if (newLine) {
        spamList.push(newLine);
        bot.sendMessage(msg.chat.id, `✅ New Spam Line Added! Total: ${spamList.length}`);
      }
      return;
    }

    if (!activeTasks[chatId]) {
      activeTasks[chatId] = { spam: false, hater: 'TARGET' };
    }

    if (lower.startsWith('!spam')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        parts.shift();
        activeTasks[chatId].hater = parts.join(' ');
      }
      activeTasks[chatId].spam = true;
      const hater = activeTasks[chatId].hater;
      bot.sendMessage(chatId, `🚀 Telegram Spam Started (${speedConfig.TG}) for ${hater}!`);

      const runTgSpam = () => {
        if (!activeTasks[chatId]?.spam) return;
        const delay = speedConfig.TG === 'slow' ? 1500 : (speedConfig.TG === 'normal' ? 500 : 50);

        setTimeout(() => {
          if (!activeTasks[chatId]?.spam) return;
          try {
            const line = spamList[Math.floor(Math.random() * spamList.length)];
            bot.sendMessage(chatId, `🔥 [ ${hater} ] ➔ ${line}`);
          } catch(e){}
          if (activeTasks[chatId]?.spam) runTgSpam();
        }, delay);
      };
      runTgSpam();
      return;
    }

    if (lower === '!stop') {
      activeTasks[chatId].spam = false;
      bot.sendMessage(chatId, `🛑 Telegram Tasks Stopped!`);
    }
  });

  console.log(`✅ Telegram Bot ${name} started successfully`);
}

createBot(TOKEN_1, "TOKEN_1");
createBot(TOKEN_2, "TOKEN_2");

http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("Rupesh Control Bot Online 24/7");
}).listen(PORT);

console.log(`🌐 Server running on port ${PORT}`);
