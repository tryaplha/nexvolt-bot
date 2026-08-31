const fs = require('fs')

global.owner = "2348105514692" //owner number
global.footer = "Nexvolt Md" //footer section
global.status = false //"self/public" section of the bot
global.prefa = ['','!','.',',','🐤','🗿']
global.owner = ['2348105514692']
global.xprefix = '.'
global.gambar = "https://files.catbox.moe/sndoxo.jpg"
global.OWNER_NAME = "NEXVOLT DEV" //
global.DEVELOPER = ["2348105514692"] //
global.BOT_NAME = "Nexvolt Md"
global.bankowner = "Nexvolt Md"
global.creatorName = "Nexvolt Md"
global.ownernumber = '2348105514692'  //creator number
global.location = "Nigeria"
global.prefa = ['','!','.','#','&']
//================DO NOT CHANGE OR YOU'LL GET AN ERROR=============\
global.footer = "Nexvolt Md" //footer section
global.link = "https://whatsapp.com/channel/0029VbDhZnFC1FuDv6iKbp0i"
global.autobio = false//auto update bio
global.botName = "Nexvolt Md"
global.version = "1.0.1"
global.botname = "Nexvolt Md"
global.author = "NEXVOLT DEV"
global.themeemoji = "⚡"
global.wagc = 'https://whatsapp.com/channel/0029VbDhZnFC1FuDv6iKbp0i'
global.thumbnail = 'https://files.catbox.moe/sndoxo.jpg'
global.richpp = ' '
global.packname = "Nexvolt Md"
global.author = "NEXVOLT DEV"
global.creator = "2348105514692@s.whatsapp.net"
global.ownername = 'Nexvolt Md' 
global.onlyowner = `Only the owner can use this Command ⚡`
  // reply 
global.database = `*To Exist In The Database Contact The Owner of this bot*`
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

global.hituet = 0
//false=disable and true=enable
global.autoviewstatus = true
global.autoread = true //auto read messages
global.autobio = true //auto update bio
global.anti92 = false //auto block +92 
global.autoswview = true //auto view status/story

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})

//PROPERTY OF NEXVOLT DEV
//owner number:+2348105514692
//telegram :@teamG_tech

