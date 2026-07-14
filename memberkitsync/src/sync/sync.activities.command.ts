import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Sincroniza somente as atividades dos usuários (lesson_progress, forum,
// downloads, etc). Não busca membros na API do MK — usa os usuários já
// existentes no banco (getAllUsers), então não refaz catálogo/membros/
// matrículas. Útil para reprocessar atividades sem rodar o sync completo.
//
// Usage:
//   npm run sync:activities
//   npm run sync:activities:prod

async function main(): Promise<void> {
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    await orchestrator.syncActivities()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Sync de atividades completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync de atividades falhou com erro não tratado')
    process.exit(1)
  }
}

main()
