require('dotenv').config();

const BOT_TOKEN = '8707482183:AAFuXjufOYHleWNldj997E7jz97PQvSDfo8';
const startupPassword = process.env.STARTUP_PASSWORD || 'nexvolt';

if (!BOT_TOKEN) {
  console.error('❌ Telegram BOT_TOKEN is missing. Set BOT_TOKEN in Railway Variables (or TELEGRAM_BOT_TOKEN).');
}

module.exports = {
  BOT_TOKEN,
  startupPassword
};
