import { createClient } from '@supabase/supabase-js';

// The publishable key is safe to ship in the browser; row level security on
// the saved_plans table is what protects user data.
export const supabase = createClient('https://ctailpmcoyvaplwbwskf.supabase.co', 'sb_publishable_J3Kaa7y4KExb-ICrCA1FIA_z4lYfhG7');
