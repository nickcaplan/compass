import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  cancelCb.current = onCancel;
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
  OBJECTIVES,
  SENIORITY_LEVELS,
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

type Stage = 'empty' | 'filling' | 'generating' | 'plan';

function ComingSoonButton() {
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
    <span className={`cs-wrap${notice ? ' cs-showing' : ''}`} ref={wrap}>
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
        <span className="cs-label" key={notice}>{notice ? '✧ Coming soon' : <><IconDownload />Download PDF</>}</span>
      </button>
    </span>
  );
}



const FULL_PRODUCT_NOTE = 'Not available yet';

type Page = 'planner' | 'plans' | 'signin' | 'pricing';

interface SavedPlan {
  id: string;
  savedAt: string;
  brief: Brief;
}

// Demo-only persistence: plans save to this browser's localStorage so the
// My Plans design is clickable end-to-end without a backend. Real saved
// plans across devices need sign-in + database - not built yet.
const PLANS_KEY = 'compass-saved-plans';

function isBrief(value: unknown): value is Brief {
  if (value === null || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  const strArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  return (
    typeof b.name === 'string' &&
    strArr(b.objectives) &&
    (b.objectives as string[]).every((id) => OBJECTIVES.some((o) => o.id === id)) &&
    strArr(b.kpis) &&
    strArr(b.audiences) &&
    strArr(b.seniority) &&
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

function isoDaysFromNow(days: number): string {
  // Local-time formatting: toISOString() is UTC and can land on the previous
  // calendar date when local time is ahead of UTC.
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedPlans(): SavedPlan[] {
  return [
    {
      id: 'seed-active-1',
      savedAt: '',
      brief: {
        name: 'UK Laboratory Procurement Campaign',
        objectives: ['performance'],
        kpis: ['Lead generation', 'Cost per lead'],
        audiences: ['Procurement', 'Laboratory Manager'],
        seniority: ['Manager', 'Senior Manager / Head'],
        budget: 100000,
        start: isoDaysFromNow(-14),
        end: isoDaysFromNow(56),
      },
    },
    {
      id: 'seed-active-2',
      savedAt: '',
      brief: {
        name: 'European Lab Automation Awareness Push',
        objectives: ['awareness'],
        kpis: ['Reach', 'Impressions'],
        audiences: ['Scientist / Researcher', 'Laboratory Technician'],
        seniority: ['Technician / Practitioner'],
        budget: 45000,
        start: isoDaysFromNow(7),
        end: isoDaysFromNow(70),
      },
    },
    {
      id: 'seed-past-1',
      savedAt: '',
      brief: {
        name: 'Quality and Compliance Enquiry Push',
        objectives: ['performance'],
        kpis: ['Enquiries'],
        audiences: ['Quality / Compliance'],
        seniority: ['Manager'],
        budget: 75000,
        start: isoDaysFromNow(-90),
        end: isoDaysFromNow(-20),
      },
    },
    {
      id: 'seed-past-2',
      savedAt: '',
      brief: {
        name: 'Global Reagent Launch Consideration',
        objectives: ['consideration'],
        kpis: ['Content downloads', 'Article engagement'],
        audiences: ['R&D', 'Department Head'],
        seniority: ['Director / Executive'],
        budget: 60000,
        start: isoDaysFromNow(-120),
        end: isoDaysFromNow(-60),
      },
    },
    { id: 'seed-past-3', savedAt: '', brief: { name: 'Laboratory Informatics Lead Campaign', objectives: ['performance'], kpis: ['Lead generation'], audiences: ['Laboratory Manager'], seniority: ['Manager'], budget: 55000, start: isoDaysFromNow(-150), end: isoDaysFromNow(-90) } },
    { id: 'seed-past-4', savedAt: '', brief: { name: 'Clinical Research Awareness Campaign', objectives: ['awareness'], kpis: ['Reach'], audiences: ['Scientist / Researcher'], seniority: ['Technician / Practitioner'], budget: 40000, start: isoDaysFromNow(-210), end: isoDaysFromNow(-150) } },
    { id: 'seed-past-5', savedAt: '', brief: { name: 'Bioprocessing Content Programme', objectives: ['consideration'], kpis: ['Content downloads'], audiences: ['R&D'], seniority: ['Director / Executive'], budget: 65000, start: isoDaysFromNow(-270), end: isoDaysFromNow(-210) } },
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
    const plans: SavedPlan[] = candidate;
    const existing = new Set(plans.map((p) => p.id));
    const fresh = seedPlans().filter((seed) => !applied.includes(seed.id) && !existing.has(seed.id));
    const room = 20 - plans.length;
    const toAdd = fresh.slice(0, Math.max(0, room));
    if (toAdd.length === 0) return;
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
    );
  } catch {
    return [];
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

const REEL_INDUSTRIES = ['Life sciences', 'Technology', 'Retail', 'Finance', 'Healthcare', 'Energy', 'Technology', 'Retail', 'Finance', 'Healthcare', 'Energy', 'Technology', 'Retail', 'Life sciences'];

function IndustryReel() {
  return (
    <div className="eyebrow industry-eyebrow">
      <span className="industry-accessible">Life sciences media planning</span>
      <span className="industry-reel" aria-hidden="true">
        <span className="industry-reel-track">
          {REEL_INDUSTRIES.map((industry, index) => <span key={index}>{industry}</span>)}
        </span>
      </span>
      <span aria-hidden="true">media planning</span>
    </div>
  );
}

export default function App() {
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
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
  const [page, setPage] = useState<Page>('planner');
  const [planFilter, setPlanFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    recoverCorruptPlans();
    if (!plansLoadFailed) ensureSeedPlans();
    return loadPlans();
  });
  const [storageRecovered, setStorageRecovered] = useState(() => plansRecovered);
  const [storageFailed] = useState(() => plansLoadFailed);
  const [savedEntry, setSavedEntry] = useState<{ id: string; mode: 'view' | 'edit'; originalAudiences?: string[] } | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hasFilled, setHasFilled] = useState(false);
  const [confirmFill, setConfirmFill] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPlan | null>(null);
  const [openTarget, setOpenTarget] = useState<{ entry: SavedPlan; reason: 'draft' | 'unsaved' | 'edit' } | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const genRef = useRef<HTMLButtonElement>(null);
  const planRef = useRef<HTMLElement>(null);
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

  const count = answeredCount(brief);
  const weeks = campaignWeeks(brief.start, brief.end);
  const viewBrief = (stage === 'generating' || stage === 'plan') && submittedBrief ? submittedBrief : brief;
  const viewWeeks = campaignWeeks(viewBrief.start, viewBrief.end);
  const viewObjectiveLabels = viewBrief.objectives
    .map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '')
    .filter((l) => l !== '');
  // Keep legacy selections visible and removable when editing older plans,
  // without making them choices for a new brief.
  const legacyAudiences = (savedEntry?.mode === "edit" ? (savedEntry.originalAudiences ?? brief.audiences) : brief.audiences)
    .filter(a => !AUDIENCES.includes(a));
  const visibleAudiences = [...AUDIENCES, ...legacyAudiences];
  const kpiOptions = OBJECTIVES.filter((o) => brief.objectives.includes(o.id))
    .flatMap((o) => o.kpis)
    .filter((k, i, a) => a.indexOf(k) === i);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const plan = useMemo(
    () => (stage === 'plan' && submittedBrief ? buildPlan(submittedBrief) : null),
    [stage, submittedBrief],
  );
  const viewingSaved = savedEntry !== null && savedEntry.mode === 'view' && stage === 'plan';
  const editingSaved = savedEntry !== null && savedEntry.mode === 'edit';
  const editsNotGenerated = stage === 'plan' && submittedBrief !== null && brief !== submittedBrief;

  useEffect(() => {
    if (stage === 'empty' || stage === 'filling') {
      setStage(count === 0 ? 'empty' : 'filling');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const genSteps = checklistFor(viewBrief).length;

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
    const id = window.setTimeout(() => setStage('plan'), 500);
    return () => window.clearTimeout(id);
  }, [stage, ticks, genSteps]);

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

  function toggleSeniority(level: string) {
    clearCue();
    setBrief((b) => ({
      ...b,
      seniority: b.seniority.includes(level)
        ? b.seniority.filter((s) => s !== level)
        : [...b.seniority, level],
    }));
  }

  // One tap fills an example, briefly shows the answers, then generates it.
  function fillDemo(force = false) {
    const hasInput = count > 0 || brief.name.trim() !== '' || budgetText.trim() !== '';
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

  function clearPlannerState() {
    clearCue();
    setBrief(EMPTY_BRIEF);
    setSubmittedBrief(null);
    setBudgetText('');
    setStage('empty');
    setHasGenerated(false);
    setHasFilled(false);
    setSavedEntry(null);
    setJustSavedId(null);
  }

  function reset() {
    clearPlannerState();
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
        setSavedEntry({ id: savedEntry.id, mode: 'view' });
        setJustSavedId(savedEntry.id);
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
      setSavedEntry({ id: entry.id, mode: 'view' });
      setJustSavedId(entry.id);
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
    }
  }

  function editSavedPlan() {
    setJustSavedId(null);
    setSavedEntry((s) => (s ? { ...s, mode: 'edit', originalAudiences: [...brief.audiences] } : s));
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
    setStage('plan');
    setSavedEntry({ id: savedEntry.id, mode: 'view' });
  }

  function openPlan(entry: SavedPlan, force = false) {
    const alreadyOpen = savedEntry?.mode === 'view' && savedEntry.id === entry.id;
    if (!force && !alreadyOpen) {
      const formDraft = stage !== 'plan' && (count > 0 || brief.name.trim() !== '' || budgetText.trim() !== '');
      const unsavedPlan = stage === 'plan' && savedEntry === null;
      const unsavedEdit = savedEntry?.mode === 'edit';
      const reason = unsavedEdit ? 'edit' : unsavedPlan ? 'unsaved' : formDraft ? 'draft' : null;
      if (reason !== null) {
        setOpenTarget({ entry, reason });
        return;
      }
    }
    setOpenTarget(null);
    setBrief(entry.brief);
    setSubmittedBrief(entry.brief);
    setBudgetText(entry.brief.budget !== null ? entry.brief.budget.toLocaleString('en-GB') : '');
    setStage('plan');
    setSavedEntry({ id: entry.id, mode: 'view' });
    setJustSavedId(null);
    window.clearTimeout(toastTimer.current);
    setToast(null);
    setPage('planner');
    window.scrollTo(0, 0);
  }

  function go(p: Page) {
    window.clearTimeout(toastTimer.current);
    setToast(null);
    setPage(p);
    window.scrollTo(0, 0);
  }

  const chips: { label: string; soft?: boolean }[] = [];
  if (viewObjectiveLabels.length) chips.push({ label: `Objective: ${viewObjectiveLabels.join(' + ')}` });
  if (viewBrief.kpis.length) chips.push({ label: `KPI: ${viewBrief.kpis.join(' + ')}` });
  if (viewBrief.audiences.length) chips.push({ label: `Audience: ${viewBrief.audiences.join(' + ')}` });
  if (viewBrief.seniority.length) chips.push({ label: `Seniority: ${viewBrief.seniority.join(' + ')}` });
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
          <button type="button" className="navsupport" onClick={() => showToast(FULL_PRODUCT_NOTE)}>Support</button>
          <button type="button" className="signin" onClick={() => go('signin')}>
            Sign in
          </button>
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
          </div>
        </div>
      </nav>

      {page === 'planner' && (
        <>
      <header className="hero">
        <IndustryReel />
        <h1>
          Your media plan, <em>in minutes.</em>
        </h1>
        <p className="sub">
          Answer a few questions. Compass recommends the publishers, formats and spend split - and
          the results to expect, with the reasoning shown.
        </p>
      </header>

      <div className="layout">
        <section className="card form" aria-label={viewingSaved ? 'Saved plan brief' : 'Plan a campaign'}>
          {viewingSaved ? (
            <>
              <div className="planhead">
                <h2>Your brief</h2>
                <div className="cap">SAVED PLAN - READ ONLY</div>
              </div>
              <div className="bsum">
                <div><div className="k">Campaign name</div><div className="v">{brief.name || 'Untitled campaign'}</div></div>
                <div><div className="k">Objective</div><div className="v">{brief.objectives.map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '').filter((l) => l !== '').join(' + ') || '-'}</div></div>
                <div><div className="k">KPI</div><div className="v">{brief.kpis.join(' + ') || '-'}</div></div>
                <div><div className="k">Audience</div><div className="v">{brief.audiences.join(' + ') || '-'}</div></div>
                <div><div className="k">Seniority</div><div className="v">{brief.seniority.join(' + ') || '-'}</div></div>
                <div><div className="k">Budget</div><div className="v">{brief.budget !== null ? gbp(brief.budget) : '-'}</div></div>
                <div><div className="k">Campaign dates</div><div className="v">{weeks > 0 ? `${formatDate(brief.start)} to ${formatDate(brief.end)} - ${weeksLabel(weeks)}` : '-'}</div></div>
              </div>
              <button type="button" className="gen" onClick={editSavedPlan}>
                Edit plan <span>&rarr;</span>
              </button>
              <div className="viewactions">
                <button type="button" className="ghost" onClick={() => go('plans')}>
                  <IconBack />
                  View all plans
                </button>
              </div>
            </>
          ) : (
            <>
          <h2>Plan a campaign</h2>
          <div className="hint">No media expertise needed.</div>

          {demoMode && <>
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

          <div className="field">
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

          <div className="field">
            <label id="g-objective">Objective</label>
            <div className="pills" role="group" aria-labelledby="g-objective">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`pill${brief.objectives.includes(o.id) ? '' : ' off'}`}
                  aria-pressed={brief.objectives.includes(o.id)}
                  onClick={() => toggleObjective(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>KPI</label>
            {kpiOptions.length === 0 ? (
              <div className="hint">Select an objective first</div>
            ) : (
              <div className="pills">
                {kpiOptions.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`pill${brief.kpis.includes(k) ? '' : ' off'}`}
                    aria-pressed={brief.kpis.includes(k)}
                    onClick={() => toggleKpi(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label id="g-audience">Audience</label>
            <div className="pills" role="group" aria-labelledby="g-audience">
              {visibleAudiences.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`pill${brief.audiences.includes(a) ? '' : ' off'}`}
                  aria-pressed={brief.audiences.includes(a)}
                  onClick={() => toggleAudience(a)}
                >
                  {a}{legacyAudiences.includes(a) ? " (saved selection)" : ""}
                </button>
              ))}

            </div>
          </div>

          <div className="field">
            <label id="g-seniority">Seniority</label>
            <div className="pills" role="group" aria-labelledby="g-seniority">
              {SENIORITY_LEVELS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill${brief.seniority.includes(s) ? '' : ' off'}`}
                  aria-pressed={brief.seniority.includes(s)}
                  onClick={() => toggleSeniority(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
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

          <div className="field">
            <label>Campaign dates</label>
            <div className="daterow">
              <div className="datewrap">
                <input
                  ref={startRef}
                  aria-label="Start date"
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
              <div className="dur warn">Start date must be in the future.</div>
            )}
            {endBeforeStart(brief.start, brief.end) && (
              <div className="dur warn">End date must be on or after the start date.</div>
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
                <span className="chip">{viewBrief.audiences.join(' + ')}</span>
                <span className="chip">{viewBrief.seniority.join(' + ')}</span>
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

          {stage === 'plan' && plan && (
            <div className="planin">
              <div className="planhead">
                <h2>{viewingSaved
                  ? `${viewBrief.name || 'Untitled campaign'}${monthsRangeLabel(viewBrief.start, viewBrief.end) ? ` · ${monthsRangeLabel(viewBrief.start, viewBrief.end)}` : ''}`
                  : 'Recommended plan'}</h2>
                {viewingSaved ? <div className="cap">SAVED PLAN - READ ONLY</div> : <DemoCap />}
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
                  <b>Want us to validate or activate this plan?</b>
                  <p>
                A{' '}
                <a href="https://thehybridhouse.co.uk" target="_blank" rel="noreferrer">
                  Hybrid House
                </a>{' '}
                media specialist can pick it up from here.
              </p>
                </div>
                <button type="button" className="btn" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
                  Speak to a specialist
                </button>
              </div>
              <div className="secondary">
                {viewingSaved ? (
                  <>
                    {justSavedId === savedEntry?.id && (
                      <button type="button" className="ghost saved" disabled>
                        <IconCheck />
                        Saved
                      </button>
                    )}
                    <ComingSoonButton />
                    <button type="button" className="ghost" onClick={reset}>
                      <IconPlus />
                      Create another scenario
                    </button>
                    <button type="button" className="ghost" onClick={() => go('plans')}>
                      <IconBack />
                      View all plans
                    </button>
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
                      Create another scenario
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
        </>
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
                    {campaignEnded(sp.brief.end) && <span className="chip expired">Expired</span>}
                    <div className="pc-main">
                      <b>
                        {sp.brief.name || 'Untitled campaign'}
                        {monthsRangeLabel(sp.brief.start, sp.brief.end) ? ` · ${monthsRangeLabel(sp.brief.start, sp.brief.end)}` : ''}
                      </b>
                      <div className="chips">
                        {objLabels && <span className="chip">{objLabels}</span>}
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
                      <button type="button" className="ghost" onClick={() => setDeleteTarget(sp)}>
                        <IconTrash />
                        Delete
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
        <section className="card pagecard signincard" aria-label="Sign in">
          <div className="planhead">
            <h2>Sign in to Compass</h2>
            <DemoCap />
          </div>
          <p className="pagesub">Save your plans and pick up where you left off.</p>
          <div className="ssolist">
            <button type="button" className="sso" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z" />
                <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z" />
                <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z" />
              </svg>
              Continue with Google
            </button>
            <button type="button" className="sso" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
              <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
              </svg>
              Continue with Microsoft
            </button>
          </div>
          <div className="divider"><span>or</span></div>
          <div className="field">
            <label htmlFor="f-email">Work email</label>
            <input id="f-email" className="ctl" type="email" placeholder="you@company.com" />
          </div>
          <button type="button" className="gen" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
            Continue with email <span>&rarr;</span>
          </button>
          <p className="finenote">
            Design proposal - sign-in is not connected yet. Google and Microsoft shown; more
            providers can be added when sign-in is built.
          </p>
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
              <span>Objective, audience, seniority, budget and dates - no media expertise needed.</span>
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

      {demoMode && confirmFill && (
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
              ? 'Opening this saved plan will discard the changes you have not saved.'
              : openTarget.reason === 'unsaved'
                ? 'Your current plan has not been saved. Replace it with this saved plan?'
                : 'Replace your current draft with this saved plan? Any answers you have not saved will be lost.'
          }
          confirmLabel="Open plan"
          cancelLabel={openTarget.reason === 'edit' ? 'Keep editing' : openTarget.reason === 'unsaved' ? 'Keep my plan' : 'Keep my draft'}
          onConfirm={() => openPlan(openTarget.entry, true)}
          onCancel={() => setOpenTarget(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
