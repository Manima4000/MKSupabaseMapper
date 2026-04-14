# Guia Power BI — MemberKit Student Tracking

## Checklist Geral
- [ ] Passo 0 — Conectar ao Supabase
- [ ] Passo 1 — Ajustes no Power Query
- [ ] Passo 2 — Criar Medidas DAX
- [ ] Passo 3 — Configurar Tema
- [ ] Passo 4 — Página 1: Visão Geral
- [ ] Passo 5 — Página 2: Alunos em Risco
- [ ] Passo 6 — Página 3: Assinaturas
- [ ] Passo 7 — Página 4: Conteúdo & Cursos
- [ ] Passo 8 — Página 5: Velocidade & Quiz
- [ ] Passo 9 — Slicers Globais e Navegação
- [ ] Passo 10 — Ajustes Finais e Publicação

---

## Passo 0 — Conectar ao Supabase

- [ ] Abrir **Power BI Desktop**
- [ ] **Obter Dados → Banco de dados PostgreSQL**
- [ ] Preencher:
  - Servidor: `db.SEUPROJETO.supabase.co` (Supabase → Settings → Database → Connection string)
  - Banco de dados: `postgres`
  - Modo: **Import** (melhor performance; agendamos refresh depois)
- [ ] Credenciais: usuário `postgres` + senha do projeto
- [ ] No **Navigator**, expandir `public` e selecionar **todas as views `vw_*`**
- [ ] Clicar **Carregar**

> Se DirectQuery ficar lento depois, troque por Import com refresh agendado a cada 1h.

---

## Passo 1 — Ajustes no Power Query

- [ ] **Página Inicial → Transformar Dados** (abre Power Query Editor)
- [x] Para cada view que tiver `week_start`: coluna → tipo **Data**
- [x] Colunas `*_pct`: tipo **Número Decimal**
- [x] Colunas `*_count` / `*_id`: tipo **Número Inteiro**
- [ ] Coluna `active_subscription_names` (array PostgreSQL):
  - Selecionar a coluna → **Transformar → Extrair Valores** → Delimitador: `, `
  - Isso converte `{ESA,Marinha}` em texto `ESA, Marinha`
- [ ] **Fechar e Aplicar**

---

## Passo 2 — Criar Medidas DAX

Ir em **Modelagem → Nova Medida** e criar:

```dax
-- Página 2: Cards de risco
Alunos Risco Critico =
COUNTROWS(FILTER(vw_at_risk_students, vw_at_risk_students[risk_level] = "critical"))

Alunos Risco Alto =
COUNTROWS(FILTER(vw_at_risk_students, vw_at_risk_students[risk_level] = "high"))

Alunos Risco Medio =
COUNTROWS(FILTER(vw_at_risk_students, vw_at_risk_students[risk_level] = "medium"))

-- Página 3: Taxa de engajamento
Taxa Engajamento =
DIVIDE(
    SUM(vw_subscription_summary[engaged_active_count]),
    SUM(vw_subscription_summary[active_count]),
    0
)
```

Depois criar uma **coluna calculada** na tabela `vw_student_quiz_summary`:

```dax
Faixa Acuracia =
SWITCH(TRUE(),
    vw_student_quiz_summary[overall_accuracy_pct] >= 90, "90-100%",
    vw_student_quiz_summary[overall_accuracy_pct] >= 70, "70-89%",
    vw_student_quiz_summary[overall_accuracy_pct] >= 50, "50-69%",
    "Abaixo de 50%"
)
```

- [x] Medida `Alunos Risco Critico` criada
- [x] Medida `Alunos Risco Alto` criada
- [x] Medida `Alunos Risco Medio` criada
- [x] Medida `Taxa Engajamento` criada
- [ ] Coluna calculada `Faixa Acuracia` criada

---

## Passo 3 — Configurar Tema

- [ ] **Exibir → Temas → Personalizar tema atual**
- [ ] Definir paleta de cores:
  - Cor 1: `#1B2A4A` (azul escuro)
  - Cor 2: `#2E86AB` (azul)
  - Cor 3: `#28A745` (verde)
  - Cor 4: `#FD7E14` (laranja)
  - Cor 5: `#DC3545` (vermelho)
- [ ] Aba **Texto**: Fonte = `Segoe UI`, Tamanho = 10
- [ ] Fundo da página: `#F5F5F5`
- [ ] Salvar tema

---

## Passo 4 — Página 1: Visão Geral

Objetivo: responder em 5 segundos — *"Como está a plataforma hoje?"*

- [x] Renomear a página para `Visao Geral`

### 4.1 — 4 Cartões KPI no topo

> **Como fazer**: Inserir → Visualizações → **Cartão** (ícone com número grande). Arrastar o campo para "Campos". Formato: fonte 32pt, fundo branco, borda cinza arredondada.

| # | Cartão | Campo | Agregação |
|---|--------|-------|-----------|
| 1 | Alunos Ativos | `vw_subscription_summary[active_count]` | Soma |
| 2 | Aulas Concluídas | `vw_student_overview[total_lessons_completed]` | Soma |
| 3 | Horas de Estudo | `vw_student_overview[estimated_study_hours]` | Soma |
| 4 | Taxa de Conclusão | `vw_course_funnel[completion_rate_pct]` | Média |

- [x] Cartão 1 criado
- [x] Cartão 2 criado
- [x] Cartão 3 criado (formatar como `0.0 h`)
- [x] Cartão 4 criado (formatar como `0.0%`)

### 4.2 — Gráfico de Área: Tendência Semanal

> **Inserir → Gráfico de Colunas e Linhas Combinado**

- [x] Eixo X: `vw_weekly_active_students[week_start]`
- [x] Colunas Y: `vw_weekly_lessons_completed[completed_lessons]`
- [x] Linha Y: `vw_weekly_active_students[active_students]`
- [x] Título: "Atividade Semanal"

> Nota: se não conseguir cruzar as duas views no mesmo visual, crie dois gráficos separados lado a lado.

### 4.3 — Rosca de Assinaturas (esquerda)

> **Inserir → Gráfico de Rosca**

- [x] Legenda: `vw_subscription_summary[level_name]`
- [x] Valores: `vw_subscription_summary[active_count]`
- [x] Formato → Rótulos de dados → Ativar → Mostrar **categoria + valor + percentual**
- [x] Título: "Alunos por Plano"

### 4.4 — Barras Empilhadas: Funil dos Top 5 Cursos (direita)

> **Inserir → Gráfico de Barras Empilhadas**

- [ ] Eixo Y: `vw_course_funnel[course_name]`
- [ ] Valores: `started_students`, `halfway_students`, `completed_students`
- [ ] Filtros no visual → `students_with_any_activity` → **Top N → 5**
- [ ] Cores: verde claro (Iniciaram) → verde médio (Metade) → verde escuro (Concluíram)
- [ ] Título: "Funil dos Cursos Mais Ativos"

---

## Passo 5 — Página 2: Alunos em Risco

Objetivo: *"Quem precisa de atenção AGORA?"*

- [ ] Criar nova página → renomear para `Alunos em Risco`

### 5.1 — 3 Cards de Risco Coloridos

> **Inserir → Cartão** para cada um. Formato → Fundo → cor sólida.

| # | Cartão | Medida DAX | Cor de fundo |
|---|--------|-----------|-------------|
| 1 | Risco Crítico | `Alunos Risco Critico` | `#DC3545` (vermelho) |
| 2 | Risco Alto | `Alunos Risco Alto` | `#FD7E14` (laranja) |
| 3 | Risco Médio | `Alunos Risco Medio` | `#FFC107` (amarelo) |

- [x] Card Crítico (vermelho) criado
- [x] Card Alto (laranja) criado
- [x] Card Médio (amarelo) criado

### 5.2 — Barras: Distribuição por Nível de Risco

> **Inserir → Gráfico de Barras Clusterizadas**

- [ ] Eixo: `vw_at_risk_students[risk_level]`
- [ ] Valor: Contagem de `user_id`
- [ ] Formatar → Cores de dados → cor manual por barra:
  - critical → `#DC3545`
  - high → `#FD7E14`
  - medium → `#FFC107`
  - low → `#28A745`
- [ ] Título: "Distribuição de Risco"

### 5.3 — Scatter Plot: Inatividade vs. Progresso

> **Inserir → Gráfico de Dispersão**

- [x] Eixo X: `vw_at_risk_students[days_since_last_seen]`
- [x] Eixo Y: `vw_at_risk_students[avg_progress_pct]`
- [x] Tamanho: `vw_at_risk_students[risk_score]`
- [x] Legenda (cor): `vw_at_risk_students[risk_level]`
- [ ] Detalhes: `vw_at_risk_students[full_name]`
- [ ] Formato → Dicas de ferramenta → adicionar `email`
- [ ] Título: "Inatividade vs. Progresso (bolha = gravidade)"

> **Como ler o gráfico:**
> - Eixo X (horizontal) = dias sem logar → quanto mais à direita, mais inativo
> - Eixo Y (vertical) = progresso médio nos cursos (0-100%) → quanto mais abaixo, menos progrediu
> - Tamanho da bolha = risk_score (0-100) → bolha maior = risco maior
> - **Canto inferior direito** = aluno parado E sem progresso = prioridade máxima

### 5.4 — Top 10 Críticos: Cartão de Várias Linhas

> **Inserir → Cartão de Várias Linhas** (Multi-row card)

- [ ] Campos: `full_name`, `days_since_last_seen`, `risk_score`
- [ ] Filtros no visual → `risk_level` = "critical"
- [ ] Filtros no visual → Top N → **10** por `risk_score` (decrescente)
- [ ] Título: "Top 10 Alunos Críticos"

---

## Passo 6 — Página 3: Assinaturas

Objetivo: *"Como cada plano está evoluindo semana a semana?"*

View principal: **`vw_subscription_weekly_trend`**
Colunas: `week_start`, `subscription_name`, `active_students`, `lessons_completed`, `estimated_hours`

- [ ] Criar nova página → renomear para `Assinaturas`

### 6.1 — 3 KPI Cards: totais da semana mais recente

> **Como fazer**: Criar medidas DAX que filtram apenas a semana mais recente.

Criar estas medidas em **Modelagem → Nova Medida**:

```dax
Alunos Ativos Ultima Semana =
VAR UltimaSemana = MAX(vw_subscription_weekly_trend[week_start])
RETURN
CALCULATE(
    SUM(vw_subscription_weekly_trend[active_students]),
    vw_subscription_weekly_trend[week_start] = UltimaSemana
)

Aulas Concluidas Ultima Semana =
VAR UltimaSemana = MAX(vw_subscription_weekly_trend[week_start])
RETURN
CALCULATE(
    SUM(vw_subscription_weekly_trend[lessons_completed]),
    vw_subscription_weekly_trend[week_start] = UltimaSemana
)

Horas Estudo Ultima Semana =
VAR UltimaSemana = MAX(vw_subscription_weekly_trend[week_start])
RETURN
CALCULATE(
    SUM(vw_subscription_weekly_trend[estimated_hours]),
    vw_subscription_weekly_trend[week_start] = UltimaSemana
)
```

| # | Cartão | Medida |
|---|--------|--------|
| 1 | Alunos Ativos (última semana) | `Alunos Ativos Ultima Semana` |
| 2 | Aulas Concluídas (última semana) | `Aulas Concluidas Ultima Semana` |
| 3 | Horas de Estudo (última semana) | `Horas Estudo Ultima Semana` |

- [x] 3 medidas DAX criadas
- [x] 3 cartões criados

### 6.2 — Linhas: Alunos Ativos por Plano ao Longo do Tempo

> **Inserir → Gráfico de Linhas**

- [x] Eixo X: `vw_subscription_weekly_trend[week_start]`
- [x] Valores: `active_students` (agregação: Soma)
- [x] Legenda: `subscription_name`
- [ ] Título: "Alunos Ativos por Semana"

> Cada linha = 1 plano. Permite ver se um plano está crescendo ou caindo.

### 6.3 — Barras Empilhadas: Aulas Concluídas por Plano (Semanal)

> **Inserir → Gráfico de Barras Empilhadas**

- [x] Eixo X: `vw_subscription_weekly_trend[week_start]`
- [x] Valores: `lessons_completed` (agregação: Soma)
- [x] Legenda: `subscription_name`
- [ ] Título: "Aulas Concluídas por Plano"

> Mostra o volume total de aulas e qual plano contribui mais a cada semana.

### 6.4 — Combo Chart: Horas de Estudo + Alunos Ativos

> **Inserir → Gráfico de Colunas e Linhas Combinado**

- [x] Eixo X: `vw_subscription_weekly_trend[week_start]`
- [x] Colunas Y: `estimated_hours` (Soma) — horas totais de estudo
- [x] Linha Y (eixo secundário): `active_students` (Soma)
- [x] Legenda: `subscription_name`
- [ ] Título: "Horas de Estudo vs. Alunos Ativos"

> Permite ver se quando mais alunos estão ativos as horas de estudo acompanham (engajamento profundo) ou não (engajamento superficial).

---

## Passo 7 — Página 4: Conteúdo & Cursos

Objetivo: *"Qual conteúdo engaja? Onde os alunos travam?"*

- [ ] Criar nova página → renomear para `Conteudo e Cursos`

### 7.1 — Funil Interativo por Curso

**Preparação no Power Query** (fazer antes):
- [ ] Power Query → selecionar `vw_course_funnel`
- [ ] Selecionar colunas: `course_id`, `course_name`, `started_students`, `halfway_students`, `completed_students`
- [ ] **Transformar → Colunas não dinâmicas (Unpivot)** nas 3 colunas de estudantes
- [ ] Renomear `Atributo` → `Etapa` e `Valor` → `Quantidade`
- [ ] Substituir valores de `Etapa`:
  - `started_students` → `1. Iniciaram`
  - `halfway_students` → `2. Chegaram na Metade`
  - `completed_students` → `3. Concluíram`
- [ ] Fechar e Aplicar

**Visual**:
- [ ] **Inserir → Funil**
- [ ] Grupo: `Etapa`
- [ ] Valores: `Quantidade`
- [ ] Adicionar **Slicer** ao lado: `course_name` como Dropdown
- [ ] Título: "Funil de Conclusão"

### 7.2 — Treemap: Aulas por Conclusões

> **Inserir → Treemap**

- [ ] Grupo (hierarquia): `course_name` → `section_name` → `title`
- [ ] Valores: `vw_lesson_stats[total_completions]`
- [ ] Título: "Aulas Mais Concluídas (clique para drill-down)"

### 7.3 — Top 10 Aulas Mais Bem Avaliadas (esquerda)

> **Inserir → Gráfico de Barras Horizontais**

- [ ] Eixo: `vw_lesson_ratings_summary[title]`
- [ ] Valor: `avg_stars`
- [ ] Filtro Top N → 10 por `avg_stars` (desc)
- [ ] Filtro adicional: `total_ratings >= 5` (evitar notas com poucos votos)
- [ ] Rótulos de dados: ativar, mostrar nota média
- [ ] Título: "Top 10 Mais Bem Avaliadas"

### 7.4 — Top 10 Mais Comentadas (direita)

> **Inserir → Gráfico de Barras Horizontais**

- [ ] Eixo: `vw_lesson_stats[title]`
- [ ] Valor: `total_comments`
- [ ] Filtro Top N → 10 por `total_comments` (desc)
- [ ] Título: "Top 10 Mais Comentadas"

---

## Passo 8 — Página 5: Velocidade & Quiz

Objetivo: *"Os alunos estão acelerando ou desacelerando?"*

- [ ] Criar nova página → renomear para `Velocidade e Quiz`

### 8.1 — Combo Chart: Ritmo de Aprendizado

> **Inserir → Gráfico de Colunas e Linhas Combinado**

- [ ] Eixo X: `vw_learning_velocity[week_start]`
- [ ] Colunas Y: `lessons_completed`
- [ ] Linha Y (eixo secundário): `cumulative_lessons`
- [ ] Título: "Ritmo de Aprendizado (barras = semana, linha = acumulado)"

### 8.2 — Barras + Linha: Horas de Estudo

> **Inserir → Gráfico de Colunas e Linhas Combinado**

- [ ] Eixo X: `vw_weekly_study_hours[week_start]`
- [ ] Colunas Y: `total_study_hours`
- [ ] Linha Y (eixo secundário): `avg_hours_per_student`
- [ ] Título: "Horas de Estudo por Semana"

### 8.3 — Barras: Distribuição de Acurácia no Quiz

> **Inserir → Gráfico de Barras Clusterizadas**

- [ ] Eixo: coluna calculada `Faixa Acuracia` (criada no Passo 2)
- [ ] Valor: Contagem de `user_id`
- [ ] Cores manuais:
  - `90-100%` → `#28A745` (verde)
  - `70-89%` → `#7BC87E` (verde claro)
  - `50-69%` → `#FD7E14` (laranja)
  - `Abaixo de 50%` → `#DC3545` (vermelho)
- [ ] Título: "Distribuição de Acurácia nos Quizzes"

---

## Passo 9 — Slicers Globais e Navegação

### 9.1 — Slicers em cada página

Para cada uma das 5 páginas:
- [ ] **Inserir → Segmentação de Dados (Slicer)** → `week_start` → Tipo: **Entre** (intervalo de datas)
- [ ] **Inserir → Segmentação de Dados** → `subscription_name` → Tipo: **Dropdown**
- [ ] Posicionar no topo da página

### 9.2 — Sincronizar slicers entre páginas

- [ ] **Exibir → Sincronizar Segmentações de Dados**
- [ ] Para o slicer de data: marcar **todas as páginas** nas colunas Sincronizar e Visível
- [ ] Para o slicer de plano: marcar **todas as páginas**

### 9.3 — Botões de Navegação

- [ ] Em **qualquer página**: **Inserir → Botões → Navegador de Páginas**
- [ ] Posicionar no topo
- [ ] Copiar e colar em todas as demais páginas (Ctrl+C / Ctrl+V)
- [ ] Formatar: fundo escuro, texto claro

---

## Passo 10 — Ajustes Finais e Publicação

### 10.1 — Alinhamento e espaçamento

- [ ] Selecionar múltiplos visuais (Ctrl+Click) → **Formato → Alinhar** (topo, esquerda)
- [ ] Distribuir horizontalmente / verticalmente para espaçamento uniforme

### 10.2 — Tooltips customizadas

- [ ] Em cada visual principal: Formato → Dicas de ferramenta → adicionar campos extras
- [ ] Ex: no Scatter da Pág. 2, tooltip deve mostrar `full_name` + `email` + `risk_score`

### 10.3 — Testar cross-filtering

- [ ] Clicar em uma barra → verificar que todos os outros visuais da página filtram junto
- [ ] Se um visual não dever filtrar outro, clicar nele → **Formato → Interações → Editar interações** → desativar

### 10.4 — Publicar

- [ ] **Arquivo → Publicar → Serviço do Power BI**
- [ ] Escolher workspace
- [ ] No Power BI Service: **Conjunto de Dados → Configurações → Atualização agendada → a cada 1h** (se Import)

---

## Referência Rápida: Views e suas Colunas

| View | Colunas Principais | Usado em |
|------|-------------------|----------|
| `vw_subscription_summary` | `level_name`, `active_count`, `pending_count`, `expired_count`, `engaged_active_count` | Pág. 1, 3 |
| `vw_student_overview` | `full_name`, `email`, `total_lessons_completed`, `estimated_study_hours`, `days_since_last_seen` | Pág. 1 |
| `vw_course_funnel` | `course_name`, `started_students`, `halfway_students`, `completed_students`, `completion_rate_pct` | Pág. 1, 4 |
| `vw_weekly_active_students` | `week_start`, `active_students` | Pág. 1 |
| `vw_weekly_lessons_completed` | `week_start`, `completed_lessons` | Pág. 1 |
| `vw_at_risk_students` | `full_name`, `email`, `risk_level`, `risk_score`, `days_since_last_seen` | Pág. 2 |
| `vw_weekly_active_students_by_subscription` | `week_start`, `subscription_name`, `active_students` | Pág. 3 |
| `vw_subscription_engagement` | `subscription_name`, `avg_progress_pct` | Pág. 3 |
| `vw_lesson_stats` | `title`, `course_name`, `section_name`, `total_completions`, `total_comments` | Pág. 4 |
| `vw_lesson_ratings_summary` | `title`, `avg_stars`, `total_ratings` | Pág. 4 |
| `vw_learning_velocity` | `week_start`, `lessons_completed`, `cumulative_lessons` | Pág. 5 |
| `vw_weekly_study_hours` | `week_start`, `total_study_hours`, `avg_hours_per_student` | Pág. 5 |
| `vw_student_quiz_summary` | `user_id`, `overall_accuracy_pct` | Pág. 5 |
