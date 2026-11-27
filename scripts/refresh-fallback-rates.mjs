// Refreshes the saved fallback exchange rates in src/data.ts from the ECB.
// Run by the scheduled "Refresh fallback rates" workflow. Prints "changed" or
// "unchanged" and exits non-zero (leaving the file alone) on anything unexpected.
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const DATA_FILE = 'src/data.ts';
const START = '// fallback-rates:start\n';
const END = '// fallback-rates:end';
const MAX_MOVE = 0.1; // refuse a rate that moves more than 10% from the saved one in one step

function load(source) {
  const code = stripTypeScriptTypes(source).replace(/^export /gm, '');
  return new Function(`${code};return {ECB_RATES_URL,FALLBACK_RATES,FX_RATE_DATE,parseEcbRates}`)();
}

const dayOf = (label) => Date.parse(`${label} UTC`);

/** Returns the new file text, or null when the saved rates are already as new as `live`. Throws on anything unsafe. */
export function applyRates(source, live) {
  const { FALLBACK_RATES, FX_RATE_DATE } = load(source);
  if (!live || live.live !== true || typeof live.date !== 'string') throw new Error('No usable live rate set');
  const liveDay = dayOf(live.date), savedDay = dayOf(FX_RATE_DATE);
  if (!Number.isFinite(liveDay) || !Number.isFinite(savedDay)) throw new Error('Unreadable rate date');
  if (liveDay < savedDay) throw new Error(`Live rates (${live.date}) are older than the saved rates (${FX_RATE_DATE})`);
  if (liveDay === savedDay) return null;
  for (const [code, saved] of Object.entries(FALLBACK_RATES)) {
    const value = live.rates[code];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`Bad ${code} rate`);
    if (code === 'EUR' ? value !== 1 : Math.abs(value / saved - 1) > MAX_MOVE) throw new Error(`${code} rate ${value} is out of range against the saved ${saved}`);
  }
  const block = `${START}export const FX_RATE_DATE = '${live.date}';\nexport const FALLBACK_RATES: FxRates = {\n` +
    Object.keys(FALLBACK_RATES).map((code) => `  ${code}: ${live.rates[code]},\n`).join('') + `};\n${END}`;
  const a = source.indexOf(START), b = source.indexOf(END);
  if (a < 0 || b < a) throw new Error('Fallback rate markers not found');
  return source.slice(0, a) + block + source.slice(b + END.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = readFileSync(DATA_FILE, 'utf8');
  const { ECB_RATES_URL, parseEcbRates } = load(source);
  const response = await fetch(ECB_RATES_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`ECB answered ${response.status}`);
  const next = applyRates(source, parseEcbRates(await response.json()));
  if (next === null) console.log('unchanged');
  else { writeFileSync(DATA_FILE, next); console.log('changed'); }
}
