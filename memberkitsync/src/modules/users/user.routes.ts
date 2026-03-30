import type { FastifyInstance } from 'fastify'
import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users — lista alunos com progresso por curso
  fastify.get('/users', async (_request, reply) => {
    const { data, error } = await supabase
      .from('vw_student_course_progress')
      .select('*')
      .order('student_name')

    if (error) throw new SupabaseError('Falha ao listar usuários', error)
    return reply.send(data)
  })

  // GET /users/:mkId — perfil completo do aluno com progresso aninhado
  fastify.get<{ Params: { mkId: string } }>('/users/:mkId', async (request, reply) => {
    const mkId = Number(request.params.mkId)

    // Busca usuário pelo mk_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('mk_id', mkId)
      .single()

    if (userError || !user) {
      return reply.code(404).send({ error: 'Aluno não encontrado' })
    }

    // Progresso completo via função SQL
    const { data: progress, error: progressError } = await supabase
      .rpc('fn_student_full_progress', { p_user_id: (user as { id: number }).id })

    if (progressError) throw new SupabaseError('Falha ao buscar progresso', progressError)

    return reply.send({ user, progress })
  })

  // GET /users/inactive — alunos inativos (sem acesso há mais de 7 dias)
  fastify.get('/users/inactive', async (_request, reply) => {
    const { data, error } = await supabase
      .from('vw_inactive_students')
      .select('*')

    if (error) throw new SupabaseError('Falha ao listar alunos inativos', error)
    return reply.send(data)
  })
}
