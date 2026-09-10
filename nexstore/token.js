require('dotenv').config();

const BOT_TOKEN = (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const startupPassword = process.env.STARTUP_PASSWORD || 'nexvolt';

if (!BOT_TOKEN) {
  console.error('❌ Telegram BOT_TOKEN is missing. Set BOT_TOKEN in Railway Variables (or TELEGRAM_BOT_TOKEN).');
}

module.exports = {
  BOT_TOKEN,
  startupPassword
};
