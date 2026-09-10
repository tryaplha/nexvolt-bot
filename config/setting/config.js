const fs = require('fs')

// ===== BOT IDENTITY =====
global.owner = ['2349044773929']           // owner number (final)
global.ownernumber = '2349044773929'       // creator number
global.OWNER_NAME = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.DEVELOPER = ["2349044773929"]
global.BOT_NAME = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.botName = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.botname = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.bankowner = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.creatorName = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"
global.ownername = '𝗡𝗘𝗫𝗩𝗢𝗟𝗧 𝗗𝗘𝗩 '
global.author = "𝗡𝗘𝗫𝗩𝗢𝗟𝗧 𝗗𝗘𝗩 "        // final (was set twice)
global.creator = "2349044773929@s.whatsapp.net"

// ===== BOT SETTINGS =====
global.status = false                      // "self/public" section
global.prefa = ['','!','.','#','&']        // prefixes (final, was set twice)
global.xprefix = '.'
global.version = "1.0.1"
global.themeemoji = "🥷"
global.location = "Nigeria,lagos island"

// ===== LINKS & MEDIA =====
global.gambar = "https://cdn.tmp.malvryx.dev/files/mxv_39ySA4EXu.jpeg"
global.thumbnail = 'https://cdn.tmp.malvryx.dev/files/mxv_39ySA4EXu.jpeg'
global.link = "https://chat.whatsapp.com/JcSmOE5WK0t2bxC5dhFwk6?s=cl&p=a&mlu=0&ilr=4"
global.wagc = 'https://chat.whatsapp.com/JcSmOE5WK0t2bxC5dhFwk6?s=cl&p=a&mlu=0&ilr=4'
global.richpp = ' '
global.packname = "Sticker By 𝗡𝗘𝗫𝗩𝗢𝗟𝐓 𝗗𝗘𝗩"

// ===== MENU IMAGE =====
global.menuImage = __dirname + '/../media/logo.jpg'   // local file used as the menu thumbnail

// ===== NEWSLETTER / CHANNEL CONTEXT =====
// Used to make bot messages show a "forwarded from channel" tag with a View channel button.
global.newsletterJid = "YOUR_NEW_NEWSLETTER_JID"
global.newsletterName = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"

// ===== DISPLAY =====
global.footer = "⚡ 𝐍𝐄𝐗𝐕𝐎𝐋𝐓 𝐌𝐃 〽️"             // final (was set twice)
global.onlyowner = `Only 𝗡𝗘𝗫𝗩𝗢𝗟𝗧 𝗗𝗘𝗩 can use this Command 🥶🥷`
global.database = `*To Exist In The Database Contact The Owner of this bot*`

// ===== FEATURES =====
global.autobio = true                      // auto update bio
global.hituet = 0
global.autoviewstatus = false
global.autoread = false                    // auto read messages
global.anti92 = true                       // auto block +92
global.autoswview = true                   // auto view status/story

// ===== MESSAGES =====
global.mess = {
    wait: "*Configurating.......*",
    success: "*Successfully acknowledged ☑️*",
    on: "*Activated ✅*",
    prem: "*Feature For Premium Users only*",
    off: "*Deactivated 📛*",
    query: {
        text: "*Please, Provide A Text Query 📑*",
        link: "Please, provide a valid link 🔗*",
    },
    error: {
        fitur: "*Status 🌐: Feature Or Command error ❌*",
    },
    only: {
        group: "*Group only feature ❌*",
        private: "*Private chat feature only ❌*",
        owner: "*Owner feature only ❌*",
        admin: "*bot owner feature only ❌*",
        badmin: "*Seek admin privilege's to use this command ❌*",
        premium: "*Availabe for premium users only ❌*",
    }
}

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})

//Property of Violetkingdev  
//owner number:+2347059886720
//telegram :@VIOLETKINGDEV
