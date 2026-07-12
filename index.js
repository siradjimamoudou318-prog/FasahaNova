const { default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState 
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const OpenAI = require('openai')
const http = require('http')
const qrcode = require('qrcode')
require('dotenv').config()

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
})

let qrCodeData = null

// Serveur web pour afficher le QR Code
const server = http.createServer(async (req, res) => {
  if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData)
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end(`
      <html>
        <body style="text-align:center;background:#000;color:#fff">
          <h1>📱 FasahaNova - Scanner ce QR Code</h1>
          <p>Ouvre WhatsApp → Appareils connectés → Scanner</p>
          <img src="${qrImage}" style="width:300px"/>
          <p>Actualise la page si le QR Code expire</p>
        </body>
      </html>
    `)
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end(`
      <html>
        <body style="text-align:center;background:#000;color:#fff">
          <h1>⏳ FasahaNova démarre...</h1>
          <p>Actualise dans 10 secondes</p>
        </body>
      </html>
    `)
  }
})

server.listen(3000, () => {
  console.log('✅ Serveur QR Code démarré sur port 3000')
})

async function askHermes(message) {
  const response = await openai.chat.completions.create({
    model: "mistralai/mistral-7b-instruct:free",
    messages: [
      {
        role: "system",
        content: `Tu es FasahaNova, une assistante virtuelle 
professionnelle pour boutiques de mode et beauté au Niger. 
Tu réponds en français, tu es polie et efficace.
Tu aides les clients avec : robes, bazins, accessoires, 
produits de beauté, salon de coiffure, couture.`
      },
      { role: "user", content: message }
    ]
  })
  return response.choices[0].message.content
}

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (qr) {
      qrCodeData = qr
      console.log('📱 QR Code prêt ! Va sur ton URL Render pour le scanner')
    }
    
    if (connection === 'close') {
      const shouldReconnect = 
        new Boom(lastDisconnect?.error)?.output?.statusCode 
        !== DisconnectReason.loggedOut
      if (shouldReconnect) connectWhatsApp()
    } else if (connection === 'open') {
      qrCodeData = null
      console.log('✅ FasahaNova connectée à WhatsApp!')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    
    const text = msg.message.conversation || 
      msg.message.extendedTextMessage?.text || ''
    
    if (!text) return
    
    console.log('📩 Message reçu:', text)
    const response = await askHermes(text)
    await sock.sendMessage(msg.key.remoteJid, { text: response })
    console.log('✅ Réponse envoyée!')
  })
}

connectWhatsApp()
