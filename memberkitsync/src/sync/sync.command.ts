import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

async function main(): Promise<void> {
  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)

  try {
    await orchestrator.run()
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Sync falhou com erro não tratado')
    process.exit(1)
  }
}

main()
