import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '../config/env.js'
import { WebhookValidationError } from '../shared/errors.js'
import type { MKWebhookEnvelope } from './webhook.types.js'

// Valida a assinatura HMAC-SHA256 do webhook (se WEBHOOK_SECRET estiver configurado)
// MemberKit envia o header X-MemberKit-Signature ou X-Hub-Signature-256
// NOTE: Confirme o header e algoritmo exatos nos webhooks da sua conta
export function validateWebhookSignature(rawBody: string, signatureHeader: string | undefined): void {
  if (!env.WEBHOOK_SECRET) return // sem segredo configurado, skip

  if (!signatureHeader) {
    throw new WebhookValidationError('Header de assinatura ausente')
  }

  // Formato esperado: "sha256=<hex_digest>"
  const [algo, digest] = signatureHeader.split('=')
  if (algo !== 'sha256' || !digest) {
    throw new WebhookValidationError('Formato de assinatura inválido')
  }

  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(rawBody).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(digest, 'hex')

  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new WebhookValidationError('Assinatura do webhook inválida')
  }
}

// Valida e faz parse do corpo do webhook
export function parseWebhookBody(body: unknown): MKWebhookEnvelope {
  if (typeof body !== 'object' || body === null || !('event' in body) || !('data' in body)) {
    throw new WebhookValidationError('Payload de webhook malformado')
  }

  const envelope = body as Record<string, unknown>

  if (typeof envelope['event'] !== 'string') {
    throw new WebhookValidationError('Campo "event" ausente ou inválido')
  }

  return {
    event: envelope['event'] as string,
    fired_at: typeof envelope['fired_at'] === 'string' ? envelope['fired_at'] : new Date().toISOString(),
    data: (envelope['data'] ?? {}) as Record<string, unknown>,
  }
}
