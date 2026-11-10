import { AUTH_DRAFT_KEY, AUTH_FLOW_KEY, accountDraftKey, emailDraftKey, googleDraftKey, bindingMatches } from './authDraft';
import type { DraftBinding } from './authDraft';
import { readPlanRoute, routeHash, usePlanNavigation } from './planRoutes';
import type { Page, PlanRoute } from './planRoutes';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, googleOAuthCallback, emailAuthCallback, SUPABASE_URL, SUPABASE_PUBLIC_KEY } from './supabase';
import EmailAuth from './EmailAuth';

import logoUrl from './assets/thh-logo.svg';

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function IconSave() {
  return (
    <svg {...iconProps}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg {...iconProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg {...iconProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconCancel() {
  return (
    <svg {...iconProps}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="5" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg {...iconProps}>
      <path d="m16 3 5 5-12 12-6 1 1-6L16 3z" />
      <path d="m14 5 5 5" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg {...iconProps}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function IconOpen() {
  return (
    <svg {...iconProps}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Styled replacement for native browser confirms: overlay dialog with the
// safe option focused by default, Escape or backdrop click to cancel, and
// Tab trapped between the two actions.
function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelCb = useRef(onCancel);
  useLayoutEffect(() => { cancelCb.current = onCancel; }, [onCancel]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCb.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const buttons = dialogRef.current.querySelectorAll('button');
        if (buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);
  return (
    <div className="confirmwrap" onClick={() => cancelCb.current()}>
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <b>{title}</b>
        <p>{body}</p>
        <div className="row">
          <button type="button" className="btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="ghost" ref={cancelRef} onClick={() => cancelCb.current()}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
import {
  AUDIENCES,
  EMPTY_BRIEF,
  MARKETS,
  marketLabels,

  OBJECTIVES,
  answeredCount,
  buildPlan,
  campaignWeeks,
  checklistFor,
  demoBrief,
  endBeforeStart,
  formatDate,
  monthsRangeLabel,
  gbp,
  startNotFuture,
  campaignEnded,
  weeksLabel,
  type Brief,
  type ObjectiveId,
} from './data';

type Stage = 'empty' | 'filling' | 'generating' | 'gate' | 'plan';

function ComingSoonButton({ compact = false }: { compact?: boolean }) {
  const [notice, setNotice] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const description = `pdf-coming-soon-${useId()}`;

  useEffect(() => {
    if (!notice) return;
    // Repeated clicks renew the badge, wash and timer together without replacing the focused button.
    wrap.current?.querySelector('button')?.getAnimations().forEach(animation => {
      animation.currentTime = 0;
      animation.play();
    });
    const dismiss = () => setNotice(0);
    const timer = window.setTimeout(dismiss, 1000);
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrap.current?.contains(event.target)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !wrap.current?.contains(event.target)) dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [notice]);

  return (
    <span className={`cs-wrap${compact ? ' cs-compact' : ''}${notice ? ' cs-showing' : ''}`} ref={wrap}>
      <span className="cs-status" role="status" aria-live="polite" aria-atomic="true">
        {notice > 0 && (
          <span id={description} key={notice}>
            Coming soon
          </span>
        )}
      </span>
      <button type="button" className="ghost" aria-label="Download PDF" aria-describedby={notice ? description : undefined} onClick={() => setNotice((value) => value + 1)}>
        {/* The button itself becomes the status: its box never moves and the
            message never covers it, so no space is reserved or created. */}
        <span className="cs-label" key={notice}>{compact ? <IconDownload /> : notice ? '✧ Coming soon' : <><IconDownload />Download PDF</>}</span>
      </button>
      {compact && notice > 0 && <span className="pdf-icon-notice" aria-hidden="true">Coming soon</span>}
    </span>
  );
}




function pageFromUrl(): Page { return readPlanRoute().page; }

interface SavedPlan {
  id: string;
  savedAt: string;
  brief: Brief;
}

// Demo-only persistence: plans save to this browser's localStorage so the
// My Plans design is clickable end-to-end without a backend. Real saved
// plans across devices need sign-in + database - not built yet.
const PLANS_KEY = 'compass-saved-plans';

const AUTH_DRAFT_STAGES: Stage[] = ['empty', 'filling', 'gate', 'plan'];

function isAuthDraft(
  value: unknown,
): value is { brief: Brief; submittedBrief: Brief | null; budgetText: string; stage: Stage; ts: number } {
  if (value === null || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    isBrief(s.brief) &&
    (s.submittedBrief === null || isBrief(s.submittedBrief)) &&
    typeof s.budgetText === 'string' &&
    AUTH_DRAFT_STAGES.includes(s.stage as Stage) &&
    typeof s.ts === 'number' &&
    Number.isFinite(s.ts)
  );
}

function isBrief(value: unknown): value is Brief {
  if (value === null || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  const strArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  return (
    typeof b.name === 'string' &&
    strArr(b.objectives) &&
    (b.objectives as string[]).every((id) => OBJECTIVES.some((o) => o.id === id)) &&
    (b.markets === undefined || (strArr(b.markets) && (b.markets as string[]).every(id=>MARKETS.some(m=>m.id===id)))) &&
    strArr(b.kpis) &&
    strArr(b.audiences) &&
    (b.budget === null || typeof b.budget === 'number') &&
    typeof b.start === 'string' &&
    typeof b.end === 'string'
  );
}

// Demo seed plans: exactly two active and five past campaigns, hardcoded so a
// first-time visitor can see a populated My plans. Dates are relative to
// today so the seeds stay evergreen. Seeds merge once per device, keep stable
// seed- ids, never overwrite or resurrect over the visitor's own plans, and
// a deleted seed stays deleted. Bump SEED_VERSION and add entries to append
// future seeds on top.
const SEED_KEY = 'compass-seeded-plans';
const SEED_VERSION = 2;

function isoDaysFromNow(days: number, now = new Date()): string {
  // Local-time formatting: toISOString() is UTC and can land on the previous
  // calendar date when local time is ahead of UTC.
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedPlans(referenceDate = new Date()): SavedPlan[] {
  return [
    {
      id: 'seed-active-1',
      savedAt: '',
      brief: {
        name: 'UK Laboratory Procurement Campaign', markets: ['uk'],
        objectives: ['performance'],
        kpis: ['Lead generation', 'Cost per lead'],
        audiences: ['Procurement', 'Laboratory Manager'],
        budget: 100000,
        start: isoDaysFromNow(-14, referenceDate),
        end: isoDaysFromNow(56, referenceDate),
      },
    },
    {
      id: 'seed-active-2',
      savedAt: '',
      brief: {
        name: 'European Lab Automation Awareness Push', markets: ['france', 'germany'],
        objectives: ['awareness'],
        kpis: ['Reach', 'Impressions'],
        audiences: ['Scientist / Researcher', 'Laboratory Technician'],
        budget: 45000,
        start: isoDaysFromNow(7, referenceDate),
        end: isoDaysFromNow(70, referenceDate),
      },
    },
    {
      id: 'seed-past-1',
      savedAt: '',
      brief: {
        name: 'Quality and Compliance Enquiry Push', markets: ['uk'],
        objectives: ['performance'],
        kpis: ['Enquiries'],
        audiences: ['Quality / Compliance'],
        budget: 75000,
        start: isoDaysFromNow(-90, referenceDate),
        end: isoDaysFromNow(-20, referenceDate),
      },
    },
    {
      id: 'seed-past-2',
      savedAt: '',
      brief: {
        name: 'Global Reagent Launch Consideration', markets: ['north-america', 'uk', 'france', 'germany'],
        objectives: ['consideration'],
        kpis: ['Content downloads', 'Article engagement'],
        audiences: [],
        budget: 60000,
        start: isoDaysFromNow(-120, referenceDate),
        end: isoDaysFromNow(-60, referenceDate),
      },
    },
    { id: 'seed-past-3', savedAt: '', brief: { name: 'Laboratory Informatics Lead Campaign', markets: ['uk'], objectives: ['performance'], kpis: ['Lead generation'], audiences: ['Laboratory Manager'], budget: 55000, start: isoDaysFromNow(-150, referenceDate), end: isoDaysFromNow(-90, referenceDate) } },
    { id: 'seed-past-4', savedAt: '', brief: { name: 'Clinical Research Awareness Campaign', markets: ['uk'], objectives: ['awareness'], kpis: ['Reach'], audiences: ['Scientist / Researcher'], budget: 40000, start: isoDaysFromNow(-210, referenceDate), end: isoDaysFromNow(-150, referenceDate) } },
    { id: 'seed-past-5', savedAt: '', brief: { name: 'Bioprocessing Content Programme', markets: ['uk'], objectives: ['consideration'], kpis: ['Content downloads'], audiences: [], budget: 65000, start: isoDaysFromNow(-270, referenceDate), end: isoDaysFromNow(-210, referenceDate) } },
  ];
}

function ensureSeedPlans(): void {
  try {
    let applied: string[] = [];
    const rawMeta = window.localStorage.getItem(SEED_KEY);
    if (rawMeta !== null) {
      try {
        const meta: unknown = JSON.parse(rawMeta);
        if (meta !== null && typeof meta === 'object' && Array.isArray((meta as { applied?: unknown }).applied)) {
          applied = ((meta as { applied: unknown[] }).applied).filter((x): x is string => typeof x === 'string');
        }
      } catch {
        applied = [];
      }
    }
    // Never interpret unreadable or partially valid storage as an empty list.
    // Recovery belongs to the storage-repair flow; samples must not replace it.
    const rawPlans = window.localStorage.getItem(PLANS_KEY);
    const candidate: unknown = rawPlans === null ? [] : JSON.parse(rawPlans);
    if (!Array.isArray(candidate) || candidate.some((p) =>
      p === null || typeof p !== 'object' || typeof p.id !== 'string' ||
      typeof p.savedAt !== 'string' || !isBrief(p.brief))) return;
    // Backfill only untouched examples. A saved-at date reconstructs the
    // original relative campaign dates, so even a date-only edit is preserved.
    let marketsAdded = false;
    const plans: SavedPlan[] = candidate.map(plan => {
      if (plan.brief.markets !== undefined || !Number.isFinite(Date.parse(plan.savedAt))) return plan;
      const example = seedPlans(new Date(plan.savedAt)).find(seed => seed.id === plan.id);
      if (!example?.brief.markets?.length) return plan;
      const { markets, ...original } = example.brief;
      const keys = Object.keys(original) as (keyof typeof original)[];
      if (Object.keys(plan.brief).length !== keys.length ||
        !keys.every(key => JSON.stringify(plan.brief[key]) === JSON.stringify(original[key]))) return plan;
      marketsAdded = true;
      return { ...plan, brief: { ...plan.brief, markets } };
    });
    const existing = new Set(plans.map((p) => p.id));
    const fresh = seedPlans().filter((seed) => !applied.includes(seed.id) && !existing.has(seed.id));
    const room = 20 - plans.length;
    const toAdd = fresh.slice(0, Math.max(0, room));
    if (toAdd.length === 0) {
      if (marketsAdded) window.localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
      return;
    }
    const now = new Date().toISOString();
    const stamped = toAdd.map((seed) => ({ ...seed, savedAt: now }));
    window.localStorage.setItem(
      SEED_KEY,
      JSON.stringify({ version: SEED_VERSION, applied: [...applied, ...toAdd.map((seed) => seed.id)] }),
    );
    try {
      window.localStorage.setItem(PLANS_KEY, JSON.stringify([...plans, ...stamped]));
    } catch (error) {
      // A failed atomic setItem added no plans. Restore metadata so a later
      // visit can retry, without ever re-adding a successfully deleted seed.
      if (rawMeta === null) window.localStorage.removeItem(SEED_KEY);
      else window.localStorage.setItem(SEED_KEY, rawMeta);
      throw error;
    }
  } catch {
    // Storage unavailable - metadata-first writes keep deleted seeds from returning.
  }
}

const PLANS_CORRUPT_KEY = 'compass-saved-plans-corrupt';

// True once per session when unreadable saved plans were moved aside.
let plansRecovered = false;

// True when saved plans exist but could not be read AND could not be backed
// up: writes that could overwrite the unreadable original must stay blocked.
let plansLoadFailed = false;

// A saved-plans payload that cannot be read at all (invalid JSON or not an
// array) used to silently show an empty My plans. Append the unreadable copy
// to a backup list and keep any still-valid entries, so nothing is lost silently and
// the visitor can keep saving normally. The main payload is only reset after
// the backup write succeeds; if storage fails, everything is left untouched
// and no recovery is presented.
function recoverCorruptPlans(): void {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PLANS_KEY);
  } catch {
    // Storage itself cannot be read - block writes and tell the visitor.
    plansLoadFailed = true;
    return;
  }
  if (raw === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (Array.isArray(parsed) && parsed.every((p) => p !== null && typeof p === 'object' && typeof p.id === 'string' && typeof p.savedAt === 'string' && isBrief(p.brief))) return;
  try {
    // Every unreadable payload is kept: append to the backup list so a newer
    // unreadable payload is never silently discarded behind an older backup.
    const existing = window.localStorage.getItem(PLANS_CORRUPT_KEY);
    let backups: unknown[] = [];
    if (existing !== null) {
      try {
        const b: unknown = JSON.parse(existing);
        backups = Array.isArray(b) ? b : [existing];
      } catch {
        backups = [existing];
      }
    }
    backups.push({ foundAt: new Date().toISOString(), payload: raw });
    window.localStorage.setItem(PLANS_CORRUPT_KEY, JSON.stringify(backups));
    // The original is only reset once the unreadable copy is safely stored.
    // Entries that are still valid are kept: one unreadable entry must not
    // hide good plans from My plans (the full original stays in the backup).
    const valid = Array.isArray(parsed)
      ? parsed.filter(
          (p): p is SavedPlan =>
            p !== null &&
            typeof p === 'object' &&
            typeof p.id === 'string' &&
            typeof p.savedAt === 'string' &&
            isBrief(p.brief),
        )
      : [];
    if (valid.length > 0) window.localStorage.setItem(PLANS_KEY, JSON.stringify(valid));
    else window.localStorage.removeItem(PLANS_KEY);
    plansRecovered = true;
  } catch {
    // The backup could not be written - leave the original payload untouched,
    // block writes that could overwrite it, and show an honest failure state.
    plansLoadFailed = true;

  }
}

function loadPlans(): SavedPlan[] {
  try {
    const raw = window.localStorage.getItem(PLANS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedPlan =>
        p !== null &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.savedAt === 'string' &&
        isBrief(p.brief),
    ).map(p => ({ ...p, brief: { ...p.brief, audiences: p.brief.audiences.filter(a => AUDIENCES.includes(a)) } }));
  } catch {
    return [];
  }
}

// Remove retired choices from existing browser-local demo plans, without
// replacing audiences or deleting plans. A failed write uses the storage error UI.
function cleanDemoAudiences(): void {
  try {
    const raw = window.localStorage.getItem(PLANS_KEY);
    if (raw === null) return;
    const plans: SavedPlan[] = JSON.parse(raw);
    let changed = false;
    const cleaned = plans.map(p => {
      const audiences = p.brief.audiences.filter(a => AUDIENCES.includes(a));
      if (audiences.length === p.brief.audiences.length) return p;
      changed = true;
      return { ...p, brief: { ...p.brief, audiences } };
    });
    if (changed) window.localStorage.setItem(PLANS_KEY, JSON.stringify(cleaned));
  } catch {
    plansLoadFailed = true;
  }
}

function SkeletonBlock() {
  return (
    <div className="dim skelpad">
      <div className="skelrow">
        <div className="skel h14" />
        <div className="skel h14" />
        <div className="skel h14" />
        <div className="skel h14" />
        <div className="skel h14" />
      </div>
      <div className="skelgrid">
        <div className="skel h9" />
        <div className="skel h9" />
        <div className="skel h9" />
      </div>
    </div>
  );
}

function PlanOutline() {
  return (
    <div className="outline">
      <div className="outlinetitle">Your new plan will appear here</div>
      <div className="osect">
        <div className="ok">Key figures</div>
        <div className="ometrics">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="ometric" key={i}>
              <span className="ol w40" />
              <span className="ol w65" />
            </div>
          ))}
        </div>
      </div>
      <div className="osect">
        <div className="ok">Publishers, formats and spend split</div>
        {[0, 1, 2].map((i) => (
          <div className="oact" key={i}>
            <div className="oacttop">
              <span className="ol w45" />
              <span className="ol pill" />
              <span className="ol w15 r" />
            </div>
            <span className="ol w80" />
          </div>
        ))}
      </div>
      <div className="osect">
        <div className="ok">Suggested timing</div>
        <div className="omonths">
          {[0, 1, 2].map((i) => (
            <div className="omonth" key={i}>
              <span className="ol w50" />
              <span className="ol w80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoCap() {
  return <div className="cap">CONCEPT DEMO &middot; FIGURES + RATIONALE ILLUSTRATIVE</div>;
}

const REEL_SERVICES = ['Media Planning', 'Data Infrastructure', 'Analytics', 'Measurement', 'Publisher Partnerships', 'Sponsorship', 'Events', 'Paid Social', 'SEO', 'Media Planning'];

function IndustryReel() {
  return (
    <div className="eyebrow industry-eyebrow">
      <span className="industry-accessible">Life Sciences Media Planning</span>
      <span aria-hidden="true">Life Sciences</span>
      <span className="industry-reel" aria-hidden="true">
        <span className="industry-reel-track">
          {REEL_SERVICES.map((service, index) => <span key={index}>{service}</span>)}
        </span>
      </span>
    </div>
  );
}

export default function App() {
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const editBaseline = useRef<Brief | null>(null);
  const [submittedBrief, setSubmittedBrief] = useState<Brief | null>(null);
  const [budgetText, setBudgetText] = useState('');
  const [stage, setStage] = useState<Stage>('empty');
  const [ticks, setTicks] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return window.localStorage.getItem('compass-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [cueGen, setCueGen] = useState(false);
  const [cueSeq, setCueSeq] = useState(0);
  const [page, setPage] = useState<Page>(() => readPlanRoute().page);
  const [unavailablePlan, setUnavailablePlan] = useState(false);
  const [linkCopy, setLinkCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const planLinkRef = useRef<HTMLInputElement>(null);
  const linkCopyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(linkCopyTimer.current), []);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery');
  const profileComplete = Boolean(authUser?.user_metadata.compass_profile_complete &&
    typeof authUser.user_metadata.full_name === 'string' && authUser.user_metadata.full_name.trim());
  const canViewPlan = Boolean(authEmail && profileComplete && !recoveringPassword);

  const profileSource = useRef<string | null>(null);
  const currentAccount = useRef<User | null>(null);
  const initialSessionPending = useRef(true);
  const authEpoch = useRef(0);
  const profileRevision = useRef(0);
  const canonicalProfile = useRef<User | null>(null);
  const recoveryPrincipal = useRef<string | null>(null);
  const googleCallbackPrincipal = useRef<string | null>(null);
  const googlePending = useRef(false);
  const [earlierDraftKey, setEarlierDraftKey] = useState<string | null>(null);
  function applyAuthUser(user: User | null, reseed = false, hydrating = false) {
    const previous = currentAccount.current;
    if (previous?.id !== user?.id) { authEpoch.current++; canonicalProfile.current = null; }
    if (user && canonicalProfile.current?.id === user.id && !reseed)
      user = { ...user, user_metadata: canonicalProfile.current.user_metadata };
    if (previous && previous.id !== user?.id) {
      mayRestoreAuthDraft.current = false;
      googleCallbackPrincipal.current = null;
      setEarlierDraftKey(null);
      googlePending.current = false;
      recoveryPrincipal.current = null;
      setRecoveringPassword(false);
      try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ }
    }
    if (recoveringPassword && user && !recoveryPrincipal.current && !previous) recoveryPrincipal.current = user.id;
    if (previous && previous.id !== user?.id) {
      stashAuthDraft({ accountId: previous.id });
      clearPlannerState();
      anonymousBinding.current = null;
    } else if (!previous && user && hasPlannerWork() &&
      !(hydrating && !anonymousBinding.current) &&
      !bindingMatches(anonymousBinding.current, user, null)) {
      // An unrelated login must not adopt an abandoned anonymous brief.
      clearPlannerState();
    }
    if (user && !googleOAuthCallback) { try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ } }
    currentAccount.current = user;
    setAuthUser(user);
    setAuthEmail(user?.email ?? null);
    const source = user?.id ?? null;
    if (user && profileSource.current === source && !reseed) return;
    profileSource.current = source;
    setProfileName(typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name :
      typeof user?.user_metadata.name === 'string' ? user.user_metadata.name : '');
    setProfileCompany(typeof user?.user_metadata.company === 'string' ? user.user_metadata.company : '');
    setProfileError(null);
  }
  const [planFilter, setPlanFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    recoverCorruptPlans();
    if (!plansLoadFailed) {
      ensureSeedPlans();
      cleanDemoAudiences();
    }
    return loadPlans();
  });
  const [storageRecovered, setStorageRecovered] = useState(() => plansRecovered);
  const [storageFailed] = useState(() => plansLoadFailed);
  const [savedEntry, setSavedEntry] = useState<{ id: string; mode: 'view' | 'edit' } | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hasFilled, setHasFilled] = useState(false);
  const [confirmFill, setConfirmFill] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPlan | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const genRef = useRef<HTMLButtonElement>(null);
  const planRef = useRef<HTMLElement>(null);
  // Viewport position of the save action row when Save is pressed, so it can
  // be pinned in place while the tall form swaps to the compact saved brief.
  const saveAnchorY = useRef<number | null>(null);
  const saveRowRef = useRef<HTMLDivElement>(null);
  // Temporary bottom slack that keeps the page scrollable to the pinned
  // position when saving shortens it; cleared on the next navigation or edit.
  const saveSpacerRef = useRef<HTMLDivElement>(null);
  const cueTimer = useRef<number | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('compass-theme', theme);
    } catch {
      /* private mode */
    }
  }, [theme]);

  // A sign-in round trip (Google redirect, verification or recovery link) reloads the app,
  // so the in-progress brief and generated plan are stashed on this device
  // first and restored when the user lands back. Expires after an hour.
  const latestPlanner = useRef({ brief, submittedBrief, savedEntry, budgetText, stage });
  useLayoutEffect(() => {
    latestPlanner.current = { brief, submittedBrief, savedEntry, budgetText, stage };
  }, [brief, submittedBrief, savedEntry, budgetText, stage]);
  const anonymousBinding = useRef<DraftBinding | null>(null);
  function activeGoogleFlow(): string | null {
    try { return window.sessionStorage.getItem(AUTH_FLOW_KEY); } catch { return null; }
  }
  function hasPlannerWork() {
    const current = latestPlanner.current;
    return current.stage !== 'empty' || current.submittedBrief !== null || current.savedEntry !== null ||
      answeredCount(current.brief) > 0 || current.brief.name.trim() !== '' || current.budgetText.trim() !== '' ||
      current.brief.start !== '' || current.brief.end !== '';
  }
  function bindingKey(binding: DraftBinding) {
    return 'accountId' in binding ? accountDraftKey(binding.accountId) :
      'email' in binding ? emailDraftKey(binding.email) : googleDraftKey(binding.googleFlow);
  }
  function cleanupExpiredDrafts() {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key !== AUTH_DRAFT_KEY && !key.startsWith(AUTH_DRAFT_KEY + ':')) continue;
        try {
          const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
          if (value && typeof value === 'object' && 'ts' in value && typeof value.ts === 'number' &&
            Date.now() - value.ts > 60 * 60 * 1000) window.localStorage.removeItem(key);
        } catch { /* Leave unknown or corrupted work alone. */ }
      }
    } catch { /* private mode */ }
  }
  function stashAuthDraft(binding: DraftBinding | null = currentAccount.current ? { accountId: currentAccount.current.id } : anonymousBinding.current) {
    cleanupExpiredDrafts();
    if (!binding || !hasPlannerWork()) return;
    try {
      const current = latestPlanner.current;
      const snap = { ...current, binding, stage: current.stage === 'generating' ? 'filling' : current.stage, ts: Date.now() };
      window.localStorage.setItem(bindingKey(binding), JSON.stringify(snap));
    } catch { /* private mode */ }
  }
  function beginEmail(email: string) {
    setAuthNotice(n => n === 'Logged out' || n === 'Password reset cancelled - log in with your current password.' ? null : n);
    if (currentAccount.current) { stashAuthDraft(); return; }
    const binding: DraftBinding = { email: email.trim().toLowerCase() };
    const previous = anonymousBinding.current;
    if (previous && ('email' in previous ? previous.email !== binding.email : true)) {
      stashAuthDraft(previous);
      clearPlannerState();
    }
    // The first submitted address owns this anonymous attempt, even if it fails.
    anonymousBinding.current = binding;
    try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ }
    stashAuthDraft(binding);
  }
  const mayRestoreAuthDraft = useRef(false);
  function restoreAuthDraft(allowSignIn = false) {
    cleanupExpiredDrafts();
    const user = currentAccount.current;
    if (!user || (!allowSignIn && (!mayRestoreAuthDraft.current || (pageFromUrl() !== 'planner' && !recoveringPassword)))) return;
    try {
      const pendingFlow = activeGoogleFlow();
      const providers: unknown = user.app_metadata.providers;
      const googleUser = user.app_metadata.provider === 'google' || (Array.isArray(providers) && providers.includes('google'));
      const flow = googleOAuthCallback && googleUser && googleCallbackPrincipal.current === user.id ? pendingFlow : null;
      const alternativeKey = accountDraftKey(user.id) + ':earlier-google';
      if (flow) {
        const raw = window.localStorage.getItem(googleDraftKey(flow));
        const snap: unknown = raw ? JSON.parse(raw) : null;
        if (hasPlannerWork() && isAuthDraft(snap) && Date.now() - snap.ts <= 60 * 60 * 1000 &&
          bindingMatches((snap as typeof snap & { binding?: unknown }).binding, user, flow)) {
          // Only the verified callback principal may keep this second version.
          // It is separate from the normal account snapshot, never an overwrite.
          window.localStorage.setItem(alternativeKey, JSON.stringify({ ...snap, binding: { accountId: user.id } }));
          window.localStorage.removeItem(googleDraftKey(flow));
          window.sessionStorage.removeItem(AUTH_FLOW_KEY);
          setEarlierDraftKey(alternativeKey);
          return;
        }
      }
      const alternativeRaw = window.localStorage.getItem(alternativeKey);
      const alternative: unknown = alternativeRaw ? JSON.parse(alternativeRaw) : null;
      if (isAuthDraft(alternative) && Date.now() - alternative.ts <= 60 * 60 * 1000 &&
        bindingMatches((alternative as typeof alternative & { binding?: unknown }).binding, user, null)) setEarlierDraftKey(alternativeKey);
      if (hasPlannerWork()) return;
      const keys = [accountDraftKey(user.id), ...(user.email ? [emailDraftKey(user.email)] : []), ...(flow ? [googleDraftKey(flow)] : [])];
      const candidates = keys.flatMap(key => {
        try {
          const raw = window.localStorage.getItem(key);
          const snap: unknown = raw ? JSON.parse(raw) : null;
          return isAuthDraft(snap) && Date.now() - snap.ts <= 60 * 60 * 1000 &&
            bindingMatches((snap as typeof snap & { binding?: unknown }).binding, user, flow) ? [{ key, snap }] : [];
        } catch { return []; }
      }).sort((a, b) => b.snap.ts - a.snap.ts);
      for (const { snap } of candidates) {
        for (const candidate of candidates) window.localStorage.removeItem(candidate.key);
        const entry = (snap as typeof snap & { savedEntry?: { id?: unknown; mode?: unknown } }).savedEntry;
        const restoredEntry: { id: string; mode: 'view' | 'edit' } | null = entry && typeof entry.id === 'string' &&
          (entry.mode === 'view' || entry.mode === 'edit') && loadPlans().some(p => p.id === entry.id)
          ? { id: entry.id, mode: entry.mode } : null;
        setSavedEntry(restoredEntry);
        const unchangedPlan = snap.submittedBrief !== null && JSON.stringify(snap.brief) === JSON.stringify(snap.submittedBrief);
        const restoredStage = snap.stage === 'filling' && unchangedPlan ? 'gate' : snap.stage;
        setBrief(snap.brief); setSubmittedBrief(unchangedPlan ? snap.brief : snap.submittedBrief);
        setBudgetText(snap.budgetText); setStage(restoredStage);
        latestPlanner.current = { brief: snap.brief, submittedBrief: unchangedPlan ? snap.brief : snap.submittedBrief,
          savedEntry: restoredEntry, budgetText: snap.budgetText, stage: restoredStage };
        anonymousBinding.current = null;
        window.sessionStorage.removeItem(AUTH_FLOW_KEY);
        if (!recoveringPassword) { setPage('planner'); writePageUrl('planner'); }
        break;
      }
    } catch { /* corrupted or unavailable storage */ }
  }

  function openEarlierDraft() {
    const user = currentAccount.current;
    if (!user || earlierDraftKey !== accountDraftKey(user.id) + ':earlier-google') return;
    try {
      const raw = window.localStorage.getItem(earlierDraftKey);
      const snap: unknown = raw ? JSON.parse(raw) : null;
      if (!isAuthDraft(snap) || Date.now() - snap.ts > 60 * 60 * 1000 ||
        !bindingMatches((snap as typeof snap & { binding?: unknown }).binding, user, null)) return;
      stashAuthDraft({ accountId: user.id });
      // Swap versions so neither is discarded, including across a reload.
      const live = latestPlanner.current;
      const current = { ...live, stage: live.stage === 'generating' ? 'filling' : live.stage, binding: { accountId: user.id }, ts: Date.now() };
      window.localStorage.setItem(earlierDraftKey, JSON.stringify(current));
      setBrief(snap.brief); setSubmittedBrief(snap.submittedBrief); setBudgetText(snap.budgetText);
      setStage(snap.stage === 'generating' ? 'filling' : snap.stage); setSavedEntry(null);
      latestPlanner.current = { brief: snap.brief, submittedBrief: snap.submittedBrief, budgetText: snap.budgetText, stage: snap.stage, savedEntry: null };
      stashAuthDraft({ accountId: user.id });
    } catch { /* Storage failure leaves the current work unchanged. */ }
  }

  useEffect(() => {
    cleanupExpiredDrafts();
    if (emailAuthCallback) { try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ } }
    const callbackError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    if (callbackError) {
      // An anonymous Google cancellation may retry its own per-tab draft.
      // getSession below revokes this handle if any account is established.
      setRecoveringPassword(false); setAuthNotice('This log-in or reset link is invalid or has expired. Log in or request a fresh password reset.'); setPage('signin'); writePageUrl('signin'); }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) googlePending.current = false; };
    window.addEventListener('pageshow', onPageShow);
    const startupEpoch = authEpoch.current;
    supabase.auth.getSession().then(({ data }) => {
      if (startupEpoch !== authEpoch.current && data.session?.user.id !== currentAccount.current?.id) return;
      applyAuthUser(data.session?.user ?? null, false, true);
      initialSessionPending.current = false;
      // Only a tab loaded with a session may consume the shared snapshot.
      // A later cross-tab SIGNED_IN must leave it for the callback tab.
      mayRestoreAuthDraft.current = Boolean(data.session);
      if (data.session) {
        if (callbackError) { try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ } }
        if (googleOAuthCallback && !googleCallbackPrincipal.current && authEpoch.current <= 1) googleCallbackPrincipal.current = data.session.user.id;
        restoreAuthDraft();
        // Canonical metadata is read without mutating SDK-owned session storage.
        // A late lookup must not replace a new account or a more recent save.
        const id = data.session.user.id;
        const epoch = authEpoch.current;
        const revision = profileRevision.current;
        void supabase.auth.getUser(data.session.access_token).then(({ data: result, error }) => {
          if (error || !result.user || result.user.id !== id || currentAccount.current?.id !== id ||
            epoch !== authEpoch.current || revision !== profileRevision.current) return;
          canonicalProfile.current = result.user;
          applyAuthUser(result.user);
        }).catch(() => { /* Keep the current profile gate; never infer completion on failure. */ });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applyAuthUser(session?.user ?? null, false, event === 'INITIAL_SESSION' || (event === 'TOKEN_REFRESHED' && initialSessionPending.current));
      // Auth events also arrive from other tabs: re-gate a visible plan when
      // the session is gone, and stop re-stashing the draft once signed in.
      // Draft restore stays on the getSession path so only the freshly loaded
      // tab consumes it; this tab keeps its in-memory brief.
      if (!session) {
        mayRestoreAuthDraft.current = false;
        setRecoveringPassword(false);
        setStage((s) => (s === 'plan' ? 'gate' : s));
        setSavedEntry(null);
      }
      if (event === 'PASSWORD_RECOVERY' && session) { recoveryPrincipal.current = session.user.id; setRecoveringPassword(true); setPage('signin'); writePageUrl('signin'); }
    });
    return () => { subscription.unsubscribe(); window.removeEventListener('pageshow', onPageShow); };
    // One subscription per mount; planner/account/flow state is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An explicit saved-plans landing defers the pending draft until Planner.
  useEffect(() => {
    if (page === 'planner' && authUser) restoreAuthDraft();
    // Only a route/session transition may consume the pending snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, authUser?.id]);

  // Reveal a plan only after authentication and first-time profile completion.
  useEffect(() => {
    if (stage === 'gate' && canViewPlan) setStage('plan');
    if (stage === 'plan' && !canViewPlan) setStage('gate');
  }, [stage, canViewPlan]);

  useEffect(() => {
    if (recoveringPassword && page !== 'signin') { setPage('signin'); writePageUrl('signin'); }
  }, [recoveringPassword, page]);

  // Re-evaluate time-based labels (e.g. the Expired chip) when the tab
  // regains focus, so a page left open across midnight shows today's state.
  const [, setDayTick] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setDayTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const count = answeredCount({ ...brief, audiences: brief.audiences.filter(a => AUDIENCES.includes(a)) });
  const weeks = campaignWeeks(brief.start, brief.end);
  const viewBrief = (stage === 'generating' || stage === 'gate' || stage === 'plan') && submittedBrief ? submittedBrief : brief;
  const viewWeeks = campaignWeeks(viewBrief.start, viewBrief.end);
  const viewObjectiveLabels = viewBrief.objectives
    .map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '')
    .filter((l) => l !== '');
  // Each KPI belongs to exactly one objective, so it can inherit that
  // objective's neutral shade even when several objectives are selected.
  const kpiOptions = OBJECTIVES.filter((o) => brief.objectives.includes(o.id))
    .flatMap((o) => o.kpis.map((k) => ({ label: k, objective: o.id })))
    .filter((entry, i, a) => a.findIndex((e) => e.label === entry.label) === i);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const plan = useMemo(
    () => (stage === 'plan' && submittedBrief ? buildPlan(submittedBrief) : null),
    [stage, submittedBrief],
  );
  const savedBriefReadOnly = savedEntry !== null && savedEntry.mode === 'view';
  const viewingSaved = savedBriefReadOnly && stage === 'plan';
  const editingSaved = savedEntry !== null && savedEntry.mode === 'edit';
  const editsNotGenerated = stage === 'plan' && submittedBrief !== null && brief !== submittedBrief;

  useEffect(() => {
    if (stage === 'empty' || stage === 'filling') {
      setStage(count === 0 ? 'empty' : 'filling');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const genSteps = checklistFor(viewBrief).length;

  // Saving swaps the tall form for a compact read-only brief, shortening the
  // page. Without correction the plan visibly jumps; keep it pinned to its
  // viewport position across the swap.
  useLayoutEffect(() => {
    if (justSavedId === null) return;
    const anchor = saveAnchorY.current;
    saveAnchorY.current = null;
    const el = saveRowRef.current;
    if (anchor === null || !el) return;
    // The document may already have been bottom-clamped before this effect
    // runs, so pin by viewport delta rather than document coordinates. When
    // the shortened page could not scroll far enough, temporary bottom slack
    // keeps the pinned position reachable instead of letting the page jump.
    const delta = el.getBoundingClientRect().top - anchor;
    const doc = document.documentElement;
    const desired = window.scrollY + delta;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    const spacer = saveSpacerRef.current;
    if (desired > maxScroll && spacer) {
      spacer.style.height = `${desired - maxScroll}px`;
    }
    if (delta !== 0) window.scrollBy(0, delta);
    const frame = requestAnimationFrame(() => {
      document.documentElement.style.overflowAnchor = '';
    });
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.overflowAnchor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justSavedId]);

  useEffect(() => {
    if (stage !== 'generating') return;
    setTicks(0);
    const interval = window.setInterval(() => {
      setTicks((t) => Math.min(t + 1, genSteps));
    }, 950);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage !== 'generating') return;
    if (ticks < genSteps) return;
    // Plans are gated behind sign-in: without a session, show the gate
    // first; the brief and generated plan stay intact behind it.
    const id = window.setTimeout(() => setStage(canViewPlan ? 'plan' : 'gate'), 500);
    return () => window.clearTimeout(id);
  }, [stage, ticks, genSteps, canViewPlan]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  function openDatePicker(ref: React.RefObject<HTMLInputElement | null>) {
    clearCue();
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  function patch(p: Partial<Brief>) {
    clearCue();
    setBrief((b) => ({ ...b, ...p }));
  }

  function toggleObjective(id: ObjectiveId) {
    clearCue();
    setBrief((b) => {
      const objectives = b.objectives.includes(id)
        ? b.objectives.filter((o) => o !== id)
        : [...b.objectives, id];
      const valid = OBJECTIVES.filter((o) => objectives.includes(o.id)).flatMap((o) => o.kpis);
      return { ...b, objectives, kpis: b.kpis.filter((k) => valid.includes(k)) };
    });
  }

  function toggleKpi(k: string) {
    clearCue();
    setBrief((b) => ({
      ...b,
      kpis: b.kpis.includes(k) ? b.kpis.filter((x) => x !== k) : [...b.kpis, k],
    }));
  }

  function toggleAudience(a: string) {
    clearCue();
    setBrief((b) => ({
      ...b,
      audiences: b.audiences.includes(a)
        ? b.audiences.filter((x) => x !== a)
        : [...b.audiences, a],
    }));
  }

  function onBudget(raw: string) {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 9);
    const value = digits === '' ? null : parseInt(digits, 10);
    setBudgetText(value === null ? '' : value.toLocaleString('en-GB'));
    patch({ budget: value });
  }

  // One tap fills an example, briefly shows the answers, then generates it.
  function fillDemo(force = false) {
    if (editingSaved) return;
    const hasInput = count > 0 || (brief.markets?.length ?? 0) > 0 || brief.name.trim() !== '' || budgetText.trim() !== '';
    if (hasInput && !force) {
      clearCue();
      setConfirmFill(true);
      return;
    }
    setConfirmFill(false);
    setHasFilled(true);
    const d = demoBrief(brief.name || undefined);
    setBrief(d);
    setBudgetText(d.budget !== null ? d.budget.toLocaleString('en-GB') : '');
    setSubmittedBrief(null);
    setStage('filling');
    window.clearTimeout(cueTimer.current);
    if (answeredCount(d) >= 6) {
      setCueSeq((n) => n + 1);
      setCueGen(true);
    }
  }

  useEffect(() => {
    if (!cueGen) return;
    if (page !== 'planner') { clearCue(); return; }
    const el = genRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 60);
    cueTimer.current = window.setTimeout(() => generate(), 1000);
    return () => { window.clearTimeout(id); window.clearTimeout(cueTimer.current); };
    // brief is the populated example; edits cancel the walkthrough below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueGen, cueSeq, page]);

  function clearCue() {
    window.clearTimeout(cueTimer.current);
    setCueGen(false);
  }

  useEffect(() => {
    if (stage !== 'generating') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = requestAnimationFrame(() => planRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  function generate() {
    if (count < 6) return;
    clearCue();
    setSubmittedBrief(brief);
    setHasGenerated(true);
    setStage('generating');
  }

  function clearSaveSpacer() {
    const spacer = saveSpacerRef.current;
    if (spacer) spacer.style.height = '0px';
  }

  function clearPlannerState() {
    clearCue();
    clearSaveSpacer();
    setBrief(EMPTY_BRIEF);
    setSubmittedBrief(null);
    setBudgetText('');
    setStage('empty');
    setHasGenerated(false);
    setHasFilled(false);
    setSavedEntry(null);
    setJustSavedId(null);
    setConfirmFill(false);
    setDeleteTarget(null);
    navigation.cancel();
    latestPlanner.current = { brief: EMPTY_BRIEF, submittedBrief: null, savedEntry: null, budgetText: '', stage: 'empty' };
  }

  function reset() {
    try {
      window.localStorage.removeItem(AUTH_DRAFT_KEY);
      const owner = currentAccount.current;
      if (owner) window.localStorage.removeItem(accountDraftKey(owner.id));
      if (anonymousBinding.current) window.localStorage.removeItem(bindingKey(anonymousBinding.current));
      window.sessionStorage.removeItem(AUTH_FLOW_KEY);
    } catch { /* private mode */ }
    anonymousBinding.current = null;
    clearPlannerState();
    setUnavailablePlan(false);
    window.clearTimeout(linkCopyTimer.current);
    setLinkCopy('idle');
    navigation.address({ page: 'planner' });
    window.scrollTo(0, 0);
  }

  function persist(plans: SavedPlan[]): boolean {
    if (plansLoadFailed) return false;
    try {
      window.localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    } catch {
      return false;
    }
    setSavedPlans(plans);
    return true;
  }

  // Captures the save row's viewport position and pauses browser scroll
  // anchoring so it cannot double-count against the pin. Called only after
  // persistence succeeds, so failed saves leave anchoring untouched.
  function pinSaveRow() {
    saveAnchorY.current = saveRowRef.current
      ? saveRowRef.current.getBoundingClientRect().top
      : null;
    document.documentElement.style.overflowAnchor = 'none';
  }

  function savePlan() {
    if (!submittedBrief) return;
    if (editingSaved && savedEntry) {
      const latest = loadPlans();
      if (!latest.some((p) => p.id === savedEntry.id)) {
        setSavedEntry(null);
        showToast('That plan is no longer in My plans - save it again as a new plan');
        return;
      }
      const updated = latest.map((p) =>
        p.id === savedEntry.id ? { ...p, brief: submittedBrief, savedAt: new Date().toISOString() } : p,
      );
      if (persist(updated)) {
        pinSaveRow();
        setSavedEntry({ id: savedEntry.id, mode: 'view' });
        setJustSavedId(savedEntry.id);
        navigation.address({ page: 'planner', planId: savedEntry.id });
      } else {
        showToast('Could not save - browser storage is unavailable');
      }
      return;
    }
    const entry: SavedPlan = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      brief: submittedBrief,
    };
    const latest = loadPlans();
    if (latest.length >= 20) {
      setSavedPlans(latest);
      showToast('My plans is full (20 plans) - delete one before saving another');
      return;
    }
    if (persist([entry, ...latest])) {
      pinSaveRow();
      setSavedEntry({ id: entry.id, mode: 'view' });
      setJustSavedId(entry.id);
      navigation.address({ page: 'planner', planId: entry.id });
    } else {
      showToast('Could not save - browser storage is unavailable');
    }
  }

  function deletePlan(id: string) {
    if (!persist(loadPlans().filter((p) => p.id !== id))) {
      showToast('Could not delete - browser storage is unavailable');
      return;
    }
    if (savedEntry?.id === id) {
      clearPlannerState();
      navigation.address({ page });
    }
  }

  useLayoutEffect(() => {
    if (!editingSaved) return;
    document.querySelector('.saved-page-head')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    document.getElementById('f-name')?.focus({ preventScroll: true });
  }, [editingSaved]);

  function editSavedPlan() {
    clearSaveSpacer();
    setJustSavedId(null);
    const loaded = { ...brief, audiences: brief.audiences.filter(a => AUDIENCES.includes(a)) };
    editBaseline.current = loaded;
    setBrief(loaded);
    setSavedEntry(s => s ? { ...s, mode: 'edit' } : s);
  }

  function cancelEditSaved() {
    if (!savedEntry) return;
    const latest = loadPlans();
    const original = latest.find((p) => p.id === savedEntry.id);
    if (!original) {
      setSavedPlans(latest);
      clearPlannerState();
      showToast('That plan is no longer in My plans');
      return;
    }
    setBrief(original.brief);
    setSubmittedBrief(original.brief);
    setBudgetText(original.brief.budget !== null ? original.brief.budget.toLocaleString('en-GB') : '');
    setStage(canViewPlan ? 'plan' : 'gate');
    setSavedEntry({ id: savedEntry.id, mode: 'view' });
  }

  // Compare field values, not object identity or the fact that Edit was opened.
  // Multi-select order and absent optional markets are not user-visible changes.
  function briefValues(value: Brief) {
    return JSON.stringify({ name: value.name, budget: value.budget,
      start: value.start, end: value.end, objectives: [...value.objectives].sort(),
      markets: [...(value.markets ?? [])].sort(), kpis: [...value.kpis].sort(),
      audiences: [...value.audiences].sort() });
  }

  function replacementReason() {
    if (editingSaved) return editBaseline.current && briefValues(brief) !== briefValues(editBaseline.current) ? 'edit' : null;
    if (savedEntry) return null;
    const hasInput = briefValues(brief) !== briefValues(EMPTY_BRIEF);
    return hasInput ? stage === 'plan' ? 'unsaved' : 'draft' : null;
  }

  const navigation = usePlanNavigation(applyRoute, route => {
    // Sign-in is part of continuing this brief, not a discard destination.
    if (route.page === 'signin') return false;
    if (replacementReason() === null) return false;
    if (route.page === 'planner' && !route.reload && route.planId === savedEntry?.id) return false;
    clearCue();
    return true;
  }, emailAuthCallback || googleOAuthCallback);
  function writePageUrl(page: Page) { navigation.address({ page }); }
  const openTarget = navigation.pending ? { reason: replacementReason() } : null;

  function applyRoute(route: PlanRoute) {
    setUnavailablePlan(false);
    window.clearTimeout(linkCopyTimer.current);
    setLinkCopy('idle');
    clearSaveSpacer();
    window.clearTimeout(toastTimer.current);
    setToast(null);
    // At this point navigation is either unchanged or an approved discard.
    // Do not carry a hidden edit onto My plans and ask again on the next Open.
    if (route.page !== 'planner' && route.page !== 'signin' && page === 'planner' && !viewingSaved) clearPlannerState();
    if (route.planId !== undefined) {
      const latest = loadPlans();
      const entry = latest.find(p => p.id === route.planId);
      setSavedPlans(latest);
      if (!entry || plansLoadFailed) {
        setUnavailablePlan(true);
      } else if (savedEntry?.id !== entry.id || route.reload) {
        clearCue();
        setBrief(entry.brief);
        setSubmittedBrief(entry.brief);
        setBudgetText(entry.brief.budget !== null ? entry.brief.budget.toLocaleString('en-GB') : '');
        setStage(canViewPlan ? 'plan' : 'gate');
        setSavedEntry({ id: entry.id, mode: 'view' });
        setJustSavedId(null);
      }
    }
    setPage(route.page);
    window.scrollTo(0, 0);
  }

  async function continueWithGoogle() {
    if (googlePending.current) return;
    googlePending.current = true;
    const epoch = authEpoch.current;
    const previousBinding = anonymousBinding.current;
    const previousPlanner = latestPlanner.current;
    const previousFlow = activeGoogleFlow();
    let flow: string | null = null;
    if (currentAccount.current) stashAuthDraft();
    else {
      if (anonymousBinding.current) {
        stashAuthDraft();
        if (!('googleFlow' in anonymousBinding.current)) clearPlannerState();
      }
      let retryFlow: string | null = null;
      if (previousFlow && !hasPlannerWork()) {
        try {
          const raw: unknown = JSON.parse(window.localStorage.getItem(googleDraftKey(previousFlow)) ?? 'null');
          if (isAuthDraft(raw) && Date.now() - raw.ts <= 60 * 60 * 1000 &&
            'binding' in raw && raw.binding && typeof raw.binding === 'object' &&
            'googleFlow' in raw.binding && raw.binding.googleFlow === previousFlow) retryFlow = previousFlow;
        } catch { /* Unknown work is never rebound. */ }
      }
      flow = retryFlow ?? crypto.randomUUID();
      anonymousBinding.current = { googleFlow: flow };
      try { window.sessionStorage.setItem(AUTH_FLOW_KEY, flow); } catch { /* private mode */ }
      stashAuthDraft(anonymousBinding.current);
    }
    let failed = false;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + (demoMode ? '/?demo=1' : '') },
      });
      failed = Boolean(error);
    } catch { failed = true; }
    if (failed) {
      googlePending.current = false;
      if (epoch !== authEpoch.current) return;
      setAuthNotice('Google log-in failed - please try again');
      try {
        if (previousFlow) window.sessionStorage.setItem(AUTH_FLOW_KEY, previousFlow);
        else window.sessionStorage.removeItem(AUTH_FLOW_KEY);
        if (flow && flow !== previousFlow) window.localStorage.removeItem(googleDraftKey(flow));
      } catch { /* private mode */ }
      anonymousBinding.current = previousBinding;
      setBrief(previousPlanner.brief); setSubmittedBrief(previousPlanner.submittedBrief);
      setBudgetText(previousPlanner.budgetText); setStage(previousPlanner.stage);
      setSavedEntry(previousPlanner.savedEntry); latestPlanner.current = previousPlanner;
    }
  }

  async function completeProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileName.trim() || profileSaving) return;
    const epoch = authEpoch.current;
    const id = currentAccount.current?.id;
    if (!id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (epoch !== authEpoch.current || currentAccount.current?.id !== id) return;
      if (error || data.session?.user.id !== id) { setProfileError('Could not save your details. Please try again.'); return; }
      const token = data.session.access_token;
      const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT', headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { full_name: profileName.trim(), company: profileCompany.trim(), compass_profile_complete: true } }),
      });
      const user = await response.json() as User;
      if (epoch !== authEpoch.current || currentAccount.current?.id !== id) return;
      if (!response.ok || user.id !== id) { setProfileError('Could not save your details. Please try again.'); return; }
      // Re-read the SDK session, but never persist captured credentials ourselves.
      const current = await supabase.auth.getSession();
      if (epoch !== authEpoch.current || currentAccount.current?.id !== id) return;
      if (current.error || current.data.session?.user.id !== id) {
        setProfileError('Your session changed. Please log in again.'); return;
      }
      profileRevision.current++;
      canonicalProfile.current = user;
      applyAuthUser(user, true);
    } catch {
      if (epoch === authEpoch.current) setProfileError('Could not save your details. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  function renderProfileFields(idPrefix: string) {
    return (
      <form onSubmit={(event) => { void completeProfile(event); }} aria-label="Complete your profile">
        <p className="pagesub">Logged in as {authEmail}. Add your details to continue.</p>
        <div className="field">
          <label htmlFor={`${idPrefix}-name`}>Name</label>
          <input id={`${idPrefix}-name`} className="ctl" autoComplete="name" required maxLength={160}
            value={profileName} disabled={profileSaving} onChange={(event) => setProfileName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-company`}>Company <span className="muted">(optional)</span></label>
          <input id={`${idPrefix}-company`} className="ctl" autoComplete="organization" maxLength={160}
            value={profileCompany} disabled={profileSaving} onChange={(event) => setProfileCompany(event.target.value)} />
        </div>
        {profileError && <p className="fieldnote" role="alert">{profileError}</p>}
        <button type="submit" className="gen" disabled={profileSaving || !profileName.trim()}>
          {profileSaving ? 'Saving details...' : 'Continue'}
        </button>
      </form>
    );
  }

  function renderSignInFields(idPrefix: string) {
    return (
      <>
        {!recoveringPassword && <><div className="ssolist">
          <button type="button" className="sso" onClick={() => { void continueWithGoogle(); }}>
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z" />
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z" />
              <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z" />
            </svg>
            Continue with Google
          </button>
        </div>
        <div className="divider"><span>or</span></div></>}
        <EmailAuth key={`${idPrefix}:${authUser?.id ?? 'anonymous'}:${recoveringPassword}`} idPrefix={idPrefix} recovery={recoveringPassword}
          recoveryUserId={recoveryPrincipal.current}
          isRecoveryCurrent={id => recoveryPrincipal.current === id && currentAccount.current?.id === id} beforeEmail={beginEmail} onAuthenticated={user => { applyAuthUser(user); restoreAuthDraft(true); stashAuthDraft({ accountId: user.id });
          try { if (anonymousBinding.current && bindingMatches(anonymousBinding.current, user, null)) window.localStorage.removeItem(bindingKey(anonymousBinding.current)); } catch { /* private mode */ }
          anonymousBinding.current = null;
          setRecoveringPassword(false); setAuthNotice(null); go('planner'); }} />
        {recoveringPassword && (
          <button type="button" className="ghost cancel-recovery" onClick={() => { void cancelRecovery(); }}>
            Cancel password reset
          </button>
        )}
      </>
    );
  }

  async function signOut(notice = 'Logged out', scope?: 'local' | 'global') {
    let failed = false;
    try {
      const { error } = await supabase.auth.signOut(scope ? { scope } : undefined);
      failed = Boolean(error);
    } catch {
      failed = true;
    }
    mayRestoreAuthDraft.current = false;
    recoveryPrincipal.current = null;
    setRecoveringPassword(false);
    applyAuthUser(null);
    anonymousBinding.current = null;
    try { window.sessionStorage.removeItem(AUTH_FLOW_KEY); } catch { /* private mode */ }
    setAuthNotice(null);
    // applyAuthUser has already stashed and cleared the prior account's planner.
    setAuthNotice(failed ? 'Log-out encountered an error. Other sessions may still be active.' : notice);
  }

  async function cancelRecovery() {
    // Local scope: cancelling a reset must not sign the visitor out on other devices.
    await signOut('Password reset cancelled - log in with your current password.', 'local');
    setRecoveringPassword(false);
  }

  function openPlan(entry: SavedPlan) {
    navigation.navigate({ page: 'planner', planId: entry.id, reload: true });
  }

  function go(p: Page) {
    navigation.navigate(p === 'planner' && savedEntry && loadPlans().some(entry => entry.id === savedEntry.id)
      ? { page: p, planId: savedEntry.id } : { page: p });
  }

  async function copyPlanLink() {
    if (!savedEntry) return;
    window.clearTimeout(linkCopyTimer.current);
    const url = new URL(window.location.href);
    url.hash = routeHash({ page: 'planner', planId: savedEntry.id });
    try {
      await navigator.clipboard.writeText(url.href);
      window.clearTimeout(linkCopyTimer.current);
      setLinkCopy('copied');
      linkCopyTimer.current = window.setTimeout(() => setLinkCopy('idle'), 3000);
    } catch {
      setLinkCopy('failed');
      requestAnimationFrame(() => { planLinkRef.current?.focus(); planLinkRef.current?.select(); });
    }
  }

  const chips: { label: string; soft?: boolean }[] = [];
  if (viewObjectiveLabels.length) chips.push({ label: `Objective: ${viewObjectiveLabels.join(' + ')}` });
  if (viewBrief.markets?.length) chips.push({label:`Market: ${marketLabels(viewBrief.markets)}`});
  if (viewBrief.kpis.length) chips.push({ label: `KPI: ${viewBrief.kpis.join(' + ')}` });
  if (viewBrief.audiences.length) chips.push({ label: `Audience: ${viewBrief.audiences.join(' + ')}` });
  if (viewBrief.budget) chips.push({ label: `Budget: ${gbp(viewBrief.budget)}` });
  if (viewWeeks > 0) chips.push({ label: weeksLabel(viewWeeks) });
  if (stage === 'filling' && count < 6) chips.push({ label: 'choosing...', soft: true });

  return (
    <div className="wrap">
      <nav>
        <div className="toprow">
          <div className="brand lockup">
            <span className="prod">
              <button type="button" className="prodhome" onClick={() => go('planner')} aria-label="Compass - go to Planner">
                <svg className="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path className="mu" d="M32 4 L46 32 L18 32Z" /><path className="md" d="M32 60 L46 32 L18 32Z" /></g><circle className="mc" cx="32" cy="32" r="3.5" /></svg>
                COMPASS
              </button>
            </span>
            <span className="byline">
              <span className="by">by</span>
              <a
                className="logoLink"
                href="https://thehybridhouse.co.uk"
                target="_blank"
                rel="noreferrer"
                aria-label="The Hybrid House website"
              >
                <img src={logoUrl} alt="The Hybrid House" height={26} />
              </a>
            </span>
          </div>
          <div className="navlinks">
          <button type="button" className={page === 'planner' ? 'navon' : ''} onClick={() => go('planner')}>Planner</button>
          <button type="button" className={page === 'plans' ? 'navon' : ''} onClick={() => go('plans')}>My plans</button>
          {/* Pricing page parked pending pricing information - nav link removed; page code kept below for later */}
          <button
            type="button"
            className="themebtn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="signin"
            onClick={() => go('signin')}
            aria-label={authEmail ? `Account - logged in as ${authEmail}` : 'Sign in'}
          >
            {authEmail ? (
              <span className="avatar" aria-hidden="true">{authEmail.charAt(0).toUpperCase()}</span>
            ) : (
              'Sign in'
            )}
          </button>
          </div>
        </div>
      </nav>

      {page === 'planner' && !unavailablePlan && (
        <>
      {viewingSaved || editingSaved ? (
        <header className="saved-page-head">
          <div className="saved-page-navigation">
            <button type="button" className="saved-back" onClick={() => go('plans')}><IconBack />View all plans</button>
            <button type="button" className="ghost saved-create" onClick={reset}><IconPlus />Create another</button>
          </div>
          <h1>{viewBrief.name || 'Untitled campaign'}</h1>
        </header>
      ) : (
        <header className="hero">
          <IndustryReel />
          <h1>Your media plan, <em>in minutes.</em></h1>
          <p className="sub">
            Answer a few questions. Compass recommends the publishers, formats and spend split - and
            the results to expect, with the reasoning shown.
          </p>
        </header>
      )}
      <div className="layout">
        <section className="card form" aria-label={savedBriefReadOnly ? 'Saved plan brief' : editingSaved ? 'Edit saved plan brief' : 'Plan a campaign'}>
          {savedBriefReadOnly ? (
            <>
              <div className="planhead saved-brief-head">
                <div className="saved-brief-heading">
                  <h2>Your brief</h2>
                  <div className="cap">SAVED PLAN - READ ONLY</div>
                </div>
                <div className="saved-brief-tools" role="group" aria-label="Export and share plan">
                  <ComingSoonButton compact />
                <button type="button" className="ghost saved-plan-copy" onClick={copyPlanLink} aria-label={linkCopy === 'copied' ? 'Plan link copied - only works in this browser' : 'Copy plan link - only works in this browser'}>
                  {linkCopy === 'copied' ? <IconCheck /> : <IconShare />}
                </button>
                </div>
              </div>
              <div className="bsum">
                <div><div className="k">Campaign name</div><div className="v">{brief.name || 'Untitled campaign'}</div></div>
                <div><div className="k">Objective</div><div className="v">{brief.objectives.map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '').filter((l) => l !== '').join(' + ') || '-'}</div></div>
                <div><div className="k">Market</div><div className="v">{marketLabels(brief.markets) || 'Not specified'}</div></div>
                <div><div className="k">KPI</div><div className="v">{brief.kpis.join(' + ') || '-'}</div></div>
                <div><div className="k">Audience</div><div className="v">{brief.audiences.join(' + ') || '-'}</div></div>
                <div><div className="k">Budget</div><div className="v">{brief.budget !== null ? gbp(brief.budget) : '-'}</div></div>
                <div><div className="k">Campaign dates</div><div className="v">{weeks > 0 ? `${formatDate(brief.start)} to ${formatDate(brief.end)} - ${weeksLabel(weeks)}` : '-'}</div></div>
              </div>
              <div className="saved-plan-actions" role="group" aria-label="Saved plan actions">
                {canViewPlan && <button type="button" className="btn saved-plan-edit" onClick={editSavedPlan}>
                  <IconEdit />
                  Edit plan
                </button>}
              </div>
              <span className="sr-only" role="status">{linkCopy === 'copied' ? 'Plan link copied.' : linkCopy === 'failed' ? 'Could not copy automatically. Select and copy the link below.' : ''}</span>
              {linkCopy === 'failed' && <input ref={planLinkRef} className="planlink-field" aria-label="Plan link - copy manually" readOnly value={window.location.href} onFocus={e => e.target.select()} />}
            </>
          ) : (
            <>
          <h2>{editingSaved ? 'Edit your brief' : 'Plan a campaign'}</h2>
          {earlierDraftKey && <div className="draft-choice" role="status">
            <p>Your other draft is also kept on this device. Your current answers have not changed.</p>
            <button type="button" className="ghost" onClick={openEarlierDraft}>Switch to other draft</button>
            <button type="button" className="ghost" onClick={() => setEarlierDraftKey(null)}>Keep current answers</button>
          </div>}
          <div className="hint">{editingSaved ? 'Changes update this saved plan when you save.' : 'No media expertise needed.'}</div>

          {demoMode && !editingSaved && <>
          <button type="button" className="demofill" onClick={() => fillDemo()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4l1.2 3.2L19.5 8.5l-3.3 1.3L15 13l-1.2-3.2L10.5 8.5l3.3-1.3L15 4z" />
              <path d="M6 11l.9 2.4 2.4.9-2.4.9L6 17.6l-.9-2.4-2.4-.9 2.4-.9L6 11z" />
              <path d="M17.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
            </svg>
            {hasFilled ? 'Try another example' : 'Fill it in for me'}
          </button>
          <div className="demohint">{cueGen ? 'Example filled. Building your plan next...' : 'Fills an example and builds your plan'}</div>
          </>}

          <div className="field planning-step">
            <label htmlFor="f-name">Campaign name</label>
            <input
              id="f-name"
              className="ctl"
              type="text"
              placeholder="e.g. UK Laboratory Procurement Campaign - Q1 2027"
              value={brief.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>

          <div className="field planning-step">
            <label id="g-market">Market</label>
            <div className="pills" role="group" aria-labelledby="g-market">
              {MARKETS.map(m=><button key={m.id} type="button" className={`pill${brief.markets?.includes(m.id) ? '' : ' off'}`} aria-pressed={brief.markets?.includes(m.id) ?? false} onClick={()=>patch({markets:brief.markets?.includes(m.id) ? brief.markets.filter(id=>id!==m.id) : [...(brief.markets??[]),m.id]})}>{m.label}</button>)}
            </div>
          </div>

          <div className="field planning-step">
            <label id="g-objective">Objective</label>
            <div className="pills" role="group" aria-labelledby="g-objective">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`pill obj-${o.id}${brief.objectives.includes(o.id) ? '' : ' off'}`}
                  aria-pressed={brief.objectives.includes(o.id)}
                  onClick={() => toggleObjective(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field planning-step">
            <label id="g-kpi">KPI</label>
            {kpiOptions.length === 0 ? (
              <div className="hint">Select an objective first</div>
            ) : (
              <div className="pills" role="group" aria-labelledby="g-kpi">
                {kpiOptions.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    className={`pill obj-${entry.objective}${brief.kpis.includes(entry.label) ? '' : ' off'}`}
                    aria-pressed={brief.kpis.includes(entry.label)}
                    onClick={() => toggleKpi(entry.label)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field planning-step">
            <label id="g-audience">Audience</label>
            <div className="pills audience-pills" role="group" aria-labelledby="g-audience">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`pill${brief.audiences.includes(a) ? '' : ' off'}`}
                  aria-pressed={brief.audiences.includes(a)}
                  onClick={() => toggleAudience(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="field planning-step">
            <label htmlFor="f-budget">Budget</label>
            <input
              id="f-budget"
              className="ctl"
              type="text"
              inputMode="numeric"
              placeholder="e.g. £100,000"
              value={budgetText ? `£${budgetText}` : ''}
              onChange={(e) => onBudget(e.target.value)}
            />
          </div>

          <div className="field planning-step">
            <label>Campaign dates</label>
            <div className="daterow">
              <div className="datewrap">
                <input
                  ref={startRef}
                  aria-label="Start date"
                  aria-invalid={startNotFuture(brief.start) || undefined}
                  aria-describedby={startNotFuture(brief.start) ? "start-date-error" : undefined}
                  className="ctl"
                  type="date"
                  onFocus={clearCue}
                  onPointerDown={clearCue}
                  value={brief.start}
                  min={tomorrowISO}
                  onChange={(e) => patch({ start: e.target.value })}
                />
                <button
                  type="button"
                  className="calbtn"
                  aria-label="Choose start date"
                  onClick={() => openDatePicker(startRef)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                  </svg>
                </button>
              </div>
              <div className="datewrap">
                <input
                  ref={endRef}
                  aria-label="End date"
                  aria-invalid={endBeforeStart(brief.start, brief.end) || undefined}
                  aria-describedby={endBeforeStart(brief.start, brief.end) ? "end-date-error" : undefined}
                  className="ctl"
                  type="date"
                  onFocus={clearCue}
                  onPointerDown={clearCue}
                  value={brief.end}
                  min={brief.start || tomorrowISO}
                  onChange={(e) => patch({ end: e.target.value })}
                />
                <button
                  type="button"
                  className="calbtn"
                  aria-label="Choose end date"
                  onClick={() => openDatePicker(endRef)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                  </svg>
                </button>
              </div>
            </div>
            {startNotFuture(brief.start) && (
              <div id="start-date-error" className="dur date-error" role="status">⚠ Start date must be in the future.</div>
            )}
            {endBeforeStart(brief.start, brief.end) && (
              <div id="end-date-error" className="dur date-error" role="status">⚠ End date must be on or after the start date.</div>
            )}
            {weeks > 0 && (
              <div className="dur">
                {formatDate(brief.start)} to {formatDate(brief.end)} · {weeksLabel(weeks)}
              </div>
            )}
          </div>

          <button ref={genRef} className={`gen${cueGen ? ' cue' : ''}`} type="button" disabled={count < 6 || stage === 'generating'} onClick={generate}>
            {hasGenerated || stage === 'plan' ? 'Regenerate my plan' : 'Generate my plan'} <span>&rarr;</span>
          </button>
            </>
          )}
        </section>

        <section ref={planRef} className="card plan" aria-live="polite">
          {stage === 'empty' && (
            <>
              <div className="empty">
                <div className="glyph">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2 L15 12 L12 22 L9 12 Z" fill="#FECA0A" />
                  </svg>
                </div>
                <h3>Your recommended plan builds here</h3>
                <p>
                  As you answer, Compass checks your brief against publisher rates, audience sizes
                  and performance benchmarks - then shows the full plan{' '}
                  <span className="only-d">on this side</span>
                  <span className="only-m">below</span>.
                </p>
              </div>
              <div className="steps3">
                <div className="step3">
                  <div className="n">01</div>
                  <b>Tell us your brief</b>
                  <span>Objective, audience, budget and dates. No media knowledge needed.</span>
                </div>
                <div className="step3">
                  <div className="n">02</div>
                  <b>Compass builds the plan</b>
                  <span>Publishers, formats and a spend split matched to your brief.</span>
                </div>
                <div className="step3">
                  <div className="n">03</div>
                  <b>Act on it</b>
                  <span>Save it, download it, or ask{' '}
                  <a href="https://thehybridhouse.co.uk" target="_blank" rel="noreferrer">
                    Hybrid House
                  </a>{' '}
                  to activate it.</span>
                </div>
              </div>
              <PlanOutline />
            </>
          )}

          {stage === 'filling' && (
            <>
              <div className="planhead">
                <h2>Your brief so far</h2>
                <DemoCap />
              </div>
              <div className="chips">
                {chips.map((c) => (
                  <span key={c.label} className={`chip${c.soft ? ' soft' : ''}`}>
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="prog">
                <div className="bar">
                  <div className="fill" style={{ width: `${(count / 6) * 100}%` }} />
                </div>
                <div className="t">{count} OF 6 ANSWERED</div>
              </div>
              <SkeletonBlock />
              <p className="keep">
                Keep going - your recommended publishers, spend split and expected results appear
                here as soon as you generate.
              </p>
            </>
          )}

          {stage === 'generating' && (
            <>
              <div className="planhead">
                <h2>Building your plan</h2>
                <DemoCap />
              </div>
              <div className="chips">
                <span className="chip">{viewObjectiveLabels.join(' + ')}</span>
                <span className="chip">{viewBrief.kpis.join(' + ')}</span>
                <span className="chip">Market: {marketLabels(viewBrief.markets) || 'Not specified'}</span>
                <span className="chip">{viewBrief.audiences.join(' + ')}</span>
                <span className="chip">{gbp(viewBrief.budget ?? 0)}</span>
                <span className="chip">{weeksLabel(viewWeeks)}</span>
              </div>
              <div className="check">
                {checklistFor(viewBrief).map((item, i) =>
                  i < ticks ? (
                    <div className="row" key={item}>
                      <span className="tick">&#10003;</span>
                      {item}
                    </div>
                  ) : (
                    <div className="row pending" key={item}>
                      <span className="dot" />
                      {item}
                    </div>
                  ),
                )}
              </div>
              <SkeletonBlock />
            </>
          )}

          {stage === 'gate' && (
            <div className="planin">
              <div className="planhead">
                <h2>Your plan is ready</h2>
                <DemoCap />
              </div>
              <p className="pagesub">
                {authEmail ? 'Add your details to see it. Your brief is kept.' : 'Log in to see it. Your brief is kept while you log in.'}
              </p>
              {authEmail ? renderProfileFields('f-gate-profile') : renderSignInFields('f-gate')}
              {savedBriefReadOnly ? <button type="button" className="ghost gate-secondary" onClick={() => go('plans')}>View all plans</button> :
                <button type="button" className="ghost gate-secondary" onClick={() => { setStage('filling'); window.scrollTo(0, 0); }}>Back to my brief</button>}
            </div>
          )}

          {stage === 'plan' && canViewPlan && plan && (
            <div className="planin">
              <div className="planhead">
                <h2>{viewingSaved || editingSaved
                  ? 'Media plan'
                  : 'Recommended plan'}</h2>
                {viewingSaved || editingSaved ? <div className="cap">{editingSaved ? 'SAVED PLAN - EDITING BRIEF' : 'SAVED PLAN - READ ONLY'}</div> : <DemoCap />}
              </div>
              <div className="metrics">
                {plan.metrics.map((m) => (
                  <div className="metric" key={m.k}>
                    <div className="k">{m.k}</div>
                    <div className={`v${m.hl ? ' hl' : ''}`}>{m.v}</div>
                  </div>
                ))}
              </div>
              {plan.items.map((item) => (
                <div className="act" key={item.title}>
                  <div className="who">
                    <b>{item.title}</b>
                    <span className="tag">{item.format}</span>
                  </div>
                  <div className="num">
                    <div className="v">{gbp(item.spend)}</div>
                    <div className="k">Spend</div>
                  </div>
                  {item.metrics.map((m) => (
                    <div className="num" key={m.k}>
                      <div className="v">{m.v}</div>
                      <div className="k">{m.k}</div>
                    </div>
                  ))}
                  <div className="why">
                    <b>Why</b>
                    {item.why}
                  </div>
                </div>
              ))}
              <div className="timing">
                <div className="k">Suggested timing</div>
                <div className="months">
                  {plan.timing.map((t, ti) => (
                    <div className="month" key={ti}>
                      <b>{t.label}</b>
                      <span>{t.activity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cta">
                <div>
                  <b>A Hybrid House specialist can pick it up from here.</b>

                </div>
                <a className="btn specialist-link" href="https://thehybridhouse.co.uk/contact/" target="_blank" rel="noreferrer">
                  Speak to a specialist
                </a>
              </div>
              <div className="secondary" ref={saveRowRef}>
                {viewingSaved ? (
                  <>
                    {justSavedId === savedEntry?.id && (
                      <button type="button" className="ghost saved" disabled>
                        <IconCheck />
                        Saved
                      </button>
                    )}
                  </>
                ) : editingSaved ? (
                  <>
                    {editsNotGenerated && (
                      <p className="savenote">Regenerate your plan to include your latest changes before saving.</p>
                    )}
                    <button type="button" className="ghost lead" onClick={savePlan} disabled={editsNotGenerated}>
                      <IconSave />
                      Save changes
                    </button>
                    <button type="button" className="ghost" onClick={cancelEditSaved}>
                      <IconCancel />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {editsNotGenerated && (
                      <p className="savenote">Regenerate your plan to include your latest changes before saving.</p>
                    )}
                    <button type="button" className="ghost lead" onClick={savePlan} disabled={editsNotGenerated}>
                      <IconSave />
                      Save plan
                    </button>
                    <ComingSoonButton />
                    <button type="button" className="ghost" onClick={reset}>
                      <IconPlus />
                      Create another
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <div ref={saveSpacerRef} className="savespacer" aria-hidden="true" />
        </>
      )}

      {page === 'planner' && unavailablePlan && (
        <section className="card pagecard" aria-label="Plan unavailable">
          <div className="planhead"><h2>Plan unavailable in this browser</h2><DemoCap /></div>
          <p className="pagesub">This link only opens a plan saved in the same browser. The plan may have been deleted, or this browser may not have it. It is not a shareable link.</p>
          {plansLoadFailed && <p role="alert">Browser storage could not be read. Your saved data has been left untouched.</p>}
          <div className="viewactions">
            <button type="button" className="btn" onClick={() => go('plans')}>View all plans</button>
            <button type="button" className="ghost" onClick={() => go('planner')}>Back to planner</button>
          </div>
        </section>
      )}

      {page === 'plans' && (
        <section className="card pagecard" aria-label="My plans">
          <div className="planhead">
            <h2>My plans</h2>
            <DemoCap />
          </div>
          <p className="pagesub">
            Plans you save land here so you can pick up where you left off.
          </p>
          {storageFailed ? (
            <div className="notice" role="alert">
              <p>
                Your saved plans could not be loaded safely on this device, so they have been left
                untouched. Saving and deleting are unavailable until this browser's storage works
                again.
              </p>
            </div>
          ) : (
            <>
          {storageRecovered && (
            <div className="notice" role="status">
              <p>Your previously saved plans could not be fully read on this device. Any readable plans were kept, and the unreadable data was backed up.</p>
              <button type="button" className="ghost" onClick={() => setStorageRecovered(false)}>
                Dismiss
              </button>
            </div>
          )}
          {savedPlans.length === 0 ? (
            <div className="empty">
              <div className="glyph">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2 L15 12 L12 22 L9 12 Z" fill="#FECA0A" />
                </svg>
              </div>
              <h3>No saved plans yet</h3>
              <p>Your saved plans will be waiting here.</p>
              <button type="button" className="btn pagebtn" onClick={() => go('planner')}>
                Plan a campaign
              </button>
            </div>
          ) : (
            <>
              <div className="planfilters" role="group" aria-label="Filter plans">
                {(['all', 'active', 'expired'] as const).map((filter) => {
                  const count = savedPlans.filter((plan) => filter === 'all' || campaignEnded(plan.brief.end) === (filter === 'expired')).length;
                  return <button type="button" key={filter} aria-pressed={planFilter === filter} onClick={() => setPlanFilter(filter)}>
                    {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Expired'} <span>{count}</span>
                  </button>;
                })}
              </div>
              <div className="planlist">
              {savedPlans.filter((plan) => planFilter === 'all' || campaignEnded(plan.brief.end) === (planFilter === 'expired')).map((sp) => {
                const wks = campaignWeeks(sp.brief.start, sp.brief.end);
                const objLabels = sp.brief.objectives
                  .map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '')
                  .filter((l) => l !== '')
                  .join(' + ');
                return (
                  <div className={`plancard${campaignEnded(sp.brief.end) ? ' is-expired' : ''}`} key={sp.id}>
                    <button type="button" className="ghost pc-delete" aria-label={`Delete ${sp.brief.name || 'Untitled campaign'}`} title="Delete plan" onClick={() => setDeleteTarget(sp)}>
                      <IconTrash />
                    </button>
                    {campaignEnded(sp.brief.end) && <span className="chip expired">Expired</span>}
                    <div className="pc-main">
                      <b>
                        {sp.brief.name || 'Untitled campaign'}
                        {monthsRangeLabel(sp.brief.start, sp.brief.end) ? ` · ${monthsRangeLabel(sp.brief.start, sp.brief.end)}` : ''}
                      </b>
                      <div className="chips">
                        {objLabels && <span className="chip pc-objective">{objLabels}</span>}
                        <span className="chip">Market: {marketLabels(sp.brief.markets) || 'Not specified'}</span>
                        {sp.brief.audiences.length > 0 && (
                          <span className="chip">{sp.brief.audiences.join(' + ')}</span>
                        )}
                        {sp.brief.budget !== null && <span className="chip">{gbp(sp.brief.budget)}</span>}
                        {wks > 0 && <span className="chip">{weeksLabel(wks)}</span>}
                      </div>
                      <div className="pc-meta">
                        Saved{' '}
                        {new Date(sp.savedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="pc-actions">
                      <button type="button" className="btn" onClick={() => openPlan(sp)}>
                        Open plan
                        <IconOpen />
                      </button>

                    </div>
                  </div>
                );
              })}
              {savedPlans.filter((plan) => planFilter === 'all' || campaignEnded(plan.brief.end) === (planFilter === 'expired')).length === 0 && (
                <p className="filterempty" role="status">No {planFilter === 'expired' ? 'expired' : 'active'} plans. Your other plans are still available under All.</p>
              )}
              </div>
            </>
          )}
            </>
          )}
        </section>
      )}

      {page === 'signin' && (
        <section className="card pagecard signincard" aria-label={authEmail ? 'Account' : 'Sign in'}>
          <div className="planhead">
            <h2>{recoveringPassword ? 'Reset your password' : authEmail && !profileComplete ? 'Complete your profile' : authEmail ? 'Your account' : 'Log in to Compass'}</h2>
            <DemoCap />
          </div>
          {!authEmail && !recoveringPassword && <p className="pagesub">Save your plans and pick up where you left off.</p>}
          {authNotice && <p className="fieldnote" role="alert">{authNotice}</p>}
          {recoveringPassword ? renderSignInFields('f-signin') : authEmail && !profileComplete ? <>{renderProfileFields('f-signin-profile')}<button type="button" className="email-forgot" disabled={profileSaving} onClick={() => { void signOut(); }}>Log out</button></> : authEmail ? (
            <>
              <p className="pagesub">You are logged in as {authEmail}.</p>
              <button type="button" className="gen" onClick={() => { void signOut(); }}>
                Log out
              </button>
            </>
          ) : (
          <>
          {renderSignInFields('f-signin')}
          <p className="finenote">
            Use Google, or create an account with your email and a password.
          </p>
          </>
          )}
        </section>
      )}

      {page === 'pricing' && (
        <section className="card pagecard" aria-label="Pricing">
          <div className="planhead">
            <h2>Pricing</h2>
            <DemoCap />
          </div>
          <p className="pagesub">
            Compass is in early access. Tell Compass your brief and it recommends publishers,
            formats, a spend split and the results to expect, with the reasoning shown.
          </p>
          <div className="includegrid">
            <div className="include">
              <div className="n">01</div>
              <b>Your brief, answered</b>
              <span>Objective, audience, budget and dates - no media expertise needed.</span>
            </div>
            <div className="include">
              <div className="n">02</div>
              <b>A plan you can act on</b>
              <span>Recommended publishers and formats with a spend split and expected results.</span>
            </div>
            <div className="include">
              <div className="n">03</div>
              <b>Saved and shareable</b>
              <span>Saved plans stay in this browser in the demo - accounts and sharing are part of the full product design.</span>
            </div>
          </div>
          <div className="cta pricecta">
            <div>
              <b>Questions on pricing or access?</b>
              <p>
                A{' '}
                <a href="https://thehybridhouse.co.uk" target="_blank" rel="noreferrer">
                  Hybrid House
                </a>{' '}
                specialist can talk it through.
              </p>
            </div>
            <a className="btn" href="https://thehybridhouse.co.uk" target="_blank" rel="noreferrer">
              Talk to us
            </a>
          </div>
        </section>
      )}

      <footer>
        Compass by{' '}
        <a href="https://thehybridhouse.co.uk" target="_blank" rel="noreferrer">
          The Hybrid House
        </a>{' '}
        &middot; Design concept - scenario, figures and rationale are
        illustrative, adapted from the Compass brief
      </footer>

      {demoMode && !editingSaved && confirmFill && (
        <ConfirmDialog
          title="Replace your answers?"
          body="Replace the answers you have already given with the example brief?"
          confirmLabel="Replace with example"
          cancelLabel="Keep my answers"
          onConfirm={() => fillDemo(true)}
          onCancel={() => setConfirmFill(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this saved plan?"
          body={`"${deleteTarget.brief.name || 'Untitled campaign'}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete plan"
          cancelLabel="Keep plan"
          onConfirm={() => {
            deletePlan(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {openTarget && (
        <ConfirmDialog
          title={openTarget.reason === 'edit' ? 'Discard unsaved changes?' : openTarget.reason === 'unsaved' ? 'Replace your current plan?' : 'Replace your draft?'}
          body={
            openTarget.reason === 'edit'
              ? 'Leaving this edit will discard the changes you have not saved.'
              : openTarget.reason === 'unsaved'
                ? 'Your current plan has not been saved. Leave it and discard your changes?'
                : 'Leave this draft? Any answers you have not saved will be lost.'
          }
          confirmLabel={navigation.pending?.route.planId !== undefined ? "Open plan" : "Discard changes"}
          cancelLabel={openTarget.reason === 'edit' ? 'Keep editing' : openTarget.reason === 'unsaved' ? 'Keep my plan' : 'Keep my draft'}
          onConfirm={navigation.confirm}
          onCancel={navigation.cancel}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
          }
