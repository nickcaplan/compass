import { ECB_RATES_URL, FALLBACK_RATE_SET, isCurrencyCode, parseEcbRates } from './data';
import type { FxRateSet } from './data';

// Exchange rates load once, in the background, when Compass first starts. Screens
// read the current set and never trigger a request. Until live rates arrive (or
// if they never do) the dated fallback snapshot is shown and named on screen.
// A successful answer is kept in browser storage for a day, so later visits
// start with it and do not ask the ECB again.
const CACHE_KEY = 'compass-fx-rates';
const CACHE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

let current: FxRateSet = FALLBACK_RATE_SET;
let started = false;
const listeners = new Set<() => void>();

function publish(next: FxRateSet) { current = next; listeners.forEach(l => l()); }

function readCache(now: number): FxRateSet | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { set?: FxRateSet; fetchedAt?: number } | null;
    const set = raw?.set;
    if (!set || typeof raw?.fetchedAt !== 'number' || now - raw.fetchedAt > CACHE_MS || raw.fetchedAt > now + 60000) return null;
    if (set.live !== true || typeof set.date !== 'string' || !set.rates) return null;
    for (const code of Object.keys(FALLBACK_RATE_SET.rates)) {
      const value = (set.rates as Record<string, number>)[code];
      if (!isCurrencyCode(code) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    }
    return set;
  } catch { return null; }
}

function writeCache(set: FxRateSet, now: number) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ set, fetchedAt: now })); } catch { /* storage unavailable: skip the cache */ }
}

/** Starts the one background fetch. Safe to call more than once. */
export function startRateFetch(): void {
  if (started) return;
  started = true;
  const now = Date.now();
  const cached = readCache(now);
  if (cached) { publish(cached); return; }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  void fetch(ECB_RATES_URL, { signal: controller.signal, headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      const set = data ? parseEcbRates(data) : null;
      if (set) { writeCache(set, Date.now()); publish(set); }
    })
    .catch(() => { /* keep the dated fallback */ })
    .finally(() => window.clearTimeout(timer));
}

export function getRates(): FxRateSet { return current; }
export function subscribeRates(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
