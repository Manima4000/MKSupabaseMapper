/**
 * Reprocessa webhooks com status 'skipped' ou 'failed' da tabela webhook_logs.
 *
 * Uso:
 *   npm run replay                         # reprocessa todos os 'skipped'
 *   npm run replay -- --status failed      # reprocessa todos os 'failed'
 *   npm run replay -- --event enrollment.created
 *   npm run replay -- --dry-run            # lista sem executar
 *   npm run replay -- --limit 50           # processa no máximo 50
 */

import '../config/env.js'
import { supabase } from '../config/supabase.js'
import { dispatchWebhook } from './webhook.handler.js'
import { logger } from '../shared/logger.js'
import type { MKWebhookEnvelope } from './webhook.types.js'

// ----------------------------------------------------------------------------
// Argument parsing
// ----------------------------------------------------------------------------

function parseArgs(): { status: string; event: string | null; dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  let status = 'skipped'
  let event: string | null = null
  let dryRun = false
  let limit = 500

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status' && args[i + 1]) status = args[++i]!
    else if (args[i] === '--event' && args[i + 1]) event = args[++i]!
    else if (args[i] === '--dry-run') dryRun = true
    else if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i])
  }

  return { status, event, dryRun, limit }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const { status, event, dryRun, limit } = parseArgs()

  logger.info({ status, event, dryRun, limit }, 'Iniciando replay de webhooks')

  // Busca webhooks para reprocessar
  let query = supabase
    .from('webhook_logs')
    .select('id, event_type, payload, payload_hash, fired_at: created_at, error_message')
    .eq('status', status)
    .order('id', { ascending: true })
    .limit(limit)

  if (event) query = query.eq('event_type', event)

  const { data: logs, error } = await query

  if (error) {
    logger.error({ error }, 'Falha ao buscar webhook_logs')
    process.exit(1)
  }

  if (!logs || logs.length === 0) {
    logger.info({ status, event }, 'Nenhum webhook encontrado para reprocessar')
    process.exit(0)
  }

  logger.info({ count: logs.length }, `Webhooks encontrados para replay`)

  if (dryRun) {
    for (const log of logs) {
      logger.info(
        { id: log.id, event_type: log.event_type, error_message: log.error_message },
        '[DRY-RUN] Seria reprocessado',
      )
    }
    process.exit(0)
  }

  // Reprocessa um a um para evitar sobrecarga no Supabase
  let processed = 0
  let failed = 0
  let skipped = 0

  for (const log of logs) {
    const envelope = log.payload as unknown as MKWebhookEnvelope

    // Garante que o envelope tem o campo fired_at (pode vir do created_at do log)
    if (!envelope.fired_at) {
      envelope.fired_at = (log as Record<string, unknown>).fired_at as string ?? new Date().toISOString()
    }

    logger.info({ logId: log.id, event: log.event_type }, 'Reprocessando webhook...')

    try {
      await dispatchWebhook(envelope, (log as Record<string, unknown>).payload_hash as string)
      // Marca o log original como 'replayed' para não aparecer em futuras execuções
      await supabase
        .from('webhook_logs')
        .update({ status: 'replayed', processed_at: new Date().toISOString() })
        .eq('id', log.id)
      processed++
      logger.info({ logId: log.id, event: log.event_type }, 'Webhook reprocessado com sucesso')
    } catch (err) {
      failed++
      logger.error({ logId: log.id, event: log.event_type, err }, 'Falha ao reprocessar webhook')
    }
  }

  skipped = logs.length - processed - failed

  logger.info(
    { total: logs.length, processed, failed, skipped },
    'Replay concluído',
  )

  process.exit(failed > 0 ? 1 : 0)
}

main()
