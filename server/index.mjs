import { createServer } from 'node:http'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res, status, body) {
  withCors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const MAX_BODY_BYTES = 64 * 1024

class BodyTooLarge extends Error {}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new BodyTooLarge('Request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function callClaude(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Model response did not contain JSON')
  }
  return JSON.parse(jsonMatch[0])
}

async function handleStructureSignal(req, res) {
  const input = await readBody(req)
  const systemPrompt =
    'You are the business-data intake layer of Otel Digital, an AI marketing operating system for hotels. ' +
    'A department manager sends a free-text update about demand or bookings. Extract it into structured signal data. ' +
    'Respond with ONLY a JSON object matching this shape: ' +
    '{"summary": string, "extractedFields": {[key: string]: string}, "confidence": "High"|"Medium"|"Low", "requiresConfirmation": boolean}. ' +
    'requiresConfirmation should be true unless the manager gave precise, unambiguous figures. ' +
    'When sourceType is file_upload, the update contains the text of a report (often CSV): extract its key figures and the period they cover, ' +
    'using short camelCase keys, and never invent figures that are not in the text.'

  const userPrompt = `Business area: ${input.businessArea}\nSource type: ${input.sourceType}\nManager update: "${input.message}"`

  try {
    const result = await callClaude(systemPrompt, userPrompt)
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 502, { error: String(error.message || error) })
  }
}

async function handleRecommendation(req, res) {
  const input = await readBody(req)
  const systemPrompt =
    'You are the AI decision layer of Otel Digital, an AI marketing operating system for hotels. ' +
    'Given a hotel business area with its current metrics, offer, and recent signal, decide what should happen next. ' +
    'Not every signal deserves a new campaign — choose the most honest outcome. ' +
    'Respond with ONLY a JSON object matching this shape: ' +
    '{"title": string, "summary": string, "confidence": "High"|"Medium"|"Low", "priority": "High"|"Medium"|"Low", "reasons": string[], "avoid": string[], ' +
    '"outcome": "Campaign"|"Corporate action"|"OTA/distribution review"|"Monitor only"|"Revenue review", "alternatives": string[]}. ' +
    'reasons should be 2-4 short bullet points citing the data given. avoid should be 1-3 short bullet points of what not to do right now. ' +
    'alternatives should be 2 other ideas the manager could consider instead. ' +
    'Treat sourceState honestly: never give High confidence when the data is Detected, Stale or Unavailable. ' +
    'Use activeOffers and upcomingDates as inputs; prefer promoting an existing offer over inventing a discount. ' +
    'hotelRules are non-negotiable rules set by the hotel: never recommend anything that breaks them, and reflect them in avoid. ' +
    'Use "Monitor only" when the signal is too thin or recent action is already in flight; use "Revenue review" when the issue is pricing/rate strategy rather than marketing; ' +
    'use "OTA/distribution review" when the gap looks like a channel-mix problem; use "Corporate action" when it needs a decision above the department head.'

  const userPrompt = JSON.stringify(input, null, 2)

  try {
    const result = await callClaude(systemPrompt, userPrompt)
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 502, { error: String(error.message || error) })
  }
}

async function handleNextRecommendation(req, res) {
  const input = await readBody(req)
  const systemPrompt =
    'You are the results-and-learning layer of Otel Digital, an AI marketing operating system for hotels. ' +
    'A campaign just finished. Given its business area, offer, and result metrics, say what worked, what to change, and propose one specific next recommendation. ' +
    'Respond with ONLY a JSON object matching this shape: ' +
    '{"whatWorked": string, "nextRecommendation": string}. Keep each field to one concise sentence.'

  const userPrompt = JSON.stringify(input, null, 2)

  try {
    const result = await callClaude(systemPrompt, userPrompt)
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 502, { error: String(error.message || error) })
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    withCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  try {
    if (req.method === 'POST' && req.url === '/api/ai/structure-signal') {
      await handleStructureSignal(req, res)
      return
    }
    if (req.method === 'POST' && req.url === '/api/ai/recommendation') {
      await handleRecommendation(req, res)
      return
    }
    if (req.method === 'POST' && req.url === '/api/ai/next-recommendation') {
      await handleNextRecommendation(req, res)
      return
    }
    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    if (error instanceof BodyTooLarge) {
      sendJson(res, 413, { error: 'Request body too large' })
      return
    }
    sendJson(res, 500, { error: String(error.message || error) })
  }
})

server.listen(PORT, () => {
  console.log(`Otel Digital AI server listening on http://localhost:${PORT}`)
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — AI endpoints will return 502 until it is configured.')
  }
})
