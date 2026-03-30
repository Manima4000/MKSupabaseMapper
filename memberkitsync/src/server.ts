import Fastify from 'fastify'
import { env } from './config/env.js'
import { logger } from './shared/logger.js'
import { webhookRoutes } from './webhooks/webhook.routes.js'
import { userRoutes } from './modules/users/user.routes.js'

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  })

  // Registra rotas
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(userRoutes, { prefix: '/api' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Handler global de erros
  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, 'Erro não tratado')
    reply.code(error.statusCode ?? 500).send({
      error: error.message ?? 'Erro interno do servidor',
    })
  })

  await app.listen({ port: env.PORT, host: env.HOST })
  logger.info({ port: env.PORT }, 'Servidor iniciado')
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Falha ao iniciar servidor')
  process.exit(1)
})
