import { createClient, AuthRefreshDiscardedError, isAuthRetryableFetchError, type AuthChangeEvent, type Session, type SupabaseClient } from '@supabase/supabase-js';

const URL = 'https://ctailpmcoyvaplwbwskf.supabase.co';
const KEY = 'sb_publishable_J3Kaa7y4KExb-ICrCA1FIA_z4lYfhG7';
const STORE = 'state';
const SESSION_KEY = 'compass-session-v2';
type State = { generation: number; values: Record<string, string>; callback?: string; pendingCallback?: string; callbackClaim?: string; recovery?: { generation: number; userId: string } };
type Listener = (event: AuthChangeEvent, session: Session | null) => void;
class StaleGeneration extends Error {}
const stale = () => new StaleGeneration('Your session changed. Please try again.');
const unavailable = () => new Error('Secure browser storage is unavailable. Log-in is paused.');

/** One browser-wide authority. Every session write compares and commits in one transaction. */
export class AuthController {
  private db: Promise<IDBDatabase>;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();
  private errorListeners = new Set<(error: Error) => void>();
  private clients = new Map<number, SupabaseClient>();
  private failure: Error | null = null;
  private callbackNotice: Error | null = null;
  private hydrated = false;
  private acceptedCallback: { generation: number; userId: string } | null = null;
  private recovery = false;
  readonly ready: Promise<void>;

  constructor() {
    this.db = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(unavailable()); return; }
      const request = indexedDB.open('compass-auth-v2', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(unavailable());
      request.onblocked = () => reject(unavailable());
    });
    try { this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('compass-auth-v2'); } catch { /* focus/pageshow also reconcile canonical state */ }
    if (this.channel) this.channel.onmessage = () => { void this.publish('SIGNED_IN'); };
    window.addEventListener('focus', () => { void this.publish('SIGNED_IN'); });
    window.addEventListener('pageshow', () => { void this.publish('SIGNED_IN'); });
    this.ready = this.initialize().catch(async () => {
      this.recovery = false;
      try { const latest = await this.read(); await this.client(latest.generation).auth.initialize(); this.hydrated = true; await this.publish('INITIAL_SESSION'); }
      catch { this.fail(); }
    });
  }

  /** Never await network or SDK work inside an IndexedDB transaction. */
  private async transaction<T>(work: (state: State, store: IDBObjectStore) => T, mode: IDBTransactionMode = 'readonly'): Promise<T> {
    try {
      if (this.failure) throw this.failure;
      const db = await this.db;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE);
        let result: T;
        const read = store.get('canonical');
        read.onsuccess = () => {
          try { if (this.failure) throw this.failure; result = work(read.result ?? { generation: 0, values: {} }, store); }
          catch (error) { reject(error); tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(unavailable());
      });
    } catch (error) {
      if (!(error instanceof StaleGeneration) && !(error instanceof AuthRefreshDiscardedError)) this.fail();
      throw error;
    }
  }

  private read() { return this.transaction(state => state); }
  private session(state: State): Session | null {
    const raw = state.values[SESSION_KEY];
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return session.expires_at && session.expires_at > Date.now() / 1000 ? session : null;
  }
  private fail() {
    if (this.failure) return;
    this.failure = unavailable();
    this.recovery = false;
    for (const listener of this.errorListeners) listener(this.failure);
    for (const client of this.clients.values()) client.auth.dispose();
    this.clients.clear();
    for (const listener of this.listeners) listener('SIGNED_OUT', null);
  }
  get error() { return this.failure ?? this.callbackNotice; }
  get recovering() { return this.recovery; }

  private client(generation: number, callback = false) {
    const existing = this.clients.get(generation);
    if (existing) return existing;
    const refreshExpected = new Map<string, string | undefined>();
    let failedRefreshExpected: {value:string | undefined} | null = null;
    const client = createClient(URL, KEY, { global: { fetch: async (input, init) => {
      const refresh = String(input).includes('grant_type=refresh_token');
      const before = refresh ? await this.read() : null;
      const response = await fetch(input, init);
      if (refresh && !response.ok && before?.generation === generation) failedRefreshExpected = {value:before.values[SESSION_KEY]};
      if (refresh && response.ok && before?.generation === generation) {
        const body = await response.clone().json();
        if (typeof body.access_token === 'string') refreshExpected.set(body.access_token, before.values[SESSION_KEY]);
      }
      return response;
    } }, auth: {
      storageKey: `${SESSION_KEY}-g${generation}`, detectSessionInUrl: false, autoRefreshToken: true,
      // The SDK never broadcasts uncommitted or stale session events across tabs.
      // Cross-tab notifications are hints to read the canonical transaction only.
      storage: {
        getItem: async key => {
          try {
            const state = await this.read();
            const canonical = key.replace(`${SESSION_KEY}-g${generation}`, SESSION_KEY);
            return state.generation === generation ? state.values[canonical] ?? null : null;
          } catch {
            // read() already fails the controller closed and notifies the UI.
            // The SDK also reads from a detached initial-session task, so do
            // not leak a rejected promise from that background reader.
            return null;
          }
        },
        setItem: async (key, value) => {
          key = key.replace(`${SESSION_KEY}-g${generation}`, SESSION_KEY);
          await this.transaction((state, store) => {
            if (state.generation !== generation) throw stale();
            if (key === SESSION_KEY) {
              const token = (JSON.parse(value) as Session).access_token;
              if (refreshExpected.has(token)) {
                const expected = refreshExpected.get(token); refreshExpected.delete(token);
                if (state.values[SESSION_KEY] !== expected) throw new AuthRefreshDiscardedError();
              }
            }
            store.put({ ...state, values: { ...state.values, [key]: value } }, 'canonical');
          }, 'readwrite');
        },
        removeItem: async key => {
          key = key.replace(`${SESSION_KEY}-g${generation}`, SESSION_KEY);
          await this.transaction((state, store) => {
            if (state.generation !== generation) throw stale();
            if (key === SESSION_KEY && failedRefreshExpected) {
              const expected = failedRefreshExpected.value; failedRefreshExpected = null;
              if (state.values[SESSION_KEY] !== expected) return;
            }
            const values = { ...state.values }; delete values[key]; store.put({ ...state, values }, 'canonical');
          }, 'readwrite');
        },
      },
    } });
    let recoveryPending = callback;
    client.auth.onAuthStateChange(event => {
      const acceptedEvent = recoveryPending && event === 'SIGNED_IN' ? 'PASSWORD_RECOVERY' : event;
      if (event === 'SIGNED_IN') recoveryPending = false;
      queueMicrotask(() => { void this.publish(acceptedEvent, generation); });
    });
    this.clients.set(generation, client);
    return client;
  }

  private async publish(event: AuthChangeEvent, generation?: number) {
    if (!this.hydrated || this.failure) return;
    try {
      const state = await this.read();
      if (this.failure || (generation !== undefined && state.generation !== generation)) return;
      const session = this.session(state);
      if (!session && state.values[SESSION_KEY]) {
        // An expired access token is not a completed logout. Let the SDK
        // settle refresh or remove the dead session before publishing null.
        this.client(state.generation);
        return;
      }
      this.recovery = Boolean(session && state.recovery?.generation === state.generation && state.recovery.userId === session.user.id);
      if (this.recovery && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) event = 'PASSWORD_RECOVERY';
      for (const [old, client] of this.clients) if (old !== state.generation) { client.auth.dispose(); this.clients.delete(old); }
      // Create the current generation's refresh owner even in passive tabs.
      this.client(state.generation);
      for (const listener of this.listeners) listener(session ? event : 'SIGNED_OUT', session);
      if (generation !== undefined) this.channel?.postMessage({ generation: state.generation });
    } catch { this.fail(); }
  }

  private async initialize() {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has('access_token')) {
      try {
      const callback = new URLSearchParams(window.location.search).get('compassAuth');
      if (!navigator.locks) { this.callbackNotice = new Error('This browser cannot safely validate a log-in link. Try a browser with Web Locks support.'); throw this.callbackNotice; }
      await navigator.locks.request('compass-callback-validation', { ifAvailable: true }, async lock => {
      if (!lock) { this.callbackNotice = new Error('This link is being checked in another tab. Try again after that check finishes.'); return; }
      const state = await this.read();
      if (!callback || callback !== state.callback && callback !== state.pendingCallback) {
        this.callbackNotice = new Error('This link does not match a current request in this browser. Open it in the browser where you requested it, or request a fresh link.');
      } else {
        // Claim the one-time callback before network work. A second tab cannot
        // reuse its authority, and the bound generation cannot become newer.
        const claim = crypto.randomUUID();
        await this.transaction((latest, store) => {
          if (latest.generation !== state.generation || latest.callback !== callback && latest.pendingCallback !== callback) throw stale();
          store.put({ ...latest, callbackClaim: claim }, 'canonical');
        }, 'readwrite');
        this.recovery = fragment.get('type') === 'recovery';
        const client = this.client(state.generation, this.recovery);
        const result = await client.auth.setSession({ access_token: fragment.get('access_token')!, refresh_token: fragment.get('refresh_token') ?? '' }).catch(async error => {
          await this.transaction((latest, store) => {
            if (latest.generation === state.generation && latest.callbackClaim === claim && latest.values[SESSION_KEY] === state.values[SESSION_KEY])
              store.put({ ...latest, callbackClaim: undefined }, 'canonical');
          }, 'readwrite');
          throw error;
        });
        if (result.error || (await this.read()).generation !== state.generation) this.recovery = false;
        if (result.error) this.callbackNotice = new Error('This log-in or reset link is invalid or has expired.');
        await this.transaction((latest, store) => {
          if (latest.generation !== state.generation || latest.callbackClaim !== claim) throw stale();
          const session = this.session(latest);
          const recovery = this.recovery && !result.error && session ? { generation: latest.generation, userId: session.user.id } : undefined;
          // Keep exclusive ownership until validation settles. A failed lookup
          // with no accepted session may retry the same delivered link.
          const accepted = session?.access_token === fragment.get('access_token');
          const consumed = !result.error || accepted;
          store.put({ ...latest,
            callback: consumed && latest.callback === callback ? undefined : latest.callback,
            pendingCallback: consumed && latest.pendingCallback === callback ? undefined : latest.pendingCallback,
            callbackClaim: undefined, recovery }, 'canonical');
          if (!result.error && session && result.data.session?.user.id === session.user.id && result.data.session.access_token === session.access_token) {
            this.acceptedCallback = { generation: latest.generation, userId: session.user.id };
          }
        }, 'readwrite');
      }
      });
      } finally {
        const url = new window.URL(window.location.href); url.hash = ''; url.searchParams.delete('compassAuth');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
    const state = await this.read();
    await this.client(state.generation).auth.initialize();
    this.hydrated = true;
    await this.publish(this.recovery ? 'PASSWORD_RECOVERY' : 'INITIAL_SESSION', state.generation);
  }

  /** New intent retires every older operation, including in other tabs. */
  private async begin(clear = false, callback?: string, preserveCallback = false, expectedGeneration?: number) {
    await this.ready;
    if (this.failure) throw this.failure;
    this.callbackNotice = null;
    this.recovery = false;
    const state = await this.transaction((previous, store) => {
      if (expectedGeneration !== undefined && previous.generation !== expectedGeneration) throw stale();
      const next = { generation: previous.generation + 1, values: clear ? {} : previous.values, callback: preserveCallback ? previous.callback : callback, pendingCallback: preserveCallback ? callback : undefined };
      store.put(next, 'canonical'); return { ...next, previousCallback: previous.callback };
    }, 'readwrite');
    this.channel?.postMessage({ generation: state.generation });
    await this.publish('SIGNED_IN', state.generation);
    return { generation: state.generation, previousCallback: state.previousCallback, auth: this.client(state.generation).auth };
  }

  async run<T>(work: (auth: SupabaseClient['auth']) => Promise<T>, clear = false) {
    const operation = await this.begin(clear);
    const result = await work(operation.auth);
    if (this.failure) throw this.failure;
    if ((await this.read()).generation !== operation.generation) throw stale();
    return result;
  }

  async redirect<T>(work: (auth: SupabaseClient['auth'], redirectTo: string) => Promise<T>, preserveFailed = false, afterValidation?: (result: T) => void) {
    const token = crypto.randomUUID();
    const operation = await this.begin(false, token, preserveFailed);
    const url = new window.URL(window.location.origin);
    if (new URLSearchParams(window.location.search).get('demo') === '1') url.searchParams.set('demo', '1');
    url.searchParams.set('compassAuth', token);
    const settlePending = async (success: boolean) => {
      await this.transaction((state, store) => {
        if (state.generation === operation.generation && state.pendingCallback === token) store.put({...state, pendingCallback:undefined, callback:success ? token : state.callback}, 'canonical');
      }, 'readwrite');
    };
    let result: T;
    try { result = await work(operation.auth, url.toString()); }
    catch (error) { if (preserveFailed && !isAuthRetryableFetchError(error) && !(error instanceof TypeError)) await settlePending(false); throw error; }
    const deliveryError = result && typeof result === 'object' && 'error' in result ? result.error : null;
    if (preserveFailed && !isAuthRetryableFetchError(deliveryError)) await settlePending(!deliveryError);
    if (this.failure) throw this.failure;
    if ((await this.read()).generation !== operation.generation) throw stale();
    afterValidation?.(result);
    return result;
  }

  /** Only a successfully accepted, still-current callback may bind a Google draft. */
  async acceptedCallbackPrincipal() {
    await this.ready;
    if (this.failure || this.callbackNotice || !this.acceptedCallback) return null;
    const state = await this.read();
    return state.generation === this.acceptedCallback.generation && this.session(state)?.user.id === this.acceptedCallback.userId
      ? this.acceptedCallback.userId : null;
  }

  async getSession() {
    await this.ready;
    if (this.failure) throw this.failure;
    let state = await this.read();
    const result = await this.client(state.generation).auth.getSession();
    const latest = await this.read();
    if (this.failure) throw this.failure;
    if (latest.generation !== state.generation) { state = latest; }
    else if (result.error) {
      const canonical = this.session(latest);
      if (!canonical || !canonical.expires_at || canonical.expires_at <= Date.now() / 1000) return { data: { session: null }, error: result.error };
      state = latest;
    }
    else state = latest;
    return { data: { session: this.session(state) }, error: null };
  }
  async lookup<T>(work: (auth: SupabaseClient['auth']) => Promise<T>) {
    await this.ready;
    if (this.failure) throw this.failure;
    const state = await this.read();
    const result = await work(this.client(state.generation).auth);
    if (this.failure) throw this.failure;
    if ((await this.read()).generation !== state.generation) throw stale();
    return result;
  }

  /** Clear locally first; late remote logout cannot remove a later account. */
  async signOut(scope: 'local' | 'global' | 'others' = 'global') {
    await this.ready;
    if (this.failure) throw this.failure;
    const state = await this.read();
    // Logout must not wait for an expired session's refresh network request.
    const previous = state.values[SESSION_KEY] ? JSON.parse(state.values[SESSION_KEY]) as Session : null;
    const token = previous?.access_token;
    const operation = await this.begin(scope !== 'others', undefined, false, state.generation);
    if (!token) return { error: null };
    const response = await fetch(`${URL}/auth/v1/logout?scope=${scope}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
    if (this.failure) throw this.failure;
    if ((await this.read()).generation !== operation.generation) throw stale();
    return { error: response.ok || scope === 'local' && (response.status === 401 || response.status === 403) ? null : new Error('Remote logout failed') };
  }

  async capture() { await this.ready; if (this.failure) throw this.failure; return (await this.read()).generation; }
  async isCurrent(generation: number) { try { return !this.failure && (await this.read()).generation === generation && !this.failure; } catch { return false; } }

  async finishRecovery(generation: number, userId: string) {
    if (this.failure) throw this.failure;
    await this.transaction((state, store) => {
      if (state.generation !== generation || this.session(state)?.user.id !== userId) throw stale();
      store.put({ ...state, recovery: undefined }, 'canonical');
    }, 'readwrite');
    this.recovery = false;
    await this.publish('USER_UPDATED', generation);
  }

  async current(userId: string) { const { data } = await this.getSession(); return data.session?.user.id === userId; }
  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
    if (this.failure) listener(this.failure);
    return () => { this.errorListeners.delete(listener); };
  }
  onAuthStateChange(listener: Listener) {
    this.listeners.add(listener);
    void this.ready.then(() => this.publish(this.recovery ? 'PASSWORD_RECOVERY' : 'INITIAL_SESSION'));
    return { data: { subscription: { unsubscribe: () => this.listeners.delete(listener) } } };
  }
}
