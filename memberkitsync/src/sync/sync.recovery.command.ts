import { MemberKitClient } from './memberkit-api.client.js'
import { SyncOrchestrator } from './sync.orchestrator.js'
import { logger } from '../shared/logger.js'

// Recovery sync: re-syncs only data that changed since a given date.
// Intended for use after a backend outage to catch up missed webhooks.
//
// Usage:
//   npm run sync:recovery                      # defaults to 2026-04-22
//   npm run sync:recovery -- --since=2026-04-22
//
// What it runs (in order):
//   1. syncMembers()           — user profile changes, new users
//   2. syncSubscriptions()     — membership status changes (expirations, new)
//   3. syncEnrollments()       — new and updated enrollments
//   4. syncActivitiesSince()   — lesson_progress, ratings, forum (early-stop per user)
//   5. syncCommentsSince()     — new comments (early-stop on global endpoint)
//   6. syncQuizAttemptsSince() — new quiz attempts (early-stop on global endpoint)
//
// Steps 1–3 are always full re-syncs because their global endpoints are small
// and they don't have a reliable date filter. Steps 4–6 use fetchPagesSince
// which stops pagination as soon as it sees items older than sinceDate.

async function main(): Promise<void> {
  const sinceArg = process.argv.find(a => a.startsWith('--since='))
  const sinceDate = sinceArg
    ? new Date(sinceArg.replace('--since=', '') + 'T00:00:00Z')
    : new Date('2026-04-22T00:00:00Z')

  if (isNaN(sinceDate.getTime())) {
    logger.error({ arg: sinceArg }, 'Data inválida. Use --since=YYYY-MM-DD')
    process.exit(1)
  }

  logger.info(
    { since: sinceDate.toISOString() },
    `=== Recovery sync desde ${sinceDate.toISOString().split('T')[0]} ===`,
  )

  const client = new MemberKitClient()
  const orchestrator = new SyncOrchestrator(client)
  const start = Date.now()

  try {
    await orchestrator.syncMembers()
    await orchestrator.syncSubscriptions()
    await orchestrator.syncEnrollments()
    await orchestrator.syncActivitiesSince(sinceDate)
    await orchestrator.syncCommentsSince(sinceDate)
    await orchestrator.syncQuizAttemptsSince(sinceDate)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `=== Recovery sync completo em ${elapsed}s ===`)
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Recovery sync falhou com erro não tratado')
    process.exit(1)
  }
}

main()
