// Vercel Function: GET lists the feedback chat, POST sends a message. Storage: Upstash Redis.
import { chatResponse, senderFrom } from '../server/chatStore.mjs'

export default async function handler(req, res) {
  const { status, body } = await chatResponse({
    method: req.method,
    body: typeof req.body === 'string' ? safeJson(req.body) : req.body,
    sender: senderFrom(req.headers, req.socket?.remoteAddress),
  })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
