import { AgentMailClient } from 'agentmail'

const withCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return handler(req, res)
}

const handler = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { name, email, company, urgency, message } = body

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Name, email, and message are required.' })
    }

    const apiKey = process.env.AGENTMAIL_API_KEY
    if (!apiKey) {
      console.error('contact form error: AGENTMAIL_API_KEY missing')
      return res.status(500).json({ error: 'Server misconfigured: missing outbound email channel. Ping Minnie.' })
    }

    const client = new AgentMailClient({ apiKey })
    const inboxId = 'minnie@agentmail.to'

    const internalText = `New lead from belphia-ai.com\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Company: ${company || 'n/a'}\n` +
      `Urgency: ${urgency || 'n/a'}\n` +
      `Message:\n${message}`

    await client.inboxes.messages.send(inboxId, {
      to: 'minnie@agentmail.to',
      subject: `New inbound lead · ${name}`,
      text: internalText,
    })

    await client.inboxes.messages.send(inboxId, {
      to: email,
      subject: 'Received – Minnie from Belphia Autonomous',
      text: `Hey ${name},\n\nThanks for reaching out. I have your brief (see below) and will follow up shortly.\n\n———\n${message}`,
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('contact form error', error)
    return res.status(500).json({ error: 'Unable to submit form right now.' })
  }
}

export default withCors(handler)
