// Global test environment setup — runs before each test file.
// Sets all required env vars so env.ts (Zod) does not call process.exit(1).
// dotenv/config (imported inside env.ts) respects already-set variables,
// so these values take precedence over any .env file present on disk.

process.env['NODE_ENV'] = 'test'
process.env['PORT'] = '3001'
process.env['HOST'] = '0.0.0.0'
process.env['LOG_LEVEL'] = 'error'
process.env['SUPABASE_URL'] = 'https://test-project.supabase.co'
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key'
process.env['MEMBERKIT_API_KEY'] = 'test-api-key'
process.env['MEMBERKIT_API_URL'] = 'https://app.memberkit.com.br/api/v1'
// Leave WEBHOOK_SECRET unset so signature validation is skipped by default.
// Tests that need it will mock the env module directly.
delete process.env['WEBHOOK_SECRET']
