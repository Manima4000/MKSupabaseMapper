import { z } from 'zod'
import 'dotenv/config'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),

    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    MEMBERKIT_API_KEY: z.string().min(1),
    MEMBERKIT_API_URL: z.string().url().default('https://app.memberkit.com.br/api/v1'),

    // Chave de API usada como query param na URL do webhook (?api_key=...)
    // Obrigatório em produção para impedir webhooks falsos
    WEBHOOK_API_KEY: z.string().min(1).optional(),

    // Origem permitida no CORS (ex: https://meu-dashboard.vercel.app)
    // Em dev, permite localhost:5173 por padrão
    CORS_ORIGIN: z.string().optional(),

    // E-mails dos administradores separados por vírgula
    // Apenas esses usuários podem chamar as rotas /api/sync/*
    ADMIN_EMAILS: z.string().optional(),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.WEBHOOK_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEBHOOK_API_KEY é obrigatório em produção para evitar webhooks falsos',
        path: ['WEBHOOK_API_KEY'],
      })
    }
    if (data.NODE_ENV === 'production' && !data.CORS_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CORS_ORIGIN é obrigatório em produção para restringir origens permitidas pelo navegador',
        path: ['CORS_ORIGIN'],
      })
    }
    if (data.NODE_ENV === 'production' && !data.ADMIN_EMAILS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ADMIN_EMAILS é obrigatório em produção para restringir acesso às rotas /api/sync/*',
        path: ['ADMIN_EMAILS'],
      })
    }
  })

export type Env = z.infer<typeof envSchema>

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(result.error.format())
  process.exit(1)
}

export const env = result.data
