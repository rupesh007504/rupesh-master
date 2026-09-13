const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

// Render Environment Variables se tokens uthayega
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;

if (!TOKEN_1 || !TOKEN_2) {
  console.error('❌ Error: Telegram Bot Tokens are missing in Environment Variables!');
  process.exit(1);
}

const bot1 = new TelegramBot(TOKEN_1, { polling: true });
const bot2 = new TelegramBot(TOKEN_2, { polling: true });

// Admin & Allowed Users Management
const MAIN_ADMIN = '7501991033';
let allowedUsers = ['7501991033', '8824915409']; 

let waSock = null;
let currentSpamInterval = null;

let targetWhatsApp = ''; 
let targetTelegramChat = ''; 
let targetInstagramUser = 'TARGET_INSTA_USER'; 

let targetName = 'TARGET'; 
let adminChatId = MAIN_ADMIN;

let activePlatform = 'whatsapp'; 
let customSpamText = '';

const getRandomEmojis = () => {
  const emojiPool = [
    '💥', '🔥', '⚡', '💎', '✨', '🖤', '👑', '🚀', '💀', '😈', '🖕', '🧨', '💣', '⚔️', '👺', '🔪', '🌪️',
    '🖕🏻', '🖕🏽', '🖕🏿', '🤬', '😡', '💩', '🤡', '🤖', '👾', '👁️‍🗨️', '👁️', '👀', '🧠', '🦹', '🦹‍♂️', '🦹‍♀️',
    '💢', '💬', '👁️‍🗨️', '🗯️', '💤', '💨', '💦', '💫', '💬', '📢', '🔊', '🔔', '🔕', '⛔', '🚫', '❌', '❓',
    '💯', '💢', '🔥', '⚡', '⚡', '🌟', '⭐', '💫', '🔥', '💥', '💀', '☠️', '👻', '👽', '🛸', '🚀', '🔮',
    '🎲', '🎯', '🎰', '🎳', '🎮', '🕹️', '🎰', '🧩', '🧸', '🪅', '🪩', '🪬', '🧿', '🛑', '⚠️', '☢️', '☣️'
  ];
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += emojiPool[Math.floor(Math.random() * emojiPool.length)];
  }
  return result;
};

const getSpamTemplates = (name) => {
  const rE1 = getRandomEmojis();
  const rE2 = getRandomEmojis();
  const rE3 = getRandomEmojis();
  const rE4 = getRandomEmojis();
  
  if (customSpamText) {
    return [
      `${rE1} ${name} [${activePlatform.toUpperCase()}]: ${customSpamText} ${rE2}\n`.repeat(30).trim(),
      `⚡ ${name} [${activePlatform.toUpperCase()}]: ${customSpamText} 💥`.repeat(30).trim()
    ];
  }

  return [
    `${rE1} 💥 ${name} TERI MAA KI CHUT ME BAM BLAST [${activePlatform.toUpperCase()}] 💥 ${rE2}\n`.repeat(30).trim(),
    `${rE2} 🔥 ${name} KI MAA KO ROZ RAAT KO GHAR BULAKE CHODTA HUN 🔥 ${rE3}\n`.repeat(30).trim(),
    `${rE3} ⚡ ${name} TU APNI MAA KA BHADWA AULAAD HAI MADARCHOD ⚡ ${rE1}\n`.repeat(30).trim(),
    `${rE1} 👑 ${name} DADDY IS HERE TERI KHUD KI AUKAAT KYA HAI BHADWE 👑 ${rE2}\n`.repeat(30).trim(),
    `${rE1} 📜✨ ${name} Teri qismat ka likh rahe hain yeh afsana,\nTerii maa ki chut me bomb hai nishana! 💥🔥\nJab tak saans chalegi teri har saans pe war karenge,\n${name} madarchod tujhe aur tere pure khandan ko nanga karenge! 💀⚡ ${rE2}\n`.repeat(25).trim(),
    `${rE2} 🌙🥀 Mehfil me baithkar koi shayari ki baat na karo,\n${name} teri maa ki chut ko humne banaya hai aakhadavaro! 😈🔥\nPhoolon ki khushbu yaa talwar ki dhaar,\n${name} tu baap Rupesh ke samne hai sabse bada bhadwa bekar! 🗡️👑 ${rE3}\n`.repeat(25).trim(),
    `${rE3} 💫🌹 Aasmaan se tuta sitara zameen par aa gaya,\n${name} teri behan ka bhosda kholne Rupesh Daddy aa gaya! 🚀💥\nLafzon ki yeh dhaar aur galiyon ki yeh bahar,\n${name} teri aukaat hi nahi ki tu tik sake ek pal mere yaar! 🌪️🔥 ${rE4}\n`.repeat(25).trim(),
    `${rE4} 🖤⚡ Raat ka andhera ho ya subah ka savera,\n${name} teri maa ke bhosde me ab mera hi dera! 🧨👺\nShayari bhi meri aur galiyan bhi meri,\n${name} madarchod khatam ho chuki hai ab aukaat teri! 🔪💯 ${rE1}\n`.repeat(25).trim(),
    `${rE1} 🧨🔥 ${name} TERI MAA KE BHOSDE ME AC CHALA DUNGA MADARCHOD\nTERI KHUD KI AUKAAT KYA HAI JO TU RUPESH SE PANGE LEGA! 🖕 ${rE2}\n`.repeat(30).trim(),
    `${rE2} 💀⚔️ ${name} RANDI KI AULAAD TERE PURE KHANDAAN KO LINE ME LAGA KE CHODUNGA\nTERI MAA KI CHUT MERI JAAGIR HAI BHADWE! 😈 ${rE3}\n`.repeat(30).trim(),
    `${rE3} 🚀💥 ${name} MADARCHOD TU APNI MAA KA LAURA KHAANE WALA CHHORTA HAI\nTUNE RUPESH DADDY KO TARGET KARIYA AB TERI TABAHI FIX HAI! 🛑 ${rE4}\n`.repeat(30).trim(),
    `${rE4} 👺🔪 ${name} TERI BAHEN KI CHUT ME TRACTOR DALKE CHEER DUNGA\nNIKAL YAHAN SE BHADWE, TUJE ZERO KAR DUNGA MAIN! 💯 ${rE1}\n`.repeat(30).trim()
  ];
};

const getHeavyNamePool = (name) => {
  return [
    `👑 ${name} Madarchod 🖕`,
    `⚡ ${name} Ki Maa Ka Bhoda 💥`,
    `🔥 ${name} Randi Ka Baccha 😈`,
    `💀 Rupesh Daddy Ka Naukar ${name} 🖕`,
    `👑 ${name} Ka Khandan Bikau Hai 🧨`,
    `🔥 ${name} Teri Maa Ka Banta 🔪`,
    `⚡ ${name} Bhadwa 100% 🚀`,
    `💀 ${name} Choot Ka Ghulam 👺`,
    `👑 Rupesh Don & Target ${name} 💥`,
    `🔥 ${name} Ki Behan Me Rocket ⚡`,
    `🖕 ${name} Tera Baap Rupesh Hai 💀`,
    `💥 ${name} Zero Aukaat Wala 👑`
  ];
};

console.log('Rupesh Master Bot (Secure & Target-Locked) is starting...');

const hasAccess = (userId) => allowedUsers.includes(userId.toString());

const handleBotCommands = (botInstance, msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;
  
  if (!hasAccess(chatId)) {
    botInstance.sendMessage(chatId, "❌ You are not authorized to use this bot!");
    return;
  }
  
  adminChatId = chatId;
  if (!text) return;

  if (text === '/start') {
    const menuOptions = {
      reply_markup: {
        keyboard: [
          [{ text: '/spam' }, { text: '/stop' }],
          [{ text: '/platform_whatsapp' }, { text: '/platform_telegram' }, { text: '/platform_instagram' }],
          [{ text: '/status' }, { text: '/logoutwa' }]
        ],
        resize_keyboard: true,
        persistent: true
      },
      parse_mode: 'Markdown'
    };

    const menuText = `🤖 *Rupesh Master Bot (Secure Controller)* 🤖\n\n` +
                     `🌐 Active Platform: *${activePlatform.toUpperCase()}*\n` +
                     `🎯 Target Name: *${targetName}*\n` +
                     `📱 WA Target: ${targetWhatsApp || 'Not Set'}\n` +
                     `✈️ TG Target Group: ${targetTelegramChat || 'Not Set'}\n` +
                     `📸 Insta Target: @${targetInstagramUser}\n\n` +
                     `📲 *Tap Commands Neeche Hain:*`;
    
    botInstance.sendMessage(chatId, menuText, menuOptions);
  } 
  else if (text.startsWith('/settarget')) {
    const args = text.split(' ');
    if (args[1]) {
      const inputTarget = args[1].trim();
      targetWhatsApp = inputTarget.includes('@g.us') ? inputTarget : inputTarget + '@s.whatsapp.net';
      botInstance.sendMessage(chatId, `✅ WhatsApp Target Lock ho gaya: ${inputTarget}`);
    } else {
      botInstance.sendMessage(chatId, `❌ Sahi format likh! Example: /settarget 919876543210 ya /settarget 120363@g.us`);
    }
  }
  else if (text.startsWith('/settgtarget')) {
    const args = text.split(' ');
    if (args[1]) {
      targetTelegramChat = args[1].trim();
      botInstance.sendMessage(chatId, `✅ Telegram Target Group ID lock ho gayi: ${targetTelegramChat}`);
    } else {
      botInstance.sendMessage(chatId, `❌ Chat ID likh! Example: /settgtarget -100xxxxxxxxxx`);
    }
  }
  else if (text.startsWith('/setinstatarget')) {
    const args = text.split(' ');
    if (args[1]) {
      targetInstagramUser = args[1].trim();
      botInstance.sendMessage(chatId, `✅ Instagram Target User/Group lock ho gaya: @${targetInstagramUser}`);
    } else {
      botInstance.sendMessage(chatId, `❌ Username likh! Example: /setinstatarget target_username`);
    }
  }
  else if (text.startsWith('/setname')) {
    const nameInput = text.replace('/setname', '').trim();
    if (nameInput) {
      targetName = nameInput.toUpperCase();
      botInstance.sendMessage(chatId, `🎯 Target Name Updated to: *${targetName}*`, { parse_mode: 'Markdown' });
    } else {
      botInstance.sendMessage(chatId, `❌ Naam toh likh! Example: /setname AMIT`);
    }
  }
  else if (text.startsWith('/setspam')) {
    const spamInput = text.replace('/setspam', '').trim();
    if (spamInput) {
      customSpamText = spamInput;
      botInstance.sendMessage(chatId, `✍️ Nayi custom spam script lock ho gayi!\n\n*Text:* ${customSpamText}`, { parse_mode: 'Markdown' });
    } else {
      botInstance.sendMessage(chatId, `❌ Khali command mat bhej! Script sath me likh.`);
    }
  }
  else if (text === '/platform_whatsapp') {
    activePlatform = 'whatsapp';
    botInstance.sendMessage(chatId, `📱 Active Platform: *WHATSAPP* 🟢`, { parse_mode: 'Markdown' });
  }
  else if (text === '/platform_instagram') {
    activePlatform = 'instagram';
    botInstance.sendMessage(chatId, `📸 Active Platform: *INSTAGRAM* 🟣`, { parse_mode: 'Markdown' });
  }
  else if (text === '/platform_telegram') {
    activePlatform = 'telegram';
    botInstance.sendMessage(chatId, `✈️ Active Platform: *TELEGRAM* 🔵`, { parse_mode: 'Markdown' });
  }
  else if (text === '/spam') {
    if (activePlatform === 'whatsapp' && !targetWhatsApp) {
      botInstance.sendMessage(chatId, `❌ Pehle /settarget karke WhatsApp target set kar bhai!`);
      return;
    }
    if (activePlatform === 'telegram' && !targetTelegramChat) {
      botInstance.sendMessage(chatId, `❌ Pehle /settgtarget karke Telegram group ID set kar bhai!`);
      return;
    }

    botInstance.sendMessage(chatId, `🚀 Target Locked Spam Started!\n🎯 Target: *${targetName}*\n🌐 Platform: *${activePlatform.toUpperCase()}*`);
    if (currentSpamInterval) clearInterval(currentSpamInterval);

    let counter = 0;
    currentSpamInterval = setInterval(async () => {
      try {
        const spamList = getSpamTemplates(targetName);
        const selectedBlock = spamList[Math.floor(Math.random() * spamList.length)];
        const finalMessage = `${selectedBlock}\n[Spam Count: ${counter++}]`;

        if (activePlatform === 'whatsapp' && waSock && targetWhatsApp) {
          await waSock.sendMessage(targetWhatsApp, { text: finalMessage }).catch(() => {});
        }
        if (activePlatform === 'telegram' && targetTelegramChat) {
          await botInstance.sendMessage(targetTelegramChat, finalMessage).catch(() => {});
        }
        if (activePlatform === 'instagram') {
          console.log(`[INSTAGRAM TARGET SPAM -> @${targetInstagramUser}]: ${finalMessage}`);
        }

        if (counter % 10 === 0 && waSock) {
          const heavyNameList = getHeavyNamePool(targetName);
          const nextHeavyName = heavyNameList[Math.floor(Math.random() * heavyNameList.length)];
          await waSock.updateProfileName(nextHeavyName).catch(() => {});
        }
      } catch (err) {
        console.log('Spam execution error:', err);
      }
    }, 450);
  }
  else if (text === '/stop') {
    if (currentSpamInterval) {
      clearInterval(currentSpamInterval);
      currentSpamInterval = null;
      botInstance.sendMessage(chatId, `🛑 Spam successfully rok diya gaya hai!`);
    } else {
      botInstance.sendMessage(chatId, `ℹ️ Koi spam active nahi hai.`);
    }
  }
  else if (text === '/status') {
    const statusMsg = `📊 *Rupesh Bot Status* 📊\n\n` +
                      `🟢 WhatsApp: ${waSock?.user ? 'Connected' : 'Disconnected'}\n` +
                      `🌐 Active Platform: *${activePlatform.toUpperCase()}*\n` +
                      `🎯 Target Name: *${targetName}*\n` +
                      `📱 WA Target: ${targetWhatsApp || 'Not Set'}\n` +
                      `✈️ TG Target Group: ${targetTelegramChat || 'Not Set'}\n` +
                      `📸 Insta Target: @${targetInstagramUser}`;
    botInstance.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
  }
  else if (text === '/logoutwa') {
    if (chatId !== MAIN_ADMIN) {
      botInstance.sendMessage(chatId, `❌ Only Main Admin can logout WhatsApp session!`);
      return;
    }
    try {
      if (waSock) await waSock.logout().catch(() => {});
      if (fs.existsSync('auth_info_baileys')) fs.rmSync('auth_info_baileys', { recursive: true, force: true });
      botInstance.sendMessage(chatId, `🔄 WhatsApp session clear! Naya QR code bheja ja raha hai...`);
      startWhatsApp();
    } catch (err) {
      botInstance.sendMessage(chatId, `❌ Logout error: ${err.message}`);
    }
  }
};

bot1.on('message', (msg) => handleBotCommands(bot1, msg));
bot2.on('message', (msg) => handleBotCommands(bot2, msg));

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  waSock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state
  });

  waSock.ev.on('creds.update', saveCreds);
  
  waSock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr && adminChatId) {
      try {
        const qrBuffer = await qrcode.toBuffer(qr);
        await bot1.sendPhoto(adminChatId, qrBuffer, { caption: '📱 WhatsApp QR Code! Scan it.' }).catch(() => {});
        await bot2.sendPhoto(adminChatId, qrBuffer, { caption: '📱 WhatsApp QR Code! Scan it.' }).catch(() => {});
      } catch (err) {}
    }
    if (connection === 'open') console.log('WhatsApp connected!');
    else if (connection === 'close') startWhatsApp();
  });
}

startWhatsApp();
