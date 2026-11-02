import { createClient } from '@supabase/supabase-js';

// The publishable key is safe to ship in the browser. Saved plans stay in
// browser localStorage, not a Supabase table. Server-side storage needs row
// level security before use (see docs/decisions.md).
export const supabase = createClient('https://ctailpmcoyvaplwbwskf.supabase.co', 'sb_publishable_J3Kaa7y4KExb-ICrCA1FIA_z4lYfhG7');
