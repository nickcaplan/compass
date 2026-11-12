import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, authController, SUPABASE_URL, SUPABASE_PUBLIC_KEY } from './supabase';

const resetNotice = 'If an account exists for that email, check your inbox and spam folder for a reset link. If you requested one recently, please wait before trying again.';

type Mode = 'signin' | 'signup' | 'reset' | 'update';
type AuthErrorLike = { code?: string; message?: string } | null;
function authErrorMessage(err: AuthErrorLike, fallback: string): string {
  const msg = err?.message ?? '';
  const code = err?.code ?? '';
  // Server-provided per-recipient cooldown. Checked first: Supabase reuses
  // over_email_send_rate_limit for both the project quota and this cooldown, so
  // only the message tells them apart. Deliberately no pinned seconds: the
  // message persists until the next interaction and a stale countdown would
  // outlive the real wait.
  if (/after \d+ seconds?/i.test(msg))
    return 'You requested an email for this address a moment ago. For security, please wait a short while before requesting another.';
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg))
    return 'Compass cannot send more emails right now - our email limit for this period is reached. This is on our side, not a problem with your details. Please try again later.';
  // IP throttle: no provider-guaranteed window is documented, so stay neutral.
  if (code === 'over_request_rate_limit' || /request rate limit/i.test(msg) || /too many requests/i.test(msg))
    return 'Too many attempts from this network. Please try again in a little while.';
  return fallback;
}

export default function EmailAuth({ idPrefix, recovery, onAuthenticated, beforeEmail, recoveryUserId, isRecoveryCurrent }: {
  recoveryUserId: string | null; isRecoveryCurrent: (id: string) => boolean;
  idPrefix: string; recovery: boolean; onAuthenticated: (user: User) => void; beforeEmail: (email: string) => boolean;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const activeMode = recovery ? 'update' : mode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function changeMode(next: Mode) { setMode(next); setError(null); setNotice(null); setPassword(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null); setNotice(null);
    if (activeMode !== 'update' && !beforeEmail(email)) { setError('Could not keep your brief in this browser. Your answers are still here. Free some browser storage and try again.'); return; }
    setBusy(true);
    try {
      if (activeMode === 'reset') {
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + (new URLSearchParams(window.location.search).get('demo') === '1' ? '/?demo=1' : '') });
        // Provider outcomes, including account-dependent delivery failures,
        // expose the same truthful, conditional status.
        // This is UI privacy only; the provider API still exposes its own errors.
        setNotice(resetNotice);
      } else if (activeMode === 'signup') {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + (new URLSearchParams(window.location.search).get('demo') === '1' ? '/?demo=1' : '') } });
        if (result.error) { setError(result.error.code === 'weak_password' ? 'Choose a stronger password. It does not meet the password requirements.' : authErrorMessage(result.error, 'Could not create your account. Try logging in if you already have one.')); return; }
        setPassword('');
        if (result.data.session) onAuthenticated(result.data.session.user);
        else setNotice('Check your inbox to confirm your email, then return to log in. If you already have an account, log in instead.');
      } else if (activeMode === 'update') {
        // Capture A's token and check its principal before sending. updateUser()
        // otherwise looks up whichever session is active after its internal await.
        const generation = await authController.capture();
        const id = recoveryUserId;
        if (!id || !isRecoveryCurrent(id)) return;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isRecoveryCurrent(id) || !(await authController.isCurrent(generation))) return;
        if (sessionError) { setError('Could not update your password. Try again, or request a fresh reset link if this one has expired.'); return; }
        if (data.session?.user.id !== id) return;
        const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'PUT',
          headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const body = await response.json();
        if (!isRecoveryCurrent(id) || !(await authController.isCurrent(generation))) return;
        const result = { data: { user: response.ok ? body as User : null },
          error: response.ok ? null : { code: body.code ?? body.error_code, message: body.msg ?? body.message } };
        if (result.error || !result.data.user) {
          setError(result.error?.code === 'same_password' ? 'Choose a different password from your current one.' :
            result.error?.code === 'weak_password' ? 'Choose a stronger password. It does not meet the password requirements.' :
            authErrorMessage(result.error, 'Could not update your password. Try again, or request a fresh reset link if this one has expired.'));
          return;
        }
        if (result.data.user.id !== id) return;
        await authController.finishRecovery(generation, id);
        if (!(await authController.isCurrent(generation))) return;
        setPassword(''); onAuthenticated(result.data.user);
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error || !result.data.user) { setError(authErrorMessage(result.error, 'Could not log in. Check your email and password, and confirm your email if you just signed up.')); return; }
        setPassword(''); onAuthenticated(result.data.user);
      }
    } catch { setError('Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    {!recovery && <div className="email-modes" aria-label="Email account options">
      <button type="button" className={mode === 'signin' ? 'selected' : ''} aria-pressed={mode === 'signin'} disabled={busy} onClick={() => changeMode('signin')}>Log in</button>
      <button type="button" className={mode === 'signup' ? 'selected' : ''} aria-pressed={mode === 'signup'} disabled={busy} onClick={() => changeMode('signup')}>Create account</button>
    </div>}
    <form onSubmit={submit} aria-label="Email account">
      <h3 className="email-heading">{activeMode === 'signup' ? 'Create your account' : activeMode === 'reset' ? 'Reset your password' : activeMode === 'update' ? 'Choose a new password' : 'Log in with email'}</h3>
      {activeMode !== 'update' && <div className="field">
        <label htmlFor={`${idPrefix}-email`}>Email</label>
        <input id={`${idPrefix}-email`} className="ctl" type="email" autoComplete="email" placeholder="you@company.com" required disabled={busy} value={email} onChange={e => { setEmail(e.target.value); setError(null); }} />
      </div>}
      {activeMode !== 'reset' && <div className="field">
        <label htmlFor={`${idPrefix}-password`}>{recovery ? 'New password' : 'Password'}</label>
        <input id={`${idPrefix}-password`} className="ctl" type="password" autoComplete={activeMode === 'signin' ? 'current-password' : 'new-password'} required minLength={activeMode === 'signin' ? 1 : 8} disabled={busy} value={password} onChange={e => { setPassword(e.target.value); setError(null); }} />
        {activeMode !== 'signin' && <p className="hint">Use at least 8 characters.</p>}
      </div>}
      {error && <p className="fieldnote" role="alert">{error}</p>}
      {notice && <p className="email-notice" role="status">{notice}</p>}
      <button type="submit" className="gen" disabled={busy}>{busy ? 'Please wait...' : activeMode === 'signup' ? 'Create account' : activeMode === 'reset' ? 'Send reset link' : activeMode === 'update' ? 'Save new password' : 'Log in with email'} <span>&rarr;</span></button>
      {activeMode === 'signin' && <button type="button" className="email-forgot" disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>}
    </form>
  </>;
}
