import type { FastifyInstance } from 'fastify'
import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'
import { env } from '../config/env.js'

// Controle de execução para evitar syncs simultâneos
let syncRunning = false

export async function syncRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/sync
  // Dispara o sync completo MemberKit → Supabase de forma assíncrona
  // Protegido pelo mesmo WEBHOOK_API_KEY usado nos webhooks
  fastify.post('/sync', async (request, reply) => {
    // Valida api_key na query string
    const { api_key } = request.query as Record<string, string | undefined>

    if (env.WEBHOOK_API_KEY && api_key !== env.WEBHOOK_API_KEY) {
      return reply.code(401).send({ error: 'api_key inválido ou ausente' })
    }

    if (syncRunning) {
      return reply.code(409).send({ error: 'Sync já em andamento' })
    }

    // Responde imediatamente e roda o sync em background
    reply.code(202).send({ ok: true, message: 'Sync iniciado em background' })

    syncRunning = true
    const client = new MemberKitClient()
    const orchestrator = new SyncOrchestrator(client)

    orchestrator.run()
      .then(() => logger.info('Sync via API concluído com sucesso'))
      .catch((err: unknown) => logger.error({ err }, 'Sync via API falhou'))
      .finally(() => { syncRunning = false })
  })

  // GET /api/sync/status
  // Verifica se um sync está em andamento
  fastify.get('/sync/status', async (_request, reply) => {
    reply.send({ running: syncRunning })
  })
}
