import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Mode = 'signin' | 'signup' | 'reset' | 'update';
export default function EmailAuth({ idPrefix, recovery, onAuthenticated, beforeEmail }: {
  idPrefix: string; recovery: boolean; onAuthenticated: (user: User) => void; beforeEmail: () => void;
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
    setError(null); setNotice(null); setBusy(true); beforeEmail();
    try {
      if (activeMode === 'reset') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (result.error) { setError('Could not request a reset email. Please try again.'); return; }
        setNotice('If an account exists for that email, we have sent a reset link. Check your inbox and spam folder.');
      } else if (activeMode === 'signup') {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (result.error) { setError('Could not create your account. Try signing in if you already have one.'); return; }
        setPassword('');
        if (result.data.session) onAuthenticated(result.data.session.user);
        else setNotice('Check your inbox to confirm your email, then return to sign in. If you already have an account, sign in instead.');
      } else if (activeMode === 'update') {
        const result = await supabase.auth.updateUser({ password });
        if (result.error || !result.data.user) { setError('Could not update your password. Request a fresh reset link if this one has expired.'); return; }
        setPassword(''); onAuthenticated(result.data.user);
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error || !result.data.user) { setError('Could not sign in. Check your email and password, and confirm your email if you just signed up.'); return; }
        setPassword(''); onAuthenticated(result.data.user);
      }
    } catch { setError('Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    {!recovery && <div className="email-modes" aria-label="Email account options">
      <button type="button" className={mode === 'signin' ? 'selected' : ''} disabled={busy} onClick={() => changeMode('signin')}>Sign in</button>
      <button type="button" className={mode === 'signup' ? 'selected' : ''} disabled={busy} onClick={() => changeMode('signup')}>Create account</button>
    </div>}
    <form onSubmit={submit} aria-label="Email account">
      <h3 className="email-heading">{activeMode === 'signup' ? 'Create your account' : activeMode === 'reset' ? 'Reset your password' : activeMode === 'update' ? 'Choose a new password' : 'Sign in with email'}</h3>
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
      <button type="submit" className="gen" disabled={busy}>{busy ? 'Please wait...' : activeMode === 'signup' ? 'Create account' : activeMode === 'reset' ? 'Send reset link' : activeMode === 'update' ? 'Save new password' : 'Sign in with email'} <span>&rarr;</span></button>
      {activeMode === 'signin' && <button type="button" className="email-forgot" disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>}
    </form>
  </>;
}
