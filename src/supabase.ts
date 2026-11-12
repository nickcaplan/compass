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
  resetPasswordForEmail: (email: string, options?: Parameters<Auth['resetPasswordForEmail']>[1], signal?: AbortSignal) => authController.redirect((auth, url) => {
    if (signal?.aborted) throw new TypeError('Reset request timed out');
    return auth.resetPasswordForEmail(email, { ...options, redirectTo: url });
  }, true),
  signInWithOAuth: (credentials: Parameters<Auth['signInWithOAuth']>[0], beforeRedirect?: () => boolean) => authController.redirect((auth, url) => auth.signInWithOAuth({ ...credentials, options: { ...credentials.options, redirectTo: url, skipBrowserRedirect: true } }), false, result => {
    if (!credentials.options?.skipBrowserRedirect && !result.error && result.data.url) {
      if (beforeRedirect && !beforeRedirect()) throw new Error('Could not preserve the latest brief before Google log-in.');
      window.location.assign(result.data.url);
    }
  }),
  signOut: (...args: Parameters<Auth['signOut']>) => authController.signOut(args[0]?.scope),
} };
