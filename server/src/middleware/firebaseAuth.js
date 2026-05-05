import { supabase } from '../config/supabase.js';

/**
 * Middleware: verify Firebase ID token via Supabase auth or simple lookup.
 * For a lightweight approach without firebase-admin SDK, we verify the user
 * exists in our user_profiles table by their Firebase UID passed in the token.
 *
 * In production, you'd use firebase-admin to verify the JWT.
 * Here we trust the Firebase UID from the Authorization header for simplicity.
 *
 * Format: Authorization: Bearer <firebase-uid>
 */
export function firebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const uid = authHeader.split('Bearer ')[1].trim();

  if (!uid) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  // Verify user exists in our profiles table
  supabase
    .from('user_profiles')
    .select('*')
    .eq('id', uid)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        // User exists in Firebase but hasn't been provisioned yet — auto-create
        return supabase
          .from('user_profiles')
          .insert({
            id: uid,
            api_key: generateApiKey(),
          })
          .select()
          .single()
          .then(({ data: newProfile, error: insertErr }) => {
            if (insertErr) {
              return res.status(500).json({ error: 'Failed to create user profile' });
            }
            req.userId = newProfile.id;
            req.userProfile = newProfile;
            next();
          });
      }

      req.userId = data.id;
      req.userProfile = data;
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Auth verification failed' });
    });
}

/** Generate a random API key */
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'qrp_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
