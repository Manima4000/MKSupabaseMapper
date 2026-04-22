import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './config/env.js'
import { supabase } from './config/supabase.js'
import { logger } from './shared/logger.js'
import { webhookRoutes } from './webhooks/webhook.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { syncRoutes } from './sync/sync.routes.js'
import { analyticsRoutes } from './modules/analytics/analytics.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Limita o tamanho do body em todas as rotas (proteção contra DoS)
    bodyLimit: 1_048_576, // 1 MB
  })

  // ── Segurança: headers HTTP ──────────────────────────────────────────────
  await app.register(helmet, {
    // CSP desativado por padrão pois esta é uma API pura (sem HTML)
    contentSecurityPolicy: false,
  })

  // ── Segurança: CORS ──────────────────────────────────────────────────────
  const allowedOrigins =
    env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ??
    (env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000'])

  await app.register(cors, {
    origin: (origin, cb) => {
      // Permitir requests sem origem (ex: curl, Postman, ferramentas internas)
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Origem não permitida pelo CORS'), false)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  // ── Segurança: rate limiting global ─────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 120,          // 120 req/min por IP (proteção geral)
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Muitas requisições. Tente novamente em alguns instantes.',
    }),
  })

  // ── Autenticação JWT nos endpoints /api/* ────────────────────────────────
  // Todos os endpoints /api/* exigem Authorization: Bearer <jwt do Supabase>
  // Para obter o token: POST /auth/login
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return

    const auth = request.headers['authorization']
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Não autorizado' })
    }

    const token = auth.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return reply.code(401).send({ error: 'Token inválido ou expirado' })
    }

    // Disponibiliza o usuário autenticado para as rotas downstream
    ;(request as any).user = user

    // Rotas /api/sync/* são restritas a administradores
    if (request.url.startsWith('/api/sync/') || request.url === '/api/sync') {
      const adminEmails = env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) ?? []
      if (!adminEmails.includes(user.email ?? '')) {
        return reply.code(403).send({ error: 'Acesso restrito a administradores' })
      }
    }
  })

  // ── Rotas ────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(syncRoutes, { prefix: '/api' })
  await app.register(analyticsRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ── Handler global de erros ──────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500

    // Em produção, não vazar detalhes de erros 5xx
    if (statusCode >= 500 && env.NODE_ENV === 'production') {
      logger.error({ err: error, url: request.url }, 'Erro interno')
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }

    logger.error({ err: error }, 'Erro não tratado')
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    reply.code(statusCode).send({ error: message })
  })

  await app.listen({ port: env.PORT, host: env.HOST })
  logger.info({ port: env.PORT, node_env: env.NODE_ENV }, 'Servidor iniciado')
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Falha ao iniciar servidor')
  process.exit(1)
})
