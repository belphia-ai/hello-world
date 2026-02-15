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

    // Webhook is intentionally passive right now.
    // Sales follow-up is controlled by the poller in "initial form request only" mode.
    if (payload?.event_type !== 'message.received') {
      return res.status(200).json({ ok: true, ignored: true })
    }

    return res.status(200).json({ ok: true, ignored: true, mode: 'passive' })
  } catch (error) {
    console.error('agentmail webhook error', error)
    return res.status(500).json({ error: 'webhook processing failed' })
  }
}

export default withCors(handler)
