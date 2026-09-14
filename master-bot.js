const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const TelegramBot = require("node-telegram-bot-api");
const { IgApiClient } = require('instagram-private-api');
const pino = require("pino");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;

// Permanent admin IDs hardcoded
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

// All 6 Independent Spam Blocks Separately Added
let spamList = [
  // Block 1: Daddy Is Here style
  `🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭
🔥 [ {target} ] ➔ ⚡️🖤 𝐃𝐀𝐃𝐃𝐘 𝐈𝐬 𝐇ᴇʀᴇ 💫🎭`,

  // Block 2: Rupesh God Of Spam style
  `👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥
👑 [ {target} ] ➔ 🔥 𝐑𝐔𝐏𝐄𝐒𝐇 𝐆𝐎𝐃 𝐎𝐅 𝐒𝐏𝐀𝐌 👑🔥`,

  // Block 3: Madarchod chup chaap gaand mara le style
  `🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥
🩴 [ {target} ] ➔ 💥 Madarchod chup chaap gaand mara le 😈🔥`,

  // Block 4: New Added 1 (Roz Chhodta Hun)
  `💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥
💥😈 {target} 𝐾𝐼 𝑀𝐴𝐴 𝐾𝑂 𝑅𝑂𝑍 𝐶𝐻𝑂𝐷𝑇𝐴 𝐻𝑈𝑁 ⚡️🔥`,

  // Block 5: New Added 2 (Aukat Nahi Hai)
  `🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨
🌙𒈒 {target} 𝐾𝐼 𝐴𝑈𝐾𝐴𝑇 𝑁𝐴𝐻𝐼 𝐻𝐴𝐼 🤍✨`,

  // Block 6: New Added 3 (Bam Blast)
  `💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎
💎✨ {target} 𝐓ᴇʀɪ 𝐌ᴀᴀ ᴋɪ ᴄʜᴜᴛ ᴍᴇ ʙᴀᴍ ʙʟᴀsᴛ ✨💎`
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

    // Heavy Unstoppable Spam Loop
    if (lower.startsWith('!spam') || lower.startsWith('.spam')) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        parts.shift();
        const t = parts.join(' ').trim();
        if (t) activeTasks[jid].hater = t;
      }

      activeTasks[jid].spam = true;
      const haterName = activeTasks[jid].hater;
      await waSock.sendMessage(jid, { text: `🚀 RUPESH WA UNSTOPPABLE SPAM STARTED (${speedConfig.WA}) for Target: ${haterName}!` });

      const runSpamLoop = () => {
        if (!activeTasks[jid]?.spam) return;
        const delay = speedConfig.WA === 'slow' ? 2000 : (speedConfig.WA === 'normal' ? 500 : 20);
        
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
      runSpamLoop(); // Multi-thread wind speed
      return;
    }

    // Name Change Loop
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
            const newTitle = `🔥 ${haterName} ➔ RUPESH DADDY IS HERE 🩴⚡`;
            await waSock.groupUpdateSubject(jid, newTitle);
          } catch(e){}
          if (activeTasks[jid]?.nc) runNcLoop();
        }, 4000);
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

// ================= 3. TELEGRAM MULTI-BOT & COMMAND STRUCTURE =================
function createBot(token, name) {
  if (!token) return;

  const bot = new TelegramBot(token, { polling: true });
  bots.push(bot);

  bot.onText(/^\/start$/, msg => {
    if (!isAdmin(msg)) return;

    bot.sendMessage(msg.chat.id, `
🤖 RUPESH MULTI-PLATFORM PANEL (${name})

📱 WHATSAPP & GENERAL
/wa_login - Get WhatsApp Pairing Code
/wa_status - Check WA Connection
/status - System Health
/addspam <text> - Add new unmixed spam block
/spamlist - Total spam blocks count

📋 COMMAND HELP
/commands
`);
  });

  bot.onText(/^\/commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📱 MAIN COMMANDS LIST
• \`/wa_commands\` - WhatsApp guide
• \`/status\` - System check
• \`/spamlist\` - View loaded spam database
• \`/addspam <text>\` - Add global spam text
`);
  });

  bot.onText(/^\/wa_commands$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `
📱 WHATSAPP GC COMMANDS:
• \`!target <name>\` - Set target name for this group
• \`!spam <target>\` - Start Heavy Unstoppable Spam Flood
• \`!nc <target>\` - Group Name Change Loop with Target
• \`!speed <slow|normal|fast>\` - Set Speed
• \`!stop\` - Stop active tasks
`);
  });

  bot.onText(/^\/status$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `✅ Control bot ${name} online\n🕐 ${new Date().toISOString()}\n🚀 Loaded Spam Blocks: ${spamList.length}`);
  });

  bot.onText(/^\/spamlist$/, msg => {
    if (!isAdmin(msg)) return;
    bot.sendMessage(msg.chat.id, `📋 Total Independent Spam Blocks Loaded: ${spamList.length}`);
  });

  bot.on('message', async msg => {
    if (!isAdmin(msg)) return;
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim() : '';
    const lower = text.toLowerCase();

    if (userState[chatId] === 'WAITING_WA_NUM') {
      delete userState[chatId];
      bot.sendMessage(chatId, `⏳ Generating WhatsApp Pairing Code...`);
      setTimeout(async () => {
        try {
          const cleanNum = text.replace(/[^0-9]/g, '');
          const code = await waSock.requestPairingCode(cleanNum);
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
          bot.sendMessage(chatId, `✅ **WhatsApp Pairing Code:** \`${formattedCode}\``, { parse__mode: 'Markdown' });
        } catch (e) {
          bot.sendMessage(chatId, `❌ Code Error: ${e.message}`);
        }
      }, 3000);
      return;
    }

    if (lower.startsWith('/addspam')) {
      const newLine = text.replace(/\/addspam/i, '').trim();
      if (newLine) {
        spamList.push(newLine);
        bot.sendMessage(msg.chat.id, `✅ New Unmixed Spam Block Added! Total Blocks: ${spamList.length}`);
      }
      return;
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
