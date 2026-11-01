import { useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from './assets/thh-logo.svg';
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
  gbp,
  startNotFuture,
  weeksLabel,
  type Brief,
  type ObjectiveId,
} from './data';

type Stage = 'empty' | 'filling' | 'generating' | 'plan';

const FULL_PRODUCT_NOTE = 'Part of the full product - not active in this concept demo';

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
        p.brief !== null &&
        typeof p.brief === 'object',
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

function DemoCap() {
  return <div className="cap">CONCEPT DEMO &middot; FIGURES + RATIONALE ILLUSTRATIVE</div>;
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
  const [page, setPage] = useState<Page>('planner');
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => loadPlans());
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const genRef = useRef<HTMLButtonElement>(null);
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

  const count = answeredCount(brief);
  const weeks = campaignWeeks(brief.start, brief.end);
  const viewBrief = (stage === 'generating' || stage === 'plan') && submittedBrief ? submittedBrief : brief;
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
    }, 650);
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
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  function patch(p: Partial<Brief>) {
    setBrief((b) => ({ ...b, ...p }));
  }

  function toggleObjective(id: ObjectiveId) {
    setBrief((b) => {
      const objectives = b.objectives.includes(id)
        ? b.objectives.filter((o) => o !== id)
        : [...b.objectives, id];
      const valid = OBJECTIVES.filter((o) => objectives.includes(o.id)).flatMap((o) => o.kpis);
      return { ...b, objectives, kpis: b.kpis.filter((k) => valid.includes(k)) };
    });
  }

  function toggleKpi(k: string) {
    setBrief((b) => ({
      ...b,
      kpis: b.kpis.includes(k) ? b.kpis.filter((x) => x !== k) : [...b.kpis, k],
    }));
  }

  function toggleAudience(a: string) {
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
    setBrief((b) => ({
      ...b,
      seniority: b.seniority.includes(level)
        ? b.seniority.filter((s) => s !== level)
        : [...b.seniority, level],
    }));
  }

  // Guided demo aid: one tap loads the complete example brief, then guides
  // the eye to the generate button (scroll + subtle pulse + focus). Demo
  // only - it never generates the plan by itself.
  function fillDemo() {
    const hasInput = count > 0 || brief.name.trim() !== '' || budgetText.trim() !== '';
    if (hasInput && !window.confirm('Replace the answers you have already given with the example brief?')) {
      return;
    }
    const d = demoBrief();
    setBrief(d);
    setBudgetText(d.budget !== null ? d.budget.toLocaleString('en-GB') : '');
    setShowAllAudiences(false);
    window.clearTimeout(cueTimer.current);
    if (answeredCount(d) >= 6) {
      setCueSeq((n) => n + 1);
      setCueGen(true);
      cueTimer.current = window.setTimeout(() => setCueGen(false), 6000);
    }
  }

  useEffect(() => {
    if (!cueGen) return;
    const el = genRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(id);
  }, [cueGen, cueSeq]);

  function clearCue() {
    window.clearTimeout(cueTimer.current);
    setCueGen(false);
  }

  function generate() {
    if (count < 6) return;
    clearCue();
    setSubmittedBrief(brief);
    setStage('generating');
  }

  function reset() {
    clearCue();
    setBrief(EMPTY_BRIEF);
    setSubmittedBrief(null);
    setBudgetText('');
    setStage('empty');
    setShowAllAudiences(false);
  }

  function persist(plans: SavedPlan[]): boolean {
    setSavedPlans(plans);
    try {
      window.localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
      return true;
    } catch {
      return false;
    }
  }

  function savePlan() {
    if (!submittedBrief) return;
    const entry: SavedPlan = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      brief: submittedBrief,
    };
    const latest = loadPlans();
    if (latest.length >= 20) {
      showToast('My plans is full (20 plans) - delete one before saving another');
      return;
    }
    if (persist([entry, ...latest])) {
      showToast('Saved to My plans - stored in this browser only (demo)');
    } else {
      showToast('Could not save - browser storage is unavailable');
    }
  }

  function deletePlan(id: string) {
    if (!window.confirm('Delete this saved plan? This cannot be undone.')) return;
    if (!persist(loadPlans().filter((p) => p.id !== id))) {
      setSavedPlans(loadPlans());
      showToast('Could not delete - browser storage is unavailable');
    }
  }

  function openPlan(entry: SavedPlan) {
    const hasDraft = count > 0 || brief.name.trim() !== '' || budgetText.trim() !== '';
    if (hasDraft && stage !== 'plan' && !window.confirm('Replace your current draft with this saved plan?')) {
      return;
    }
    setBrief(entry.brief);
    setSubmittedBrief(entry.brief);
    setBudgetText(entry.brief.budget !== null ? entry.brief.budget.toLocaleString('en-GB') : '');
    setStage('plan');
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
        <div className="brand">
          <a
            className="logoLink"
            href="https://thehybridhouse.co.uk"
            target="_blank"
            rel="noreferrer"
            aria-label="The Hybrid House website"
          >
            <img src={logoUrl} alt="The Hybrid House" height={30} />
          </a>
          <span className="prod">
            <button type="button" className="prodhome" onClick={() => go('planner')} aria-label="Compass - go to Planner">
              COMPASS
            </button>
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
      </nav>

      {page === 'planner' && (
        <>
      <header className="hero">
        <div className="eyebrow">Life sciences media planning</div>
        <h1>
          Your media plan, <em>in minutes.</em>
        </h1>
        <p className="sub">
          Answer a few questions. Compass recommends the publishers, formats and spend split - and
          the results to expect, with the reasoning shown.
        </p>
      </header>

      <div className="layout">
        <section className="card form" aria-label="Plan a campaign">
          <h2>Plan a campaign</h2>
          <div className="hint">No media expertise needed.</div>

          <button type="button" className="demofill" onClick={fillDemo}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4l1.2 3.2L19.5 8.5l-3.3 1.3L15 13l-1.2-3.2L10.5 8.5l3.3-1.3L15 4z" />
              <path d="M6 11l.9 2.4 2.4.9-2.4.9L6 17.6l-.9-2.4-2.4-.9 2.4-.9L6 11z" />
              <path d="M17.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
            </svg>
            Fill it in for me
          </button>
          <div className="demohint">Loads a complete example brief - demo only</div>

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
            Generate my plan <span>&rarr;</span>
          </button>
        </section>

        <section className="card plan" aria-live="polite">
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
              <SkeletonBlock />
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
            <>
              <div className="planhead">
                <h2>Recommended plan</h2>
                <DemoCap />
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
                <button type="button" className="ghost" onClick={savePlan}>
                  Save plan
                </button>
                <button type="button" className="ghost" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
                  Download PDF
                </button>
                <button type="button" className="ghost" onClick={reset}>
                  Create another scenario
                </button>
              </div>
            </>
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
                      <b>{sp.brief.name || 'Untitled campaign'}</b>
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
                      </button>
                      <button type="button" className="ghost" onClick={() => deletePlan(sp.id)}>
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
            <h2>Sign in to Compass</h2>
            <DemoCap />
          </div>
          <p className="pagesub">Save your plans and pick them up on any device.</p>
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
