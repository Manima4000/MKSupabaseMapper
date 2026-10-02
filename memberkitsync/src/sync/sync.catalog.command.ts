import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Sincroniza somente o catálogo de conteúdo: membership_levels, courses,
// sections, lessons, lesson_videos, lesson_files e classrooms — sem membros,
// assinaturas, matrículas, atividades, comentários ou quiz attempts.
//
// Usage:
//   npm run sync:catalog
//   npm run sync:catalog:prod

async function main(): Promise<void> {
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    await orchestrator.syncCatalog()
    await orchestrator.syncLessonMedia()
    await orchestrator.syncClassrooms()
    await orchestrator.syncPlans()

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Sync de catálogo completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync de catálogo falhou com erro não tratado')
    process.exit(1)
  }
}

main()
