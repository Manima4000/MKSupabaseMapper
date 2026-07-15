import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Sincroniza somente membros/usuários, assinaturas (memberships) e
// matrículas (enrollments) — sem catálogo, atividades, comentários ou
// quiz attempts. Útil para atualizar cadastro e vínculos de alunos sem
// rodar o sync completo.
//
// Usage:
//   npm run sync:members
//   npm run sync:members:prod
//
// Ordem (respeita FKs):
//   1. syncMembers()       — usuários
//   2. syncSubscriptions() — memberships (depende de users + membership_levels)
//   3. syncEnrollments()   — enrollments (depende de users + courses + classrooms)

async function main(): Promise<void> {
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    const members = await orchestrator.syncMembers()
    await orchestrator.syncSubscriptions()
    await orchestrator.syncEnrollments(members)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Sync de membros/memberships/enrollments completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync de membros falhou com erro não tratado')
    process.exit(1)
  }
}

main()
