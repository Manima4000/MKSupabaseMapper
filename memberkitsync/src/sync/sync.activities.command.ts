import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Sincroniza somente as atividades dos usuários (lesson_progress, forum,
// downloads, etc). Não busca membros na API do MK — usa os usuários já
// existentes no banco (getAllUsers), então não refaz catálogo/membros/
// matrículas. Útil para reprocessar atividades sem rodar o sync completo.
//
// Com --since=YYYY-MM-DD, usa syncActivitiesSince (early-stop por usuário)
// para buscar somente atividades a partir da data informada.
//
// Usage:
//   npm run sync:activities
//   npm run sync:activities -- --since=2026-06-06
//   npm run sync:activities:prod
//   npm run sync:activities:prod -- --since=2026-06-06

async function main(): Promise<void> {
  const sinceArg = process.argv.find(a => a.startsWith('--since='))
  let sinceDate: Date | null = null

  if (sinceArg) {
    sinceDate = new Date(sinceArg.replace('--since=', '') + 'T00:00:00Z')
    if (isNaN(sinceDate.getTime())) {
      logger.error({ arg: sinceArg }, 'Data inválida. Use --since=YYYY-MM-DD')
      process.exit(1)
    }
  }

  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    if (sinceDate) {
      await orchestrator.syncActivitiesSince(sinceDate)
    } else {
      await orchestrator.syncActivities()
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Sync de atividades completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync de atividades falhou com erro não tratado')
    process.exit(1)
  }
}

main()
