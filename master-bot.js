const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const TelegramBot = require("node-telegram-bot-api");
const { IgApiClient } = require('instagram-private-api');
const pino = require("pino");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;

// Rupesh Permanent Admins
const ADMINS = new Set(['7501991033', '8824915409']);

const bots = [];
let waSock = null;
let igClient = null;
let userState = {};
let activeTasks = {};

// Ultra Fast Speed Lock
let speedConfig = {
  WA: 'fast',
  IG: 'fast',
  TG: 'fast'
};

// Cleaned Spam Database (Daddy & God blocks removed, Custom target blocks active)
let spamList = [
  `🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥 ➔ {target} teri maa ki chut me chappal aur jute bajenge 🩴 ➔ {target} aukaat me reh warna ujaad denge ⚡️ ➔ {target} system ka baap rupesh hoon madarchod 🔥`,
  `💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎 ➔ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎 ➔ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎 ➔ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎 ➔ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎`,
  `🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨`,
  `💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥`
];

function isAdmin(msg) {
  return ADMINS.has(String(msg.from?.id));
}

// ================= 1. WHATSAPP ENGINE (UNLIMITED & INSTANT) =================
async function startWhatsApp() {
  const authFolder = 'auth_baileys';
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  
  waSock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
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

    // Set Target command (!target <name>)
    if (lower.startsWith('!target') || lower.startsWith('.target')) {
      const parts = cleanText.split(' ');
      parts.shift();
      const targetName = parts.join(' ').trim();
      if (targetName) {
        activeTasks[jid].hater = targetName;
        await waSock.sendMessage(jid, { text: `🎯 Target Set Successfully for this Group: ${targetName}` });
      }
      return;
    }

    if (lower.startsWith('!speed') || lower.startsWith('.speed')) {
      await waSock.sendMessage(jid, { text: `⚡ Speed is locked to ULTRA FAST (0ms delay)!` });
      return;
    }

    // Non-stop Instant Spam Loop (!spam <target> or direct !spam)
    if (lower.startsWith('!spam') || lower.startsWith('.spam')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].spam = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🚀 RUPESH UNSTOPPABLE SPAM STARTED for Target: ${haterName}!` });

      const runSpamLoop = () => {
        if (!activeTasks[jid]?.spam) return;
        setImmediate(async () => {
          if (!activeTasks[jid]?.spam) return;
          try {
            const rawBlock = spamList[Math.floor(Math.random() * spamList.length)];
            const formattedBlock = rawBlock.replace(/{target}/g, haterName).replace(/\(alpha ke hater\)/g, haterName);
            await waSock.sendMessage(jid, { text: formattedBlock });
          } catch(e){}
          if (activeTasks[jid]?.spam) runSpamLoop();
        });
      };

      // Multi-threading for maximum saturation speed
      runSpamLoop();
      runSpamLoop();
      runSpamLoop();
      runSpamLoop();
      return;
    }

    // High Speed Group Name Change Loop (!nc <target>)
    if (lower.startsWith('!nc') || lower.startsWith('.nc')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].nc = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🔥 Instant Group Name Change Loop Started for: ${haterName}!` });

      const runNcLoop = () => {
        if (!activeTasks[jid]?.nc) return;
        setTimeout(async () => {
          if (!activeTasks[jid]?.nc) return;
          try {
            const rawBlock = spamList[Math.floor(Math.random() * spamList.length)];
            const snippet = rawBlock.replace(/{target}/g, haterName).replace(/\(alpha ke hater\)/g, haterName).slice(0, 20);
            const newTitle = `🔥 ${haterName} ➔ ${snippet} 🩴⚡ Rupesh`;
            await waSock.groupUpdateSubject(jid, newTitle);
          } catch(e){}
          if (activeTasks[jid]?.nc) runNcLoop();
        }, 500); // Super fast 0.5s rotation
      };
      runNcLoop();
      return;
    }

    if (lower === '!stop' || lower === '.stop') {
      activeTasks[jid].spam = false;
      activeTasks[jid].nc = false;
      await waSock.sendMessage(jid, { text: `🛑 All Tasks Successfully Stopped in this Group!` });
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
/wa_speed - Speed Info
/wa_commands - View WA guide

📸 INSTAGRAM
/ig_connect - IG Connect Info
/ig_status - Check IG Status
/ig_speed - IG Speed Info
/ig_commands - View IG guide

✈️ TELEGRAM
/tg_status - Telegram Bot Status
/tg_speed - TG Speed Info
/tg_commands - View TG guide

⚙️ GENERAL
/status - System Health
/addadmin <id> - Add Admin
/removeadmin <id> - Remove Admin
/admins - List Admins
/addspam <text> - Add new spam line globally
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
• \`/addspam <text>\` - Add custom spam line instantly
`);
  });

  bot.onText(/^\/wa_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📱 WHATSAPP COMMANDS (Use inside GC):
• \`!target <name>\` - Set target name for group
• \`!spam <target>\` - Start Ultra-Fast Spam Flood
• \`!nc <target>\` - Ultra-Fast Group Name Change Loop
• \`!stop\` - Stop active tasks
`);
  });

  bot.onText(/^\/ig_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📸 INSTAGRAM COMMANDS:
• \`/ig_connect\` - Connect info
• \`/ig_status\` - Check login status
`);
  });

  bot.onText(/^\/tg_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
✈️ TELEGRAM COMMANDS (Use inside GC/DM):
• \`!spam <target>\` - Telegram High-Speed Spam
• \`!stop\` - Stop Telegram tasks
`);
  });

  bot.onText(/^\/status$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `✅ Rupesh Bot ${name} online\n🕐 ${new Date().toISOString()}\n🚀 Loaded Spam Blocks: ${spamList.length}\n⚡ Speed: ULTRA FAST (0ms)`);
  });

  bot.onText(/^\/admins$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `👑 Rupesh Admins:\n${[...ADMINS].map(x => `• ${x}`).join("\n")}`);
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

  bot.onText(/^\/spamlist$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `📋 Total Spam Blocks Loaded: ${spamList.length}`);
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
        }, 2000);
      } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
      return;
    }

    // Add custom spam directly from bot chat copy-paste
    if (lower.startsWith('/addspam')) {
      const newLine = text.replace(/\/addspam/i, '').trim();
      if (newLine) {
        spamList.push(newLine);
        bot.sendMessage(msg.chat.id, `✅ New Spam Block Added Successfully! Total Blocks: ${spamList.length}`);
      } else {
        bot.sendMessage(msg.chat.id, `❌ Usage: /addspam <tera text ya gali>`);
      }
      return;
    }

    if (!activeTasks[chatId]) {
      activeTasks[chatId] = { spam: false, hater: 'TARGET' };
    }

    // Telegram instant spam handler
    if (lower.startsWith('!spam')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        parts.shift();
        activeTasks[chatId].hater = parts.join(' ');
      }
      activeTasks[chatId].spam = true;
      const hater = activeTasks[chatId].hater;
      bot.sendMessage(chatId, `🚀 Rupesh Telegram Unstoppable Spam Started for ${hater}!`);

      const runTgSpam = () => {
        if (!activeTasks[chatId]?.spam) return;
        setImmediate(() => {
          if (!activeTasks[chatId]?.spam) return;
          try {
            const rawBlock = spamList[Math.floor(Math.random() * spamList.length)];
            const formattedBlock = rawBlock.replace(/{target}/g, hater).replace(/\(alpha ke hater\)/g, hater);
            bot.sendMessage(chatId, formattedBlock);
          } catch(e){}
          if (activeTasks[chatId]?.spam) runTgSpam();
        });
      };
      runTgSpam();
      runTgSpam();
      return;
    }

    if (lower === '!stop') {
      activeTasks[chatId].spam = false;
      bot.sendMessage(chatId, `🛑 Telegram Tasks Stopped Successfully!`);
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
