// Plan/layout regressions need a completed fixture account once auth is enabled.
// Authentication behaviour itself is tested separately. These helpers never
// contact the configured provider, or use a real account/session.
export const fixtureUser = {
  id: 'planner-test-fixture', email: 'planner-fixture@example.com',
  aud: 'authenticated', role: 'authenticated', app_metadata: {},
  user_metadata: { full_name: 'Planner fixture', compass_profile_complete: true },
  created_at: '2026-01-01T00:00:00Z',
};
export function handleFixtureAuthRequest(request) {
  if (new URL(request.url()).hostname !== 'ctailpmcoyvaplwbwskf.supabase.co') return false;
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' };
  if (request.method() === 'OPTIONS') void request.respond({ status: 204, headers });
  else void request.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(fixtureUser) });
  return true;
}
export async function seedPlannerFixture(page, intercept = true) {
  await page.evaluateOnNewDocument(user => {
    localStorage.setItem('sb-ctailpmcoyvaplwbwskf-auth-token', JSON.stringify({
      access_token: 'planner-fixture-token', refresh_token: 'planner-fixture-refresh',
      token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user,
    }));
  }, fixtureUser);
  if (intercept) {
    await page.setRequestInterception(true);
    page.on('request', request => { if (!handleFixtureAuthRequest(request)) void request.continue(); });
  }
}
