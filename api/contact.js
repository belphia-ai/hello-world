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

    // Email sending is intentionally disabled for now.
    // Keep endpoint alive so site intake still works without breaking UX.
    console.info('contact_form_received_no_email_send', {
      source: 'belphia-ai.com',
      name,
      email,
      company: company || null,
      urgency: urgency || null,
      messageLength: message.trim().length,
      at: new Date().toISOString(),
    })

    return res.status(200).json({ ok: true, emailDelivery: 'disabled' })
  } catch (error) {
    console.error('contact form error', error)
    return res.status(500).json({ error: 'Unable to submit form right now.' })
  }
}

export default withCors(handler)
