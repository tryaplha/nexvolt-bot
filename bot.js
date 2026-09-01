require('dotenv').config();
require('./setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { performance } = require('perf_hooks');
const os = require('os');
const { BOT_TOKEN } = require('./nexstore/token');
const { sleep } = require('./nexstore/utils');
const { autoLoadPairs } = require('./autoload');

// ==================== SYSTEM CONFIGURATION ====================
const SYSTEM = {
  name: "Nexvolt Md",
  shortName: "Nexvolt Md",
  creator: "NEXVOLT DEV",
  version: "1.0.0",
  environment: process.env.NODE_ENV || "production",
  sessionLimit: 100,
  codeExpiry: 300000, // 5 minutes
  broadcastDelay: 100,
  maxLogs: 1000
};

// Owner Configuration
const OWNERS = {
  primary: 6598118857,
  secondary: 6598118857,
  dev: 6598118857,
  all: [6598118857, 6598118857]
};

// Developer Contact Information
const DEVELOPER_CONTACTS = {
  telegram: 'https://t.me/teamG_tech*',
  whatsapp: 'https://whatsapp.com/channel/0029VbDhZnFC1FuDv6iKbp0i',
  email: '',
  support: '@teamG_tech'
};

// File System Structure
const PATHS = {
  base: path.join(__dirname, 'axis_storage'),
  admin: path.join(__dirname, 'axis_storage', 'admin.json'),
  users: path.join(__dirname, 'axis_storage', 'users.json'),
  userDetails: path.join(__dirname, 'axis_storage', 'userdetails.json'),
  stats: path.join(__dirname, 'axis_storage', 'stats.json'),
  banned: path.join(__dirname, 'axis_storage', 'banned.json'),
  reports: path.join(__dirname, 'axis_storage', 'reports.json'),
  sessions: path.join(__dirname, 'axis_storage', 'sessions'),
  audit: path.join(__dirname, 'axis_storage', 'audit.json'),
  maintenance: path.join(__dirname, 'axis_storage', 'maintenance.json'),
  backups: path.join(__dirname, 'axis_storage', 'backups'),
  premium: path.join(__dirname, 'axis_storage', 'premium.json'),
  trials: path.join(__dirname, 'axis_storage', 'trials.json'),
verified: path.join(__dirname, 'axis_storage', 'verified.json')
};

// Media Assets
const ASSETS = {
  menuImages: [
    'https://tmpfiles.org/dl/wow6sAI1DHEI/nexvolt_logo.jpg'
  ]
};

// Channel Requirements (Kept for reference but verification is bypassed)
const REQUIRED_CHANNELS = [
  { id: -1003976924762, name: 'MAIN CHANNEL', link: 'https://t.me/teamG_tech' },
  { id: -1003904340215, name: 'GROUP', link: 'https://t.me/cybertech_world' },
  { id: -1003561280313, name: 'SUPPORT CHANNEL', link: 'https://t.me/NexvoltMDPairing' },
];

// Social Links
const SOCIAL = {
  whatsapp: 'https://whatsapp.com/channel/0029VbDhZnFC1FuDv6iKbp0i',
  telegram: {
    primary: 'https://t.me/teamG_tech',
    group: 'https://t.me/cybertech_world'
  },
  developer: 'https://t.me/teamG_tech'
};

// Rate Limiting
const RATE_LIMIT = {
  window: 60000, // 1 minute
  max: 15 // requests per minute
};

// ==================== INITIALIZATION ====================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Data Stores
let database = {
  admins: [...OWNERS.all.map(id => id.toString())],
  users: new Set(),
  userDetails: {},
  banned: {},
  stats: {
    startTime: Date.now(),
    totalConnections: 0,
    dailyConnections: 0,
    totalUsers: 0,
    totalMessages: 0,
    groupMessages: 0,
    privateMessages: 0,
    failures: 0,
    pairingSpeed: [],
    lastReset: new Date().toDateString()
  },
  reports: [],
  audit: [],
  activeSessions: new Map(),
  maintenance: false,
  premium: {},
  trialMode: {
    active: false,
    expiry: null,
    startedBy: null,
    startedAt: null
  },
verifiedUsers: new Set()
};

// Rate Limit Store
const rateLimit = new Map();

// ==================== UTILITY FUNCTIONS ====================

const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}ᴅ`);
  if (hours > 0) parts.push(`${hours}ʜ`);
  if (minutes > 0) parts.push(`${minutes}ᴍ`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

const parseDuration = (durationStr) => {
  const match = durationStr.match(/^(\d+)\s*(second|minute|hour|day|week|month)s?$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  };
  
  return value * (multipliers[unit] || multipliers.day);
};

const formatDuration = (ms) => {
  if (ms < 0) return 'Expired';
  
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  
  return parts.join(', ') || 'Less than a minute';
};

const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'ᴍᴏʀɴɪɴɢ', emoji: '🌅' };
  if (hour < 17) return { text: 'ᴀғᴛᴇʀɴᴏᴏɴ', emoji: '☀️' };
  if (hour < 20) return { text: 'ᴇᴠᴇɴɪɴɢ', emoji: '🌆' };
  return { text: 'ɴɪɢʜᴛ', emoji: '🌙' };
};

const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[<>[\]{}()\\;'"`]/g, '').substring(0, 500);
};

const validatePhone = (number) => {
  if (!number || number.trim() === '') {
    return { valid: false, error: 'ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ' };
  }
  
  if (/[a-z]/i.test(number)) {
    return { valid: false, error: 'ʟᴇᴛᴛᴇʀs ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ' };
  }
  
  if (!/^\d{7,15}$/.test(number.split('|')[0])) {
    return { valid: false, error: 'ɪɴᴠᴀʟɪᴅ ғᴏʀᴍᴀᴛ' };
  }
  
  if (number.startsWith('0')) {
    return { valid: false, error: 'ɴᴏ ʟᴇᴀᴅɪɴɢ ᴢᴇʀᴏ' };
  }
  
  const restricted = ['252', '201', '202'];
  if (restricted.includes(number.slice(0, 3))) {
    return { valid: false, error: 'ᴄᴏᴜɴᴛʀʏ ɴᴏᴛ sᴜᴘᴘᴏʀᴛᴇᴅ' };
  }
  
  return { valid: true };
};

const checkRateLimit = (userId) => {
  const now = Date.now();
  const userLimit = rateLimit.get(userId) || { count: 0, reset: now + RATE_LIMIT.window };
  
  if (now > userLimit.reset) {
    userLimit.count = 0;
    userLimit.reset = now + RATE_LIMIT.window;
  }
  
  if (userLimit.count >= RATE_LIMIT.max) return false;
  
  userLimit.count++;
  rateLimit.set(userId, userLimit);
  return true;
};

const isOwner = (userId) => OWNERS.all.includes(Number(userId));
const isAdmin = (userId) => database.admins.includes(userId.toString());

const isPremium = (userId) => {
  const userIdStr = userId.toString();
  const premiumData = database.premium[userIdStr];
  
  if (!premiumData) return false;
  
  if (premiumData.expiry < Date.now()) {
    delete database.premium[userIdStr];
    saveData();
    return false;
  }
  
  return true;
};

const isTrialActive = () => {
  if (!database.trialMode.active) return false;
  if (database.trialMode.expiry && database.trialMode.expiry < Date.now()) {
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    saveData();
    return false;
  }
  return true;
};

const hasAccess = (userId) => {
  return isAdmin(userId.toString()) || 
         isOwner(userId) || 
         isPremium(userId) || 
         isTrialActive();
};

const sendAccessDenied = async (chatId) => {
  const message = `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆
│
├◆ ⚠️ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ
├◆
├◆ 📞 ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ ғᴏʀ ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇss:
├◆
├◆ 👤 ᴅᴇᴠᴇʟᴏᴘᴇʀ: @nexvoltdev
├◆ 📱 ᴛᴇʟᴇɢʀᴀᴍ: ${DEVELOPER_CONTACTS.telegram}
├◆ 💬 ᴡʜᴀᴛsᴀᴘᴘ: ${DEVELOPER_CONTACTS.whatsapp}
│
└ ❏`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

// ==================== FILE OPERATIONS ====================

const ensureDirectories = async () => {
  const dirs = [
    PATHS.base,
    PATHS.sessions,
    PATHS.backups,
    path.join(__dirname, 'nexstore', 'pairing'),
    path.join(__dirname, 'allfunc')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`ᴅɪʀᴇᴄᴛᴏʀʏ ᴇʀʀᴏʀ: ${dir}`, err.message);
    }
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadDatabase = async () => {
  // Load admins
  if (await fileExists(PATHS.admin)) {
    try {
      const data = await fs.readFile(PATHS.admin, 'utf8');
      database.admins = [...new Set([...OWNERS.all.map(id => id.toString()), ...JSON.parse(data)])];
    } catch (err) {
      console.error('ᴀᴅᴍɪɴ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  } else {
    await fs.writeFile(PATHS.admin, JSON.stringify(database.admins, null, 2));
  }

  // Load users
  if (await fileExists(PATHS.users)) {
    try {
      const data = await fs.readFile(PATHS.users, 'utf8');
      database.users = new Set(JSON.parse(data));
      database.stats.totalUsers = database.users.size;
    } catch (err) {
      console.error('ᴜsᴇʀs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load user details
  if (await fileExists(PATHS.userDetails)) {
    try {
      database.userDetails = JSON.parse(await fs.readFile(PATHS.userDetails, 'utf8'));
    } catch (err) {
      console.error('ᴜsᴇʀ ᴅᴇᴛᴀɪʟs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load banned
  if (await fileExists(PATHS.banned)) {
    try {
      database.banned = JSON.parse(await fs.readFile(PATHS.banned, 'utf8'));
    } catch (err) {
      console.error('ʙᴀɴɴᴇᴅ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load stats
  if (await fileExists(PATHS.stats)) {
    try {
      database.stats = JSON.parse(await fs.readFile(PATHS.stats, 'utf8'));
      const today = new Date().toDateString();
      if (database.stats.lastReset !== today) {
        database.stats.dailyConnections = 0;
        database.stats.lastReset = today;
      }
    } catch (err) {
      console.error('sᴛᴀᴛs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load maintenance
  if (await fileExists(PATHS.maintenance)) {
    try {
      database.maintenance = JSON.parse(await fs.readFile(PATHS.maintenance, 'utf8')).enabled || false;
    } catch (err) {
      console.error('ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load reports
  if (await fileExists(PATHS.reports)) {
    try {
      database.reports = JSON.parse(await fs.readFile(PATHS.reports, 'utf8'));
    } catch (err) {
      console.error('ʀᴇᴘᴏʀᴛs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load audit
  if (await fileExists(PATHS.audit)) {
    try {
      database.audit = JSON.parse(await fs.readFile(PATHS.audit, 'utf8'));
    } catch (err) {
      console.error('ᴀᴜᴅɪᴛ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load premium data
  if (await fileExists(PATHS.premium)) {
    try {
      database.premium = JSON.parse(await fs.readFile(PATHS.premium, 'utf8'));
    } catch (err) {
      console.error('ᴘʀᴇᴍɪᴜᴍ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
      database.premium = {};
    }
  } else {
    await fs.writeFile(PATHS.premium, JSON.stringify(database.premium, null, 2));
  }

  // Load trial data
  if (await fileExists(PATHS.trials)) {
    try {
      database.trialMode = JSON.parse(await fs.readFile(PATHS.trials, 'utf8'));
    } catch (err) {
      console.error('ᴛʀɪᴀʟ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
      database.trialMode = { active: false, expiry: null, startedBy: null, startedAt: null };
    }
  } else {
    await fs.writeFile(PATHS.trials, JSON.stringify(database.trialMode, null, 2));
  }

// Load verified users
if (await fileExists(PATHS.verified)) {
  try {
    const data = await fs.readFile(PATHS.verified, 'utf8');
    database.verifiedUsers = new Set(JSON.parse(data));
  } catch (err) {
    console.error('Verified users load error:', err.message);
  }
} else {
  await fs.writeFile(PATHS.verified, JSON.stringify([...database.verifiedUsers], null, 2));
}
};



const saveData = async () => {
  try {
    await Promise.all([
      fs.writeFile(PATHS.admin, JSON.stringify(database.admins, null, 2)),
      fs.writeFile(PATHS.users, JSON.stringify([...database.users], null, 2)),
      fs.writeFile(PATHS.userDetails, JSON.stringify(database.userDetails, null, 2)),
      fs.writeFile(PATHS.banned, JSON.stringify(database.banned, null, 2)),
      fs.writeFile(PATHS.stats, JSON.stringify(database.stats, null, 2)),
      fs.writeFile(PATHS.maintenance, JSON.stringify({ enabled: database.maintenance }, null, 2)),
      fs.writeFile(PATHS.reports, JSON.stringify(database.reports, null, 2)),
      fs.writeFile(PATHS.audit, JSON.stringify(database.audit.slice(-SYSTEM.maxLogs), null, 2)),
      fs.writeFile(PATHS.premium, JSON.stringify(database.premium, null, 2)),
      fs.writeFile(PATHS.trials, JSON.stringify(database.trialMode, null, 2)),
      fs.writeFile(PATHS.verified, JSON.stringify([...database.verifiedUsers], null, 2))
    ]);
  } catch (err) {
    console.error('sᴀᴠᴇ ᴇʀʀᴏʀ:', err.message);
  }
};

// ==================== USER TRACKING ====================

const trackUser = async (userId, userName = 'ᴜsᴇʀ', isGroup = false) => {
  const userIdStr = userId.toString();
  
  if (!database.users.has(userIdStr)) {
    database.users.add(userIdStr);
    database.stats.totalUsers = database.users.size;
    
    database.userDetails[userIdStr] = {
      name: userName,
      joined: new Date().toISOString(),
      messages: 1,
      lastActive: new Date().toISOString(),
      pairs: 0,
      groupMessages: isGroup ? 1 : 0,
      privateMessages: isGroup ? 0 : 1,
      premium: isPremium(userIdStr)
    };
    
    console.log(chalk.green(`➕ ɴᴇᴡ ᴜsᴇʀ: ${userName} (${userIdStr})`));
  } else {
    if (database.userDetails[userIdStr]) {
      database.userDetails[userIdStr].messages++;
      database.userDetails[userIdStr].lastActive = new Date().toISOString();
      if (isGroup) {
        database.userDetails[userIdStr].groupMessages++;
      } else {
        database.userDetails[userIdStr].privateMessages++;
      }
      database.userDetails[userIdStr].premium = isPremium(userIdStr);
    }
  }
  
  database.stats.totalMessages++;
  if (isGroup) database.stats.groupMessages++;
  else database.stats.privateMessages++;
  
  await saveData();
};

// ==================== BAN CHECK ====================

const checkBanned = async (userId, chatId = null) => {
  const userIdStr = userId.toString();
  
  if (database.banned[userIdStr]) {
    if (chatId) {
      await bot.sendMessage(chatId, 
        `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ʙᴀɴɴᴇᴅ\n├◆ ʀᴇᴀsᴏɴ: ${database.banned[userIdStr].reason || 'ᴠɪᴏʟᴀᴛɪᴏɴ ᴏғ ᴛᴇʀᴍs'}\n│\n└ ❏`,
        { parse_mode: 'Markdown' }
      );
    }
    return true;
  }
  return false;
};

// ==================== MEMBERSHIP VERIFICATION ====================

const verifyMembership = async (userId) => {
  // Channel verification bypassed — all users allowed
  return { verified: true, missing: [] };
};

// ==================== SESSION MANAGEMENT ====================

const getSessions = async () => {
  try {
    const entries = await fs.readdir(PATHS.sessions, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && entry.name.includes('@s.whatsapp.net'))
      .map(entry => entry.name);
  } catch {
    return [];
  }
};

const getSessionDetails = async () => {
  try {
    const entries = await fs.readdir(PATHS.sessions, { withFileTypes: true });
    const sessions = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.includes('@s.whatsapp.net')) continue;
      
      const sessionPath = path.join(PATHS.sessions, entry.name);
      const credsPath = path.join(sessionPath, 'creds.json');
      
      let status = 'ɪɴᴀᴄᴛɪᴠᴇ';
      let name = 'ᴜɴᴋɴᴏᴡɴ';
      let lastActive = null;
      
      if (await fileExists(credsPath)) {
        try {
          const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
          if (creds.me && creds.me.id) {
            status = 'ᴀᴄᴛɪᴠᴇ ✅';
            name = creds.me.name || 'ᴜɴᴋɴᴏᴡɴ';
            lastActive = creds.lastActive || null;
          } else {
            status = 'ᴄᴏʀʀᴜᴘᴛᴇᴅ ❌';
          }
        } catch (e) {
          status = 'ᴄᴏʀʀᴜᴘᴛᴇᴅ ❌';
        }
      } else {
        status = 'ɪɴᴄᴏᴍᴘʟᴇᴛᴇ ⚠️';
      }
      
      sessions.push({
        jid: entry.name,
        number: entry.name.split('@')[0],
        name,
        status,
        lastActive,
        path: sessionPath
      });
    }
    
    return sessions;
  } catch (error) {
    console.error('sᴇssɪᴏɴ ᴅᴇᴛᴀɪʟs ᴇʀʀᴏʀ:', error.message);
    return [];
  }
};

const deleteSession = async (phone) => {
  const sessionPath = path.join(PATHS.sessions, `${phone}@s.whatsapp.net`);
  try {
    if (await fileExists(sessionPath)) {
      await fs.rm(sessionPath, { recursive: true, force: true });
      return true;
    }
  } catch (err) {
    console.error('sᴇssɪᴏɴ ᴅᴇʟᴇᴛɪᴏɴ ᴇʀʀᴏʀ:', err.message);
  }
  return false;
};

// ==================== AUDIT LOGGING ====================

const addAuditLog = (action, userId, target = null, details = {}) => {
  database.audit.push({
    timestamp: new Date().toISOString(),
    action,
    userId,
    target,
    details
  });
  
  if (database.audit.length > SYSTEM.maxLogs) {
    database.audit = database.audit.slice(-SYSTEM.maxLogs);
  }
  
  saveData();
};

// ==================== GROUP MESSAGE HANDLER ====================

const handleGroupMessage = async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const mention = msg.from.username ? `@${msg.from.username}` : `[${msg.from.first_name}](tg://user?id=${userId})`;
  
  await bot.sendMessage(chatId, 
    `${mention} ┌ ❏ ◆ *⌜𝗗𝗠 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗⌟* ◆\n│\n├◆ ᴘʟᴇᴀsᴇ ᴜsᴇ ᴍᴇ ɪɴ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ\n├◆ ғᴏʀ ғᴜʟʟ ғᴜɴᴄᴛɪᴏɴᴀʟɪᴛʏ\n│\n└ ❏`,
    {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 ᴄʜᴀᴛ ᴘʀɪᴠᴀᴛᴇʟʏ', url: `https://t.me/${(await bot.getMe()).username}` }]
        ]
      }
    }
  );
};

const sendMembershipRequired = async (chatId, verification, userName) => {
  let missingChannelsText = '';
  const inlineButtons = [];
  
  for (const channel of verification.missing) {
    missingChannelsText += `├◇ 🔗 ${channel.name}: ${channel.link}\n`;
    inlineButtons.push([{ text: `📢 Join ${channel.name}`, url: channel.link }]);
  }
  
  inlineButtons.push([{ text: '✅ Approve Access', callback_data: 'verify_membership' }]);
  
  await bot.sendMessage(chatId,
    `┌ ❏ ◇ *⌜VERIFICATION REQUIRED⌟* ◇
├◇ Hello ${userName}!
├◇ You must join the following channels to use the bot:
├◇
${missingChannelsText}├◇
├◇ After joining, click 'Approve' below
└ ❏`,
    {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: inlineButtons
      }
    }
  );
};

// ==================== MAIN MENU FUNCTION ====================

const sendMainMenu = async (chatId, userId, userName, isAdminUser = false, isOwnerUser = false) => {
  const greeting = getGreeting();
  const uptime = formatUptime(Date.now() - database.stats.startTime);
  const sessions = await getSessions();
  const userPremium = isPremium(userId);
  const trialActive = isTrialActive();

  let caption = `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨⌟* ◆
│
├◆ ${greeting.emoji} ɢᴏᴏᴅ ${greeting.text}, ${userName}
├◆ ᴇɴᴛᴇʀᴘʀɪsᴇ ᴡʜᴀᴛsᴀᴘᴘ ᴘᴀɪʀɪɴɢ sʏsᴛᴇᴍ
├◆ sᴇᴄᴜʀᴇ • ғᴀsᴛ • ʀᴇʟɪᴀʙʟᴇ
│
└ ❏
┌ ❏ ◆ *⌜𝗦𝗬𝗦𝗧𝗘𝗠 𝗜𝗡𝗙𝗢⌟* ◆
│
├◆ ᴜᴘᴛɪᴍᴇ: ${uptime}
├◆ ᴜsᴇʀs: ${formatNumber(database.stats.totalUsers)}
├◆ sᴇssɪᴏɴs: ${sessions.length}/${SYSTEM.sessionLimit}
├◆ ᴛᴏᴅᴀʏ: ${formatNumber(database.stats.dailyConnections)}
│`;

  if (!isAdminUser && !isOwnerUser) {
    if (userPremium) {
      const expiry = new Date(database.premium[userId.toString()].expiry);
      caption += `\n├◆ 👑 ᴘʀᴇᴍɪᴜᴍ: ᴀᴄᴛɪᴠᴇ (ᴇxᴘɪʀᴇs: ${expiry.toLocaleDateString()})`;
    } else if (trialActive) {
      const trialExpiry = new Date(database.trialMode.expiry);
      caption += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry.toLocaleDateString()})`;
    }
  }

  caption += `
│
└ ❏
┌ ❏ ◆ *⌜𝗤𝗨𝗜𝗖𝗞 𝗔𝗖𝗧𝗜𝗢𝗡𝗦⌟* ◆
│
├◆ /pair    - ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
├◆ /unpair  - ʀᴇᴍᴏᴠᴇ sᴇssɪᴏɴ
├◆ /ping    - ʟᴀᴛᴇɴᴄʏ ᴄʜᴇᴄᴋ
├◆ /runtime - sʏsᴛᴇᴍ ᴜᴘᴛɪᴍᴇ
├◆ /stats   - ʙᴏᴛ sᴛᴀᴛɪsᴛɪᴄs
├◆ /report  - ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ
│
└ ❏`;

  if (isAdminUser) {
    caption += `
┌ ❏ ◆ *⌜𝗔𝗗𝗠𝗜𝗡 𝗖𝗢𝗡𝗧𝗥𝗢𝗟⌟* ◆
│
├◆ /users      - ᴜsᴇʀ ʀᴇɢɪsᴛʀʏ
├◆ /listpair   - ᴀᴄᴛɪᴠᴇ sᴇssɪᴏɴs
├◆ /broadcast  - sʏsᴛᴇᴍ ᴀʟᴇʀᴛ
├◆ /clean      - ᴘᴜʀɢᴇ ɪɴᴠᴀʟɪᴅ sᴇssɪᴏɴs
├◆ /ban        - ʀᴇsᴛʀɪᴄᴛ ᴜsᴇʀ
├◆ /unban      - ʀᴇsᴛᴏʀᴇ ᴀᴄᴄᴇss
├◆ /checkuser  - ᴜsᴇʀ ᴀᴜᴅɪᴛ
├◆ /maintenance  - ᴛᴏɢɢʟᴇ ᴍᴏᴅᴇ
├◆ /logs       - ᴠɪᴇᴡ ᴀᴜᴅɪᴛ ʟᴏɢs
├◆ /announce   - sᴄʜᴇᴅᴜʟᴇᴅ
│
└ ❏`;
  }

  if (isOwnerUser) {
    caption += `
┌ ❏ ◆ *⌜𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦⌟* ◆
│
├◆ /addadmin    - ᴀᴅᴅ ɴᴇᴡ ᴀᴅᴍɪɴ
├◆ /removeadmin - ʀᴇᴍᴏᴠᴇ ᴀᴅᴍɪɴ
├◆ /restart     - ʀᴇsᴛᴀʀᴛ ʙᴏᴛ
│
└ ❏`;
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📢 ᴄʜᴀɴɴᴇʟ', url: SOCIAL.telegram.primary },
        { text: '👥 ɢʀᴏᴜᴘ', url: SOCIAL.telegram.group }
      ]
    ]
  };

  try {
    await bot.sendPhoto(
      chatId,
      ASSETS.menuImages[Math.floor(Math.random() * ASSETS.menuImages.length)],
      {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } catch (error) {
    await bot.sendMessage(chatId, caption, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

// ==================== COMMAND: START ====================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'ᴜsᴇʀ';
  const isGroup = msg.chat.type !== 'private';

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;
  await trackUser(userId, userName, isGroup);

  if (isGroup) {
    return handleGroupMessage(msg);
  }

  //  Channel membership check
  // Check verification
if (!isAdmin(userId.toString()) && !isOwner(userId) && !database.verifiedUsers.has(userId.toString())) {
  const verification = await verifyMembership(userId);
  if (!verification.verified) {
    return sendMembershipRequired(chatId, verification, userName);
  }
  // User is already in all channels, add to verified set
  database.verifiedUsers.add(userId.toString());
  await saveData();
}


  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    const verification = await verifyMembership(userId);
    if (!verification.verified) {
      return sendMembershipRequired(chatId, verification, userName);
    }
  }

  await sendMainMenu(chatId, userId, userName, isAdmin(userId.toString()), isOwner(userId));
});

// ==================== COMMAND: MENU ====================

bot.onText(/\/menu(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'ᴜsᴇʀ';
  const isGroup = msg.chat.type !== 'private';

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;
  await trackUser(userId, userName, isGroup);

  if (isGroup) {
    return handleGroupMessage(msg);
  }

  await sendMainMenu(chatId, userId, userName, isAdmin(userId.toString()), isOwner(userId));
});

// ==================== COMMAND: PAIR ====================

bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;
  const isGroup = msg.chat.type !== 'private';

  // Maintenance check
  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆
│
├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ
├◆ ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (isGroup) {
    return handleGroupMessage(msg);
  }

  // Channel membership check for non-admin users
  

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
  if (!database.verifiedUsers.has(userId.toString())) {
    const verification = await verifyMembership(userId);
    if (!verification.verified) {
      return sendMembershipRequired(chatId, verification, msg.from.first_name);
    }
    database.verifiedUsers.add(userId.toString());
    await saveData();
  }
}

  if (!input) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗣𝗔𝗜𝗥 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /pair 923078071982
├◆ ᴏʀ: /pair 923078071982|1234
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const validation = validatePhone(input);
  if (!validation.valid) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗜𝗡𝗣𝗨𝗧⌟* ◆
│
├◆ ${validation.error}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const [number, customCode] = input.split('|');
  const cleanNumber = number.replace(/[^0-9]/g, '');

  const sessions = await getSessions();
  if (sessions.length >= SYSTEM.sessionLimit) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗟𝗜𝗠𝗜𝗧 𝗥𝗘𝗔𝗖𝗛𝗘𝗗⌟* ◆
│
├◆ ᴍᴀxɪᴍᴜᴍ sᴇssɪᴏɴs ʀᴇᴀᴄʜᴇᴅ
├◆ ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (sessions.includes(`${cleanNumber}@s.whatsapp.net`)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗫𝗜𝗦𝗧𝗦⌟* ◆
│
├◆ sᴇssɪᴏɴ ᴀʟʀᴇᴀᴅʏ ᴇxɪsᴛs
├◆ ᴜsᴇ /unpair ${cleanNumber}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (database.activeSessions.has(cleanNumber)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦⌟* ◆
│
├◆ ᴘᴀɪʀɪɴɢ ᴀʟʀᴇᴀᴅʏ ɪɴ ᴘʀᴏɢʀᴇss
├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const processingMsg = await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗜𝗡 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦⌟* ◆
│
├◆ ⠋ ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ᴡʜᴀᴛsᴀᴘᴘ
├◆ ɴᴜᴍʙᴇʀ: +${cleanNumber}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  database.activeSessions.set(cleanNumber, {
    chatId,
    userId,
    startTime: Date.now(),
    messageId: processingMsg.message_id
  });

  const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const loadingInterval = setInterval(async () => {
    try {
      await bot.editMessageText(
        `┌ ❏ ◆ *⌜𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗜𝗡 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦⌟* ◆
│
├◆ ${dots[i]} ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ᴡʜᴀᴛsᴀᴘᴘ
├◆ ɴᴜᴍʙᴇʀ: +${cleanNumber}
│
└ ❏`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
      i = (i + 1) % dots.length;
    } catch (e) {}
  }, 300);

  try {
    const pairModule = require('./pair');
    const jid = cleanNumber + '@s.whatsapp.net';
    await pairModule(jid);
    await sleep(4000);
    
    clearInterval(loadingInterval);

    const pairingFile = path.join(__dirname, 'nexstore', 'pairing', 'pairing.json');
    
    if (!await fileExists(pairingFile)) {
      throw new Error('ᴘᴀɪʀɪɴɢ.json ɴᴏᴛ ғᴏᴜɴᴅ');
    }
    
    const cu = await fs.readFile(pairingFile, 'utf-8');
    const cuObj = JSON.parse(cu);
    const code = customCode || cuObj.code;

    delete require.cache[require.resolve('./pair')];

    // Save to owner.json
    const ownerPath = path.join(__dirname, 'allfunc', 'owner.json');
    let ownerData = [];

    try {
      const ownerFile = await fs.readFile(ownerPath, 'utf-8');
      ownerData = JSON.parse(ownerFile);
    } catch (err) {
      console.log("⚠️ ᴄʀᴇᴀᴛɪɴɢ ɴᴇᴡ ᴏᴡɴᴇʀ.ᴊsᴏɴ");
      ownerData = [];
    }

    const senderNumber = cleanNumber;
    const whatsappFormat = senderNumber + "@s.whatsapp.net";
    const lidFormat = senderNumber + "@lid";

    let updated = false;
    if (!ownerData.includes(whatsappFormat)) {
      ownerData.push(whatsappFormat);
      updated = true;
    }
    if (!ownerData.includes(lidFormat)) {
      ownerData.push(lidFormat);
      updated = true;
    }

    if (updated) {
      await fs.writeFile(ownerPath, JSON.stringify(ownerData, null, 2));
    }

    database.stats.totalConnections++;
    database.stats.dailyConnections++;
    database.stats.pairingSpeed.push(Date.now() - database.activeSessions.get(cleanNumber).startTime);
    if (database.stats.pairingSpeed.length > 100) database.stats.pairingSpeed.shift();
    
    if (database.userDetails[userId]) {
      database.userDetails[userId].pairs++;
    }
    
    await saveData();

    // Enhanced pairing code message with one-click copy
    await bot.editMessageText(
      `✅ *PAIRING CODE READY!*

📱 *Number:* +${cleanNumber}
🔐 *Code:* \`${code}\`

*How to use:*
1️⃣ Open WhatsApp → Settings
2️⃣ Tap "Linked Devices"
3️⃣ Select "Link a Device"
4️⃣ Enter this code

⏰ *Code expires in 5 minutes*

⚡ *Click the button below to copy the code instantly!*`,
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 ONE-CLICK COPY CODE 📋', callback_data: `copy_code_${code}` }],
            [
              { text: '🏠 MAIN MENU', callback_data: 'show_main' }
            ]
          ]
        }
      }
    );

    addAuditLog('ᴘᴀɪʀ', userId, cleanNumber);
    setTimeout(() => database.activeSessions.delete(cleanNumber), SYSTEM.codeExpiry);

  } catch (error) {
    clearInterval(loadingInterval);
    database.activeSessions.delete(cleanNumber);
    database.stats.failures++;
    await saveData();

    await bot.editMessageText(
      `┌ ❏ ◆ *⌜𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗙𝗔𝗜𝗟𝗘𝗗⌟* ◆
│
├◆ ${error.message}
├◆ ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ
│
└ ❏`,
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 ʀᴇᴘᴏʀᴛ', callback_data: 'show_report' }]
          ]
        }
      }
    );
  }
});

// ==================== COMMAND: UNPAIR ====================

bot.onText(/\/unpair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆
│
├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗨𝗡𝗣𝗔𝗜𝗥 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /unpair 923078071982
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const validation = validatePhone(input);
  if (!validation.valid) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗜𝗡𝗣𝗨𝗧⌟* ◆
│
├◆ ${validation.error}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const cleanNumber = input.split('|')[0].replace(/[^0-9]/g, '');

  if (await deleteSession(cleanNumber)) {
    database.activeSessions.delete(cleanNumber);
    addAuditLog('ᴜɴᴘᴀɪʀ', userId, cleanNumber);
    
    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗥𝗘𝗠𝗢𝗩𝗘𝗗⌟* ◆
│
├◆ ɴᴜᴍʙᴇʀ: +${cleanNumber}
├◆ sᴛᴀᴛᴜs: sᴜᴄᴄᴇssғᴜʟ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  } else {
    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗡𝗢?? 𝗙𝗢𝗨𝗡𝗗⌟* ◆
│
├◆ ɴᴏ sᴇssɪᴏɴ ғᴏᴜɴᴅ ғᴏʀ +${cleanNumber}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ==================== PREMIUM COMMANDS ====================

bot.onText(/\/addprem(?:\s+(\d+)\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;
  const durationStr = match ? match[2] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!targetId || !durationStr) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗔𝗗𝗗 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /addprem <ᴜsᴇʀ_ɪᴅ> <ᴅᴜʀᴀᴛɪᴏɴ>
├◆
├◆ ᴇxᴀᴍᴘʟᴇs:
├◆ /addprem 123456789 3 days
├◆ /addprem 123456789 1 week
├◆ /addprem 123456789 24 hours
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗗𝗨𝗥𝗔𝗧𝗜𝗢𝗡⌟* ◆
│
├◆ ᴜsᴇ ғᴏʀᴍᴀᴛs ʟɪᴋᴇ: 3 days, 1 week, 24 hours
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const expiry = Date.now() + durationMs;
  
  database.premium[targetId] = {
    expiry: expiry,
    addedBy: userId.toString(),
    addedAt: Date.now()
  };

  await saveData();

  await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗔𝗗𝗗𝗘𝗗⌟* ◆
│
├◆ 👤 ᴜsᴇʀ ɪᴅ: ${targetId}
├◆ ⏱️ ᴅᴜʀᴀᴛɪᴏɴ: ${durationStr}
├◆ 📅 ᴇxᴘɪʀʏ: ${new Date(expiry).toLocaleString()}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  try {
    await bot.sendMessage(targetId,
      `┌ ❏ ◆ *⌜𝗖𝗢𝗡𝗚𝗥𝗔𝗧𝗨𝗟𝗔𝗧𝗜𝗢𝗡𝗦! 🎉⌟* ◆
│
├◆ ʏᴏᴜ ᴀʀᴇ ɴᴏᴡ ᴀ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ
├◆
├◆ 👑 ᴀᴄᴄᴇss: ᴜɴʟɪᴍɪᴛᴇᴅ
├◆ ⏱️ ᴅᴜʀᴀᴛɪᴏɴ: ${durationStr}
├◆ 📅 ᴇxᴘɪʀʏ: ${new Date(expiry).toLocaleString()}
│
└ ❏
┌ ❏ ◆ *⌜𝗧𝗛𝗔𝗡𝗞 𝗬𝗢𝗨⌟* ◆
│
├◆ ᴇɴᴊᴏʏ ᴘʀᴇᴍɪᴜᴍ ғᴇᴀᴛᴜʀᴇs!
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {}

  addAuditLog('ᴀᴅᴅᴘʀᴇᴍ', userId, targetId, { duration: durationStr, expiry });
});

bot.onText(/\/delprem(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗗𝗘𝗟 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /delprem <ᴜsᴇʀ_ɪᴅ>
├◆
├◆ ᴇxᴀᴍᴘʟᴇ: /delprem 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!database.premium[targetId]) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗡𝗢𝗧 𝗙𝗢𝗨𝗡𝗗⌟* ◆
│
├◆ ᴜsᴇʀ ɪs ɴᴏᴛ ᴀ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  delete database.premium[targetId];
  await saveData();

  await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗥𝗘𝗠𝗢𝗩𝗘𝗗⌟* ◆
│
├◆ 👤 ᴜsᴇʀ ɪᴅ: ${targetId}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  try {
    await bot.sendMessage(targetId,
      `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗘𝗫𝗣𝗜𝗥𝗘𝗗⌟* ◆
│
├◆ ʏᴏᴜʀ ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇss ʜᴀs ʙᴇᴇɴ ʀᴇᴍᴏᴠᴇᴅ
├◆
├◆ 📞 ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ ғᴏʀ ʀᴇɴᴇᴡᴀʟ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {}

  addAuditLog('ᴅᴇʟᴘʀᴇᴍ', userId, targetId);
});

bot.onText(/\/trials(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const durationStr = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!durationStr) {
    const status = database.trialMode.active ? 
      `ᴀᴄᴛɪᴠᴇ ✅ (ᴇxᴘɪʀᴇs: ${new Date(database.trialMode.expiry).toLocaleString()})` : 
      'ɪɴᴀᴄᴛɪᴠᴇ ❌';
    
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗧𝗥𝗜𝗔𝗟 𝗠𝗢𝗗𝗘 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴄᴜʀʀᴇɴᴛ sᴛᴀᴛᴜs: ${status}
├◆
├◆ ᴜsᴀɢᴇ: /trials <ᴅᴜʀᴀᴛɪᴏɴ>
├◆
├◆ ᴇxᴀᴍᴘʟᴇs:
├◆ /trials 3 days
├◆ /trials 1 week
├◆ /trials 24 hours
├◆
├◆ ᴛᴏ ᴇɴᴅ ᴛʀɪᴀʟ ᴇᴀʀʟʏ: /trials end
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (durationStr.toLowerCase() === 'end') {
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    database.trialMode.startedBy = null;
    database.trialMode.startedAt = null;
    await saveData();

    await bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗧𝗥𝗜𝗔𝗟 𝗠𝗢𝗗𝗘 𝗘𝗡𝗗𝗘𝗗⌟* ◆
│
├◆ ᴛʀɪᴀʟ ᴘᴇʀɪᴏᴅ ʜᴀs ʙᴇᴇɴ ᴇɴᴅᴇᴅ
├◆ ʙᴏᴛ ɪs ɴᴏᴡ ʙᴀᴄᴋ ᴛᴏ ᴘʀᴇᴍɪᴜᴍ ᴏɴʟʏ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );

    addAuditLog('ᴛʀɪᴀʟ_ᴇɴᴅ', userId);
    return;
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗗𝗨𝗥𝗔𝗧𝗜𝗢𝗡⌟* ◆
│
├◆ ᴜsᴇ ғᴏʀᴍᴀᴛs ʟɪᴋᴇ: 3 days, 1 week, 24 hours
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const expiry = Date.now() + durationMs;

  database.trialMode = {
    active: true,
    expiry: expiry,
    startedBy: userId.toString(),
    startedAt: Date.now()
  };

  await saveData();

  await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗧𝗥𝗜𝗔𝗟 𝗠𝗢𝗗𝗘 𝗘𝗡𝗔𝗕𝗟𝗘𝗗⌟* ◆
│
├◆ 🎉 ᴛʀɪᴀʟ ᴘᴇʀɪᴏᴅ ɪs ɴᴏᴡ ᴀᴄᴛɪᴠᴇ
├◆ ⏱️ ᴅᴜʀᴀᴛɪᴏɴ: ${durationStr}
├◆ 📅 ᴇxᴘɪʀʏ: ${new Date(expiry).toLocaleString()}
├◆
├◆ 👥 ᴀʟʟ ᴜsᴇʀs ʜᴀᴠᴇ ᴀᴄᴄᴇss ᴜɴᴛɪʟ ᴇxᴘɪʀʏ
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  const broadcastMsg = `┌ ❏ ◆ *⌜🎉 𝗧𝗥𝗜𝗔𝗟 𝗠𝗢𝗗𝗘 𝗔𝗖𝗧𝗜𝗩𝗔𝗧𝗘𝗗 ⌟* ◆
│
├◆ ɢʀᴇᴀᴛ ɴᴇᴡs! ᴛʜᴇ ʙᴏᴛ ɪs ɴᴏᴡ ғʀᴇᴇ ғᴏʀ ᴇᴠᴇʀʏᴏɴᴇ
├◆
├◆ ⏱️ ᴛʀɪᴀʟ ᴘᴇʀɪᴏᴅ: ${durationStr}
├◆ 📅 ᴇɴᴅs: ${new Date(expiry).toLocaleString()}
├◆
├◆ 🚀 ᴇɴᴊᴏʏ ᴘᴀɪʀɪɴɢ ғᴏʀ ғʀᴇᴇ!
│
└ ❏`;

  let sent = 0;
  for (const user of [...database.users].slice(0, 100)) {
    try {
      await bot.sendMessage(user, broadcastMsg, { parse_mode: 'Markdown' });
      sent++;
      await sleep(100);
    } catch (e) {}
  }

  await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗥𝗘𝗦𝗨𝗟𝗧⌟* ◆
│
├◆ ɴᴏᴛɪғɪᴄᴀᴛɪᴏɴ sᴇɴᴛ ᴛᴏ ${sent} ᴜsᴇʀs
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴛʀɪᴀʟ_ꜱᴛᴀʀᴛ', userId, null, { duration: durationStr, expiry });
});

bot.onText(/\/premlist/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, 
      { parse_mode: 'Markdown' }
    );
  }

  const premiumUsers = Object.entries(database.premium)
    .filter(([_, data]) => data.expiry > Date.now())
    .map(([id, data]) => ({
      id,
      expiry: new Date(data.expiry).toLocaleString(),
      addedBy: data.addedBy,
      addedAt: new Date(data.addedAt).toLocaleString()
    }));

  if (premiumUsers.length === 0) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗡𝗢 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗨𝗦𝗘𝗥𝗦⌟* ◆
│
├◆ ɴᴏ ᴀᴄᴛɪᴠᴇ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀs
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  let listText = `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗨𝗦𝗘𝗥𝗦 𝗟𝗜𝗦𝗧⌟* ◆
│
├◆ ᴛᴏᴛᴀʟ: ${premiumUsers.length}
│\n`;

  premiumUsers.slice(0, 20).forEach((user, index) => {
    listText += `├◆ ${index + 1}. ɪᴅ: ${user.id}\n`;
    listText += `├◆    ⏱️ ᴇxᴘɪʀʏ: ${user.expiry}\n`;
    if (index < premiumUsers.length - 1) listText += `│\n`;
  });

  if (premiumUsers.length > 20) {
    listText += `├◆ ... ᴀɴᴅ ${premiumUsers.length - 20} ᴍᴏʀᴇ\n`;
  }

  listText += `└ ❏`;

  bot.sendMessage(chatId, listText, { parse_mode: 'Markdown' });
});

// ==================== COMMAND: PING ====================

bot.onText(/\/ping/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const start = Date.now();

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const sentMsg = await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗣𝗜𝗡𝗚 𝗧𝗘𝗦𝗧⌟* ◆\n│\n├◆ ᴍᴇᴀsᴜʀɪɴɢ ʟᴀᴛᴇɴᴄʏ...\n│\n└ ❏`,
    { parse_mode: 'Markdown' }
  );

  const latency = Date.now() - start;
  const status = latency < 500 ? 'ᴇxᴄᴇʟʟᴇɴᴛ' : latency < 1000 ? 'ɢᴏᴏᴅ' : 'sʟᴏᴡ';
  const emoji = latency < 500 ? '🟢' : latency < 1000 ? '🟡' : '🔴';

  await bot.editMessageText(
    `┌ ❏ ◆ *⌜𝗣𝗢𝗡𝗚!⌟* ◆
│
├◆ ${emoji} ʀᴇsᴘᴏɴsᴇ: ${latency}ms
├◆ ${emoji} sᴛᴀᴛᴜs: ${status}
│
└ ❏`,
    {
      chat_id: chatId,
      message_id: sentMsg.message_id,
      parse_mode: 'Markdown'
    }
  );
});

// ==================== COMMAND: RUNTIME ====================

bot.onText(/\/runtime/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const uptime = formatUptime(Date.now() - database.stats.startTime);
  const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const cpu = os.loadavg()[0].toFixed(2);

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗦𝗬𝗦𝗧𝗘𝗠 𝗥𝗨𝗡𝗧𝗜𝗠𝗘⌟* ◆
│
├◆ ⏱️ ᴜᴘᴛɪᴍᴇ: ${uptime}
├◆ 💾 ᴍᴇᴍᴏʀʏ: ${memory}MB
├◆ ⚙️ ᴄᴘᴜ: ${cpu}%
├◆ 💻 ᴘʟᴀᴛғᴏʀᴍ: ${os.platform()}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );
});

// ==================== COMMAND: STATS ====================

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const sessions = await getSessions();
  const avgSpeed = database.stats.pairingSpeed.length > 0 
    ? Math.round(database.stats.pairingSpeed.reduce((a, b) => a + b) / database.stats.pairingSpeed.length) 
    : 0;

  const premiumCount = Object.keys(database.premium).filter(id => isPremium(id)).length;

  let stats = `┌ ❏ ◆ *⌜𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦⌟* ◆
│
├◆ 👥 ᴜsᴇʀs: ${formatNumber(database.stats.totalUsers)}
├◆ 🔗 sᴇssɪᴏɴs: ${sessions.length}/${SYSTEM.sessionLimit}
├◆ 📊 ᴄᴏɴɴᴇᴄᴛɪᴏɴs: ${formatNumber(database.stats.totalConnections)}
├◆ 📅 ᴛᴏᴅᴀʏ: ${formatNumber(database.stats.dailyConnections)}
├◆ ⚡ ᴀᴠɢ sᴘᴇᴇᴅ: ${avgSpeed}ms
├◆ ❌ ғᴀɪʟᴜʀᴇs: ${database.stats.failures}
├◆ 🛡️ ʙᴀɴɴᴇᴅ: ${Object.keys(database.banned).length}
├◆ 👑 ᴘʀᴇᴍɪᴜᴍ: ${premiumCount}
│`;

  if (database.trialMode.active) {
    const trialExpiry = new Date(database.trialMode.expiry).toLocaleString();
    stats += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry})`;
  }

  stats += `\n│\n└ ❏`;

  bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
});

// ==================== COMMAND: REPORT ====================

bot.onText(/\/report(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const message = match ? match[1] : null;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!message) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗥𝗘𝗣𝗢𝗥𝗧 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /report ʙᴏᴛ ɴᴏᴛ ʀᴇsᴘᴏɴᴅɪɴɢ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const reportId = Date.now();
  const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  const report = {
    id: reportId,
    userId: userId.toString(),
    userName: userName,
    message: sanitizeInput(message),
    timestamp: new Date().toISOString(),
    status: 'ᴘᴇɴᴅɪɴɢ'
  };

  database.reports.push(report);
  await saveData();

  const reportMessage = `┌ ❏ ◆ *⌜𝗡𝗘𝗪 𝗥𝗘𝗣𝗢𝗥𝗧⌟* ◆
│
├◆ ɪᴅ: ${userId}
├◆ ᴜsᴇʀ: ${userName}
├◆ ʀᴇᴘᴏʀᴛ ɪᴅ: ${reportId}
│
└ ❏
┌ ❏ ◆ *⌜𝗠𝗘𝗦𝗦𝗔𝗚𝗘⌟* ◆
│
├◆ ${sanitizeInput(message)}
│
└ ❏`;

  for (const adminId of database.admins) {
    try {
      await bot.sendMessage(adminId, reportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 ʀᴇᴘʟʏ', callback_data: `reply_${userId}` }],
            [{ text: '📋 ᴄᴏᴘʏ ɪᴅ', callback_data: `copyid_${userId}` }]
          ]
        }
      });
    } catch (e) {}
  }

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗥𝗘𝗣𝗢𝗥𝗧 𝗦𝗨𝗕𝗠𝗜𝗧𝗧𝗘𝗗⌟* ◆
│
├◆ ᴛʜᴀɴᴋ ʏᴏᴜ ғᴏʀ ʏᴏᴜʀ ʀᴇᴘᴏʀᴛ
├◆ ʀᴇᴘᴏʀᴛ ɪᴅ: ${reportId}
├◆ ᴡᴇ'ʟʟ ʀᴇᴠɪᴇᴡ ɪᴛ sʜᴏʀᴛʟʏ
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʀᴇᴘᴏʀᴛ', userId, null, { reportId });
});

// ==================== COMMAND: TUTORIAL ====================

bot.onText(/\/tutorial/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const tutorial = `┌ ❏ ◆ *⌜𝗦𝗘𝗧𝗨𝗣 𝗧𝗨𝗧𝗢𝗥𝗜𝗔𝗟⌟* ◆
│
├◆ 📌 sᴛᴇᴘ 1: ᴘʀᴇᴘᴀʀᴀᴛɪᴏɴ
├◆    • ᴇɴsᴜʀᴇ ᴡʜᴀᴛsᴀᴘᴘ ɪs ɪɴsᴛᴀʟʟᴇᴅ
├◆    • ᴋᴇᴇᴘ ᴘʜᴏɴᴇ ᴡɪᴛʜ ɪɴᴛᴇʀɴᴇᴛ
│
├◆ 📌 sᴛᴇᴘ 2: ɢᴇɴᴇʀᴀᴛᴇ ᴄᴏᴅᴇ
├◆    • ᴜsᴇ: /pair 923078071982
├◆    • ᴡᴀɪᴛ ғᴏʀ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ
│
├◆ 📌 sᴛᴇᴘ 3: ʟɪɴᴋ ᴅᴇᴠɪᴄᴇ
├◆    • ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ → sᴇᴛᴛɪɴɢs
├◆    • ᴛᴀᴘ "ʟɪɴᴋᴇᴅ ᴅᴇᴠɪᴄᴇs"
├◆    • sᴇʟᴇᴄᴛ "ʟɪɴᴋ ᴀ ᴅᴇᴠɪᴄᴇ"
├◆    • ᴇɴᴛᴇʀ ᴛʜᴇ ᴄᴏᴅᴇ
│
├◆ ⚡ ɴᴏᴛᴇ: ᴄᴏᴅᴇ ᴇxᴘɪʀᴇs ɪɴ 𝟱 ᴍɪɴᴜᴛᴇs
│
└ ❏`;

  bot.sendMessage(chatId, tutorial, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔗 ᴘᴀɪʀ ɴᴏᴡ', callback_data: 'pair_guide' }
        ]
      ]
    }
  });
});

// ==================== COMMAND: HELP ====================

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆\n│\n├◆ 🔧 ʙᴏᴛ ɪs ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗥𝗔𝗧𝗘 𝗟𝗜𝗠𝗜𝗧⌟* ◆\n│\n├◆ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇǫᴜᴇsᴛs\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  let help = `┌ ❏ ◆ *⌜𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗖𝗘𝗡𝗧𝗘𝗥⌟* ◆
│
├◆ ──── ɢᴇɴᴇʀᴀʟ ᴄᴏᴍᴍᴀɴᴅs ────
├◆ /start      - ɪɴɪᴛɪᴀʟɪᴢᴇ ʙᴏᴛ
├◆ /menu       - ᴍᴀɪɴ ᴍᴇɴᴜ
├◆ /pair       - ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
├◆ /unpair     - ʀᴇᴍᴏᴠᴇ sᴇssɪᴏɴ
├◆ /ping       - ᴛᴇsᴛ ᴄᴏɴɴᴇᴄᴛɪᴏɴ
├◆ /runtime    - sʏsᴛᴇᴍ ᴜᴘᴛɪᴍᴇ
├◆ /stats      - ʙᴏᴛ sᴛᴀᴛɪsᴛɪᴄs
├◆ /report     - ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ
├◆ /tutorial   - ᴡᴀᴛᴄʜ ɢᴜɪᴅᴇ
├◆ /help       - ᴛʜɪs ᴍᴇɴᴜ
│`;

  if (isAdmin(userId.toString()) || isOwner(userId)) {
    help += `
├◆
├◆ ──── ᴀᴅᴍɪɴ ᴄᴏᴍᴍᴀɴᴅs ────
├◆ /users      - ʟɪsᴛ ᴀʟʟ ᴜsᴇʀs
├◆ /listpair   - ᴀʟʟ sᴇssɪᴏɴs
├◆ /broadcast  - sᴇɴᴅ ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛ
├◆ /clean      - ᴄʟᴇᴀɴ ɪɴᴠᴀʟɪᴅ sᴇssɪᴏɴs
├◆ /ban        - ʙᴀɴ ᴜsᴇʀ
├◆ /unban      - ᴜɴʙᴀɴ ᴜsᴇʀ
├◆ /checkuser  - ᴄʜᴇᴄᴋ ᴜsᴇʀ ɪɴғᴏ
├◆ /maintenance- ᴛᴏɢɢʟᴇ ᴍᴏᴅᴇ
├◆ /logs       - ᴠɪᴇᴡ ᴀᴜᴅɪᴛ ʟᴏɢs
├◆ /announce   - sᴄʜᴇᴅᴜʟᴇᴅ
├◆
├◆ ──── ᴘʀᴇᴍɪᴜᴍ ᴄᴏᴍᴍᴀɴᴅs ────
├◆ /addprem    - ᴀᴅᴅ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ
├◆ /delprem    - ʀᴇᴍᴏᴠᴇ ᴘʀᴇᴍɪᴜᴍ
├◆ /trials     - sᴇᴛ ᴛʀɪᴀʟ ᴘᴇʀɪᴏᴅ
├◆ /premlist   - ʟɪsᴛ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀs
│`;
  }

  if (isOwner(userId)) {
    help += `
├◆ ──── ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅs ────
├◆ /addadmin   - ᴀᴅᴅ ɴᴇᴡ ᴀᴅᴍɪɴ
├◆ /removeadmin- ʀᴇᴍᴏᴠᴇ ᴀᴅᴍɪɴ
├◆ /restart    - ʀᴇsᴛᴀʀᴛ ʙᴏᴛ
│`;
  }

  help += `└ ❏`;

  bot.sendMessage(chatId, help, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data: 'show_main' }]
      ]
    }
  });
});

// ==================== ADMIN COMMANDS ====================

bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const usersList = [...database.users].slice(0, 10);
  let userText = '';
  usersList.forEach((id, index) => {
    const name = database.userDetails[id]?.name || 'ᴜɴᴋɴᴏᴡɴ';
    userText += `├◆ ${index + 1}. ${id} (${name})\n`;
  });

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗨𝗦𝗘𝗥 𝗟𝗜𝗦𝗧⌟* ◆
│
├◆ ᴛᴏᴛᴀʟ: ${database.stats.totalUsers}
│
${userText}${database.stats.totalUsers > 10 ? `├◆ ... ᴀɴᴅ ${database.stats.totalUsers - 10} ᴍᴏʀᴇ\n` : ''}│
└ ❏`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/listpair/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const sessions = await getSessionDetails();
  
  if (sessions.length === 0) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗡𝗢 𝗦𝗘𝗦𝗦𝗜𝗢𝗡𝗦⌟* ◆
│
├◆ ɴᴏ ᴀᴄᴛɪᴠᴇ sᴇssɪᴏɴs
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const activeCount = sessions.filter(s => s.status === 'ᴀᴄᴛɪᴠᴇ ✅').length;
  const inactiveCount = sessions.filter(s => s.status !== 'ᴀᴄᴛɪᴠᴇ ✅').length;

  let sessionList = '';
  sessions.slice(0, 15).forEach((session, index) => {
    sessionList += `├◆ ${index + 1}. +${session.number}\n`;
    sessionList += `├◆    ᴛʏᴘᴇ: ${session.status}\n`;
    if (session.name !== 'ᴜɴᴋɴᴏᴡɴ') {
      sessionList += `├◆    ɴᴀᴍᴇ: ${session.name}\n`;
    }
    sessionList += `│\n`;
  });

  const summary = `┌ ❏ ◆ *⌜𝗔𝗟𝗟 𝗦𝗘𝗦𝗦𝗜𝗢𝗡𝗦⌟* ◆
│
├◆ ᴛᴏᴛᴀʟ: ${sessions.length}/${SYSTEM.sessionLimit}
├◆ ✅ ᴀᴄᴛɪᴠᴇ: ${activeCount}
├◆ ⚠️ ɪɴᴀᴄᴛɪᴠᴇ: ${inactiveCount}
│
${sessionList}${sessions.length > 15 ? `├◆ ... ᴀɴᴅ ${sessions.length - 15} ᴍᴏʀᴇ\n` : ''}└ ❏`;

  bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
});

bot.onText(/\/broadcast(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const message = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!message) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /broadcast ᴍᴇssᴀɢᴇ ʜᴇʀᴇ
├◆ ᴛᴏᴛᴀʟ ᴜsᴇʀs: ${database.stats.totalUsers}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const total = database.users.size;
  if (total === 0) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗡𝗢 𝗨𝗦𝗘𝗥𝗦⌟* ◆\n│\n├◆ ɴᴏ ᴜsᴇʀs ᴛᴏ ʙʀᴏᴀᴅᴄᴀsᴛ ᴛᴏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const statusMsg = await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧𝗜𝗡𝗚⌟* ◆
│
├◆ ᴛᴏᴛᴀʟ: ${total}
├◆ sᴇɴᴛ: 0
├◆ ғᴀɪʟᴇᴅ: 0
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  let sent = 0;
  let failed = 0;
  const users = [...database.users];

  for (let i = 0; i < users.length; i++) {
    try {
      await bot.sendMessage(users[i],
        `┌ ❏ ◆ *⌜𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘𝗠𝗘𝗡𝗧⌟* ◆
│
├◆ ${message}
│
└ ❏
┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆
│
├◆ ғʀᴏᴍ: ${SYSTEM.name} ᴀᴅᴍɪɴ
├◆ ᴛɪᴍᴇ: ${new Date().toLocaleString()}
│
└ ❏`,
        { parse_mode: 'Markdown' }
      );
      sent++;

      if (i % 10 === 0 || i === users.length - 1) {
        await bot.editMessageText(
          `┌ ❏ ◆ *⌜𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧𝗜𝗡𝗚⌟* ◆
│
├◆ ᴘʀᴏɢʀᴇss: ${Math.round((i + 1) / total * 100)}%
├◆ sᴇɴᴛ: ${sent}
├◆ ғᴀɪʟᴇᴅ: ${failed}
│
└ ❏`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          }
        );
      }

      await sleep(SYSTEM.broadcastDelay);
    } catch (error) {
      failed++;
      if (error.response?.body?.error_code === 403) {
        database.users.delete(users[i]);
      }
    }
  }

  await bot.editMessageText(
    `┌ ❏ ◆ *⌜𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘𝗗⌟* ◆
│
├◆ sᴇɴᴛ: ${sent}
├◆ ғᴀɪʟᴇᴅ: ${failed}
├◆ sᴜᴄᴄᴇss: ${Math.round(sent / total * 100)}%
│
└ ❏`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown'
    }
  );

  await saveData();
  addAuditLog('ʙʀᴏᴀᴅᴄᴀsᴛ', userId, null, { sent, failed, total });
});

bot.onText(/\/clean/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const sessions = await getSessions();
  let cleaned = 0;
  let kept = 0;

  for (const session of sessions) {
    const sessionPath = path.join(PATHS.sessions, session);
    const credsPath = path.join(sessionPath, 'creds.json');
    
    let isValid = false;
    if (await fileExists(credsPath)) {
      try {
        const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
        isValid = !!(creds.me && creds.me.id);
      } catch (e) {}
    }
    
    if (!isValid) {
      await fs.rm(sessionPath, { recursive: true, force: true });
      cleaned++;
    } else {
      kept++;
    }
  }

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗖𝗟𝗘𝗔𝗡 𝗨𝗣 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘𝗗⌟* ◆
│
├◆ ʀᴇᴍᴏᴠᴇᴅ: ${cleaned}
├◆ ᴋᴇᴘᴛ: ${kept}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴄʟᴇᴀɴ', userId, null, { cleaned, kept });
});

bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗕𝗔𝗡 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /ban 123456789 sᴘᴀᴍᴍɪɴɢ
├◆ ᴏʀ: /ban 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const parts = input.split(' ');
  const targetId = parts[0];
  const reason = parts.slice(1).join(' ') || 'ᴠɪᴏʟᴀᴛɪᴏɴ ᴏғ ᴛᴇʀᴍs';

  if (isOwner(parseInt(targetId))) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗘𝗥𝗥𝗢𝗥⌟* ◆\n│\n├◆ ᴄᴀɴɴᴏᴛ ʙᴀɴ ᴀɴ ᴏᴡɴᴇʀ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  database.banned[targetId] = {
    reason,
    date: new Date().toISOString(),
    bannedBy: userId.toString()
  };

  await saveData();

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗨𝗦𝗘𝗥 𝗕𝗔𝗡𝗡𝗘𝗗⌟* ◆
│
├◆ ᴜsᴇʀ ɪᴅ: ${targetId}
├◆ ʀᴇᴀsᴏɴ: ${reason}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʙᴀɴ', userId, targetId, { reason });
});

bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗨𝗡𝗕𝗔𝗡 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /unban 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const targetId = input.trim();

  if (!database.banned[targetId]) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇʀ ɪs ɴᴏᴛ ʙᴀɴɴᴇᴅ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  delete database.banned[targetId];
  await saveData();

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗨𝗦𝗘𝗥 𝗨𝗡𝗕𝗔𝗡𝗡𝗘𝗗⌟* ◆
│
├◆ ᴜsᴇʀ ɪᴅ: ${targetId}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴜɴʙᴀɴ', userId, targetId);
});

bot.onText(/\/checkuser(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗖𝗛𝗘𝗖𝗞 𝗨𝗦𝗘𝗥 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /checkuser 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const user = database.userDetails[targetId] || {};
  const isBanned = database.banned[targetId] ? 'ʏᴇs' : 'ɴᴏ';
  const banReason = database.banned[targetId] ? database.banned[targetId].reason : 'ɴ/ᴀ';
  const premiumStatus = isPremium(targetId) ? 'ᴀᴄᴛɪᴠᴇ ✅' : 'ɪɴᴀᴄᴛɪᴠᴇ ❌';
  const premiumExpiry = database.premium[targetId] ? new Date(database.premium[targetId].expiry).toLocaleString() : 'ɴ/ᴀ';
  
  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗨𝗦𝗘𝗥 𝗜𝗡𝗙𝗢⌟* ◆
│
├◆ 🆔 ɪᴅ: ${targetId}
├◆ 👤 ɴᴀᴍᴇ: ${user.name || 'ɴ/ᴀ'}
├◆ 📅 ᴊᴏɪɴᴇᴅ: ${user.joined ? new Date(user.joined).toLocaleDateString() : 'ɴ/ᴀ'}
├◆ 💬 ᴍsɢs: ${user.messages || 0}
├◆ 🔗 ᴘᴀɪʀs: ${user.pairs || 0}
├◆ 🔒 ʙᴀɴɴᴇᴅ: ${isBanned}
├◆ 📝 ʀᴇᴀsᴏɴ: ${banReason}
├◆ 👑 ᴘʀᴇᴍɪᴜᴍ: ${premiumStatus}
├◆ ⏱️ ᴘʀᴇᴍɪᴜᴍ ᴇxᴘ: ${premiumExpiry}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/maintenance(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const mode = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!mode) {
    const status = database.maintenance ? 'ᴇɴᴀʙʟᴇᴅ 🔧' : 'ᴅɪsᴀʙʟᴇᴅ ✅';
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆
│
├◆ ᴄᴜʀʀᴇɴᴛ sᴛᴀᴛᴜs: ${status}
├◆
├◆ ᴜsᴀɢᴇ: /maintenance on
├◆ ᴜsᴀɢᴇ: /maintenance off
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!['on', 'off'].includes(mode.toLowerCase())) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗⌟* ◆\n│\n├◆ ᴜsᴇ /maintenance on ᴏʀ /maintenance off\n│\n└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  database.maintenance = mode.toLowerCase() === 'on';
  await saveData();

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘 𝗠𝗢𝗗𝗘⌟* ◆
│
├◆ sᴛᴀᴛᴜs: ${database.maintenance ? 'ᴇɴᴀʙʟᴇᴅ 🔧' : 'ᴅɪsᴀʙʟᴇᴅ ✅'}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ', userId, null, { enabled: database.maintenance });
});

bot.onText(/\/logs/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const recentLogs = database.audit.slice(-5).reverse();
  
  if (recentLogs.length === 0) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗡𝗢 𝗟𝗢𝗚𝗦⌟* ◆\n│\n├◆ ɴᴏ ʟᴏɢs ᴀᴠᴀɪʟᴀʙʟᴇ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  let logText = `┌ ❏ ◆ *⌜𝗥𝗘𝗖𝗘𝗡𝗧 𝗟𝗢𝗚𝗦⌟* ◆\n│\n`;
  recentLogs.forEach((log, index) => {
    const time = new Date(log.timestamp).toLocaleString();
    logText += `├◆ ${index + 1}. ${log.action}\n├◆    ᴜsᴇʀ: ${log.userId}\n├◆    ᴛɪᴍᴇ: ${time}\n`;
    if (log.target) logText += `├◆    ᴛᴀʀɢᴇᴛ: ${log.target}\n`;
    logText += `│\n`;
  });
  logText += `└ ❏`;

  bot.sendMessage(chatId, logText, { parse_mode: 'Markdown' });
});

bot.onText(/\/announce(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /announce 10m ᴜᴘᴅᴀᴛᴇ ᴍᴇssᴀɢᴇ
├◆ ᴇxᴀᴍᴘʟᴇ: /announce 1h sʏsᴛᴇᴍ ᴜᴘᴅᴀᴛᴇ
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  const parts = input.split(' ');
  const timeArg = parts[0];
  const message = parts.slice(1).join(' ');

  if (!message) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗘𝗥𝗥𝗢𝗥⌟* ◆\n│\n├◆ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴍᴇssᴀɢᴇ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  let delay = 0;
  if (timeArg.endsWith('m')) {
    delay = parseInt(timeArg) * 60 * 1000;
  } else if (timeArg.endsWith('h')) {
    delay = parseInt(timeArg) * 60 * 60 * 1000;
  } else {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗜𝗡𝗩𝗔𝗟𝗜𝗗⌟* ◆\n│\n├◆ ᴜsᴇ 10m ᴏʀ 1h\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const scheduleTime = new Date(Date.now() + delay);

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘𝗠𝗘𝗡𝗧 𝗦𝗖𝗛𝗘𝗗𝗨𝗟𝗘𝗗⌟* ◆
│
├◆ ᴛɪᴍᴇ: ${scheduleTime.toLocaleString()}
├◆ ᴍᴇssᴀɢᴇ: ${message}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  setTimeout(async () => {
    let sent = 0;
    let failed = 0;
    
    for (const user of [...database.users]) {
      try {
        await bot.sendMessage(user,
          `┌ ❏ ◆ *⌜𝗦𝗖𝗛𝗘𝗗𝗨𝗟𝗘𝗗 𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘𝗠𝗘𝗡𝗧⌟* ◆
│
├◆ ${message}
│
└ ❏
┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆
│
├◆ 🕒 ${new Date().toLocaleString()}
│
└ ❏`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        await sleep(SYSTEM.broadcastDelay);
      } catch {
        failed++;
      }
    }

    bot.sendMessage(userId,
      `┌ ❏ ◆ *⌜𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘𝗠𝗘𝗡𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘𝗗⌟* ◆
│
├◆ sᴇɴᴛ: ${sent}
├◆ ғᴀɪʟᴇᴅ: ${failed}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }, delay);

  addAuditLog('ᴀɴɴᴏᴜɴᴄᴇ', userId, null, { time: timeArg, message });
});

// ==================== OWNER COMMANDS ====================

bot.onText(/\/addadmin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴏᴡɴᴇʀ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗔𝗗𝗗 𝗔𝗗𝗠𝗜𝗡 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /addadmin 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (database.admins.includes(targetId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇʀ ɪs ᴀʟʀᴇᴀᴅʏ ᴀɴ ᴀᴅᴍɪɴ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  database.admins.push(targetId);
  await saveData();

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗔𝗗𝗠𝗜𝗡 𝗔𝗗𝗗𝗘𝗗⌟* ◆
│
├◆ ᴜsᴇʀ ɪᴅ: ${targetId}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴀᴅᴅᴀᴅᴍɪɴ', userId, targetId);
});

bot.onText(/\/removeadmin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴏᴡɴᴇʀ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗥𝗘𝗠𝗢𝗩𝗘 𝗔𝗗𝗠𝗜𝗡 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴀɢᴇ: /removeadmin 123456789
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  if (isOwner(parseInt(targetId))) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗘𝗥𝗥𝗢𝗥⌟* ◆\n│\n├◆ ᴄᴀɴɴᴏᴛ ʀᴇᴍᴏᴠᴇ ᴀɴ ᴏᴡɴᴇʀ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  const index = database.admins.indexOf(targetId);
  if (index === -1) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇʀ ɪs ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  database.admins.splice(index, 1);
  await saveData();

  bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗠𝗢𝗩𝗘𝗗⌟* ◆
│
├◆ ᴜsᴇʀ ɪᴅ: ${targetId}
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʀᴇᴍᴏᴠᴇᴀᴅᴍɪɴ', userId, targetId);
});

bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴏᴡɴᴇʀ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  await bot.sendMessage(chatId,
    `┌ ❏ ◆ *⌜𝗥𝗘𝗦𝗧𝗔𝗥𝗧𝗜𝗡𝗚⌟* ◆
│
├◆ ʙᴏᴛ ᴡɪʟʟ ʀᴇsᴛᴀʀᴛ ɪɴ 3 seconds
│
└ ❏`,
    { parse_mode: 'Markdown' }
  );

  await saveData();
  addAuditLog('ʀᴇsᴛᴀʀᴛ', userId);

  setTimeout(() => {
    console.log('🔄 ʀᴇsᴛᴀʀᴛ ɪɴɪᴛɪᴀᴛᴇᴅ ʙʏ ᴏᴡɴᴇʀ');
    process.exit(1);
  }, 3000);
});

// ==================== CALLBACK HANDLER ====================

bot.on('callback_query', async (query) => {
  const msg = query.message;
  const data = query.data;
  const userId = query.from.id;
  const chatId = msg.chat.id;
  const userName = query.from.first_name || 'ᴜsᴇʀ';

  await trackUser(userId, userName);

  if (data === 'verify_membership') {
  const verification = await verifyMembership(userId);
  if (verification.verified) {
    database.verifiedUsers.add(userId.toString());
    await saveData();
    
    await bot.answerCallbackQuery(query.id, { text: '✅ Verified! You can now use the bot.' });
    await bot.editMessageText(
      `┌ ❏ ◇ *⌜VERIFICATION SUCCESS⌟* ◇\n├◇ ✅ Access granted\n├◇ Click below to continue\n└ ❏`,
      {
        chat_id: chatId,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Continue', callback_data: 'show_main' }]
          ]
        }
      }
    );
  } else {
    await bot.answerCallbackQuery(query.id, { text: '❌ You have not joined all required channels.', show_alert: true });
  }
}

  else if (data === 'show_main') {
    await bot.answerCallbackQuery(query.id);
    await sendMainMenu(chatId, userId, userName, isAdmin(userId.toString()), isOwner(userId));
  }

  else if (data === 'show_tutorial') {
    await bot.answerCallbackQuery(query.id);
    
    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗩𝗜𝗗𝗘𝗢 𝗧𝗨𝗧𝗢𝗥𝗜𝗔𝗟⌟* ◆
│
├◆ ᴡᴀᴛᴄʜ ᴛʜᴇ ᴄᴏᴍᴘʟᴇᴛᴇ sᴇᴛᴜᴘ ɢᴜɪᴅᴇ
│
└ ❏`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ ᴡᴀᴛᴄʜ ɴᴏᴡ', callback_data: 'watch_tutorial' }]
          ]
        }
      }
    );
  }

  else if (data === 'watch_tutorial') {
    await bot.answerCallbackQuery(query.id, { text: 'sᴇɴᴅɪɴɢ ᴠɪᴅᴇᴏ...' });
    
    try {
      await bot.sendVideo(chatId, ASSETS.tutorialVideo, {
        caption: `🎬 *${SYSTEM.name} sᴇᴛᴜᴘ ɢᴜɪᴅᴇ*`,
        parse_mode: 'Markdown'
      });
    } catch (e) {
      await bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗘𝗥𝗥𝗢𝗥⌟* ◆\n│\n├◆ ᴠɪᴅᴇᴏ ᴜɴᴀᴠᴀɪʟᴀʙʟᴇ\n│\n└ ❏`, { parse_mode: 'Markdown' });
    }
  }

  else if (data === 'pair_guide') {
    await bot.answerCallbackQuery(query.id);
    
    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗣𝗔𝗜𝗥 𝗚𝗨𝗜𝗗𝗘⌟* ◆
│
├◆ ᴜsᴇ: /pair 923078071982
├◆ ᴏʀ: /pair 923078071982|1234
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );
  }

  else if (data === 'bot_stats') {
    await bot.answerCallbackQuery(query.id, { text: 'ʟᴏᴀᴅɪɴɢ...' });
    
    const sessions = await getSessions();
    const avgSpeed = database.stats.pairingSpeed.length > 0 
      ? Math.round(database.stats.pairingSpeed.reduce((a, b) => a + b) / database.stats.pairingSpeed.length) 
      : 0;
    const premiumCount = Object.keys(database.premium).filter(id => isPremium(id)).length;

    let stats = `┌ ❏ ◆ *⌜𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦⌟* ◆
│
├◆ 👥 ᴜsᴇʀs: ${formatNumber(database.stats.totalUsers)}
├◆ 🔗 sᴇssɪᴏɴs: ${sessions.length}/${SYSTEM.sessionLimit}
├◆ 📊 ᴄᴏɴɴᴇᴄᴛɪᴏɴs: ${formatNumber(database.stats.totalConnections)}
├◆ 📅 ᴛᴏᴅᴀʏ: ${formatNumber(database.stats.dailyConnections)}
├◆ ⚡ ᴀᴠɢ sᴘᴇᴇᴅ: ${avgSpeed}ms
├◆ 👑 ᴘʀᴇᴍɪᴜᴍ: ${premiumCount}`;

    if (database.trialMode.active) {
      const trialExpiry = new Date(database.trialMode.expiry).toLocaleString();
      stats += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry})`;
    }

    stats += `\n│\n└ ❏`;

    await bot.editMessageText(stats, {
      chat_id: chatId,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 ʀᴇғʀᴇsʜ', callback_data: 'bot_stats' }]
        ]
      }
    });
  }

  else if (data.startsWith('copy_code_')) {
    const code = data.replace('copy_code_', '');
    await bot.answerCallbackQuery(query.id, {
      text: `✅ ᴄᴏᴅᴇ ᴄᴏᴘɪᴇᴅ: ${code}`,
      show_alert: true
    });
    
    await bot.sendMessage(chatId, `📋 *ᴄᴏᴅᴇ ᴄᴏᴘɪᴇᴅ ᴛᴏ ᴄʟɪᴘʙᴏᴀʀᴅ!*\n\n\`${code}\``, {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
  }

  else if (data.startsWith('copyid_')) {
    const id = data.replace('copyid_', '');
    await bot.answerCallbackQuery(query.id, {
      text: `ᴜsᴇʀ ɪᴅ: ${id}`,
      show_alert: true
    });
  }

  else if (data.startsWith('reply_')) {
    const targetId = data.replace('reply_', '');
    
    await bot.answerCallbackQuery(query.id, {
      text: 'ʀᴇᴘʟʏ ᴛᴏ ᴛʜɪs ᴍᴇssᴀɢᴇ',
      show_alert: true
    });
    
    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗥𝗘𝗣𝗟𝗬 𝗠𝗢𝗗𝗘⌟* ◆
│
├◆ ᴛᴀʀɢᴇᴛ: ${targetId}
├◆ ᴜsᴇ: /reply ${targetId} ʏᴏᴜʀ ᴍᴇssᴀɢᴇ
│
└ ❏`,
      {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      }
    );
  }
});

// ==================== ADMIN REPLY COMMAND ====================

bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match[1];
  const replyMessage = match[2];

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟* ◆\n│\n├◆ ᴀᴅᴍɪɴ ᴏɴʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }

  try {
    await bot.sendMessage(targetId,
      `┌ ❏ ◆ *⌜𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘⌟* ◆
│
├◆ ${replyMessage}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );

    bot.sendMessage(chatId,
      `┌ ❏ ◆ *⌜𝗥𝗘𝗣𝗟𝗬 𝗦𝗘𝗡𝗧⌟* ◆
│
├◆ ᴛᴏ: ${targetId}
├◆ ᴍᴇssᴀɢᴇ: ${replyMessage}
│
└ ❏`,
      { parse_mode: 'Markdown' }
    );

    addAuditLog('ᴀᴅᴍɪɴ_ʀᴇᴘʟʏ', userId, targetId, { message: replyMessage });
  } catch (error) {
    bot.sendMessage(chatId, `┌ ❏ ◆ *⌜𝗘𝗥𝗥𝗢𝗥⌟* ◆\n│\n├◆ ғᴀɪʟᴇᴅ ᴛᴏ sᴇɴᴅ ʀᴇᴘʟʏ\n│\n└ ❏`, { parse_mode: 'Markdown' });
  }
});

// ==================== AUTO-REPLY SYSTEM ====================

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/') || msg.chat.type === 'private') return;

  const text = msg.text.toLowerCase();
  const chatId = msg.chat.id;

  const responses = {
    'how to pair': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /pair ғᴏʟʟᴏᴡᴇᴅ ʙʏ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ\n│\n└ ❏',
    'how to connect': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /pair ᴄᴏᴍᴍᴀɴᴅ ᴛᴏ ᴄᴏɴɴᴇᴄᴛ\n│\n└ ❏',
    'what is axis': `┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ${SYSTEM.name} ɪs ᴀ ᴘʀᴏғᴇssɪᴏɴᴀʟ ᴘᴀɪʀɪɴɢ sʏsᴛᴇᴍ\n│\n└ ❏`,
    'help': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /help ғᴏʀ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ\n│\n└ ❏',
    'tutorial': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /tutorial ғᴏʀ ᴠɪᴅᴇᴏ ɢᴜɪᴅᴇ\n│\n└ ❏',
    'premium': `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗜𝗡𝗙𝗢⌟* ◆
│
├◆ ᴛᴏ ɢᴇᴛ ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇss:
├◆
├◆ 📞 ᴄᴏɴᴛᴀᴄᴛ: @teamG_tech
├◆ 💬 ᴏʀ ᴠɪsɪᴛ: ${DEVELOPER_CONTACTS.telegram}
│
└ ❏`
  };

  for (const [key, response] of Object.entries(responses)) {
    if (text.includes(key)) {
      await bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });
      break;
    }
  }
});

// ==================== PREMIUM EXPIRY CHECKER ====================

setInterval(async () => {
  let expired = 0;
  const now = Date.now();
  
  for (const [userId, data] of Object.entries(database.premium)) {
    if (data.expiry < now) {
      delete database.premium[userId];
      expired++;
      
      try {
        await bot.sendMessage(userId,
          `┌ ❏ ◆ *⌜𝗣𝗥𝗘𝗠𝗜𝗨𝗠 𝗘𝗫𝗣𝗜𝗥𝗘𝗗⌟* ◆
│
├◆ ʏᴏᴜʀ ᴘʀᴇᴍɪᴜᴍ sᴜʙsᴄʀɪᴘᴛɪᴏɴ ʜᴀs ᴇɴᴅᴇᴅ
├◆
├◆ 📞 ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ ғᴏʀ ʀᴇɴᴇᴡᴀʟ
│
└ ❏`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
    }
  }
  
  if (expired > 0) {
    console.log(`🧹 ᴄʟᴇᴀɴᴇᴅ ${expired} ᴇxᴘɪʀᴇᴅ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀs`);
    await saveData();
  }
}, 60 * 60 * 1000);

setInterval(async () => {
  if (database.trialMode.active && database.trialMode.expiry < Date.now()) {
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    await saveData();
    console.log('🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ ᴇxᴘɪʀᴇᴅ');
  }
}, 60 * 1000);

// ==================== INITIALIZATION ====================

(async () => {
  console.clear();
  
  await ensureDirectories();
  await loadDatabase();
  
  console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║     ${SYSTEM.name} v${SYSTEM.version}          ║
║     ${SYSTEM.creator}              ║
║     ᴇɴᴛᴇʀᴘʀɪsᴇ ᴘᴀɪʀɪɴɢ sʏsᴛᴇᴍ        ║
║     ᴘʀᴇᴍɪᴜᴍ ᴇᴅɪᴛɪᴏɴ                 ║
╚══════════════════════════════════════╝
  `));

  console.log(chalk.green('✅ sʏsᴛᴇᴍ ɪɴɪᴛɪᴀʟɪᴢᴇᴅ'));
  console.log(chalk.blue(`👥 ᴜsᴇʀs: ${formatNumber(database.stats.totalUsers)}`));
  console.log(chalk.yellow(`🔗 ᴀᴅᴍɪɴs: ${database.admins.length}`));
  console.log(chalk.magenta(`👑 ᴘʀᴇᴍɪᴜᴍ: ${Object.keys(database.premium).length}`));
  console.log(chalk.cyan(`🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ${database.trialMode.active ? 'ᴀᴄᴛɪᴠᴇ' : 'ɪɴᴀᴄᴛɪᴠᴇ'}`));
  console.log(chalk.cyan(`⏱️ ᴜᴘᴛɪᴍᴇ: ${formatUptime(Date.now() - database.stats.startTime)}`));
  console.log(chalk.white('\n📢 ᴍᴏɴɪᴛᴏʀɪɴɢ ғᴏʀ ᴄᴏᴍᴍᴀɴᴅs...\n'));
})();

// ==================== SHUTDOWN HANDLERS ====================

const shutdown = async (signal) => {
  console.log(`\n🛑 ʀᴇᴄᴇɪᴠᴇᴅ ${signal}. sᴀᴠɪɴɢ ᴅᴀᴛᴀ...`);
  await saveData();
  console.log('✅ ᴅᴀᴛᴀ sᴀᴠᴇᴅ. sʜᴜᴛᴛɪɴɢ ᴅᴏᴡɴ...');
  bot.stopPolling();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('message', (msg) => {
  if (msg === 'shutdown') shutdown('PM2_SHUTDOWN');
});

module.exports = { bot };