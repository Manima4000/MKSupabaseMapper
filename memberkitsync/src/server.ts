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

  // Registra rotas
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(syncRoutes, { prefix: '/api' })

  // Health check
  app.get('/', async (_req, reply) => {
    reply.type('text/html').send(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2>MemberKit Sync — online</h2>
        <p>Status: <strong style="color:green">OK</strong></p>
        <p>Horario: ${new Date().toISOString()}</p>
        <ul>
          <li><a href="/health">/health</a> — JSON health check</li>
          <li><a href="/api/users">/api/users</a> — lista de alunos</li>
        </ul>
      </body></html>
    `)
  })
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
