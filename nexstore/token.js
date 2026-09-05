const BOT_TOKEN = process.env.BOT_TOKEN;
const startupPassword = process.env.STARTUP_PASSWORD || '';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set. Add BOT_TOKEN in Railway Variables.');
}

module.exports = {
  BOT_TOKEN,
  startupPassword
};
