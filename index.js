const http = require('http')
const https = require('https')
const OpenAI = require('openai')
require('dotenv').config()

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
})

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID
const VERIFY_TOKEN = process.env.VERIFY_TOKEN

async function askHermes(message) {
  try {
    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        {
          role: "system",
          content: "Tu es FasahaNova, assistante virtuelle pour boutiques mode et beaute au Niger. Tu reponds en francais, tu es polie et efficace. Tu aides avec robes, bazins, accessoires, beaute, coiffure, couture."
        },
        { role: "user", content: message }
      ]
    })
    return response.choices[0].message.content
  } catch(e) {
    return "Bonjour! Je suis FasahaNova. Comment puis-je vous aider?"
  }
}

async function sendWhatsAppMessage(to, message) {
  const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: message }
  })

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v18.0/${PHONE_NUMBER_ID}/messages`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verifie!')
      res.writeHead(200)
      res.end(challenge)
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end('<h1>FasahaNova est active!</h1>')
    }
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        const entry = data.entry?.[0]
        const change = entry?.changes?.[0]
        const message = change?.value?.messages?.[0]

        if (message && message.type === 'text') {
          const from = message.from
          const text = message.text.body
          console.log('Message recu de', from, ':', text)

          const response = await askHermes(text)
          await sendWhatsAppMessage(from, response)
          console.log('Reponse envoyee!')
        }
      } catch(e) {
        console.error('Erreur:', e)
      }
      res.writeHead(200)
      res.end('OK')
    })
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log('FasahaNova demarre!')
})
