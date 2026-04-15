# Guia Power BI — MemberKit Student Tracking

## Checklist Geral
- [ ] Passo 0 — Aplicar migration 033 no Supabase SQL Editor
- [ ] Passo 1 — Conectar ao Supabase no Power BI
- [ ] Passo 2 — Power Query: tipos de dados
- [ ] Passo 3 — Medidas DAX
- [ ] Passo 4 — Página 1: Visão Geral (gráficos do chefe)
- [ ] Passo 5 — Página 2: Assinaturas
- [ ] Passo 6 — Navegação e ajustes finais

---

## Estrutura Visual Adotada

Cada página segue o mesmo padrão de 3 zonas — isso é o que diferencia relatórios amadores de profissionais:

```
┌──────────────────────────────────────────────────────┐
│  HEADER  │  Título da página + Slicer de Período     │
├──────┬───────────────────────────────────────────────┤
│      │  KPI 1  │  KPI 2  │  KPI 3  │  KPI 4         │
│ NAV  ├───────────────────────────────────────────────┤
│      │                                               │
│      │         GRÁFICOS PRINCIPAIS                   │
│      │         (2 colunas, 2 linhas)                 │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

**Regras de design aplicadas:**
- Máximo **4 KPI cards** por página
- Máximo **6 gráficos** por página
- Máximo **3 cores** primárias + variações de opacidade
- Fundo `#F4F6FA`, cards em branco com sombra leve
- Fonte única: **Segoe UI** em toda a aplicação

---

## Passo 0 — Aplicar migration 033 no Supabase

Antes de conectar o Power BI, a migration precisa estar aplicada no banco.

- [ ] Abrir o arquivo `memberkitsync/src/database/migrations/033_powerbi_boss_charts.sql`
- [ ] Copiar o conteúdo completo
- [ ] No Supabase Dashboard → **SQL Editor → New query** → colar e executar
- [ ] Confirmar que as views foram criadas: `SELECT * FROM vw_weekly_global_stats LIMIT 5;`

**O que a migration faz:**
- Cria `vw_weekly_global_stats` — 1 linha por semana com total de aulas, alunos ativos, média e mediana
- Recria `vw_yearly_weekly_comparison` incluindo 2024 (antes era só 2025+)
- Remove `vw_weekly_active_students` (absorvida na view global)

---

## Passo 1 — Conectar ao Supabase no Power BI

- [ ] **Power BI Desktop → Obter Dados → Banco de dados PostgreSQL**
- [ ] Servidor: `db.SEUPROJETO.supabase.co` | Banco: `postgres`
- [ ] Modo: **Import**
- [ ] Credenciais: usuário `postgres` + senha do projeto
- [ ] No Navigator, expandir `public` e selecionar as views:
  - `vw_weekly_global_stats` ← **nova: serve os 3 gráficos do chefe**
  - `vw_yearly_weekly_comparison` ← **atualizada: agora inclui 2024**
  - `vw_student_weekly_activity`
  - `vw_subscription_summary`
  - `vw_subscription_engagement`
  - `vw_subscription_weekly_trend_normalized`
  - `vw_subscription_risk_distribution`
- [ ] Clicar **Carregar**

> `vw_weekly_active_students` foi removida — não selecionar. Tudo que ela fornecia agora está em `vw_weekly_global_stats[active_students]`.

---

## Passo 2 — Power Query: tipos de dados

- [ ] **Página Inicial → Transformar Dados**
- [ ] `vw_weekly_global_stats[week_start]`: tipo **Data**
- [ ] `vw_weekly_global_stats[total_lessons_completed]`: tipo **Número Inteiro**
- [ ] `vw_weekly_global_stats[active_students]`: tipo **Número Inteiro**
- [ ] `vw_weekly_global_stats[avg_lessons_per_active_student]`: tipo **Número Decimal**
- [ ] `vw_weekly_global_stats[median_lessons_per_active_student]`: tipo **Número Decimal**
- [ ] `vw_yearly_weekly_comparison[year]`: tipo **Número Inteiro**
- [ ] `vw_yearly_weekly_comparison[iso_week]`: tipo **Número Inteiro**
- [ ] `vw_yearly_weekly_comparison[lessons_completed]`: tipo **Número Inteiro**
- [ ] Colunas `*_pct`: tipo **Número Decimal**
- [ ] **Fechar e Aplicar**

---

## Passo 3 — Medidas DAX

### 3.1 — Tabela de Períodos (slicer de filtro)

> **Modelagem → Nova Tabela**

```dax
Periodos =
DATATABLE(
    "Periodo",  STRING,
    "Ordem",    INTEGER,
    "DiasBack", INTEGER,
    {
        {"7 dias",    1,     7},
        {"30 dias",   2,    30},
        {"90 dias",   3,    90},
        {"1 ano",     4,   365},
        {"Tudo",      5, 99999}
    }
)
```

- [x] Tabela criada
- [x] Ordenar coluna `Periodo` por `Ordem`: selecionar coluna `Periodo` → **Ferramentas de Coluna → Classificar por Coluna → Ordem**

### 3.2 — Medida base de período

> **Modelagem → Nova Medida**

```dax
Data Inicio Periodo =
VAR DiasBack = SELECTEDVALUE(Periodos[DiasBack], 99999)
RETURN IF(DiasBack = 99999, DATE(2000,1,1), TODAY() - DiasBack)
```

- [x] Medida criada

### 3.3 — Medidas globais (gráficos do chefe)

> Todas baseadas em `vw_weekly_global_stats`. Pasta de exibição: `_Globais`.

> **⚠️ Por que usar `REMOVEFILTERS` aqui:** os gráficos de série temporal (Gráficos 1a, 2 e 3) têm hierarquia de datas no eixo X (Ano → Mês → Dia). Ao clicar em "2025" no gráfico para fazer drill-down, o Power BI aplica um cross-filter em todos os visuais da página restringindo `week_start` ao ano de 2025. Os KPI cards então calculam `week_start >= DataInicio` (ex: 8/abr/2026 se o slicer está em "7 dias") **E** `week_start em 2025` — interseção vazia → card em branco.
>
> A solução é `REMOVEFILTERS(vw_weekly_global_stats[week_start])` dentro do `CALCULATE`: isso descarta o cross-filter do gráfico sobre `week_start` e re-aplica **só** o filtro do slicer de período. O valor do slicer (`DataInicio`) já foi capturado como VAR antes do `CALCULATE`, então fica imune à remoção.

```dax
[Total Aulas Concluidas] =
VAR DataInicio = [Data Inicio Periodo]
RETURN
CALCULATE(
    SUM(vw_weekly_global_stats[total_lessons_completed]),
    REMOVEFILTERS(vw_weekly_global_stats[week_start]),
    vw_weekly_global_stats[week_start] >= DataInicio
)
```

```dax
[Alunos Ativos] =
VAR DataInicio = [Data Inicio Periodo]
RETURN
CALCULATE(
    SUM(vw_weekly_global_stats[active_students]),
    REMOVEFILTERS(vw_weekly_global_stats[week_start]),
    vw_weekly_global_stats[week_start] >= DataInicio
)
```

```dax
[Media Aulas por Aluno Ativo] =
-- Média das médias semanais no período selecionado.
-- Cada semana já tem sua própria avg calculada no banco.
VAR DataInicio = [Data Inicio Periodo]
RETURN
CALCULATE(
    AVERAGE(vw_weekly_global_stats[avg_lessons_per_active_student]),
    REMOVEFILTERS(vw_weekly_global_stats[week_start]),
    vw_weekly_global_stats[week_start] >= DataInicio
)
```

```dax
[Mediana Aulas por Aluno Ativo] =
-- Mediana das medianas semanais no período selecionado.
VAR DataInicio = [Data Inicio Periodo]
RETURN
CALCULATE(
    AVERAGE(vw_weekly_global_stats[median_lessons_per_active_student]),
    REMOVEFILTERS(vw_weekly_global_stats[week_start]),
    vw_weekly_global_stats[week_start] >= DataInicio
)
```

> **Nota sobre a mediana no DAX:** Power BI não tem função MEDIAN que respeite contexto de filtro para dados externos. A coluna `median_lessons_per_active_student` já vem calculada corretamente para cada semana pelo banco (PERCENTILE_CONT). A medida acima faz a média dessas medianas semanais — é uma aproximação razoável para mostrar no KPI card. Os gráficos de linha usam a coluna diretamente (sem DAX), o que é exato.

- [x] Medidas criadas e organizadas na pasta `_Globais`

### 3.4 — Medidas para Assinaturas (Passo 5)

> As medidas de assinaturas são criadas diretamente no Passo 5.2. Não é necessário criar nada aqui antecipadamente.

---

## Passo 4 — Página 1: Visão Geral (Gráficos do Chefe)

**Objetivo:** 4 gráficos de série temporal atendendo exatamente ao que foi pedido.

- [ ] Renomear para `Visão Geral`

### Layout da página

```
┌──────────────────────────────────────────────────────────────────────┐
│  Visão Geral                        [7d][30d][90d][1a][Tudo]         │  ← HEADER
├────────────────┬─────────────────┬──────────────────┬────────────────┤
│  Total Aulas   │  Alunos Ativos  │  Média Aulas/    │  Mediana       │  ← KPIs
│  Concluídas    │  (acum. período)│  Aluno Ativo/Sem │  Aulas/Aluno   │
├──────────────────────────────────┬───────────────────────────────────┤
│                                  │                                   │
│  Gráfico 1a: Total Aulas/Semana  │  Gráfico 2: Alunos Ativos/Semana  │
│  (barras, série completa 2023+)  │  (área, série completa 2023+)     │
│                                  │                                   │
├──────────────────────────────────┴───────────────────────────────────┤
│                                                                      │
│  Gráfico 1b: Aulas/Semana — 2024 vs 2025 vs 2026 (linhas sobrepostas)│
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Gráfico 3: Média e Mediana de Aulas por Aluno Ativo/Semana          │
│  (2 linhas sobrepostas)                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.1 — Header + Slicer de Período

- [ ] **Inserir → Caixa de Texto** → `Visão Geral` → Segoe UI 18pt Bold, cor `#1E293B`
- [x] **Inserir → Segmentação de Dados** → campo `Periodos[Periodo]`
  - Estilo: **Mosaico** | Cor selecionado: `#2563EB` (azul) + texto branco
  - Posicionar canto superior direito

> **Atenção:** o slicer de período afeta os KPI cards e os gráficos 1a, 2 e 3. O gráfico 1b (ano contra ano) **não** é afetado — ele sempre mostra o ano inteiro por design.

### 4.2 — 4 KPI Cards

> **Inserir → Cartão** (4x). Fonte 28pt, fundo branco, borda `#E2E8F0`, raio 8.

| # | Rótulo | Medida | Formato |
|---|--------|--------|---------|
| 1 | Total Aulas Concluídas | `[Total Aulas Concluidas]` | Número inteiro |
| 2 | Alunos Ativos (período) | `[Alunos Ativos]` | Número inteiro |
| 3 | Média Aulas/Aluno/Sem | `[Media Aulas por Aluno Ativo]` | `0.0` |
| 4 | Mediana Aulas/Aluno/Sem | `[Mediana Aulas por Aluno Ativo]` | `0.0` |

> **Cards 3 e 4 juntos** permitem ver se a distribuição é simétrica (média ≈ mediana) ou se poucos alunos muito ativos puxam a média para cima (média > mediana).

> **Alternativa ao REMOVEFILTERS nas medidas:** se preferir não alterar o DAX, é possível desativar o cross-filter dos gráficos nos cards via **Editar Interações**. Selecionar cada gráfico de série temporal (1a, 2, 3) → **Formato → Editar Interações** → clicar no ícone **"Nenhum"** (🚫) sobre cada KPI card. Com isso, clicar no gráfico não afeta os cards. A desvantagem é que os cards sempre mostram o total do período do slicer, mesmo quando o gráfico está com drill em um ano específico — o `REMOVEFILTERS` no DAX é a solução mais coerente.

- [x] 4 cards criados

### 4.3 — Gráfico 1a: Total de Aulas Concluídas por Semana (série completa)

> **Inserir → Gráfico de Colunas Empilhadas**

- [x] Eixo X: `vw_weekly_global_stats[week_start]`
- [x] Valores Y: `vw_weekly_global_stats[total_lessons_completed]` (Soma) — cor `#2563EB`
- [x] Título: **"Aulas Concluídas por Semana"**
- [ ] Formato → Eixo X → Tipo: **Data Contínua** (para que semanas sem dados apareçam como lacunas e não somam)
- [ ] Formato → Eixo Y → Título: **"Aulas Concluídas"**
- [ ] Formato → Linhas de grade → cor `#F1F5F9`

> O slicer de período filtra automaticamente pelo `[Total Aulas Concluidas]`, mas as barras no gráfico usam a coluna direta — crie uma interação: selecionar o slicer → **Formato → Editar Interações** → ativar filtro neste gráfico. Alternativamente, adicionar `[Data Inicio Periodo]` como filtro visual neste gráfico.

- [ ] Gráfico criado

### 4.4 — Gráfico 2: Alunos Ativos por Semana (série completa)

**Definição:** alunos que concluíram ao menos 1 aula naquela semana (não login, não visita — conclusão de aula).

> **Inserir → Gráfico de Área**

- [x] Eixo X: `vw_weekly_global_stats[week_start]`
- [x] Valores: `vw_weekly_global_stats[active_students]` (Soma) — cor `#10B981` (verde), opacidade 20%
- [ ] Linha: cor `#10B981`, espessura 2.5px
- [ ] Título: **"Alunos que Estudaram por Semana"**
- [ ] Formato → Eixo X → Tipo: **Data Contínua**
- [ ] Formato → Eixo Y → Título: **"Alunos Ativos"**

- [ ] Gráfico criado

### 4.5 — Gráfico 1b: Ano Contra Ano — 2024, 2025 e 2026

**Objetivo:** comparar o mesmo período do ano entre anos diferentes. Eixo X = semana ISO (1 a 53), uma linha por ano.

> **Inserir → Gráfico de Linhas**

- [x] Eixo X: `vw_yearly_weekly_comparison[iso_week]`
- [x] Valores: `vw_yearly_weekly_comparison[lessons_completed]` (Soma)
- [x] Legenda: `vw_yearly_weekly_comparison[year]`
- [ ] Formato → Linha 2024: cor `#94A3B8` (cinza claro), estilo **pontilhado**, espessura 1.5px
- [ ] Formato → Linha 2025: cor `#60A5FA` (azul claro), estilo **tracejado**, espessura 2px
- [ ] Formato → Linha 2026: cor `#2563EB` (azul escuro), sólida, espessura 3px
- [ ] Formato → Marcadores: ativar apenas para 2026
- [ ] Formato → Rótulos de dados: desativar (muitos pontos)
- [ ] Formato → Legenda → posição: **Topo Direito**
- [x] Título: **"Aulas/Semana — 2024 vs 2025 vs 2026"**
- [x] Formato → Eixo X → Título: **"Semana do Ano (ISO)"**
- [x] Formato → Eixo Y → Título: **"Aulas Concluídas"**

> **Como ler:** o eixo X mostra a semana do ano (ex: semana 10 = início de março). Cada linha é um ano. Se a linha de 2026 está acima das de 2025 e 2024 na semana 10, 2026 está melhor nessa época do ano.
>
> **Atenção:** 2024 começa só na semana 42 (out/2023 é quando os dados começam — mas o `ISOYEAR` é 2023 nesse caso, portanto não aparece). Os primeiros dados de 2024 são de jan/2024 (semana 1). As semanas de 2026 só vão até a semana atual.

- [ ] Gráfico criado

### 4.6 — Gráfico 3: Média e Mediana de Aulas por Aluno Ativo

**Objetivo:** dado que o aluno estudou naquela semana, quantas aulas ele fez? Média e mediana permitem ver a distribuição — se média >> mediana, tem outliers puxando para cima.

> **Inserir → Gráfico de Linhas**

- [x] Eixo X: `vw_weekly_global_stats[week_start]`
- [x] Valores (2 séries):
  - `vw_weekly_global_stats[avg_lessons_per_active_student]` (Média) — cor `#F59E0B` (laranja), espessura 2.5px
  - `vw_weekly_global_stats[median_lessons_per_active_student]` (Média) — cor `#8B5CF6` (roxo), espessura 2px, estilo tracejado
- [ ] Formato → Marcadores: desativar (muitas semanas)
- [ ] Formato → Legenda → posição: **Topo Direito**, renomear séries:
  - `avg_lessons_per_active_student` → **"Média"**
  - `median_lessons_per_active_student` → **"Mediana"**
- [ ] Título: **"Aulas por Aluno Ativo na Semana"**
- [ ] Formato → Eixo X → Tipo: **Data Contínua**
- [ ] Formato → Eixo Y → Título: **"Aulas / Aluno"**

> **Por que média pode ser enganosa aqui:** se na semana 5 alguns alunos fizeram 40 aulas (revisão intensiva pré-prova), a média sobe muito. A mediana mostra o comportamento do aluno típico. Ambas juntas revelam isso.

- [ ] Gráfico criado

- [ ] **Página 1 concluída**

---

## Passo (antigo 3) — Tema Profissional (JSON)

> Copiar o JSON abaixo → salvar como `tema_edtech.json` → **Power BI → Exibir → Temas → Procurar temas → selecionar o arquivo**

```json
{
  "name": "EdTech Pro",
  "dataColors": [
    "#2563EB",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
    "#F97316",
    "#6B7280"
  ],
  "background": "#F4F6FA",
  "foreground": "#1E293B",
  "tableAccent": "#2563EB",
  "visualStyles": {
    "*": {
      "*": {
        "fontFamily": [{"value": "Segoe UI"}],
        "fontSize": [{"value": 10}],
        "color": [{"solid": {"color": "#1E293B"}}]
      }
    },
    "card": {
      "*": {
        "background": [{"solid": {"color": "#FFFFFF"}}],
        "border": [{"show": true, "color": {"solid": {"color": "#E2E8F0"}}, "radius": 8}]
      }
    },
    "page": {
      "*": {
        "background": [{"solid": {"color": "#F4F6FA"}}]
      }
    }
  }
}
```

- [x] Arquivo `tema_edtech.json` criado na área de trabalho
- [x] Tema importado no Power BI

---


---

## Passo 5 — Página 2: Assinaturas (manter para depois)

**Objetivo**: Comparar a saúde de cada plano de assinatura usando métricas **normalizadas por aluno** — elimina a distorção de planos com volumes muito diferentes.

- [x] Criar nova página → Renomear para `Assinaturas`

### Filosofia desta página

O problema de mostrar dados brutos (total de aulas, total de horas) é que um plano com 200 alunos sempre "ganha" de um com 15. Isso não diz nada sobre a qualidade do engajamento. Por isso, **todos os gráficos principais usam métricas por aluno** (aulas/aluno, horas/aluno, % de risco). Os números absolutos ficam apenas nos KPIs de contexto.

### Views utilizadas

| View | O que fornece |
|---|---|
| `vw_subscription_summary` | Contagens por status (ativo, pendente, expirado) |
| `vw_subscription_engagement` | Métricas normalizadas: avg_progress, avg_hours_per_student, risco |
| `vw_subscription_weekly_trend_normalized` | Tendência semanal com lessons_per_student e hours_per_student |
| `vw_subscription_risk_distribution` | % de alunos em cada faixa de risco por plano |

### Layout da página

```
┌──────────────────────────────────────────────────────────────────┐
│  Assinaturas                                                     │  ← HEADER
├──────────────┬───────────────┬───────────────┬───────────────────┤
│  Total Ativos │  % Engajados  │  Progresso    │  Em Risco         │  ← KPIs
│               │               │  Médio        │  Crítico          │
├──────────────────────────────┬───────────────────────────────────┤
│                              │                                   │
│  Aulas/Aluno por Semana      │  Distribuição de Risco            │
│  (linhas por plano)          │  (barras empilhadas 100%)         │
│                              │                                   │
├──────────────────────────────┴───────────────────────────────────┤
│                                                                  │
│  Visão Geral por Plano (tabela com métricas normalizadas)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 — Header

- [ ] **Inserir → Caixa de Texto** → digitar `Assinaturas` → fonte **Segoe UI 18pt Bold**, cor `#1E293B`
- [ ] **Inserir → Formas → Retângulo** → cobrir faixa do header → cor `#FFFFFF`, sem borda → enviar para trás

> Esta página não tem slicer de período — os dados são sempre o estado atual + tendência histórica completa.

### 5.2 — 4 KPI Cards

**Novas medidas necessárias** (Modelagem → Nova Medida):

```dax
[Total Assinantes Ativos] =
SUM(vw_subscription_summary[active_count])
```

```dax
[Pct Engajados] =
DIVIDE(
    SUM(vw_subscription_summary[engaged_active_count]),
    SUM(vw_subscription_summary[active_count]),
    0
)
```

```dax
[Progresso Medio Geral] =
-- avg_progress_pct está na escala 0–100 no banco (ex: 36 = 36%).
-- Dividir por 100 converte para 0–1 (ex: 0.36), que é o que o Power BI
-- espera para formatar corretamente como Percentual (0%).
DIVIDE(AVERAGE(vw_subscription_engagement[avg_progress_pct]), 100)
```

```dax
[Alunos Risco Critico] =
SUM(vw_subscription_engagement[students_critical])
```

| # | Rótulo | Medida | Formato |
|---|--------|--------|---------|
| 1 | Assinantes Ativos | `[Total Assinantes Ativos]` | Número inteiro |
| 2 | % Engajados | `[Pct Engajados]` | Percentual `0%` |
| 3 | Progresso Médio | `[Progresso Medio Geral]` | Percentual `0%` |
| 4 | Em Risco Crítico | `[Alunos Risco Critico]` | Número inteiro, cor vermelha `#EF4444` |

**Formatação:** mesma do Passo 4.2 (fundo branco, borda `#E2E8F0`, raio 8, fonte 28).

- [x] 4 medidas criadas
- [x] 4 cards criados

### 5.3 — Gráfico Principal Esquerda: Aulas por Aluno por Semana (por Plano)

**Objetivo:** comparar o ritmo de estudo entre planos de forma justa — normalizado pelo número de alunos ativos daquela semana.

> **Inserir → Gráfico de Linhas**

- [x] Eixo X: `vw_subscription_weekly_trend_normalized[week_start]`
- [x] Valores: `lessons_per_student` (Média)
- [x] Legenda: `level_name` ← **migration 034 renomeou de `subscription_name` para `level_name`**
- [x] Formato → Linhas → espessura **2.5px**
- [x] Formato → Marcadores → desativar (muitas semanas)
- [x] Título: **"Aulas/Aluno por Semana"**
- [ ] Formato → Eixo Y → Título: **"Aulas por Aluno"**

> **Por que este gráfico é poderoso:** se o plano A tem 200 alunos e o plano B tem 15, o total de aulas é inútil para comparação. Mas "aulas por aluno" mostra qual plano tem os alunos mais ativos. Se uma linha cai, os alunos daquele plano estão desengajando — independente do tamanho.

### 5.4 — Gráfico Principal Direita: Distribuição de Risco por Plano

**Objetivo:** ver de relance qual plano tem o maior percentual de alunos em risco — não o maior número (que seria sempre o plano maior).

> **Inserir → Gráfico de Barras Empilhadas 100%** (horizontal)

- [x] Eixo Y: `vw_subscription_risk_distribution[level_name]`
- [x] Valores (nesta ordem):
  - `low_pct` → cor `#10B981` (verde)
  - `medium_pct` → cor `#F59E0B` (amarelo)
  - `high_pct` → cor `#F97316` (laranja)
  - `critical_pct` → cor `#EF4444` (vermelho)
- [x] Formato → Rótulos de dados → Ativar → mostrar `%`
- [x] Formato → Legenda → Ativar, posição: topo
- [x] Título: **"Distribuição de Risco por Plano"**

> **Leitura:** barra toda verde = plano saudável. Quanto mais vermelho/laranja, mais alunos daquele plano estão em risco de abandono. Como é percentual, planos de tamanhos diferentes são diretamente comparáveis.

### 5.5 — Gráfico Rodapé: Tabela Resumo por Plano

**Objetivo:** painel de controle compacto com as métricas-chave de cada plano lado a lado.

> **Inserir → Tabela** (visual de tabela, NÃO matriz)

- [ ] Campos (nesta ordem):
  | Coluna | Fonte | Formato |
  |--------|-------|---------|
  | Plano | `vw_subscription_engagement[level_name]` | Texto |
  | Ativos | `vw_subscription_engagement[active_students]` | Inteiro |
  | Progresso Médio | `vw_subscription_engagement[avg_progress_pct]` | Formato personalizado `0.0"%"` (NÃO usar formato Percentual nativo — a coluna já está em 0–100) |
  | Horas/Aluno | `vw_subscription_engagement[avg_study_hours_per_student]` | `0.0 "h"` |
  | Aulas Totais | `vw_subscription_engagement[total_lessons_completed]` | Inteiro |
  | % Risco Crítico | `vw_subscription_risk_distribution[critical_pct]` | `0.0 "%"` |

- [x] Formato → Cabeçalho → fundo `#1E293B`, texto branco, fonte 10pt bold
- [x] Formato → Linhas alternadas → ativar, cor `#F8FAFC`
- [x] Formato → Bordas → cor `#E2E8F0`
- [x] Título: **"Resumo por Plano"**

> **Formatação condicional na coluna "% Risco Crítico":**
> Selecionar coluna → Formato → Cor de fundo → Regras:
> - `>= 30` → fundo `#FEE2E2` (vermelho claro)
> - `>= 15` → fundo `#FEF3C7` (amarelo claro)
> - `< 15` → fundo `#DCFCE7` (verde claro)

> **Como funciona o click:** ao clicar em um plano na tabela ou em uma barra do gráfico de risco, o cross-filter propaga via `membership_level_id` para o Gráfico 1, isolando apenas a linha daquele plano. Isso funciona porque todos os visuais desta página compartilham o mesmo campo chave (ver 5.6 abaixo).

### 5.6 — Relacionamentos no Modelo (Model View)

> **Importante:** sem estes relacionamentos, clicar em uma assinatura causa um cross-filter incorreto que seleciona uma data aleatória no Gráfico 1 em vez de filtrar pelo plano.

**Migration aplicada:** `034_normalize_subscription_view_column_names` — padronizou `vw_subscription_weekly_trend_normalized` para usar `level_name` e `membership_level_id` (igual às demais views).

**Criar os relacionamentos em Model View (Modelagem → Gerenciar Relações):**

| De (1) | Para (N) | Coluna |
|--------|----------|--------|
| `vw_subscription_engagement[membership_level_id]` | `vw_subscription_weekly_trend_normalized[membership_level_id]` | membership_level_id |
| `vw_subscription_engagement[membership_level_id]` | `vw_subscription_risk_distribution[membership_level_id]` | membership_level_id |

> `vw_subscription_engagement` é a tabela "mestre" — tem 1 linha por plano. As outras têm N linhas por plano (N semanas / N faixas de risco).

- [x] Relacionamentos criados no Model View
- [x] Página 2 concluída

---

## Passo 6 — Navegação e Ajustes Finais

### 6.1 — Barra de Navegação

- [ ] Ir para **qualquer página**
- [ ] **Inserir → Botões → Navegador de Páginas**
- [ ] Formato → estilo: fundo `#1E293B`, texto branco, selecionado: `#2563EB`
- [ ] Posicionar na faixa do header, à esquerda do título
- [ ] Copiar para a outra página (Ctrl+C → ir para página 2 → Ctrl+V)

### 6.2 — Alinhamento

- [ ] Em cada página: selecionar todos os cards (Ctrl+A) → **Formato → Alinhar → Alinhar parte superior**
- [ ] Selecionar os gráficos → **Formato → Distribuir → Distribuir horizontalmente**

### 6.3 — Sincronizar Slicer de Período

- [ ] **Exibir → Sincronizar Segmentações de Dados**
- [ ] Para o slicer `Periodos[Periodo]`: marcar apenas **página 1** (Visão Geral) em Sincronizar + Visível
- [ ] Página 2 (Assinaturas) NÃO tem slicer de período — dados são sempre estado atual

### 6.4 — Publicação

- [ ] **Arquivo → Publicar → Serviço do Power BI**
- [ ] No Power BI Service: Dataset → Configurações → **Atualização agendada → a cada 1h**

---

## Referência Rápida: Medidas e suas Páginas

| Medida | Páginas | Depende de |
|--------|---------|-----------|
| `[Data Inicio Periodo]` | 1 | Slicer `Periodos` |
| `[Total Aulas Concluidas]` | 1 | `vw_weekly_global_stats` + período |
| `[Alunos Ativos]` | 1 | `vw_weekly_global_stats` + período |
| `[Media Aulas por Aluno Ativo]` | 1 | `vw_weekly_global_stats` + período |
| `[Mediana Aulas por Aluno Ativo]` | 1 | `vw_weekly_global_stats` + período |
| `[Total Assinantes Ativos]` | 2 | `vw_subscription_summary` |
| `[Pct Engajados]` | 2 | `vw_subscription_summary` |
| `[Progresso Medio Geral]` | 2 | `vw_subscription_engagement` |
| `[Alunos Risco Critico]` | 2 | `vw_subscription_engagement` |

## Referência Rápida: Views por Página

| Página | Views usadas |
|--------|-------------|
| Visão Geral | `vw_weekly_global_stats`, `vw_yearly_weekly_comparison` |
| Assinaturas | `vw_subscription_summary`, `vw_subscription_engagement`, `vw_subscription_weekly_trend_normalized`, `vw_subscription_risk_distribution` |

## Mapeamento: Pedido do Chefe → Gráfico → View

| Pedido | Gráfico | View | Colunas |
|--------|---------|------|---------|
| Total aulas/semana desde 2023 | 1a (barras) | `vw_weekly_global_stats` | `week_start`, `total_lessons_completed` |
| Ano contra ano 2024/2025/2026 | 1b (linhas sobrepostas) | `vw_yearly_weekly_comparison` | `iso_week`, `lessons_completed`, `year` |
| Alunos que estudaram/semana desde 2023 | 2 (área) | `vw_weekly_global_stats` | `week_start`, `active_students` |
| Média aulas/aluno ativo/semana | 3 (linha laranja) | `vw_weekly_global_stats` | `week_start`, `avg_lessons_per_active_student` |
| Mediana aulas/aluno ativo/semana | 3 (linha roxa tracejada) | `vw_weekly_global_stats` | `week_start`, `median_lessons_per_active_student` |
