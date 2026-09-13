const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const http = require('http');

// Render 24/7 Keep Alive Server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Ultimate Multi-Platform Bot is Running 24/7!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const MASTER_TOKEN = process.env.TOKEN_1 || 'YOUR_MASTER_BOT_TOKEN';
const bot = new TelegramBot(MASTER_TOKEN, { polling: true });

const MAIN_ADMINS = ['7501991033', '8824915409'];
let allowedUsers = [...MAIN_ADMINS]; // Approved friends list
let pendingRequests = {}; // Jo approval maangenge

let userState = {}; 
let waSock = null;
let targetName = 'TARGET'; 
let spamDelay = 150; // RDP jaisi super fast speed (ms)

// Platform-wise independent configurations & states
let platformsData = {
  whatsapp: { 
    targets: [], 
    active: false, 
    timer: null, 
    linked: false 
  },
  telegram: { 
    customBotToken: '', 
    customBotInstance: null, 
    targets: [], 
    active: false, 
    timer: null 
  },
  instagram: { 
    username: '', 
    password: '', 
    targets: [], 
    active: false, 
    timer: null 
  }
};

const clipboardEmojis = [
  '💥', '🔥', '⚡', '💎', '✨', '🖤', '👑', '🚀', '💀', '😈', '🖕', '🧨', '💣', '⚔️',
  '💩', '🤡', '🤬', '🔪', '🩸', '🥃', '🚬', '🌪️', '☠️', '🛑', '⚠️', '💢', '💬', '🦾'
];

const getRandomEmojis = (count = 10) => {
  let res = '';
  for (let i = 0; i < count; i++) {
    res += clipboardEmojis[Math.floor(Math.random() * clipboardEmojis.length)];
  }
  return res;
};

// Spam Templates (Custom pasted text bhi isme add ho jayega)
let spamTemplates = [
  (t) => `[ ${t} ] ➔ Teri maa ki chudai madarchod 🔥\nSun bhadwe ${t}, teri maa ki chudaai na ki toh mera naam nahi! ⚡\nTeri aukaat kya hai bhadwe, sabke samne tu ek nalla bhikari hai! 🖕`,
  (t) => `[ ${t} ] ➔ Teri behan ki chut me bam blast 💥\nAchha khasa parivar tera, dhajjiya uda dunga saale ${t}! 😈\nKabar khod di hai teri aur tere poore khaandaan ki!`,
  (t) => `[ ${t} ] ➔ Shayari ke sath pel dunga saale tujhe 🚀\nTeri maa ke bhosde me train chalwa dunga madarchod! 🧨\nSystem hang kar diya hai tera, samjha kya bsdk! ⚔️`,
  
  // Heavy 30+ Lines Template
  (t) => `[ ${t} ] ➔ Sun bhadwe dhyan se sun le:\n` +
         `1. ${t} teri maa ki chut me railway track bichha dunga!\n` +
         `2. ${t} teri behan ke bhosde me bomb phod dunga madarchod!\n` +
         `3. ${t} nalla bhikari hai, iski poori family road par nangi nachti hai.\n` +
         `4. ${t} ke ghar walo ka roj ka kachra uthane wala hu main.\n` +
         `5. ${t} ki maa ka bhosda khali karke usme truck ghusa dunga.\n` +
         `6. ${t} madarchod teri aukaat hi kya hai be bhadwe?\n` +
         `7. ${t} ko dekh kar kutte bhi raste par thook kar chalte hain.\n` +
         `8. ${t} ki behan ko raat bhar rulaane wala hu saala!\n` +
         `9. ${t} ke pure khandan ki auction lagne wali hai market me.\n` +
         `10. ${t} ke muh me apna laura dekar chup kara dunga.\n` +
         `11. ${t} bsdk teri maa ko roz naye naye log chodte hain.\n` +
         `12. ${t} ka baap nalla berojgar sadak chap bhikari hai.\n` +
         `13. ${t} teri maa ke chucho par chai ki tapri kholunga.\n` +
         `14. ${t} ke ghar me ghus kar sabki haddiyan tod dunga.\n` +
         `15. ${t} tu aur tera poora khandan hamesha ke liye bikau hai.\n` +
         `16. ${t} madarchod tera system ukhad kar fenk dunga.\n` +
         `17. ${t} ki maa ka bharosa tod diya hai saale ne.\n` +
         `18. ${t} ki behan ki chut me helicopter land karwa dunga.\n` +
         `19. ${t} saala hijda paida hua tha hospital ki naali me.\n` +
         `20. ${t} ke paas khane ko roti nahi, chala hai 30 line sunne!\n` +
         `21. ${t} ki maa ka bhosda laal kar dunga gande wala.\n` +
         `22. ${t} tera baap kaun hai ye tujhe khud nahi pata bsdk.\n` +
         `23. ${t} ke poore parivar ko nanga karke bazaar me ghumauga.\n` +
         `24. ${t} ki maa ko roz raat ko naya customer milta hai.\n` +
         `25. ${t} madarchod aukat me reh warna gaad dunga zameen me.\n` +
         `26. ${t} ki shakal dekh kar tatti ko bhi ulti aa jati hai.\n` +
         `27. ${t} tera pura vansh ek number ka harami aur nalla hai.\n` +
         `28. ${t} ki behan ke sath roz raat ko gandi wali game hoti hai.\n` +
         `29. ${t} ki maa ki chut me bidi jala dunga saale.\n` +
         `30. ${t} kahatam ho gaya hai tu, ab tera kuch nahi ho sakta! 🖕🔥\n` +
         `( ${getRandomEmojis(10)} )`
];

const hasAccess = (userId) => allowedUsers.includes(userId.toString());
const isMainAdmin = (userId) => MAIN_ADMINS.includes(userId.toString());

// Callback query handler for approving friends access
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id.toString();
  const data = query.data;

  if (!isMainAdmin(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "❌ You are not authorized to approve!", show_alert: true });
    return;
  }

  if (data.startsWith('approve_')) {
    const targetUserId = data.replace('approve_', '');
    if (!allowedUsers.includes(targetUserId)) {
      allowedUsers.push(targetUserId);
    }
    delete pendingRequests[targetUserId];
    bot.answerCallbackQuery(query.id, { text: `✅ User ${targetUserId} granted access!` });
    bot.editMessageText(`✅ Access Approved for User ID: \`${targetUserId}\``, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });
    bot.sendMessage(targetUserId, `🎉 Tumhe Rupesh Bot ka access mil gaya hai! Ab \`/start\` type karo.`);
  } 
  else if (data.startsWith('deny_')) {
    const targetUserId = data.replace('deny_', '');
    delete pendingRequests[targetUserId];
    bot.answerCallbackQuery(query.id, { text: `❌ Access Denied!` });
    bot.editMessageText(`❌ Access Denied for User ID: \`${targetUserId}\``, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });
    bot.sendMessage(targetUserId, `❌ Sorry! Tumhara access request reject kar diya gaya hai.`);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text ? msg.text.trim() : '';
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  // Access Guard & Approval Request Flow
  if (!hasAccess(chatId)) {
    if (!pendingRequests[chatId]) {
      pendingRequests[chatId] = true;
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Accept Access', callback_data: `approve_${chatId}` },
              { text: '❌ Deny', callback_data: `deny_${chatId}` }
            ]
          ]
        }
      };
      for (let admin of MAIN_ADMINS) {
        bot.sendMessage(admin, `🔔 *New Access Request!*\n\n👤 User: ${username}\n🆔 ID: \`${chatId}\`\n\nKya isko bot ka access dena hai?`, { parse_mode: 'Markdown', ...inlineKeyboard }).catch(() => {});
      }
    }
    bot.sendMessage(chatId, `⏳ Tumhare paas access nahi hai! Admin ko request bhej di gayi hai. Approval milte hi bot start ho jayega.`);
    return;
  }

  // Handle Input States
  if (userState[chatId]) {
    const state = userState[chatId];
    
    if (state.action === 'WA_SETUP_NUMBER') {
      const phone = text.replace('+', '');
      delete userState[chatId];
      bot.sendMessage(chatId, `⏳ Generating WhatsApp Pairing Code for +${phone}...`);
      try {
        if (!waSock) await startWhatsAppInternal();
        setTimeout(async () => {
          if (!waSock.authState.creds.registered) {
            const code = await waSock.requestPairingCode(phone);
            const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
            bot.sendMessage(chatId, `✅ *WhatsApp Pairing Code:* \`${formatted}\`\nApne WhatsApp par jaakar Link via Phone Number me ye code dalein.`, { parse_mode: 'Markdown' });
          } else {
            platformsData.whatsapp.linked = true;
            bot.sendMessage(chatId, `ℹ️ WhatsApp pehle se linked aur ready hai!`);
          }
        }, 3000);
      } catch (e) {
        bot.sendMessage(chatId, `❌ WA Error: ${e.message}`);
      }
      return;
    }
    if (state.action === 'WA_SET_TARGETS') {
      platformsData.whatsapp.targets = text.split(',').map(t => t.trim().includes('@g.us') || t.trim().includes('@s.whatsapp.net') ? t.trim() : t.trim() + '@s.whatsapp.net');
      delete userState[chatId];
      bot.sendMessage(chatId, `✅ WhatsApp Targets Locked:\n${platformsData.whatsapp.targets.join('\n')}`);
      return;
    }
    if (state.action === 'INSTA_SETUP_CREDS') {
      const parts = text.split(':');
      if (parts.length < 2) {
        bot.sendMessage(chatId, `❌ Format galat hai! Use karein: \`username:password\``, { parse_mode: 'Markdown' });
        return;
      }
      platformsData.instagram.username = parts[0].trim();
      platformsData.instagram.password = parts[1].trim();
      delete userState[chatId];
      bot.sendMessage(chatId, `✅ Instagram ID Saved: *${platformsData.instagram.username}*`);
      return;
    }
    if (state.action === 'INSTA_SET_TARGETS') {
      platformsData.instagram.targets = text.split(',').map(t => t.trim());
      delete userState[chatId];
      bot.sendMessage(chatId, `✅ Instagram Targets Locked:\n${platformsData.instagram.targets.join('\n')}`);
      return;
    }
    if (state.action === 'TG_SETUP_TOKEN') {
      platformsData.telegram.customBotToken = text;
      delete userState[chatId];
      bot.sendMessage(chatId, `⏳ Connecting custom Telegram Bot...`);
      try {
        if (platformsData.telegram.customBotInstance) platformsData.telegram.customBotInstance.stopPolling();
        const customBot = new TelegramBot(text, { polling: true });
        platformsData.telegram.customBotInstance = customBot;

        customBot.on('message', (customMsg) => {
          const cChatId = customMsg.chat.id.toString();
          const cText = customMsg.text ? customMsg.text.trim() : '';
          if (cText === '!start' || cText === '!spam') {
            if (platformsData.telegram.targets.includes(cChatId)) startTelegramSpamForChat(customBot, cChatId);
          } else if (cText === '!stop') {
            stopTelegramSpam(cChatId);
          }
        });
        bot.sendMessage(chatId, `✅ Custom Telegram Bot Connected!`);
      } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
      return;
    }
    if (state.action === 'TG_SET_TARGETS') {
      platformsData.telegram.targets = text.split(',').map(t => t.trim());
      delete userState[chatId];
      bot.sendMessage(chatId, `✅ Telegram Targets Locked:\n${platformsData.telegram.targets.join('\n')}`);
      return;
    }
    if (state.action === 'SET_TARGET_NAME') {
      targetName = text.toUpperCase();
      delete userState[chatId];
      bot.sendMessage(chatId, `🎯 Target Name Updated to: *${targetName}*`, { parse_mode: 'Markdown' });
      return;
    }
    if (state.action === 'ADD_CUSTOM_TEXT') {
      spamTemplates.push((t) => `${text}\n(Target: ${t})`);
      delete userState[chatId];
      bot.sendMessage(chatId, `✅ Naya spam text/gaali successfully add ho gayi hai! Total templates: ${spamTemplates.length}`);
      return;
    }
  }

  // --- Dedicated Commands & Menu System ---
  if (text === '/start') {
    const keyboard = {
      reply_markup: {
        keyboard: [
          [ { text: '📱 Setup WhatsApp' }, { text: '🚀 Start WA Spam' } ],
          [ { text: '📸 Setup Insta' }, { text: '🚀 Start Insta Spam' } ],
          [ { text: '✈️ Setup Telegram' }, { text: '🛑 Stop All Spams' } ],
          [ { text: '✏️ Set Target Name' }, { text: '➕ Add Spam Text' } ],
          [ { text: '/status' }, { text: '/help' } ]
        ],
        resize_keyboard: true,
        persistent: true
      },
      parse_mode: 'Markdown'
    };

    const dashboardText = `🤖 *RUPESH ULTIMATE MULTI-PLATFORM BOT* 🤖\n\n` +
                          `🎯 Target: *${targetName}*\n` +
                          `⚡ Speed (Delay): *${spamDelay}ms* (RDP Ultra-Fast Mode)\n\n` +
                          `📌 *Features:* RDP Speed Control (\`/setspeed\` ), Live Group Name Changing & Friend Access System.`;
    
    bot.sendMessage(chatId, dashboardText, keyboard);
  }
  else if (text === '/help' || text === 'ℹ️ Help') {
    const helpMsg = `📖 *RDP Speed & Command Guide*\n\n` +
                    `• \`/start\` - Open main menu\n` +
                    `• \`/setspeed <ms>\` - Set lightning speed (e.g., \`/setspeed 50\`)\n` +
                    `• \`/settarget <name>\` - Change target name\n` +
                    `• \`/addtext <msg>\` - Add direct spam text\n` +
                    `• \`/removeuser <id>\` - Remove friend's access\n` +
                    `• \`/status\` - Check current status\n` +
                    `• \`/stop\` - Stop spam`;
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  }
  else if (text === '📱 Setup WhatsApp') {
    userState[chatId] = { action: 'WA_SETUP_NUMBER' };
    bot.sendMessage(chatId, `📱 Apna WhatsApp number country code ke sath bhejo (jaise: \`919876543210\`):`, { parse_mode: 'Markdown' });
  }
  else if (text === '🚀 Start WA Spam') {
    if (platformsData.whatsapp.targets.length === 0) {
      userState[chatId] = { action: 'WA_SET_TARGETS' };
      bot.sendMessage(chatId, `❌ WhatsApp targets set nahi hain! Group JID ya Number comma separated bhejo:`);
      return;
    }
    startWhatsAppSpam(chatId);
  }
  else if (text === '📸 Setup Insta') {
    const keyboard = {
      reply_markup: {
        keyboard: [
          [ { text: '🔑 Set Insta Credentials' }, { text: '🎯 Setup Insta Targets' } ],
          [ { text: '🏠 Main Menu' } ]
        ],
        resize_keyboard: true
      }
    };
    bot.sendMessage(chatId, `📸 *Instagram Setup Menu*`, keyboard);
  }
  else if (text === '🔑 Set Insta Credentials') {
    userState[chatId] = { action: 'INSTA_SETUP_CREDS' };
    bot.sendMessage(chatId, `🔑 Instagram Credentials bhejo:\n\`username:password\``, { parse_mode: 'Markdown' });
  }
  else if (text === '🎯 Setup Insta Targets') {
    userState[chatId] = { action: 'INSTA_SET_TARGETS' };
    bot.sendMessage(chatId, `📸 Instagram target usernames/multi-GC IDs comma separated bhejo:`);
  }
  else if (text === '🚀 Start Insta Spam') {
    if (platformsData.instagram.targets.length === 0) {
      userState[chatId] = { action: 'INSTA_SET_TARGETS' };
      bot.sendMessage(chatId, `❌ Pehle Instagram targets set karo!`);
      return;
    }
    startInstagramSpam(chatId);
  }
  else if (text === '✈️ Setup Telegram') {
    const keyboard = {
      reply_markup: {
        keyboard: [
          [ { text: '🤖 Set Telegram Bot Token' }, { text: '🎯 Setup Telegram Targets' } ],
          [ { text: '🏠 Main Menu' } ]
        ],
        resize_keyboard: true
      }
    };
    bot.sendMessage(chatId, `✈️ *Telegram Setup Menu*`, keyboard);
  }
  else if (text === '🤖 Set Telegram Bot Token') {
    userState[chatId] = { action: 'TG_SETUP_TOKEN' };
    bot.sendMessage(chatId, `🤖 BotFather token yahan bhejo:`);
  }
  else if (text === '🎯 Setup Telegram Targets') {
    userState[chatId] = { action: 'TG_SET_TARGETS' };
    bot.sendMessage(chatId, `✈️ Telegram Group Chat IDs comma separated bhejo:`);
  }
  else if (text === '➕ Add Spam Text' || text.startsWith('/addtext')) {
    if (text.startsWith('/addtext')) {
      const customContent = text.replace('/addtext', '').trim();
      if (customContent) {
        spamTemplates.push((t) => `${customContent}\n(Target: ${t})`);
        bot.sendMessage(chatId, `✅ Spam text added! Total: ${spamTemplates.length}`);
      }
    } else {
      userState[chatId] = { action: 'ADD_CUSTOM_TEXT' };
      bot.sendMessage(chatId, `📋 Jo text copy karke paste karega, woh templates me add ho jayegi. Yahan paste kar:`);
    }
  }
  else if (text === '🏠 Main Menu') {
    bot.sendMessage(chatId, `Main menu ke liye \`/start\` type karein.`);
  }
  else if (text === '🛑 Stop All Spams' || text === '/stop') {
    platformsData.whatsapp.active = false;
    if (platformsData.whatsapp.timer) clearInterval(platformsData.whatsapp.timer);

    platformsData.instagram.active = false;
    if (platformsData.instagram.timer) clearInterval(platformsData.instagram.timer);

    platformsData.telegram.active = false;
    if (platformsData.telegram.timer) clearInterval(platformsData.telegram.timer);

    bot.sendMessage(chatId, `🛑 Sabhi platforms ke spams rok diye gaye hain!`);
  }
  else if (text.startsWith('/setspeed')) {
    const s = parseInt(text.replace('/setspeed', '').trim());
    if (!isNaN(s) && s >= 20) {
      spamDelay = s;
      bot.sendMessage(chatId, `⚡ RDP Speed Updated to: *${spamDelay}ms* (Ultra Fast)`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Min speed 20ms honi chahiye! Format: \`/setspeed 50\``, { parse_mode: 'Markdown' });
    }
  }
  else if (text.startsWith('/settarget')) {
    const n = text.replace('/settarget', '').trim();
    if (n) {
      targetName = n.toUpperCase();
      bot.sendMessage(chatId, `🎯 Target Name Updated to: *${targetName}*`, { parse_mode: 'Markdown' });
    }
  }
  else if (text === '✏️ Set Target Name') {
    userState[chatId] = { action: 'SET_TARGET_NAME' };
    bot.sendMessage(chatId, `✏️ Naya Target Name bhejo:`);
  }
  else if (text.startsWith('/removeuser')) {
    if (!isMainAdmin(chatId)) {
      bot.sendMessage(chatId, `❌ Yeh command sirf Main Admin (Rupesh) use kar sakte hain!`);
      return;
    }
    const targetRemoveId = text.replace('/removeuser', '').trim();
    if (targetRemoveId && !MAIN_ADMINS.includes(targetRemoveId)) {
      allowedUsers = allowedUsers.filter(id => id !== targetRemoveId);
      bot.sendMessage(chatId, `✅ User ID \`${targetRemoveId}\` ka access hata diya gaya hai!`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Invalid ID ya Main Admin ko remove nahi kar sakte!`);
    }
  }
  else if (text === '/status') {
    bot.sendMessage(chatId, `📊 *Status*\n- WA Active: ${platformsData.whatsapp.active} (Linked: ${platformsData.whatsapp.linked})\n- Insta Active: ${platformsData.instagram.active}\n- TG Active: ${platformsData.telegram.active}\n- Target Name: ${targetName}\n- Speed: ${spamDelay}ms\n- Approved Users: ${allowedUsers.length}`, { parse_mode: 'Markdown' });
  }
});

// --- WHATSAPP ENGINE (RDP Speed & Dynamic Name Changer) ---
async function startWhatsAppInternal() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  waSock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state
  });

  waSock.ev.on('creds.update', saveCreds);
  waSock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      platformsData.whatsapp.linked = true;
      console.log('✅ WhatsApp Connected & Session Saved!');
    } else if (connection === 'close') {
      platformsData.whatsapp.linked = false;
      setTimeout(() => startWhatsAppInternal(), 5000);
    }
  });
}

function startWhatsAppSpam(adminId) {
  if (!platformsData.whatsapp.linked) {
    bot.sendMessage(adminId, `❌ WhatsApp linked nahi hai! Pehle \`Setup WhatsApp\` karein.`);
    return;
  }
  if (platformsData.whatsapp.active) {
    bot.sendMessage(adminId, `ℹ️ WhatsApp spam pehle se chal raha hai!`);
    return;
  }

  platformsData.whatsapp.active = true;
  bot.sendMessage(adminId, `🚀 RDP Ultra-Fast WhatsApp Spam & Live Group Name Changer Launched!\n🎯 Target: *${targetName}*\n⚡ Speed: *${spamDelay}ms*`);

  let counter = 1;
  
  const runWhatsAppLoop = async () => {
    if (!platformsData.whatsapp.active) return;
    try {
      const templateGenerator = spamTemplates[Math.floor(Math.random() * spamTe
