
const makeWASocket = require('@whiskeysockets/baileys').default
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode')
const http = require('http')
const OpenAI = require('openai')
require('dotenv').config()

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
})

let qrCodeData = null
let isReady = false

const server = http.createServer(async (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'})
  if (isReady) {
    res.end(`<html><body style="background:#000;color:#0f0;text-align:center;font-family:Arial">
      <h1>FasahaNova connectee!</h1>
      <p>L agent repond automatiquement</p>
    </body></html>`)
  } else if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData)
    res.end(`<html><body style="background:#000;color:#fff;text-align:center;font-family:Arial">
      <h1>Scanner ce QR Code</h1>
      <p>WhatsApp - Appareils connectes - Scanner</p>
      <img src="${qrImage}" style="width:300px"/>
      <p>Actualise si expire</p>
    </body></html>`)
  } else {
    res.end(`<html><body style="background:#000;color:#fff;text-align:center;font-family:Arial">
      <h1>FasahaNova demarre...</h1>
      <p>Actualise dans 15 secondes</p>
    </body></html>`)
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log('Serveur demarre!')
})

async function askHermes(message) {
  try {
    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        {
          role: "system",
          content: "Tu es FasahaNova, assistante virtuelle pour boutiques mode et beaute au Niger. Tu reponds en francais, tu es polie et efficace."
        },
        { role: "user", content: message }
      ]
    })
    return response.choices[0].message.content
  } catch(e) {
    return "Bonjour! Je suis FasahaNova. Comment puis-je vous aider?"
  }
}

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['FasahaNova', 'Chrome', '1.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (qr) {
      qrCodeData = qr
      isReady = false
      console.log('QR Code pret! Va sur ton URL Render')
    }
    
    if (connection === 'open') {
      isReady = true
      qrCodeData = null
      console.log('FasahaNova connectee a WhatsApp!')
    }
    
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnexion...')
        setTimeout(connectWhatsApp, 5000)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    
    const text = msg.message.conversation || 
      msg.message.extendedTextMessage?.text || ''
    
    if (!text) return
    
    console.log('Message recu:', text)
    const response = await askHermes(text)
    
    await sock.sendMessage(msg.key.remoteJid, { text: response })
    console.log('Reponse envoyee!')
  })
}

connectWhatsApp()
