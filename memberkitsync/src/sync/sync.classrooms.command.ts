import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Sincroniza somente classrooms (turmas / member areas) — sem catálogo,
// membros, assinaturas, matrículas ou atividades. Útil para atualizar os
// campos de analytics (master, course_name, users_count, comments_count,
// average_progress) sem rodar o sync completo.
//
// Usage:
//   npm run sync:classrooms
//   npm run sync:classrooms:prod

async function main(): Promise<void> {
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    await orchestrator.syncClassrooms()

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Sync de classrooms completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync de classrooms falhou com erro não tratado')
    process.exit(1)
  }
}

main()
