import { AgentMailClient } from 'agentmail'

const INBOX_ID = 'minnie@agentmail.to'

const FALLBACK_REPLY = (name = 'there') =>
  `Hey ${name},\n\n` +
  `Thanks for your email — got it. I’ve logged your question and I’m preparing a direct answer.\n\n` +
  `To move faster, feel free to include:\n` +
  `• target budget\n` +
  `• timeline\n` +
  `• your top priority (cost, speed, or quality)\n\n` +
  `You’ll get a specific follow-up from me shortly.\n\n` +
  `– Minnie`

const withCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  return handler(req, res)
}

const handler = async (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    // Only care about inbound message events.
    if (payload?.event_type !== 'message.received') {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const message = payload?.message || {}
    const inboxId = (message?.inbox_id || '').toLowerCase()
    if (inboxId !== INBOX_ID) {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const fromFirst = Array.isArray(message?.from) ? message.from[0] : null
    const senderEmail = (fromFirst?.email || '').toLowerCase()
    const senderName = (fromFirst?.name || senderEmail.split('@')[0] || 'there').trim()

    if (!senderEmail || senderEmail === INBOX_ID) {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const apiKey = process.env.AGENTMAIL_API_KEY
    if (!apiKey) {
      console.error('agentmail webhook error: AGENTMAIL_API_KEY missing')
      return res.status(500).json({ error: 'missing AGENTMAIL_API_KEY' })
    }

    const subjectRaw = message?.subject || 'Follow-up from Minnie'
    const subject = /^re:/i.test(subjectRaw) ? subjectRaw : `Re: ${subjectRaw}`

    const client = new AgentMailClient({ apiKey })
    const inboundMessageId = message?.message_id || undefined

    await client.inboxes.messages.send(INBOX_ID, {
      to: senderEmail,
      subject,
      text: FALLBACK_REPLY(senderName),
      headers: inboundMessageId
        ? {
            'In-Reply-To': inboundMessageId,
            References: inboundMessageId,
          }
        : undefined,
    })

    return res.status(200).json({ ok: true, sent: true })
  } catch (error) {
    console.error('agentmail webhook error', error)
    return res.status(500).json({ error: 'webhook processing failed' })
  }
}

export default withCors(handler)
