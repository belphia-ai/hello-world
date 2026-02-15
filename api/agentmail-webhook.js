const withCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  return handler(req, res)
}

const handler = async (_req, res) => {
  // AgentMail automation is intentionally paused.
  return res.status(200).json({ ok: true, disabled: true })
}

export default withCors(handler)
