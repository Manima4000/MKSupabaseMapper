import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Singleton com service_role key → acesso total (bypassa RLS)
// Nunca exponha esta key no frontend
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
