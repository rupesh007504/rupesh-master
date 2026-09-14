const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');

// Cloud server zinda rakhne ke liye HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Rupesh WhatsApp Bot Running 24/7!\n');
});
server.listen(process.env.PORT || 3000);

let waSock = null;
let waActiveTasks = {}; 

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

async function startWA() {
  // Agar session me error aaye toh clean start ke liye auth folder manage karega
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  
  waSock = makeWASocket({ 
    logger: pino({ level: 'silent' }), 
    auth: state, 
    printQRInTerminal: false,
    // Device profile jo WhatsApp block nahi karega
    browser: ['Ubuntu', 'Edge', '110.0.1587.57'] 
  });
  
  waSock.ev.on('creds.update', saveCreds);
  
  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log('✅ WhatsApp Successfully Connected & Ready in Groups!');
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Connection closed. Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => startWA(), 3000);
      } else {
        console.log('❌ Logged out. Clearing auth session...');
        try { fs.rmSync('auth_baileys', { recursive: true, force: true }); } catch(e){}
        setTimeout(() => startWA(), 3000);
      }
    }
  });

  // Group aur Personal Chats dono ke liye Bulletproof Command Handler
  waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    
    const remoteJid = m.key.remoteJid; 
    
    // Sabhi message types (Group chat text, captions) ko read karne ke liye
    const text = m.message.conversation || 
                 m.message.extendedTextMessage?.text || 
                 m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || '';
                 
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();
    if (!cleanText) return;

    if (!waActiveTasks[remoteJid]) {
      waActiveTasks[remoteJid] = { spam: false, nc: false, hater: 'TARGET' };
    }

    // 1. Target Command (!target <naam>)
    if (/^(!target|\.target)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      parts.shift();
      const newHater = parts.join(' ').trim();
      if (newHater) {
        waActiveTasks[remoteJid].hater = newHater;
        await waSock.sendMessage(remoteJid, { text: `🎯 Target Set Successfully: ${newHater}` });
      }
      return;
    }

    // 2. Spam Command (!spam ya !spam <naam>)
    if (/^(!spam|\.spam|!spm|\.spm)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const inlineHater = parts.join(' ').trim();
        if (inlineHater) waActiveTasks[remoteJid].hater = inlineHater;
      }
      
      waActiveTasks[remoteJid].spam = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🚀 Spam Started in Group for ${currentHater}!` });

      const runSpam = () => {
        if (!waActiveTasks[remoteJid]?.spam) return;
        setImmediate(async () => {
          try {
            const randomGaali = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
            await waSock.sendMessage(remoteJid, { text: `🔥 [ ${currentHater} ] ➔ ${randomGaali}` });
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.spam) runSpam();
        });
      };
      runSpam();
      runSpam();
      return;
    }

    // 3. Name Change Command (!nc)
    if (/^(!nc|\.nc)/i.test(lowerText)) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        waActiveTasks[remoteJid].hater = parts.join(' ');
      }
      
      waActiveTasks[remoteJid].nc = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🔥 Group Name Change Started for \`${currentHater}\`!` });

      const waNcLoop = () => {
        if (!waActiveTasks[remoteJid]?.nc) return;
        setImmediate(async () => {
          try {
            const randomGaali = dynamicGaaliList[Math.floor(Math.random() * dynamicGaaliList.length)];
            const title = `🔥 ${waActiveTasks[remoteJid].hater} ➔ ${randomGaali.slice(0, 15)} ⚡`;
            await waSock.groupUpdateSubject(remoteJid, title);
          } catch (e) {}
          if (waActiveTasks[remoteJid]?.nc) waNcLoop();
        });
      };
      waNcLoop();
      return;
    }

    // 4. Stop Command (!stop)
    if (lowerText === '!stop' || lowerText === '.stop') {
      waActiveTasks[remoteJid].spam = false;
      waActiveTasks[remoteJid].nc = false;
      await waSock.sendMessage(remoteJid, { text: `🛑 All Tasks Stopped in this Group!` });
      return;
    }
  });
}

startWA();
