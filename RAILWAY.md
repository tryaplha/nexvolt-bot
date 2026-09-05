# Nexvolt MD — Railway deployment

## Railway Variables
Add these in the Railway service Variables:

- `BOT_TOKEN` = your Telegram bot token
- `AUTO_START` = `true`
- `STARTUP_PASSWORD` = a strong password (kept for local/manual starts)

The Telegram token is intentionally **not stored in the source code**.

## Deploy
1. Upload/push this project to GitHub.
2. In Railway, create a new project and deploy the GitHub repository.
3. Railway should detect Node.js automatically.
4. Confirm the Variables above.
5. Deploy. The start command is `npm start`.

## WhatsApp sessions
This bot stores WhatsApp pairing sessions under `nexstore/pairing/`. Railway's normal filesystem is ephemeral. For sessions that must survive redeploys/restarts, attach a Railway Volume and mount it so the application's persistent storage is retained.

## Important
Do not commit real bot tokens, session credentials, or `.env` files to GitHub.
