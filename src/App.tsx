import { useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from './assets/thh-logo.svg';
import {
  AUDIENCES,
  EMPTY_BRIEF,
  OBJECTIVES,
  SENIORITY_LEVELS,
  answeredCount,
  buildPlan,
  campaignWeeks,
  checklistFor,
  formatDate,
  gbp,
  type Brief,
} from './data';

type Stage = 'empty' | 'filling' | 'generating' | 'plan';

const FULL_PRODUCT_NOTE = 'Part of the full product - not active in this concept demo';

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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const count = answeredCount(brief);
  const weeks = campaignWeeks(brief.start, brief.end);
  const objective = OBJECTIVES.find((o) => o.id === brief.objective) ?? null;
  const viewBrief = (stage === 'generating' || stage === 'plan') && submittedBrief ? submittedBrief : brief;
  const viewWeeks = campaignWeeks(viewBrief.start, viewBrief.end);
  const viewObjective = OBJECTIVES.find((o) => o.id === viewBrief.objective) ?? null;
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

  useEffect(() => {
    if (stage !== 'generating') return;
    setTicks(0);
    const steps = checklistFor(submittedBrief ?? brief).length;
    const interval = window.setInterval(() => {
      setTicks((t) => {
        if (t + 1 >= steps) {
          window.clearInterval(interval);
          window.setTimeout(() => setStage('plan'), 500);
          return t + 1;
        }
        return t + 1;
      });
    }, 650);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  function patch(p: Partial<Brief>) {
    setBrief((b) => ({ ...b, ...p }));
  }

  function onObjective(id: string) {
    const next = OBJECTIVES.find((o) => o.id === id) ?? null;
    patch({
      objective: next?.id ?? null,
      kpi: next && brief.kpi && next.kpis.includes(brief.kpi) ? brief.kpi : null,
    });
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

  function generate() {
    if (count < 6) return;
    setSubmittedBrief(brief);
    setStage('generating');
  }

  function reset() {
    setBrief(EMPTY_BRIEF);
    setSubmittedBrief(null);
    setBudgetText('');
    setStage('empty');
  }

  const chips: { label: string; soft?: boolean }[] = [];
  if (viewObjective) chips.push({ label: `Objective: ${viewObjective.label}` });
  if (viewBrief.kpi) chips.push({ label: `KPI: ${viewBrief.kpi}` });
  if (viewBrief.audience) chips.push({ label: `Audience: ${viewBrief.audience}` });
  if (viewBrief.seniority.length) chips.push({ label: `Seniority: ${viewBrief.seniority.join(' + ')}` });
  if (viewBrief.budget) chips.push({ label: `Budget: ${gbp(viewBrief.budget)}` });
  if (viewWeeks > 0) chips.push({ label: `${viewWeeks} weeks` });
  if (stage === 'filling' && count < 6) chips.push({ label: 'choosing...', soft: true });

  return (
    <div className="wrap">
      <nav>
        <div className="brand">
          <img src={logoUrl} alt="The Hybrid House" height={30} />
          <span className="prod">
            COMPASS<small>by The Hybrid House</small>
          </span>
        </div>
        <div className="navlinks">
          <button type="button" onClick={() => showToast(FULL_PRODUCT_NOTE)}>My plans</button>
          <button type="button" onClick={() => showToast(FULL_PRODUCT_NOTE)}>Support</button>
          <button type="button" className="signin" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
            Sign in
          </button>
        </div>
      </nav>

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
            <label htmlFor="f-objective">Objective</label>
            <select
              id="f-objective"
              className="ctl"
              value={brief.objective ?? ''}
              onChange={(e) => onObjective(e.target.value)}
              required
            >
              <option value="" disabled>
                Choose an objective
              </option>
              {OBJECTIVES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-kpi">KPI</label>
            <select
              id="f-kpi"
              className="ctl"
              value={brief.kpi ?? ''}
              onChange={(e) => patch({ kpi: e.target.value || null })}
              disabled={!objective}
              required
            >
              <option value="" disabled>
                {objective ? 'Choose a KPI' : 'Select an objective first'}
              </option>
              {(objective?.kpis ?? []).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-audience">Audience</label>
            <select
              id="f-audience"
              className="ctl"
              value={brief.audience ?? ''}
              onChange={(e) => patch({ audience: e.target.value || null })}
              required
            >
              <option value="" disabled>
                Choose an audience
              </option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Seniority</label>
            <div className="pills">
              {SENIORITY_LEVELS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill${brief.seniority.includes(s) ? '' : ' off'}`}
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
              <input
                aria-label="Start date"
                className="ctl"
                type="date"
                value={brief.start}
                onChange={(e) => patch({ start: e.target.value })}
              />
              <input
                aria-label="End date"
                className="ctl"
                type="date"
                value={brief.end}
                min={brief.start || undefined}
                onChange={(e) => patch({ end: e.target.value })}
              />
            </div>
            {weeks > 0 && (
              <div className="dur">
                {formatDate(brief.start)} to {formatDate(brief.end)} · {weeks} weeks
              </div>
            )}
          </div>

          <button className="gen" type="button" disabled={count < 6 || stage === 'generating'} onClick={generate}>
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
                  and performance benchmarks - then shows the full plan on this side.
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
                  <span>Save it, download it, or ask Hybrid House to activate it.</span>
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
                <span className="chip">{viewObjective?.label}</span>
                <span className="chip">{viewBrief.kpi}</span>
                <span className="chip">{viewBrief.audience}</span>
                <span className="chip">{viewBrief.seniority.join(' + ')}</span>
                <span className="chip">{gbp(viewBrief.budget ?? 0)}</span>
                <span className="chip">{viewWeeks} weeks</span>
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
                  {plan.timing.map((t) => (
                    <div className="month" key={t.label}>
                      <b>{t.label}</b>
                      <span>{t.activity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cta">
                <div>
                  <b>Want us to validate or activate this plan?</b>
                  <p>A Hybrid House media specialist can pick it up from here.</p>
                </div>
                <button type="button" className="btn" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
                  Speak to a specialist
                </button>
              </div>
              <div className="secondary">
                <button type="button" className="ghost" onClick={() => showToast(FULL_PRODUCT_NOTE)}>
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

      <footer>
        Compass by The Hybrid House &middot; Design concept - scenario, figures and rationale are
        illustrative, adapted from the Compass brief
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
