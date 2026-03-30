import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('../webhook.handler.js', () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { webhookRoutes } from '../webhook.routes.js'
import { dispatchWebhook } from '../webhook.handler.js'

const mockDispatch = vi.mocked(dispatchWebhook)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(webhookRoutes)
  await app.ready()
  return app
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /memberkit (webhook route)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 { ok: true } for a valid member.created payload', async () => {
    const payload = {
      event: 'member.created',
      fired_at: '2024-01-01T00:00:00Z',
      data: { id: 1, name: 'Test User', email: 'test@test.com' },
    }

    const res = await app.inject({ method: 'POST', url: '/memberkit', payload })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('calls dispatchWebhook asynchronously after returning 200', async () => {
    const payload = {
      event: 'member.updated',
      fired_at: '2024-01-01T00:00:00Z',
      data: { id: 2 },
    }

    await app.inject({ method: 'POST', url: '/memberkit', payload })
    // Flush microtask queue so the async dispatch runs
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(mockDispatch).toHaveBeenCalledOnce()
    expect(mockDispatch.mock.calls[0]?.[0]?.event).toBe('member.updated')
  })

  it('returns 401 when event field is missing from payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/memberkit',
      payload: { data: { id: 1 } }, // missing "event"
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when payload is an empty object', async () => {
    const res = await app.inject({ method: 'POST', url: '/memberkit', payload: {} })

    expect(res.statusCode).toBe(401)
  })

  it('does NOT call dispatchWebhook when validation fails', async () => {
    await app.inject({ method: 'POST', url: '/memberkit', payload: { bad: 'payload' } })

    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('still returns 200 even if dispatchWebhook rejects asynchronously', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('async failure'))

    const payload = {
      event: 'lesson_status_saved',
      fired_at: '2024-01-01T00:00:00Z',
      data: { lesson_id: 5 },
    }

    const res = await app.inject({ method: 'POST', url: '/memberkit', payload })

    expect(res.statusCode).toBe(200)
  })
})
