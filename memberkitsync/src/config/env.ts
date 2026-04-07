import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  MEMBERKIT_API_KEY: z.string().min(1),
  MEMBERKIT_API_URL: z.string().url().default('https://app.memberkit.com.br/api/v1'),

  // Chave de API usada como query param na URL do webhook (?api_key=...)
  WEBHOOK_API_KEY: z.string().min(1).optional(),

  // Chave de API para proteger os endpoints REST internos (/api/*)
  // Enviada via header: Authorization: Bearer <API_KEY>
  API_KEY: z.string().min(1).optional(),

  // Redireciona HTTP → HTTPS usando o header x-forwarded-proto (set pelo proxy)
  FORCE_HTTPS: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
})

export type Env = z.infer<typeof envSchema>

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(result.error.format())
  process.exit(1)
}

export const env = result.data
