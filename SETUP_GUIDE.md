# 🤖 Nexvolt Bot - Setup Guide

## Step 1: Create .env file

On your computer, create a file called `.env` (no extension!) in the bot folder:

```
BOT_TOKEN=your_bot_token_here
STARTUP_PASSWORD=your_password_here
```

**Important:**
- The file is called `.env` (starts with a dot)
- Replace `your_bot_token_here` with your ACTUAL token from @BotFather
- Replace `your_password_here` with your preferred password

## Step 2: The .env file is already protected!

I've already added `.env` to `.gitignore`, so:
- ✅ Your token will NEVER be uploaded to GitHub
- ✅ Only you know your token
- ✅ The code in GitHub is safe

## Step 3: Run the bot

```bash
npm install
npm start
```

The bot will read your token from `.env` automatically.

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `.env.example` | Template showing format (safe to push) |
| `.gitignore` | Excludes `.env`, `session/token.js`, secrets |
| `session/token.js` | Reads token from environment (secure) |

## 🔒 Security Status

- ✅ No hardcoded tokens in code
- ✅ `.env` excluded from git
- ✅ `.env.example` shows format without real token
- ✅ Pushed to GitHub safely

---

**You're all set!** Just create the `.env` file with your real token and you're good to go! 🚀
