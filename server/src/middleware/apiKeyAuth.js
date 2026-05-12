import { supabase } from '../config/supabase.js';

/**
 * Middleware: Verify API Key from headers or query params
 * 
 * Supports:
 * - Header: `x-api-key: your_key`
 * - Query: `?apiKey=your_key`
 */
export async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Provide via x-api-key header or ?apiKey query param.' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !profile) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.userId = profile.id;
    req.userProfile = profile;
    next();
  } catch (err) {
    console.error('[API Key Auth Error]', err.message);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
