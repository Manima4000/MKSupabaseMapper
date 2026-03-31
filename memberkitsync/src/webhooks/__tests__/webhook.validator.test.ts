import { describe, it, expect } from 'vitest'
import { parseWebhookBody } from '../webhook.validator.js'
import { WebhookValidationError } from '../../shared/errors.js'

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
