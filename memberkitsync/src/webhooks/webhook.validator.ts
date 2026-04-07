import { env } from '../config/env.js'
import { WebhookValidationError } from '../shared/errors.js'
import type { MKWebhookEnvelope } from './webhook.types.js'

// Valida o api_key enviado como query param na URL do webhook
// MemberKit envia ?api_key=... na URL configurada
export function validateApiKey(apiKey: string | undefined): void {
  if (!env.WEBHOOK_API_KEY) return // sem chave configurada, skip

  if (!apiKey || apiKey !== env.WEBHOOK_API_KEY) {
    throw new WebhookValidationError('api_key inválido ou ausente')
  }
}

// Valida e faz parse do corpo do webhook
// MemberKit envia o tipo do evento no campo "type" (não "event")
export function parseWebhookBody(body: unknown): MKWebhookEnvelope {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new WebhookValidationError('Payload de webhook malformado')
  }

  const envelope = body as Record<string, unknown>

  // MemberKit usa "type", mas suportamos "event" como fallback
  const eventValue = envelope['type'] ?? envelope['event']

  if (typeof eventValue !== 'string') {
    throw new WebhookValidationError('Campo "type" ausente ou inválido')
  }

  return {
    event: eventValue,
    fired_at: typeof envelope['fired_at'] === 'string' ? envelope['fired_at'] : new Date().toISOString(),
    data: (envelope['data'] ?? {}) as Record<string, unknown>,
  }
}
