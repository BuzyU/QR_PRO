import 'dotenv/config';

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'HMAC_SECRET',
  'ENCRYPTION_KEY',
  'FRONTEND_URL',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`\x1b[31m[FATAL] Missing required env var: ${key}\x1b[0m`);
    process.exit(1);
  }
}

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  hmacSecret: process.env.HMAC_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  frontendUrl: process.env.FRONTEND_URL,
};
