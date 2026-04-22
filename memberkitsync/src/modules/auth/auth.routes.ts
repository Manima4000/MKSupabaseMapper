import type { FastifyInstance } from 'fastify';
import { supabase } from '../../config/supabase.js'

type LoginBody = { email: string; password: string }
type RefreshBody = { refresh_token?: string }

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login — retorna access_token + refresh_token
  app.post<{ Body: LoginBody }>('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body ?? {}

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha são obrigatórios' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      // Não diferenciar "usuário não existe" de "senha errada" (evita user enumeration)
      return reply.code(401).send({ error: 'Credenciais inválidas' })
    }

    return reply.send({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  })

  // POST /auth/refresh — renova o access_token usando o refresh_token
  app.post<{ Body: RefreshBody }>('/refresh', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'Muitas renovações de token. Tente novamente em 15 minutos.',
        }),
      },
    },
  }, async (request, reply) => {
    const { refresh_token } = request.body ?? {}

    if (!refresh_token) {
      return reply.code(400).send({ error: 'refresh_token é obrigatório' })
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token })

    if (error || !data.session) {
      return reply.code(401).send({ error: 'Token inválido ou expirado' })
    }

    return reply.send({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    })
  })

  // POST /auth/logout — invalida a sessão no servidor
  app.post('/logout', async (request, reply) => {
    const auth = request.headers['authorization']
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7)
      const { data } = await supabase.auth.getUser(token)
      if (data.user) {
        await supabase.auth.admin.signOut(data.user.id, 'global')
      }
    }
    return reply.code(204).send()
  })
}
