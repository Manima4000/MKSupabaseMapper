import type { FastifyInstance } from 'fastify'
import { validateApiKey, parseWebhookBody } from './webhook.validator.js'
import { dispatchWebhook } from './webhook.handler.js'
import { logger } from '../shared/logger.js'
import { WebhookValidationError } from '../shared/errors.js'

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /webhooks/memberkit
  // Recebe eventos da MemberKit e os processa de forma assíncrona
  fastify.post('/memberkit', async (request, reply) => {
    try {
      // Valida api_key na query string (se WEBHOOK_API_KEY estiver configurado)
      const { api_key } = request.query as Record<string, string | undefined>
      validateApiKey(api_key)

      // Faz parse e valida o envelope
      const envelope = parseWebhookBody(request.body)

      // Responde 200 imediatamente e processa em background
      // (evita timeout do webhook sender em caso de operações lentas)
      reply.code(200).send({ ok: true })

      dispatchWebhook(envelope).catch((err: unknown) => {
        logger.error({ err, event: envelope.event }, 'Erro assíncrono ao processar webhook')
      })
    } catch (err) {
      if (err instanceof WebhookValidationError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      logger.error({ err }, 'Erro inesperado no endpoint de webhook')
      return reply.code(500).send({ error: 'Erro interno' })
    }
  })
}
