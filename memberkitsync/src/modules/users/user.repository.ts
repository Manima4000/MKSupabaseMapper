import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { User, UserInsert } from './user.types.js'
import type { UpsertUserInput } from './user.types.js'

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const row: UserInsert = {
    mk_id: input.mkId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    blocked: input.blocked,
    unlimited: input.unlimited,
    sign_in_count: input.signInCount,
    current_sign_in_at: input.currentSignInAt,
    last_seen_at: input.lastSeenAt,
    metadata: input.metadata,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.updatedAt !== undefined && { updated_at: input.updatedAt }),
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert user mk_id=${input.mkId}`, error)
  return data as User
}

export async function getUserByMkId(mkId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar user mk_id=${mkId}`, error)
  return data as User | null
}

export async function getUserById(id: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('id', id)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar user id=${id}`, error)
  return data as User | null
}

export async function updateUserLoginData(
  mkId: number,
  data: {
    sign_in_count: number
    current_sign_in_at: string | null
    last_seen_at: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update(data)
    .eq('mk_id', mkId)

  if (error) throw new SupabaseError(`Falha ao atualizar login data user mk_id=${mkId}`, error)
}

export async function getAllUsers(): Promise<User[]> {
  const PAGE = 1000
  const all: User[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('users')
      .select('id, mk_id')
      .order('id')
      .range(from, from + PAGE - 1)

    if (error) throw new SupabaseError('Falha ao buscar todos os users', error)
    all.push(...(data as User[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}
