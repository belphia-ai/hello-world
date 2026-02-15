import { AgentMailClient } from 'agentmail'

const INBOX_ID = 'minnie@agentmail.to'

const SYSTEM_SENDER_PATTERNS = [
  'no-reply@',
  'noreply@',
  'do-not-reply@',
  'donotreply@',
  'notifications@',
  'mailer-daemon@',
  'postmaster@',
]

const withCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  return handler(req, res)
}

const isSystemSender = (email = '') => {
  const e = String(email).toLowerCase()
  return SYSTEM_SENDER_PATTERNS.some((p) => e.includes(p))
}

const normalizeReplySubject = (subject) => {
  if (!subject) return 'Re: Follow-up from Minnie'
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`
}

const firstName = (name = '', email = '') => {
  const raw = String(name || '').trim() || String(email || '').split('@')[0]
  const token = raw.split(/\s+/)[0] || 'there'
  return token.replace(/[ ,.'"()]/g, '') || 'there'
}

const composeReply = (name = 'there', text = '') => {
  const msg = String(text || '').toLowerCase()

  if (['price', 'pricing', 'how much', 'cost', 'quote'].some((k) => msg.includes(k))) {
    return (
      `Hey ${name},\n\n` +
      `Great question. For a sales-agent setup, pricing depends on channels, lead volume, and whether booking is included.\n\n` +
      `If you share those 3 details, I’ll send a fixed quote and rollout timeline in my next reply.\n\n` +
      `– Minnie`
    )
  }

  if (['dealership', 'used car', 'car dealership', 'autotrader', 'whatsapp', 'facebook ads'].some((k) => msg.includes(k))) {
    return (
      `Hey ${name},\n\n` +
      `Perfect — I can run this as a dealership sales workflow.\n\n` +
      `I’ll handle:\n` +
      `• rapid first response\n` +
      `• lead qualification\n` +
      `• follow-up sequences\n` +
      `• daily sales summary\n\n` +
      `Reply with monthly lead volume + channels + whether you want appointment booking and I’ll send your scoped implementation + pricing.\n\n` +
      `– Minnie`
    )
  }

  return (
    `Hey ${name},\n\n` +
    `Thanks — I can help scope this properly.\n\n` +
    `To give you a concrete plan + price, reply with:\n` +
    `• monthly lead volume\n` +
    `• channels in use (website, ads, WhatsApp, etc.)\n` +
    `• CRM today (or none)\n` +
    `• whether you want appointment booking included\n\n` +
    `Once I have that, I’ll send your exact implementation and quote.\n\n` +
    `– Minnie`
  )
}

const handler = async (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    if (payload?.event_type !== 'message.received') {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const message = payload?.message || {}
    const inboxId = String(message?.inbox_id || '').toLowerCase()
    if (inboxId !== INBOX_ID) {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const fromFirst = Array.isArray(message?.from) ? message.from[0] : null
    const senderEmail = String(fromFirst?.email || '').toLowerCase()
    const senderName = firstName(fromFirst?.name, senderEmail)

    if (!senderEmail || senderEmail === INBOX_ID || isSystemSender(senderEmail)) {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const apiKey = process.env.AGENTMAIL_API_KEY
    if (!apiKey) {
      console.error('agentmail webhook error: AGENTMAIL_API_KEY missing')
      return res.status(500).json({ error: 'missing AGENTMAIL_API_KEY' })
    }

    const subject = normalizeReplySubject(message?.subject)
    const inboundMessageId = message?.message_id || undefined
    const inboundText = message?.text || message?.html || message?.preview || ''

    const client = new AgentMailClient({ apiKey })
    await client.inboxes.messages.send(INBOX_ID, {
      to: senderEmail,
      subject,
      text: composeReply(senderName, inboundText),
      headers: inboundMessageId
        ? {
            'In-Reply-To': inboundMessageId,
            References: inboundMessageId,
          }
        : undefined,
    })

    return res.status(200).json({ ok: true, sent: true, mode: 'active' })
  } catch (error) {
    console.error('agentmail webhook error', error)
    return res.status(500).json({ error: 'webhook processing failed' })
  }
}

export default withCors(handler)
