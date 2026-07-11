const { default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState 
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const OpenAI = require('openai')
require('dotenv').config()

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
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
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = 
        new Boom(lastDisconnect?.error)?.output?.statusCode 
        !== DisconnectReason.loggedOut
      if (shouldReconnect) connectWhatsApp()
    } else if (connection === 'open') {
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
    
    await sock.sendMessage(msg.key.remoteJid, { 
      text: response 
    })
    
    console.log('✅ Réponse envoyée!')
  })
}

connectWhatsApp()
