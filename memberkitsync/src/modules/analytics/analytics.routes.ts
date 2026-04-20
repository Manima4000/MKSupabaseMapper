import type { FastifyInstance } from 'fastify'
import { getOverview, getSubscriptionAnalytics, getStudentRiskScores } from './analytics.repository.js'

// Default: últimas 12 semanas
function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7 * 12)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    '/analytics/overview',
    async (request, reply) => {
      const defaults = defaultRange()
      const from = request.query.from && isValidDate(request.query.from) ? request.query.from : defaults.from
      const to = request.query.to && isValidDate(request.query.to) ? request.query.to : defaults.to

      const data = await getOverview(from, to)
      return reply.send(data)
    },
  )

  // GET /api/analytics/subscriptions?from=YYYY-MM-DD&to=YYYY-MM-DD&membershipLevelId=123
  fastify.get<{ Querystring: { from?: string; to?: string; membershipLevelId?: string } }>(
    '/analytics/subscriptions',
    async (request, reply) => {
      const defaults = defaultRange()
      const from = request.query.from && isValidDate(request.query.from) ? request.query.from : defaults.from
      const to = request.query.to && isValidDate(request.query.to) ? request.query.to : defaults.to
      const membershipLevelId = request.query.membershipLevelId ? parseInt(request.query.membershipLevelId) : undefined

      const data = await getSubscriptionAnalytics(from, to, membershipLevelId)
      return reply.send(data)
    },
  )

  // GET /api/analytics/risk?membershipLevelId=123
  fastify.get<{ Querystring: { membershipLevelId?: string } }>(
    '/analytics/risk', 
    async (request, reply) => {
      const membershipLevelId = request.query.membershipLevelId ? parseInt(request.query.membershipLevelId) : undefined
      const data = await getStudentRiskScores(membershipLevelId)
      return reply.send(data)
    }
  )
}
