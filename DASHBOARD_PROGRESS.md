# Dashboard Progresso — Visão Geral

Stack: **Next.js 15 (App Router)** + **Recharts** | Dados: via **Fastify `/api/analytics/*`** (Bearer auth)

---

## Status dos passos

### Passo 1 — Banco (manual, usuário executa)
- [ ] Aplicar `038_active_students_flat_view.sql` no SQL Editor do Supabase
- [ ] Aplicar `039_looker_studio_cleanup.sql`
- [ ] Validar: `SELECT viewname FROM pg_views WHERE schemaname='public'` → deve retornar 9 views
- [ ] Aplicar `040_materialized_views_dashboard.sql` (views materializadas + pg_cron)
- [ ] Validar: `SELECT matviewname FROM pg_matviews WHERE schemaname='public'` → 4 mvw_*

### Passo 2 — Módulo `analytics` no Fastify ✅
- [x] `memberkitsync/src/modules/analytics/analytics.types.ts`
- [x] `memberkitsync/src/modules/analytics/analytics.repository.ts`
- [x] `memberkitsync/src/modules/analytics/analytics.routes.ts`
- [x] Registrar em `memberkitsync/src/server.ts`
- [ ] Testar: `curl -H "Authorization: Bearer $API_KEY" "http://localhost:3000/api/analytics/overview?from=2025-01-01&to=2026-04-17"`

### Passo 3 — Scaffold Next.js ✅
- [x] `npx create-next-app@latest frontend` (Next.js 16.2.4 + Turbopack)
- [x] Instalar dependências: `recharts date-fns clsx lucide-react`
- [x] Criar `frontend/.env.local` (`BACKEND_URL`, `BACKEND_API_KEY`)
- [x] Criar `frontend/src/lib/api-client.ts`
- [x] Criar `frontend/src/lib/types.ts`
- [x] Criar `frontend/src/lib/date-range.ts`

### Passo 4 — Página Visão Geral ✅
- [x] `frontend/src/app/layout.tsx`
- [x] `frontend/src/app/page.tsx` (redireciona → `/dashboard/overview`)
- [x] `frontend/src/app/dashboard/layout.tsx` (sidebar)
- [x] `frontend/src/app/dashboard/overview/page.tsx` (Server Component — 4 KPIs + 4 charts)
- [x] `frontend/src/app/dashboard/overview/loading.tsx` (skeleton de loading)
- [x] `components/dashboard/kpi-card.tsx`
- [x] `components/dashboard/sidebar.tsx`
- [x] `components/dashboard/date-range-picker.tsx` (preset: 4s/3m/6m/1a)
- [x] `components/charts/weekly-lessons-bar.tsx` (BarChart)
- [x] `components/charts/active-students-area.tsx` (AreaChart)
- [x] `components/charts/yearly-comparison-line.tsx` (LineChart 3 anos)
- [x] `components/charts/avg-median-line.tsx` (LineChart avg+mediana)
- [x] **Build sem erros** (`next build` passou)

### Passo 5 — Docker/dev
- [ ] Adicionar serviço `frontend` no `docker-compose.yml` (porta 3001)

---

## Views do banco (Visão Geral)

| View | Tipo atual | Usado para | Recomendado |
|---|---|---|---|
| `vw_weekly_global_stats` | Regular | KPIs + bar + area chart | Materializar |
| `vw_yearly_weekly_comparison` | Regular | Line chart 3 anos | Materializar |
| `vw_active_students_flat` | Regular | DISTINCT user_id no período | Materializar |
| `vw_subscription_summary` | Regular | Cards por plano | Materializar |
| `vw_student_course_progress` | Regular | Endpoint `/api/users` (já existe) | Manter regular |
| `vw_inactive_students` | Regular | Endpoint `/api/users/inactive` | Manter regular |

---

## Views Materializadas (recomendado — Passo 1 opcional)

Views materializadas pré-computam o resultado e o guardam fisicamente. A query do dashboard passa de ~500ms para <10ms. O refresh é feito via `pg_cron` (já disponível no Supabase).

**SQL para criar as views materializadas:**

```sql
-- 1. Criar views materializadas
CREATE MATERIALIZED VIEW mvw_weekly_global_stats AS
  SELECT * FROM vw_weekly_global_stats;

CREATE MATERIALIZED VIEW mvw_yearly_weekly_comparison AS
  SELECT * FROM vw_yearly_weekly_comparison;

CREATE MATERIALIZED VIEW mvw_active_students_flat AS
  SELECT * FROM vw_active_students_flat;

CREATE MATERIALIZED VIEW mvw_subscription_summary AS
  SELECT * FROM vw_subscription_summary;

-- 2. Índices para queries com filtro de data
CREATE INDEX ON mvw_weekly_global_stats (week_start);
CREATE INDEX ON mvw_active_students_flat (week_start);
CREATE INDEX ON mvw_active_students_flat (user_id);
CREATE INDEX ON mvw_yearly_weekly_comparison (week_number);

-- 3. Agendar refresh a cada hora via pg_cron
SELECT cron.schedule(
  'refresh-dashboard-views',
  '0 * * * *',            -- todo início de hora
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_weekly_global_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_yearly_weekly_comparison;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_students_flat;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_summary;
  $$
);
```

> **Nota:** `REFRESH CONCURRENTLY` não bloqueia leituras durante o refresh, mas exige que a view tenha um índice único. Se preferir simplicidade, use `REFRESH MATERIALIZED VIEW` sem `CONCURRENTLY` (bloqueia por ~1s, aceitável para dashboards).

**No `analytics.repository.ts`**: basta trocar o nome da view de `vw_*` para `mvw_*` nas queries que usam os dados de dashboard (manter `vw_*` nas queries das rotas de API de usuários).

---

## Endpoint alvo

```
GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD

Response:
{
  kpis: {
    totalLessons: number,
    activeStudents: number,
    avgLessonsPerStudent: number,
    medianLessonsPerStudent: number
  },
  weekly: { week_start: string, total_lessons: number, active_students: number }[],
  yearlyComparison: { week_number: number, year: number, total_lessons: number }[],
  avgMedianSeries: { week_start: string, avg: number, median: number }[],
  subscriptions: { level_name: string, active: number, pending: number, expired: number }[]
}
```

---

## Próximas páginas (fora do escopo atual)

- **Assinaturas** — `vw_subscription_engagement`, `vw_subscription_weekly_trend_normalized`, `vw_subscription_risk_distribution`
- **Alunos** — drill-down por aluno via `fn_student_full_progress(user_id)`
- **Autenticação** — login no dashboard (hoje usa Bearer compartilhado — MVP)
- **Deploy** — Vercel (frontend) + Docker existente (backend)
