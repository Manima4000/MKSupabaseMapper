import type { FastifyInstance } from 'fastify'
import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'
import { syncUser } from '../modules/users/user.service.js'
import { supabase } from '../config/supabase.js'
import { dispatchWebhook } from '../webhooks/webhook.handler.js'
import type { WebhookLog } from '../shared/types.js'
import type { MKWebhookEnvelope } from '../webhooks/webhook.types.js'

// Controle de execução para evitar syncs simultâneos
let syncRunning = false
let currentSyncJob: string | null = null

function checkConflict(reply: { code: (n: number) => { send: (v: unknown) => unknown } }): boolean {
  if (syncRunning) {
    reply.code(409).send({ error: `Sync já em andamento: ${currentSyncJob}` })
    return false
  }
  return true
}

function runSync(job: string, fn: (orchestrator: SyncOrchestrator) => Promise<unknown>): void {
  syncRunning = true
  currentSyncJob = job
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)

  fn(orchestrator)
    .then(() => logger.info({ job }, 'Sync parcial concluído com sucesso'))
    .catch((err: unknown) => logger.error({ job, err }, 'Sync parcial falhou'))
    .finally(() => {
      syncRunning = false
      currentSyncJob = null
    })
}

export async function syncRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/sync/status
  fastify.get('/sync/status', async (_request, reply) => {
    reply.send({ running: syncRunning, job: currentSyncJob })
  })

  // POST /api/sync — sync completo
  fastify.post('/sync', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync completo iniciado em background' })
    runSync('full', (o) => o.run())
  })

  // POST /api/sync/catalog — cursos, seções, aulas, vídeos, arquivos
  fastify.post('/sync/catalog', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de catálogo iniciado em background' })
    runSync('catalog', (o) => o.syncCatalog())
  })

  // POST /api/sync/classrooms — áreas de membros
  fastify.post('/sync/classrooms', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de classrooms iniciado em background' })
    runSync('classrooms', (o) => o.syncClassrooms())
  })

  // POST /api/sync/plans — planos de assinatura
  fastify.post('/sync/plans', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de planos iniciado em background' })
    runSync('plans', (o) => o.syncPlans())
  })

  // POST /api/sync/members — usuários/membros
  fastify.post('/sync/members', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de membros iniciado em background' })
    runSync('members', (o) => o.syncMembers())
  })

  // POST /api/sync/subscriptions — assinaturas (requer membros + planos já sincronizados)
  fastify.post('/sync/subscriptions', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de assinaturas iniciado em background' })
    runSync('subscriptions', (o) => o.syncSubscriptions())
  })

  // POST /api/sync/enrollments — matrículas (requer membros + cursos + classrooms já sincronizados)
  fastify.post('/sync/enrollments', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de matrículas iniciado em background' })
    runSync('enrollments', (o) => o.syncEnrollments())
  })

  // POST /api/sync/activities/from-db
  // Sincroniza atividades dos usuários usando os usuários já salvos no banco,
  // sem re-buscar a lista de membros na API do MemberKit.
  fastify.post('/sync/activities/from-db', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de atividades (via banco) iniciado em background' })
    runSync('activities:from-db', (o) => o.syncActivities())
  })

  // POST /api/sync/lesson-media/from-db
  // Re-sincroniza vídeos e arquivos das aulas usando as aulas já salvas no banco,
  // sem re-buscar o catálogo completo de cursos na API do MemberKit.
  fastify.post('/sync/lesson-media/from-db', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de vídeos e arquivos (via banco) iniciado em background' })
    runSync('lesson-media:from-db', (o) => o.syncLessonMedia())
  })

  // POST /api/sync/comments — pagina GET /comments na API do MemberKit
  fastify.post('/sync/comments', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de comentários iniciado em background' })
    runSync('comments', (o) => o.syncComments())
  })

  // POST /api/sync/comments/from-db
  // Re-sincroniza comentários por aula usando as aulas já salvas no banco,
  // sem paginar o endpoint global /comments da API do MemberKit.
  fastify.post('/sync/comments/from-db', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de comentários (via banco) iniciado em background' })
    runSync('comments:from-db', (o) => o.syncCommentsByLesson())
  })

  // POST /api/sync/quiz-attempts — pagina GET /quiz_attempts na API do MemberKit
  // Requer que os membros já estejam sincronizados no banco.
  fastify.post('/sync/quiz-attempts', async (request, reply) => {
    if (!checkConflict(reply)) return

    reply.code(202).send({ ok: true, message: 'Sync de tentativas de quiz iniciado em background' })
    runSync('quiz-attempts', (o) => o.syncQuizAttempts())
  })

  // POST /api/sync/users/:mkId — busca um usuário na API do MemberKit e cria/atualiza no banco
  fastify.post<{ Params: { mkId: string } }>('/sync/users/:mkId', async (request, reply) => {
    const mkId = Number(request.params.mkId)
    if (isNaN(mkId)) {
      return reply.code(400).send({ error: 'mkId inválido' })
    }

    const client = new MemberKitClient()
    const detail = await client.getUserDetail(mkId)
    const user = await syncUser(detail)

    logger.info({ mkId, userId: user.id }, 'Usuário criado/atualizado via endpoint')
    return reply.send({ ok: true, user })
  })
}
