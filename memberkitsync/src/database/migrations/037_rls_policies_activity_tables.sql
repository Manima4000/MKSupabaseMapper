-- ============================================================================
-- Migration 037: RLS policies para tabelas sem políticas definidas
--
-- Context:
--   Tabelas criadas em migrations anteriores têm RLS habilitado mas nenhuma
--   política definida. Isso bloqueia todo acesso via anon/authenticated key
--   (PostgREST direto, Power BI, etc.). O backend usa service_role que bypassa
--   RLS, então não há impacto funcional atual — mas qualquer acesso direto
--   retorna zero dados sem erro explícito.
--
--   Fix: adicionar service_role ALL policy em todas as tabelas afetadas,
--   seguindo o padrão já estabelecido em users e comments.
-- ============================================================================

CREATE POLICY service_role_all_lesson_progress
  ON lesson_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_lesson_ratings
  ON lesson_ratings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_lesson_file_downloads
  ON lesson_file_downloads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_quiz_attempts
  ON quiz_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_forum_posts
  ON forum_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_forum_comments
  ON forum_comments FOR ALL TO service_role USING (true) WITH CHECK (true);


