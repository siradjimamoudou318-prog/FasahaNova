const { Client, LocalAuth } = require('whatsapp-web.js')
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
  res.writeHead(200, {'Content-Type': 'text/html'})
  if (isReady) {
    res.end(`<html><body style="background:#000;color:#0f0;text-align:center">
      <h1>✅ FasahaNova est connectée à WhatsApp!</h1>
      <p>L'agent répond automatiquement aux messages</p>
    </body></html>`)
  } else if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData)
    res.end(`<html><body style="background:#000;color:#fff;text-align:center">
      <h1>📱 Scanner ce QR Code avec WhatsApp</h1>
      <p>WhatsApp → Appareils connectés → Scanner</p>
      <img src="${qrImage}" style="width:300px"/>
      <p>Actualise si expiré</p>
    </body></html>`)
  } else {
    res.end(`<html><body style="background:#000;color:#fff;text-align:center">
      <h1>⏳ FasahaNova démarre...</h1>
      <p>Actualise dans 15 secondes</p>
    </body></html>`)
  }
})

server.listen(process.env.PORT || 3000)

async function askHermes(message) {
  const response = await openai.chat.completions.create({
    model: "mistralai/mistral-7b-instruct:free",
    messages: [
      {
        role: "system",
        content: `Tu es FasahaNova, assistante virtuelle pour boutiques mode et beauté au Niger. Tu réponds en français, tu es polie et efficace. Tu aides avec : robes, bazins, accessoires, beauté, coiffure, couture.`
      },
      { role: "user", content: message }
    ]
  })
  return response.choices[0].message.content
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
})

client.on('qr', (qr) => {
  qrCodeData = qr
  console.log('📱 QR Code généré!')
})

client.on('ready', () => {
  isReady = true
  qrCodeData = null
  console.log('✅ FasahaNova connectée!')
})

client.on('message', async (msg) => {
  if (msg.fromMe) return
  console.log('📩 Message:', msg.body)
  const response = await askHermes(msg.body)
  msg.reply(response)
  console.log('✅ Réponse envoyée!')
})

client.initialize()()
