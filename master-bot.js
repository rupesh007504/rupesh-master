const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const qrcode = require('qrcode');

// Yahan apna Telegram Bot Token daal dena
const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let waSock = null;
let currentSpamInterval = null;
let targetNumber = '';
let targetName = 'TARGET'; // Default name agar set na ho
let adminChatId = null;

// Dynamic templates jisme tera dala hua target name apne aap fit ho jayega
const getSpamTemplates = (name) => [
  `💥😈 ${name} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥\n`.repeat(15).trim(),
  `💎✨ ${name} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎\n`.repeat(15).trim(),
  `⚡️🖤 ${name} 𝐃𝐀𝐃𝐃𝐘 𝐈s 𝐇ᴇʀᴇ 💫🎭\n`.repeat(15).trim(),
  `🔥👑 ${name} 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥\n`.repeat(15).trim()
];

console.log('Rupesh Master Bot (Dynamic Target Spam) is starting...');

// Telegram Start Command & Menu
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  adminChatId = chatId;

  if (text === '/start') {
    const menu = `🤖 *Rupesh Master Bot (Dynamic Target)* 🤖\n\n` +
                 `Commands:\n` +
                 `1. /settarget <number> - Target WhatsApp number set karein\n` +
                 `2. /setname <hater_name> - Target ka naam set karein (Jaise: /setname AMIT)\n` +
                 `3. /spam - Dynamic Heavy Block Spam shuru karein\n` +
                 `4. /stop - Spam rokne ke liye\n` +
                 `5. /status - Check status`;
    bot.sendMessage(chatId, menu, { parse_mode: 'Markdown' });
  } 
  else if (text.startsWith('/settarget')) {
    const args = text.split(' ');
    if (args[1]) {
      targetNumber = args[1] + '@s.whatsapp.net';
      bot.sendMessage(chatId, `✅ Target number set ho gaya: ${args[1]}`);
    } else {
      bot.sendMessage(chatId, `❌ Sahi number likh bhai! Example: /settarget 919876543210`);
    }
  }
  else if (text.startsWith('/setname')) {
    const nameInput = text.replace('/setname', '').trim();
    if (nameInput) {
      targetName = nameInput.toUpperCase();
      bot.sendMessage(chatId, `🎯 Target Name Successfully Updated to: *${targetName}*`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Kiska naam daalna hai wo toh likh! Example: /setname AMIT`);
    }
  }
  else if (text === '/spam') {
    if (!targetNumber) {
      bot.sendMessage(chatId, `❌ Pehle /settarget karke number set kar bhai!`);
      return;
    }
    
    bot.sendMessage(chatId, `🚀 Dynamic Heavy Spam Shuru on Target: *${targetName}*!`);
    if (currentSpamInterval) clearInterval(currentSpamInterval);

    let counter = 0;
    // Super fast interval (0.4 seconds)
    currentSpamInterval = setInterval(async () => {
      if (waSock && targetNumber) {
        try {
          // Dynamic templates se current target name ke sath message generate karna
          const spamList = getSpamTemplates(targetName);
          const selectedBlock = spamList[Math.floor(Math.random() * spamList.length)];
          const finalMessage = `${selectedBlock}\n[Spam Count: ${counter++}]`;

          await waSock.sendMessage(targetNumber, { text: finalMessage });

          // Har 10 message ke baad profile name bhi auto-change karega
          if (counter % 10 === 0) {
            const dynamicNames = ["Rupesh Don 👑", "Rupesh Hacker ⚡", "Rupesh King 🔥", "Rupesh Master 🚀"];
            const nextName = dynamicNames[Math.floor(Math.random() * dynamicNames.length)];
            await waSock.updateProfileName(nextName);
          }
        } catch (err) {
          console.log('Spam error:', err);
        }
      }
    }, 400);
  }
  else if (text === '/stop') {
    if (currentSpamInterval) {
      clearInterval(currentSpamInterval);
      currentSpamInterval = null;
      bot.sendMessage(chatId, `🛑 Spam rok diya gaya hai!`);
    } else {
      bot.sendMessage(chatId, `ℹ️ Koi spam chal nahi raha hai.`);
    }
  }
  else if (text === '/status') {
    const statusMsg = waSock?.user ? `🟢 Connected as: ${waSock.user.id}\n🎯 Current Target Name: ${targetName}` : `🔴 Disconnected / QR Scan Pending`;
    bot.sendMessage(chatId, statusMsg);
  }
});

// WhatsApp Connection Setup & Telegram QR Sender
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  waSock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state
  });

  waSock.ev.on('creds.update', saveCreds);
  
  waSock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;
    
    if (qr && adminChatId) {
      try {
        const qrBuffer = await qrcode.toBuffer(qr);
        await bot.sendPhoto(adminChatId, qrBuffer, { 
          caption: '📱 Yeh lo WhatsApp QR! Telegram se hi scan kar le.' 
        });
      } catch (err) {
        console.log('QR send error:', err);
      }
    }

    if (connection === 'open') {
      console.log('WhatsApp connected!');
      if (adminChatId) {
        bot.sendMessage(adminChatId, '🎉 WhatsApp successfully connect ho gaya bot ke sath!');
      }
    } else if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startWhatsApp();
      }
    }
  });
}

startWhatsApp();
