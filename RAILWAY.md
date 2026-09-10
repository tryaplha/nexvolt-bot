# Nexvolt MD — Railway deployment

## Railway Variables
Add these in the Railway service Variables:

- `BOT_TOKEN` = your Telegram bot token from @BotFather (required for Telegram pairing)
- `AUTO_START` = `true`
- `STARTUP_PASSWORD` = a strong password (kept for local/manual starts)

`TELEGRAM_BOT_TOKEN` is also accepted as an alias for `BOT_TOKEN`.

The Telegram token is intentionally **not stored in the source code**. The app now stops trying to initialize Telegram when the variable is missing, instead of producing repeated `EFATAL: Telegram Bot Token not provided` errors.

## Deploy
1. Upload/push this project to GitHub.
2. In Railway, create a new project and deploy the GitHub repository.
3. Railway should detect Node.js automatically.
4. Open the service **Variables** tab and add `BOT_TOKEN`.
5. Redeploy the service.

## WhatsApp sessions
WhatsApp sessions are stored under `storage/session-data/pairing/`. The Railway filesystem is ephemeral unless a Volume is attached. Attach a Railway Volume and mount it so pairing credentials survive restarts and redeploys.

The pairing code/session implementation uses an absolute project-rooted path and recreates the session directory before credential writes. This prevents the `ENOENT .../creds.json` errors caused by a missing session directory during reconnects.

## Security
Do not commit real bot tokens, session credentials, or `.env` files to GitHub. If a real Telegram token has been exposed in a chat, screenshot, repository, or log, revoke it with @BotFather and create a replacement before production use.
