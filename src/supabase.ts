import { createClient } from '@supabase/supabase-js';

// The publishable key is safe to ship in the browser. Saved plans stay in
// browser localStorage, not a Supabase table. Server-side storage needs row
// level security before use (see docs/decisions.md).
// Capture before the SDK consumes the redirect fragment.
const callback = new URLSearchParams(window.location.hash.slice(1));
export const googleOAuthCallback = callback.has('access_token') && callback.has('provider_token') && !callback.has('type');
export const emailAuthCallback = callback.has('access_token') && !googleOAuthCallback;
export const supabase = createClient('https://ctailpmcoyvaplwbwskf.supabase.co', 'sb_publishable_J3Kaa7y4KExb-ICrCA1FIA_z4lYfhG7');
