import { randomUUID } from 'node:crypto'
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
    const inboxId = (process.env.AGENTMAIL_INBOX_ID || 'uptightsmile451@agentmail.to').toLowerCase()

    const internalText = `New lead from belphia-ai.com\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Company: ${company || 'n/a'}\n` +
      `Urgency: ${urgency || 'n/a'}\n` +
      `Message:\n${message}`

    // Single-response model: create one internal lead relay only.
    // Sales reply is handled by the lead poller/webhook logic.
    await client.inboxes.messages.send(inboxId, {
      to: inboxId,
      subject: `New inbound lead · ${name}`,
      text: internalText,
    })

    const conversionEvent = {
      event: 'contact_form_submitted',
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'belphia-ai.com',
      hasCompany: Boolean(company?.trim()),
      urgency: urgency || 'n/a',
      messageLength: message.trim().length,
    }

    console.info('conversion_event', conversionEvent)

    return res.status(200).json({ ok: true, eventId: conversionEvent.eventId })
  } catch (error) {
    console.error('contact form error', error)
    return res.status(500).json({ error: 'Unable to submit form right now.' })
  }
}

export default withCors(handler)
