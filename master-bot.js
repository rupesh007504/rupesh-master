waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    
    const remoteJid = m.key.remoteJid; 
    
    // Universal text extractor for all WhatsApp message types
    const text = m.message.conversation || 
                 m.message.extendedTextMessage?.text || 
                 m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || '';
                 
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    if (!waActiveTasks[remoteJid]) {
      waActiveTasks[remoteJid] = { spam: false, nc: false, hater: 'TARGET' };
    }

    // Target Command
    if (lowerText.startsWith('!target') || lowerText.startsWith('.target')) {
      const parts = cleanText.split(' ');
      parts.shift();
      const newHater = parts.join(' ').trim();
      if (newHater) {
        waActiveTasks[remoteJid].hater = newHater;
        await waSock.sendMessage(remoteJid, { text: `🎯 Target Set: ${newHater}` });
      }
      return;
    }

    // Spam Command
    if (lowerText.startsWith('!spam') || lowerText.startsWith('.spam') || lowerText.startsWith('!spm') || lowerText.startsWith('.spm')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const inlineHater = parts.join(' ').trim();
        if (inlineHater) waActiveTasks[remoteJid].hater = inlineHater;
      }
      
      waActiveTasks[remoteJid].spam = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🚀 Spam Started for ${currentHater}!` });

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

    // Name Change Command
    if (lowerText.startsWith('!nc') || lowerText.startsWith('.nc')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        waActiveTasks[remoteJid].hater = parts.join(' ');
      }
      
      waActiveTasks[remoteJid].nc = true;
      const currentHater = waActiveTasks[remoteJid].hater;
      
      await waSock.sendMessage(remoteJid, { text: `🔥 WhatsApp Name Change Started for \`${currentHater}\`!` });

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

    // Stop Command
    if (lowerText === '!stop' || lowerText === '.stop') {
      waActiveTasks[remoteJid].spam = false;
      waActiveTasks[remoteJid].nc = false;
      await waSock.sendMessage(remoteJid, { text: `🛑 Stop Command Executed!` });
      return;
    }
  });
