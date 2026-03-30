import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  Membership,
  MembershipInsert,
  MembershipLevel,
  MembershipLevelInsert,
  UpsertMembershipInput,
  UpsertMembershipLevelInput,
} from './membership.types.js'

// ----------------------------------------------------------------------------
// Membership Levels (plans)
// ----------------------------------------------------------------------------

export async function upsertMembershipLevel(input: UpsertMembershipLevelInput): Promise<MembershipLevel> {
  const row: MembershipLevelInsert = {
    mk_id: input.mkId,
    name: input.name,
    trial_period: input.trialPeriod,
  }

  const { data, error } = await supabase
    .from('membership_levels')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert membership_level mk_id=${input.mkId}`, error)
  return data as MembershipLevel
}

export async function getMembershipLevelByMkId(mkId: number): Promise<MembershipLevel | null> {
  const { data, error } = await supabase
    .from('membership_levels')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar membership_level mk_id=${mkId}`, error)
  return data as MembershipLevel | null
}

// ----------------------------------------------------------------------------
// Memberships (subscriptions)
// ----------------------------------------------------------------------------

export async function upsertMembership(input: UpsertMembershipInput): Promise<Membership> {
  const row: MembershipInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    membership_level_id: input.membershipLevelId,
    status: input.status,
    expire_date: input.expireDate,
  }

  const { data, error } = await supabase
    .from('memberships')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert membership mk_id=${input.mkId}`, error)
  return data as Membership
}

export async function getMembershipByMkId(mkId: number): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar membership mk_id=${mkId}`, error)
  return data as Membership | null
}
