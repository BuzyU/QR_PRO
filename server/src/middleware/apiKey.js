import { supabase } from '../config/supabase.js';

/**
 * Middleware: resolve API key to user profile.
 * Attaches req.userId and req.userProfile.
 */
export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  // Look up user by API key
  supabase
    .from('user_profiles')
    .select('*')
    .eq('api_key', apiKey)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      req.userId = data.id;
      req.userProfile = data;
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Auth lookup failed' });
    });
}
