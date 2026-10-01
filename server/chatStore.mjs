// Shared feedback chat store, used by the Vercel function (api/chat.js) and the local dev server.
// On Vercel it needs Upstash Redis (KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/TOKEN).
// Locally, without those, it falls back to in-memory storage so the chat works on localhost.
import { randomUUID } from 'node:crypto'

const KEY = 'otel:chat:messages'
const KEEP = 500
const LIST = 200
const RATE_LIMIT = 8 // messages per minute, per sender address
const MAX_NAME = 40
const MAX_TEXT = 1000

const memory = { messages: [], hits: new Map() }

function upstash() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

export function storageMode() {
  if (upstash()) return 'upstash'
  // Serverless instances don't share memory, so in-memory storage would silently lose messages.
  return process.env.VERCEL ? 'missing' : 'memory'
}

async function pipeline(commands) {
  const { url, token } = upstash()
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!response.ok) throw new Error(`Upstash responded ${response.status}`)
  const results = await response.json()
  const failed = results.find((item) => item.error)
  if (failed) throw new Error(failed.error)
  return results.map((item) => item.result)
}

const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max + 1)

function validate(input) {
  const name = clean(input?.name, MAX_NAME).replace(/\s+/g, ' ')
  const text = clean(input?.text, MAX_TEXT)
  const page = /^[a-z-]{1,30}$/.test(String(input?.page ?? '')) ? input.page : null
  if (!name) return { error: 'Add your name' }
  if (name.length > MAX_NAME) return { error: `Names can be up to ${MAX_NAME} characters` }
  if (!text) return { error: 'Write a message' }
  if (text.length > MAX_TEXT) return { error: `Messages can be up to ${MAX_TEXT} characters` }
  return { message: { id: randomUUID(), name, text, page, at: new Date().toISOString() } }
}

async function allowed(sender) {
  if (storageMode() === 'upstash') {
    const key = `otel:chat:rate:${sender}`
    const [count] = await pipeline([['INCR', key]])
    if (count === 1) await pipeline([['EXPIRE', key, 60]])
    return count <= RATE_LIMIT
  }
  const now = Date.now()
  const recent = (memory.hits.get(sender) ?? []).filter((time) => now - time < 60_000)
  recent.push(now)
  memory.hits.set(sender, recent)
  return recent.length <= RATE_LIMIT
}

async function list() {
  if (storageMode() === 'upstash') {
    const [raw] = await pipeline([['LRANGE', KEY, 0, LIST - 1]])
    return raw.map((item) => JSON.parse(item)).reverse()
  }
  return memory.messages.slice(-LIST)
}

async function add(message) {
  if (storageMode() === 'upstash') {
    await pipeline([
      ['LPUSH', KEY, JSON.stringify(message)],
      ['LTRIM', KEY, 0, KEEP - 1],
    ])
    return
  }
  memory.messages.push(message)
  if (memory.messages.length > KEEP) memory.messages.splice(0, memory.messages.length - KEEP)
}

/** Framework-free handler: returns { status, body } for GET (list) and POST (send). */
export async function chatResponse({ method, body, sender }) {
  if (storageMode() === 'missing') {
    return { status: 503, body: { error: 'Chat storage is not connected yet', code: 'not_configured' } }
  }
  try {
    if (method === 'GET') return { status: 200, body: { messages: await list(), storage: storageMode() } }
    if (method === 'POST') {
      const result = validate(body)
      if (result.error) return { status: 400, body: { error: result.error } }
      if (!(await allowed(sender || 'unknown'))) return { status: 429, body: { error: 'You’re sending messages quickly — wait a moment and try again' } }
      await add(result.message)
      return { status: 201, body: { message: result.message } }
    }
    return { status: 405, body: { error: 'Method not allowed' } }
  } catch (error) {
    return { status: 502, body: { error: 'Chat storage is unavailable right now', detail: String(error.message || error) } }
  }
}

/** Sender address for rate limiting. On Vercel the platform sets these headers, so clients can't spoof them. */
export function senderFrom(headers, fallback = '') {
  const first = (value) => String(value ?? '').split(',')[0].trim()
  return first(headers['x-vercel-forwarded-for']) || first(headers['x-real-ip']) || first(headers['x-forwarded-for']) || fallback || 'unknown'
}
