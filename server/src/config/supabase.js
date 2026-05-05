import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-side client uses SERVICE ROLE key to bypass RLS
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
