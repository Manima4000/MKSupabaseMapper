import Fastify from 'fastify'
import { env } from './config/env.js'
import { logger } from './shared/logger.js'
import { webhookRoutes } from './webhooks/webhook.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { syncRoutes } from './sync/sync.routes.js'

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  })

  // Protege todos os endpoints /api/* com Bearer token
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return
    if (!env.API_KEY) return // sem chave configurada → sem proteção (dev)

    const auth = request.headers['authorization']
    if (!auth || auth !== `Bearer ${env.API_KEY}`) {
      reply.code(401).send({ error: 'Não autorizado' })
    }
  })

  // Registra rotas
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(syncRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Handler global de erros
  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, 'Erro não tratado')
    const statusCode = (error as any).statusCode ?? 500
    const message = (error as any).message ?? 'Erro interno do servidor'
    reply.code(statusCode).send({
      error: message,
    })
  })

  await app.listen({ port: env.PORT, host: env.HOST })
  logger.info({ port: env.PORT }, 'Servidor iniciado')
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Falha ao iniciar servidor')
  process.exit(1)
})
