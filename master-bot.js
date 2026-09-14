const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const TelegramBot = require("node-telegram-bot-api");
const { IgApiClient } = require('instagram-private-api');
const pino = require("pino");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;

// Permanent & Dynamic Admins
const ADMINS = new Set(['7501991033', '8824915409']);

const bots = [];
let waSock = null;
let igClient = null;
let userState = {};
let activeTasks = {};

// Platform speed configuration (Default ultra fast water flow)
let speedConfig = {
  WA: 'fast',
  IG: 'fast',
  TG: 'fast'
};

// Super Optimized Single-Line Heavy Spam Blocks (No commands removed, extremely compact file size)
let spamList = [
  `🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭 ➔ {target} ki aukaat me aake gand mara le bhosdike 💥 ➔ {target} teri maa ko roz chodte hain madarchod ⚡️ ➔ {target} system faad denge madarchod 🔥 ➔ {target} gaaand mara le chupchap bsdk 🌪️ ➔ {target} teri behan ke bhosde me bam blast 💥 ➔ {target} nalla saala aukaat se bahar ja raha hai 🩴 ➔ {target} jute aur chappalo se swagat hoga tera 👟 ➔ {target} chup chaap gaand mara le bhosdike 😈 ➔ {target} teri maa ki chut me chappal aur jute bajenge 💥 ➔ {target} aukaat me reh warna ujaad denge ⚡️ ➔ {target} system ka baap hoon madarchod 🔥 ➔ {target} bhaag mat bsdk aukat dikha apni 🌪️ ➔ {target} madarchod ke bachhe chup chap gand mara 💥 ➔ {target} system hilana band kar warna gaaad denge 🩴 ➔ {target} teri poori khandan ki maa chod denge ⚡️ ➔ {target} aukaat me rehke baat kar bhosdike 🔥 ➔ {target} system faad ke rakh denge tera madarchod 😈 ➔ {target} aur uski poori gang ki gaand me bamboo denge 💥 ➔ {target} bsdk aukat me reh le warna zinda gaad denge 🩴 ➔ {target} ki maa ka bhosda faad denge ek hi jhatke me ⚡️ ➔ {target} shakal se bhikari aur harkat se chinal bsdk 🔥 ➔ {target} tera poora khandan gaand maraata hai 🌪️ ➔ {target} madarchod ki aulaad chup chap baith ja 💥 ➔ {target} teri behan ko nanga karke nachayenge 😈 ➔ {target} bsdk aukat me reh warna ghar से utha lenge 🩴 ➔ {target} tera baap hoon madarchod baat mat kar zyaada ⚡️ ➔ {target} teri maa ke bhosde me rocket launcher ghusa denge 🔥 ➔ {target} nalla kahin ka road chhap bhikari bsdk 🌪️ ➔ {target} teri gaand me laal mirch bhar denge madarchod 💥 ➔ {target} aukat me rehke gand mara bsdk 😈`,

  `👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀ᴍ 👑🔥 ➔ {target} nalla bhikari saala aukat dekh apni ⚡️ ➔ {target} teri behan ke bhosde me aag laga denge 🔥 ➔ {target} madarchod ke bachhe chup reh bsdk 🌪️ ➔ {target} jute aur chappalo se swagat hoga tera 💥 ➔ {target} aukat se bahar mat jaa madarchod 🩴 ➔ {target} tera system hi hila ke rakh denge ek baar me 😈 ➔ {target} teri maa ke mooh me apna lund de denge ⚡️ ➔ {target} madarchod ke pille aukat me aa ja 🔥 ➔ {target} tera poora khandan bikhari hai bsdk 🌪️ ➔ {target} teri gaand me sariya dal denge madarchod 💥 ➔ {target} bhagwaan bhi bacha nahi payega tujhe ab 🩴 ➔ {target} bsdk teri maa ki chut me aag laga denge 😈 ➔ {target} tera system faadne ke liye akela kaafi hoon ⚡️ ➔ {target} madarchod sharam karle thodi si bsdk 🔥 ➔ {target} teri behan ko gaadi ke piche bandh ke ghumayenge 🌪️ ➔ {target} bsdk tera baap hoon main pehchan le 💥 ➔ {target} teri maa ka bhosda tod denge madarchod 🩴 ➔ {target} aukat me reh warna kachra karke fek denge 😈 ➔ {target} madarchod saala aukat me rehke baat kar ⚡️ ➔ {target} teri poori gang ko nanga karke chodenge 🔥 ➔ {target} bsdk tera game bajane wale hain aaj 🌪️ ➔ {target} teri maa ke bhosde me bomb phod denge 💥 ➔ {target} madarchod shakal dekhi hai apni aaine me 🩴 ➔ {target} bsdk tera khel khatam hone wala hai ab 😈 ➔ {target} teri maa ko sadak par nanga nachayenge ⚡️ ➔ {target} madarchod aukat me rehke gand mara le 🔥 ➔ {target} bsdk tera poora vansh nalla hai 🌪️ ➔ {target} teri maa ki chut fadd denge bsdk 💥 ➔ {target} system ka baap rupesh hai yaad rakhna 😈`,

  `🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥 ➔ {target} teri maa ki chut me chappal aur jute bajenge 🩴 ➔ {target} aukaat me reh warna ujaad denge ⚡️ ➔ {target} system ka baap hoon madarchod 🔥 ➔ {target} gaaand mara le bhosdike chup chap 🌪️ ➔ {target} tera poora khandan jute khata hai 💥 ➔ {target} madarchod aukat me rehke baat kar 🩴 ➔ {target} teri maa ke bhosde me danda denge 😈 ➔ {target} bsdk tera game bajane me maza aata hai ⚡️ ➔ {target} teri behan ka bhosda laal kar denge 🔥 ➔ {target} madarchod saala nalla kahin ka 🌪️ ➔ {target} teri gaand me bambu de denge bsdk 💥 ➔ {target} aukat me reh warna zinda dafna denge 🩴 ➔ {target} madarchod shakal dekhi hai apni 😈 ➔ {target} teri maa ko roz naye raaste par chodte hain ⚡️ ➔ {target} bsdk tera system faad ke rakh denge 🔥 ➔ {target} teri maa ka bhosda fadd denge 🌪️ ➔ {target} madarchod chup chaap baith ja warna tod denge 💥 ➔ {target} bsdk apni aukat me rehna sikh le pehle 🩴 ➔ {target} teri maa ke mooh me apna lund de denge 😈 ➔ {target} madarchod ke pille aukat me aa ja ⚡️ ➔ {target} tera poora khandan bikhari hai bsdk 🔥 ➔ {target} teri gaand me sariya dal denge madarchod 🌪️ ➔ {target} bhagwaan bhi bacha nahi payega tujhe ab 💥 ➔ {target} bsdk teri maa ki chut me aag laga denge 🩴 ➔ {target} tera system faadne ke liye akela kaafi hoon 😈 ➔ {target} madarchod sharam karle thodi si bsdk ⚡️ ➔ {target} teri behan ko gaadi ke piche bandh ke ghumayenge 🔥 ➔ {target} bsdk tera baap hoon main pehchan le 🌪️ ➔ {target} teri maa ka bhosda tod denge madarchod 💥 ➔ {target} aukat me reh warna kachra karke fek denge 🩴`,

  `💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} bhaag mat bsdk aukat dikha apni 💥 ➔ {target} jute aur chappalo se maar khayega tu 🩴 ➔ {target} madarchod ke bachhe chup chap gand mara ⚡️ ➔ {target} system hilana band kar warna gaaad denge 🔥 ➔ {target} teri maa ke bhosde me bomb phod denge 🌪️ ➔ {target} bsdk aukat me rehna sikh le 💥 ➔ {target} tera poora khandan nalla hai 🩴 ➔ {target} madarchod chup chaap gaand mara le 😈 ➔ {target} teri maa ki chut fadd denge ek jhatke me ⚡️ ➔ {target} bsdk tera khel khatam hone wala hai 🔥 ➔ {target} teri maa ko sadak par nanga nachayenge 🌪️ ➔ {target} madarchod aukat me rehke gand mara le 💥 ➔ {target} bsdk tera poora vansh bhikari hai 🩴 ➔ {target} teri maa ki chut me aag laga denge bsdk 😈 ➔ {target} system ka baap rupesh hai yaad rakhna ⚡️ ➔ {target} tera system hi hila ke rakh denge ek baar me 🔥 ➔ {target} teri maa ke mooh me apna lund de denge 🌪️ ➔ {target} madarchod ke pille aukat me aa ja 💥 ➔ {target} tera poora khandan bikhari hai bsdk 🩴 ➔ {target} teri gaand me sariya dal denge madarchod 😈 ➔ {target} bhagwaan bhi bacha nahi payega tujhe ab ⚡️ ➔ {target} bsdk teri maa ki chut me aag laga denge 🔥 ➔ {target} tera system faadne ke liye akela kaafi hoon 🌪️ ➔ {target} madarchod sharam karle thodi si bsdk 💥 ➔ {target} teri behan ko gaadi ke piche bandh ke ghumayenge 🩴 ➔ {target} bsdk tera baap hoon main pehchan le 😈 ➔ {target} teri maa ka bhosda tod denge madarchod ⚡️ ➔ {target} aukat me reh warna kachra karke fek denge 🔥 ➔ {target} madarchod saala aukat me rehke baat kar 🌪️ ➔ {target} teri poori gang ko nanga karke chodenge 💥`,

  `🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} teri poori khandan ki maa chod denge ⚡️ ➔ {target} aukaat me rehke baat kar bhosdike 🔥 ➔ {target} system faad ke rakh denge tera madarchod 🌪️ ➔ {target} bsdk aukat me reh le warna zinda gaad denge 💥 ➔ {target} ki maa ka bhosda faad denge ek hi jhatke me 🩴 ➔ {target} shakal se bhikari aur harkat se chinal bsdk 😈 ➔ {target} tera poora khandan gaand maraata hai ⚡️ ➔ {target} madarchod ki aulaad chup chap baith ja 🔥 ➔ {target} teri behan ko nanga karke nachayenge 🌪️ ➔ {target} bsdk aukat me reh warna ghar se utha lenge 💥 ➔ {target} tera baap hoon madarchod baat mat kar zyaada 🩴 ➔ {target} teri maa ke bhosde me rocket launcher ghusa denge 😈 ➔ {target} nalla kahin ka road chhap bhikari bsdk ⚡️ ➔ {target} teri gaand me laal mirch bhar denge madarchod 🔥 ➔ {target} aukat me rehke gand mara bsdk 🌪️ ➔ {target} nalla saala aukat se bahar ja raha hai 💥 ➔ {target} teri maa ka bhosda laal kar denge bsdk 🩴 ➔ {target} madarchod chup chaap baith ja warna tod denge 😈 ➔ {target} tera system hi hila ke rakh denge ek baar me ⚡️ ➔ {target} ki behan ko roz naye road par chodte hain 🔥 ➔ {target} bsdk apni aukat me rehna sikh le pehle 🌪️ ➔ {target} teri maa ke mooh me apna lund de denge 💥 ➔ {target} madarchod ke pille aukat me aa ja 🩴 ➔ {target} tera poora khandan bikhari hai bsdk 😈 ➔ {target} teri gaand me sariya dal denge madarchod ⚡️ ➔ {target} bhagwaan bhi bacha nahi payega tujhe ab 🔥 ➔ {target} bsdk teri maa ki chut me aag laga denge 🌪️ ➔ {target} tera system faadne ke liye akela kaafi hoon 💥 ➔ {target} madarchod sharam karle thodi si bsdk 🩴 ➔ {target} teri behan ko gaadi ke piche bandh ke ghumayenge 😈`,

  `💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎 ➔ {target} aur uski poori gang ki gaand me bamboo denge 💥 ➔ {target} bsdk aukat me reh le warna zinda gaad denge ⚡️ ➔ {target} ki maa ka bhosda faad denge ek hi jhatke me 🔥 ➔ {target} shakal se bhikari aur harkat se chinal bsdk 🌪️ ➔ {target} tera poora khandan gaand maraata hai 🩴 ➔ {target} madarchod ki aulaad chup chap baith ja 😈 ➔ {target} teri behan ko nanga karke nachayenge 💥 ➔ {target} bsdk aukat me reh warna ghar se utha lenge ⚡️ ➔ {target} tera baap hoon madarchod baat mat kar zyaada 🔥 ➔ {target} teri maa ke bhosde me rocket launcher ghusa denge 🌪️ ➔ {target} nalla kahin ka road chhap bhikari bsdk 🩴 ➔ {target} teri gaand me laal mirch bhar denge madarchod 😈 ➔ {target} aukat me rehke gand mara bsdk 💥 ➔ {target} nalla saala aukat se bahar ja raha hai ⚡️ ➔ {target} teri maa ka bhosda laal kar denge bsdk 🔥 ➔ {target} madarchod chup chaap baith ja warna tod denge 🌪️ ➔ {target} tera system hi hila ke rakh denge ek baar me 🩴 ➔ {target} ki behan ko roz naye road par chodte hain 😈 ➔ {target} bsdk apni aukat me rehna sikh le pehle 💥 ➔ {target} teri maa ke mooh me apna lund de denge ⚡️ ➔ {target} madarchod ke pille aukat me aa ja 🔥 ➔ {target} tera poora khandan bikhari hai bsdk 🌪️ ➔ {target} teri gaand me sariya dal denge madarchod 🩴 ➔ {target} bhagwaan bhi bacha nahi payega tujhe ab 😈 ➔ {target} bsdk teri maa ki chut me aag laga denge 💥 ➔ {target} tera system faadne ke liye akela kaafi hoon ⚡️ ➔ {target} madarchod sharam karle thodi si bsdk 🔥 ➔ {target} teri behan ko gaadi ke piche bandh ke ghumayenge 🌪️ ➔ {target} bsdk tera baap hoon main pehchan le 🩴 ➔ {target} system ka baap rupesh hai yaad rakhna 😈`,

  `💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥 ➔ {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥`,

  `👑🔥 RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥 ➔ RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥 ➔ RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥 ➔ RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥 ➔ RUPESH 𝑆𝐴𝑅𝐾𝐴𝑅 𝐼𝑆 𝑁𝑂.1 ☠️💥`,

  `🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨ ➔ {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨`,

  `🔥👑 RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥 ➔ RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥 ➔ RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥 ➔ RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥 ➔ RUPESH 𝐆ᴏᴅ 𝐎ғ 𝐒ᴘ𝐀ᴍ 👑🔥`
];

function isAdmin(msg) {
  return ADMINS.has(String(msg.from?.id));
}

// ================= 1. WHATSAPP ENGINE =================
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

    if (lower.startsWith('!target') || lower.startsWith('.target')) {
      const parts = cleanText.split(' ');
      parts.shift();
      const targetName = parts.join(' ').trim();
      if (targetName) {
        activeTasks[jid].hater = targetName;
        await waSock.sendMessage(jid, { text: `🎯 Target Updated for this Group: ${targetName}` });
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

    // Unstoppable Water-Flow Infinite Spam Loop
    if (lower.startsWith('!spam') || lower.startsWith('.spam')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].spam = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🚀 RUPESH WA WATER-FLOW SPAM STARTED (${speedConfig.WA}) for Target: ${haterName}!` });

      const runSpamLoop = () => {
        if (!activeTasks[jid]?.spam) return;
        const delay = speedConfig.WA === 'slow' ? 500 : (speedConfig.WA === 'normal' ? 100 : 0);
        
        setTimeout(async () => {
          if (!activeTasks[jid]?.spam) return;
          try {
            const rawBlock = spamList[Math.floor(Math.random() * spamList.length)];
            const formattedBlock = rawBlock.replace(/{target}/g, haterName);
            await waSock.sendMessage(jid, { text: formattedBlock });
          } catch(e){}
          if (activeTasks[jid]?.spam) runSpamLoop();
        }, delay);
      };

      runSpamLoop();
      runSpamLoop();
      runSpamLoop();
      return;
    }

    // Fast Group Name Change Loop
    if (lower.startsWith('!nc') || lower.startsWith('.nc')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].nc = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🔥 Group Name Change Loop Started for Target: ${haterName}!` });

      const runNcLoop = () => {
        if (!activeTasks[jid]?.nc) return;
        setTimeout(async () => {
          if (!activeTasks[jid]?.nc) return;
          try {
            const rawBlock = spamList[Math.floor(Math.random() * spamList.length)];
            const shortText = rawBlock.replace(/{target}/g, haterName).slice(0, 20);
            const newTitle = `🔥 ${haterName} ➔ ${shortText} 🩴⚡`;
            await waSock.groupUpdateSubject(jid, newTitle);
          } catch(e){}
          if (activeTasks[jid]?.nc) runNcLoop();
        }, 2000);
      };
      runNcLoop();
      return;
    }

    if (lower === '!stop' || lower === '.stop') {
      activeTasks[jid].spam = false;
      activeTasks[jid].nc = false;
      await waSock.sendMessage(jid, { text: `🛑 All Tasks Stopped in this Group Chat!` });
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

// ================= 3. TELEGRAM MULTI-BOT & FULL PANEL COMMAND STRUCTURE =================
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
• \`/addspam <text>\` - Add new global spam block
`);
  });

  bot.onText(/^\/wa_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📱 WHATSAPP COMMANDS (Multi-GC supported):
• \`!target <name>\` - Set target name for this specific group
• \`!spam <target>\` - Start Heavy Infinity Spam Flood
• \`!nc <target>\` - Group Name Change Loop with Target
• \`!speed <slow|normal|fast>\` - Set Speed
• \`!stop\` - Stop active tasks in this group
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
✈️ TELEGRAM COMMANDS:
• \`!spam <target>\` - Telegram High-Speed Spam (Use in TG group/DM)
• \`!stop\` - Stop Telegram tasks
• \`/tg_speed <slow|normal|fast>\` - Set TG Speed
`);
  });

  bot.onText(/^\/status$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `✅ Control bot ${name} online\n🕐 ${new Date().toISOString()}\n🚀 Loaded Heavy Blocks: ${spamList.length}\n⚡ Speeds -> WA: ${speedConfig.WA} | TG: ${speedConfig.TG} | IG: ${speedConfig.IG}`);
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

  bot.onText(/^\/spamlist$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `📦 Total Loaded Spam Blocks: ${spamList.length}`);
  });
}

createBot(TOKEN_1, "BOT_1");
createBot(TOKEN_2, "BOT_2");

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh Multi-Platform Bot is running smoothly!\n');
});

server.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});
    
