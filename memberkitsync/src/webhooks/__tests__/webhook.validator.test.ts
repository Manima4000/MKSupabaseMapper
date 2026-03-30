import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { parseWebhookBody } from '../webhook.validator.js'
import { WebhookValidationError } from '../../shared/errors.js'

// validateWebhookSignature reads env.WEBHOOK_SECRET at call time.
// We import it dynamically inside tests that need it so we can control
// the env value without mocking the entire env module.

// ---------------------------------------------------------------------------
// parseWebhookBody — pure validation, no external deps
// ---------------------------------------------------------------------------

describe('parseWebhookBody', () => {
  it('returns a valid envelope when event and data are present', () => {
    const body = {
      event: 'member.created',
      fired_at: '2024-01-01T00:00:00Z',
      data: { id: 1, name: 'Test' },
    }

    const result = parseWebhookBody(body)

    expect(result.event).toBe('member.created')
    expect(result.fired_at).toBe('2024-01-01T00:00:00Z')
    expect(result.data).toEqual({ id: 1, name: 'Test' })
  })

  it('defaults fired_at to current ISO string when missing', () => {
    const body = { event: 'member.updated', data: {} }

    const result = parseWebhookBody(body)

    // Should be a valid ISO date string close to now
    expect(() => new Date(result.fired_at)).not.toThrow()
    expect(result.fired_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('defaults data to empty object when data is null', () => {
    const body = { event: 'enrollment.created', data: null }

    const result = parseWebhookBody(body as Record<string, unknown>)

    expect(result.data).toEqual({})
  })

  it('throws WebhookValidationError when data field is missing', () => {
    const body = { event: 'enrollment.created' }

    expect(() => parseWebhookBody(body as Record<string, unknown>)).toThrow(WebhookValidationError)
  })

  it('throws WebhookValidationError when body is null', () => {
    expect(() => parseWebhookBody(null)).toThrow(WebhookValidationError)
  })

  it('throws WebhookValidationError when body is a string', () => {
    expect(() => parseWebhookBody('invalid')).toThrow(WebhookValidationError)
  })

  it('throws WebhookValidationError when body is missing the event field', () => {
    expect(() => parseWebhookBody({ data: {} })).toThrow(WebhookValidationError)
  })

  it('throws WebhookValidationError when event is not a string', () => {
    expect(() => parseWebhookBody({ event: 123, data: {} })).toThrow(WebhookValidationError)
  })

  it('throws with message "Payload de webhook malformado" for null body', () => {
    try {
      parseWebhookBody(null)
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookValidationError)
      expect((err as WebhookValidationError).message).toBe('Payload de webhook malformado')
    }
  })
})

// ---------------------------------------------------------------------------
// validateWebhookSignature — HMAC-SHA256 validation
// We test by computing the expected HMAC ourselves and comparing.
// ---------------------------------------------------------------------------

describe('validateWebhookSignature', () => {
  const SECRET = 'test-secret-key'
  const body = JSON.stringify({ event: 'member.created', data: {} })

  function sign(secret: string, rawBody: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  }

  it('does not throw when WEBHOOK_SECRET is empty (skip validation)', async () => {
    // env.WEBHOOK_SECRET is '' (set by setup.ts), so validation is skipped
    const { validateWebhookSignature } = await import('../webhook.validator.js')

    expect(() => validateWebhookSignature(body, undefined)).not.toThrow()
    expect(() => validateWebhookSignature(body, 'sha256=wrongsig')).not.toThrow()
  })

  it('throws when signature header is missing and secret is set', async () => {
    // Override the env module for this test
    const { WebhookValidationError: WVE } = await import('../../shared/errors.js')

    // Temporarily set the secret on the parsed env object
    // (env is a plain object created at module init time)
    const envMod = await import('../../config/env.js')
    const originalSecret = envMod.env.WEBHOOK_SECRET
    ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = SECRET

    const { validateWebhookSignature } = await import('../webhook.validator.js')

    try {
      expect(() => validateWebhookSignature(body, undefined)).toThrow(WVE)
    } finally {
      ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = originalSecret
    }
  })

  it('throws when signature format is invalid (no "sha256=" prefix)', async () => {
    const envMod = await import('../../config/env.js')
    const originalSecret = envMod.env.WEBHOOK_SECRET
    ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = SECRET

    const { validateWebhookSignature } = await import('../webhook.validator.js')

    try {
      expect(() => validateWebhookSignature(body, 'invalid-format')).toThrow()
    } finally {
      ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = originalSecret
    }
  })

  it('does not throw when signature is valid', async () => {
    const envMod = await import('../../config/env.js')
    const originalSecret = envMod.env.WEBHOOK_SECRET
    ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = SECRET

    const { validateWebhookSignature } = await import('../webhook.validator.js')
    const validSig = sign(SECRET, body)

    try {
      expect(() => validateWebhookSignature(body, validSig)).not.toThrow()
    } finally {
      ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = originalSecret
    }
  })

  it('throws when signature is valid format but wrong secret', async () => {
    const envMod = await import('../../config/env.js')
    const originalSecret = envMod.env.WEBHOOK_SECRET
    ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = SECRET

    const { validateWebhookSignature } = await import('../webhook.validator.js')
    const wrongSig = sign('wrong-secret', body)

    try {
      expect(() => validateWebhookSignature(body, wrongSig)).toThrow(WebhookValidationError)
    } finally {
      ;(envMod.env as Record<string, unknown>)['WEBHOOK_SECRET'] = originalSecret
    }
  })
})
