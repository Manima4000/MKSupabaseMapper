import { logger } from '../../shared/logger.js'
import { mkMemberToUpsertInput } from './user.mapper.js'
import { upsertUser, getUserByMkId } from './user.repository.js'
import type { MKUserPayload, User } from './user.types.js'

export async function syncUser(mkMember: MKUserPayload): Promise<User> {
  const input = mkMemberToUpsertInput(mkMember)
  const user = await upsertUser(input)
  logger.debug({ mkId: mkMember.id, userId: user.id }, 'User sincronizado')
  return user
}

export async function resolveUserByMkId(mkId: number): Promise<User | null> {
  return getUserByMkId(mkId)
}
