import { AuthController } from './authController';

// Authentication is fenced separately from saved plans. No legacy auth tokens
// are imported; rollout requires fresh log-in and closing old-version tabs.
const callback = new URLSearchParams(window.location.hash.slice(1));
export const googleOAuthCallback = callback.has('access_token') && callback.has('provider_token') && !callback.has('type');
export const emailAuthCallback = callback.has('access_token') && !googleOAuthCallback;
export const SUPABASE_URL = 'https://ctailpmcoyvaplwbwskf.supabase.co';
export const SUPABASE_PUBLIC_KEY = 'sb_publishable_J3Kaa7y4KExb-ICrCA1FIA_z4lYfhG7';
export const authController = new AuthController();
type Auth = import('@supabase/supabase-js').SupabaseClient['auth'];
export const supabase = { auth: {
  getSession: () => authController.getSession(),
  getUser: (...args: Parameters<Auth['getUser']>) => authController.lookup(auth => auth.getUser(...args)),
  onAuthStateChange: authController.onAuthStateChange.bind(authController),
  signInWithPassword: (...args: Parameters<Auth['signInWithPassword']>) => authController.run(auth => auth.signInWithPassword(...args)),
  signUp: (...args: Parameters<Auth['signUp']>) => authController.redirect((auth, url) => auth.signUp({ ...args[0], options: { ...args[0].options, emailRedirectTo: url } }), true),
  resetPasswordForEmail: (...args: Parameters<Auth['resetPasswordForEmail']>) => authController.redirect((auth, url) => auth.resetPasswordForEmail(args[0], { ...args[1], redirectTo: url }), true),
  signInWithOAuth: (...args: Parameters<Auth['signInWithOAuth']>) => authController.redirect((auth, url) => auth.signInWithOAuth({ ...args[0], options: { ...args[0].options, redirectTo: url } })),
  signOut: (...args: Parameters<Auth['signOut']>) => authController.signOut(args[0]?.scope),
} };
