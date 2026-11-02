import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
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
  PRIMARY_AUDIENCES,
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

type Stage = 'empty' | 'filling' | 'generating' | 'gate' | 'plan';

const FULL_PRODUCT_NOTE = 'Not available yet';

type Page = 'planner' | 'plans' | 'signin' | 'pricing';
const PAGE_ROUTES: Record<Page, string> = { planner: '#/planner', plans: '#/my-plans', signin: '#/sign-in', pricing: '#/pricing' };
function pageFromUrl(): Page {
  return (Object.keys(PAGE_ROUTES) as Page[]).find(page => PAGE_ROUTES[page] === window.location.hash) ?? 'planner';
}
function writePageUrl(page: Page, replace = false) {
  const url = new URL(window.location.href);
  url.hash = PAGE_ROUTES[page];
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
}


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
    strArr(b.kpis) &&
    strArr(b.audiences) &&
    strArr(b.seniority) &&
    (b.budget === null || typeof b.budget === 'number') &&
    typeof b.start === 'string' &&
    typeof b.end === 'string'
  );
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
  const [showAllAudiences, setShowAllAudiences] = useState(false);
  const [cueGen, setCueGen] = useState(false);
  const [cueSeq, setCueSeq] = useState(0);
  const [page, setPage] = useState<Page>(pageFromUrl);
  useEffect(() => {
    const syncPage = () => { setPage(pageFromUrl()); window.scrollTo(0, 0); };
    window.addEventListener('popstate', syncPage);
    window.addEventListener('hashchange', syncPage);
    // Leave OAuth fragments intact for the auth client to consume.
    if (!window.location.hash) writePageUrl(pageFromUrl(), true);
    return () => { window.removeEventListener('popstate', syncPage); window.removeEventListener('hashchange', syncPage); };
  }, []);
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
  function applyAuthUser(user: User | null) {
    setAuthUser(user);
    setAuthEmail(user?.email ?? null);
    const source = user ? JSON.stringify([user.id, user.user_metadata]) : null;
    if (user && profileSource.current === source) return;
    profileSource.current = source;
    setProfileName(typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name :
      typeof user?.user_metadata.name === 'string' ? user.user_metadata.name : '');
    setProfileCompany(typeof user?.user_metadata.company === 'string' ? user.user_metadata.company : '');
    setProfileError(null);
  }
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => loadPlans());
  const [savedEntry, setSavedEntry] = useState<{ id: string; mode: 'view' | 'edit' } | null>(null);
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

  // A sign-in round trip (Google redirect or emailed link) reloads the app,
  // so the in-progress brief and generated plan are stashed on this device
  // first and restored when the user lands back. Expires after an hour.
  const AUTH_DRAFT_KEY = 'compass-auth-draft';
  const latestPlanner = useRef({ brief, submittedBrief, savedEntry, budgetText, stage });
  latestPlanner.current = { brief, submittedBrief, savedEntry, budgetText, stage };
  function hasPlannerWork() {
    const current = latestPlanner.current;
    return current.stage !== 'empty' || current.submittedBrief !== null || current.savedEntry !== null ||
      answeredCount(current.brief) > 0 || current.brief.name.trim() !== '' || current.budgetText.trim() !== '' ||
      current.brief.start !== '' || current.brief.end !== '';
  }
  function stashAuthDraft() {
    try {
      if (!hasPlannerWork() && window.localStorage.getItem(AUTH_DRAFT_KEY)) return;
      const snap = {
        brief,
        submittedBrief,
        savedEntry,
        budgetText,
        stage: stage === 'generating' ? 'filling' : stage,
        ts: Date.now(),
      };
      window.localStorage.setItem(AUTH_DRAFT_KEY, JSON.stringify(snap));
    } catch {
      /* private mode */
    }
  }
  function restoreAuthDraft(allowSignIn = false) {
    // An explicit bookmarked page wins over an older pending auth draft.
    if (!allowSignIn && pageFromUrl() !== 'planner' && !recoveringPassword) return;
    if (hasPlannerWork()) return;
    try {
      const raw = window.localStorage.getItem(AUTH_DRAFT_KEY);
      if (!raw) return;
      window.localStorage.removeItem(AUTH_DRAFT_KEY);
      const snap: unknown = JSON.parse(raw);
      if (!isAuthDraft(snap) || Date.now() - snap.ts > 60 * 60 * 1000) return;
      const entry = (snap as typeof snap & { savedEntry?: { id?: unknown; mode?: unknown } }).savedEntry;
      if (entry && typeof entry.id === 'string' && (entry.mode === 'view' || entry.mode === 'edit') &&
          loadPlans().some((p) => p.id === entry.id)) {
        setSavedEntry({ id: entry.id, mode: entry.mode });
      }
      const unchangedPlan = snap.submittedBrief !== null &&
        JSON.stringify(snap.brief) === JSON.stringify(snap.submittedBrief);
      setBrief(snap.brief);
      setSubmittedBrief(unchangedPlan ? snap.brief : snap.submittedBrief);
      setBudgetText(snap.budgetText);
      // Back to the brief is navigation, not an edit. Keep an unchanged
      // generated plan available after the sign-in round trip.
      setStage(snap.stage === 'filling' && unchangedPlan ? 'gate' : snap.stage);
      if (!recoveringPassword) { setPage('planner'); writePageUrl('planner', true); }
    } catch {
      /* corrupted or unavailable storage */
    }
  }

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    if (callbackError) { setRecoveringPassword(false); setAuthNotice('This sign-in or reset link is invalid or has expired. Sign in or request a fresh password reset.'); setPage('signin'); writePageUrl('signin', true); }
    supabase.auth.getSession().then(({ data }) => {
      applyAuthUser(data.session?.user ?? null);
      if (data.session) restoreAuthDraft();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applyAuthUser(session?.user ?? null);
      // Auth events also arrive from other tabs: re-gate a visible plan when
      // the session is gone, and stop re-stashing the draft once signed in.
      // Draft restore stays on the getSession path so only the freshly loaded
      // tab consumes it; this tab keeps its in-memory brief.
      if (!session) {
        setRecoveringPassword(false);
        setStage((s) => (s === 'plan' ? 'gate' : s));
        setSavedEntry(null);
      }
      if (event === 'PASSWORD_RECOVERY') { setRecoveringPassword(true); setPage('signin'); writePageUrl('signin', true); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Reveal a plan only after authentication and first-time profile completion.
  useEffect(() => {
    if (stage === 'gate' && canViewPlan) setStage('plan');
    if (stage === 'plan' && !canViewPlan) setStage('gate');
  }, [stage, canViewPlan]);

  useEffect(() => {
    if (recoveringPassword && page !== 'signin') { setPage('signin'); writePageUrl('signin', true); }
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

  const count = answeredCount(brief);
  const weeks = campaignWeeks(brief.start, brief.end);
  const viewBrief = (stage === 'generating' || stage === 'gate' || stage === 'plan') && submittedBrief ? submittedBrief : brief;
  const viewWeeks = campaignWeeks(viewBrief.start, viewBrief.end);
  const viewObjectiveLabels = viewBrief.objectives
    .map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '')
    .filter((l) => l !== '');
  const primaryAudiences = PRIMARY_AUDIENCES.map((label) =>
    AUDIENCES.find((a) => a === label),
  ).filter((a): a is (typeof AUDIENCES)[number] => a !== undefined);
  const secondaryAudiences = AUDIENCES.filter((a) => !PRIMARY_AUDIENCES.includes(a));
  const visibleAudiences = showAllAudiences
    ? [...primaryAudiences, ...secondaryAudiences]
    : [...primaryAudiences, ...secondaryAudiences.filter((a) => brief.audiences.includes(a))];
  const hiddenAudienceCount = showAllAudiences
    ? 0
    : secondaryAudiences.filter((a) => !brief.audiences.includes(a)).length;
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
    setShowAllAudiences(false);
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
    setShowAllAudiences(false);
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
    setSavedEntry((s) => (s ? { ...s, mode: 'edit' } : s));
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
    setStage(canViewPlan ? 'plan' : 'gate');
    setSavedEntry({ id: entry.id, mode: 'view' });
    setJustSavedId(null);
    window.clearTimeout(toastTimer.current);
    setToast(null);
    setPage('planner');
    writePageUrl('planner');
    window.scrollTo(0, 0);
  }

  async function continueWithGoogle() {
    stashAuthDraft();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) showToast('Google sign-in failed - please try again');
  }

  async function completeProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileName.trim() || profileSaving) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim(), company: profileCompany.trim(), compass_profile_complete: true },
      });
      if (error || !data.user) {
        setProfileError('Could not save your details. Please try again.');
        return;
      }
      applyAuthUser(data.user);
    } catch {
      setProfileError('Could not save your details. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  function renderProfileFields(idPrefix: string) {
    return (
      <form onSubmit={(event) => { void completeProfile(event); }} aria-label="Complete your profile">
        <p className="pagesub">Signed in as {authEmail}. Add your details to continue.</p>
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
        <EmailAuth idPrefix={idPrefix} recovery={recoveringPassword} beforeEmail={stashAuthDraft} onAuthenticated={user => { restoreAuthDraft(true); applyAuthUser(user); setRecoveringPassword(false); try { window.localStorage.removeItem(AUTH_DRAFT_KEY); } catch { /* storage unavailable */ } go('planner'); }} />
      </>
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    applyAuthUser(null);
    // A signed-out visitor should not keep seeing a gated plan.
    if (stage === 'plan') setStage('gate');
    showToast('Signed out');
  }

  function go(p: Page) {
    window.clearTimeout(toastTimer.current);
    setToast(null);
    if (pageFromUrl() !== p || window.location.hash !== PAGE_ROUTES[p]) writePageUrl(p);
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
            {authEmail ?? 'Sign in'}
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
        <section className="card form" aria-label={savedBriefReadOnly ? 'Saved plan brief' : 'Plan a campaign'}>
          {savedBriefReadOnly ? (
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
              {canViewPlan && <button type="button" className="gen" onClick={editSavedPlan}>
                Edit plan <span>&rarr;</span>
              </button>}
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

          <button type="button" className="demofill" onClick={() => fillDemo()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4l1.2 3.2L19.5 8.5l-3.3 1.3L15 13l-1.2-3.2L10.5 8.5l3.3-1.3L15 4z" />
              <path d="M6 11l.9 2.4 2.4.9-2.4.9L6 17.6l-.9-2.4-2.4-.9 2.4-.9L6 11z" />
              <path d="M17.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
            </svg>
            {hasFilled ? 'Try another example' : 'Fill it in for me'}
          </button>
          <div className="demohint">{cueGen ? 'Example filled. Building your plan next...' : 'Fills an example and builds your plan'}</div>

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
                  {a}
                </button>
              ))}
              <button
                type="button"
                className="pill more"
                aria-expanded={showAllAudiences}
                onClick={() => setShowAllAudiences((v) => !v)}
              >
                {showAllAudiences
                  ? 'Show fewer'
                  : `Show ${hiddenAudienceCount} more`}
              </button>
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

          {stage === 'gate' && (
            <div className="planin">
              <div className="planhead">
                <h2>Your plan is ready</h2>
                <DemoCap />
              </div>
              <p className="pagesub">
                Sign in to see it. Your brief is kept while you sign in.
              </p>
              {authEmail ? renderProfileFields('f-gate-profile') : renderSignInFields('f-gate')}
              {savedBriefReadOnly ? <button type="button" className="ghost" onClick={() => go('plans')}>View all plans</button> :
                <button type="button" className="ghost" onClick={() => { setStage('filling'); window.scrollTo(0, 0); }}>Back to my brief</button>}
            </div>
          )}

          {stage === 'plan' && canViewPlan && plan && (
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
                    <button type="button" className="ghost" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
                      <IconDownload />
                      Download PDF
                    </button>
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
                    <button type="button" className="ghost" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
                      <IconDownload />
                      Download PDF
                    </button>
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
            <div className="planlist">
              {savedPlans.map((sp) => {
                const wks = campaignWeeks(sp.brief.start, sp.brief.end);
                const objLabels = sp.brief.objectives
                  .map((id) => OBJECTIVES.find((o) => o.id === id)?.label ?? '')
                  .filter((l) => l !== '')
                  .join(' + ');
                return (
                  <div className="plancard" key={sp.id}>
                    <div className="pc-main">
                      <b>
                        {sp.brief.name || 'Untitled campaign'}
                        {monthsRangeLabel(sp.brief.start, sp.brief.end) ? ` · ${monthsRangeLabel(sp.brief.start, sp.brief.end)}` : ''}
                      </b>
                      <div className="chips">
                        {campaignEnded(sp.brief.end) && <span className="chip soft">Expired</span>}
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
            </div>
          )}
        </section>
      )}

      {page === 'signin' && (
        <section className="card pagecard signincard" aria-label="Sign in">
          <div className="planhead">
            <h2>{recoveringPassword ? 'Reset your password' : authEmail && !profileComplete ? 'Complete your profile' : 'Sign in to Compass'}</h2>
            <DemoCap />
          </div>
          <p className="pagesub">Save your plans and pick up where you left off.</p>
          {authNotice && <p className="fieldnote" role="alert">{authNotice}</p>}
          {recoveringPassword ? renderSignInFields('f-signin') : authEmail && !profileComplete ? <>{renderProfileFields('f-signin-profile')}<button type="button" className="email-forgot" disabled={profileSaving} onClick={() => { void signOut(); }}>Sign out</button></> : authEmail ? (
            <>
              <p className="pagesub">You are signed in as {authEmail}.</p>
              <button type="button" className="gen" onClick={() => { void signOut(); }}>
                Sign out
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

      {confirmFill && (
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
