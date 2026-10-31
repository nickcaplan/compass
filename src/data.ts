// Compass concept demo data.
// All plan content is illustrative, adapted from the example scenario in the
// Compass brief (Ben Portnoi, 31 Oct 2026). No real publisher rates, audience
// figures or benchmarks are used anywhere in this demo.

export type ObjectiveId = 'awareness' | 'consideration' | 'performance';

export interface Objective {
  id: ObjectiveId;
  label: string;
  kpis: string[];
}

// Taxonomy from the Compass brief: three objectives, each with its own KPIs.
export const OBJECTIVES: Objective[] = [
  {
    id: 'awareness',
    label: 'Awareness',
    kpis: ['Reach', 'Impressions', 'Audience penetration', 'Video views', 'Brand exposure'],
  },
  {
    id: 'consideration',
    label: 'Consideration',
    kpis: [
      'Dwell time',
      'Content interactions',
      'Video views / completions',
      'Webinar registrations',
      'Webinar views',
      'Content downloads',
      'Article engagement',
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    kpis: [
      'Lead generation',
      'Cost per lead',
      'Website visits',
      'Qualified traffic',
      'Downloads',
      'Form completions',
      'Enquiries',
    ],
  },
];

// Job-function taxonomy from the Compass brief (section 6).
export const AUDIENCES: string[] = [
  'Laboratory Technician',
  'Scientist / Researcher',
  'Laboratory Manager',
  'Procurement',
  'Purchasing Manager',
  'Purchasing Lead',
  'Operations',
  'Engineering',
  'Quality / Compliance',
  'R&D',
  'Department Head',
  'Director',
];

// Audiences shown first in the form. The brief (section 6) lists the
// taxonomy without ranking it; this first-visible pair is a proposed default
// grounded in the brief's worked example (Audience: Procurement) and the
// prototype slice in the project notes (procurement and lab managers),
// pending Nick's confirmation. Everything else sits under "Show more".
export const PRIMARY_AUDIENCES: string[] = ['Procurement', 'Laboratory Manager'];

// Seniority levels from the Compass brief (section 7). Multiple selections allowed.
export const SENIORITY_LEVELS: string[] = [
  'Technician / Practitioner',
  'Manager',
  'Senior Manager / Head',
  'Director / Executive',
];

export interface Brief {
  name: string;
  objectives: ObjectiveId[];
  kpis: string[];
  audiences: string[];
  seniority: string[];
  budget: number | null;
  start: string; // ISO date or ''
  end: string; // ISO date or ''
}

export const EMPTY_BRIEF: Brief = {
  name: '',
  objectives: [],
  kpis: [],
  audiences: [],
  seniority: [],
  budget: null,
  start: '',
  end: '',
};

// Guided-demo helper: one tap loads a complete example brief so the demo
// can reach the plan without filling every field by hand. Demo-only - this
// is not user data and does not persist anything. Dates are computed
// relative to today so the example never goes stale.
export function demoBrief(): Brief {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 83); // 12 weeks
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    name: 'UK Laboratory Procurement Campaign',
    objectives: ['performance'],
    kpis: ['Lead generation'],
    audiences: ['Procurement'],
    seniority: ['Manager'],
    budget: 100000,
    start: iso(start),
    end: iso(end),
  };
}

export function answeredCount(b: Brief): number {
  return [
    b.objectives.length > 0,
    b.kpis.length > 0,
    b.audiences.length > 0,
    b.seniority.length > 0,
    b.budget !== null && b.budget > 0,
    campaignWeeks(b.start, b.end) > 0 && !startNotFuture(b.start),
  ].filter(Boolean).length;
}

export function startNotFuture(start: string): boolean {
  if (!start) return false;
  const d = new Date(start + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() <= today.getTime();
}

export function weeksLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}

export function endBeforeStart(start: string, end: string): boolean {
  if (!start || !end) return false;
  const s = new Date(start + 'T00:00:00').getTime();
  const e = new Date(end + 'T00:00:00').getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return e < s;
}

export function campaignWeeks(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / (7 * 24 * 3600 * 1000)));
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function timingMonths(start: string, end: string): string[] {
  const d = new Date(start);
  const finish = new Date(end);
  if (Number.isNaN(d.getTime()) || Number.isNaN(finish.getTime())) {
    return ['Month 1', 'Month 2', 'Month 3'];
  }
  const m = d.getUTCMonth();
  const startIndex = d.getUTCFullYear() * 12 + m;
  const endIndex = finish.getUTCFullYear() * 12 + finish.getUTCMonth();
  const lastOffset = Math.min(2, Math.max(0, endIndex - startIndex));
  return [0, 1, 2].map((offset) => MONTHS[(m + Math.min(offset, lastOffset)) % 12]);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

export function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

export interface PlanMetric {
  k: string;
  v: string;
  hl?: boolean;
}

export interface PlanItem {
  title: string;
  format: string;
  spend: number;
  metrics: PlanMetric[];
  why: string;
}

export interface Plan {
  metrics: PlanMetric[];
  items: PlanItem[];
  timing: { label: string; activity: string }[];
}

// Reference scenario from the brief: Performance / Lead generation /
// Procurement / Manager + Director / GBP 100,000 / 12 weeks.
// Other budgets scale linearly from this reference, purely for illustration.
const REFERENCE_BUDGET = 100000;

function audienceWord(b: Brief): string {
  if (b.audiences.length === 0) return 'selected';
  if (b.audiences.length === 1) return b.audiences[0].toLowerCase();
  const rest = b.audiences.slice(0, -1).join(', ').toLowerCase();
  return `${rest} and ${b.audiences[b.audiences.length - 1].toLowerCase()}`;
}

function seniorityWord(b: Brief): string {
  if (b.seniority.length === 0) return 'senior';
  return b.seniority.join(' + ').toLowerCase();
}


function spends(budget: number, shares: number[]): number[] {
  const exact = shares.map((s) => Math.max(0, budget * s));
  const out = exact.map((x) => Math.floor(x));
  let rest = Math.round(budget) - out.reduce((a, n) => a + n, 0);
  const order = exact
    .map((x, i) => ({ frac: x - out[i], i }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (rest > 0 && order.length > 0) {
    out[order[k % order.length].i] += 1;
    rest -= 1;
    k += 1;
  }
  return out;
}

function performancePlan(b: Brief, f: number, weeks: number, months: string[]): Plan {
  const [webinarSpend, articleSpend, leadSpend] = spends(b.budget ?? 0, [0.2, 0.3, 0.5]);
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Estimated reach', v: num(180000 * f) },
      { k: 'Estimated leads', v: num(950 * f), hl: true },
      { k: 'Blended CPL', v: gbp(105), hl: true },
      { k: 'Duration', v: weeksLabel(weeks) },
    ],
    items: [
      {
        title: `Publisher A - ${b.audiences.join(' / ')} Webinar`,
        format: 'Webinar',
        spend: webinarSpend,
        metrics: [
          { k: 'Estimated leads', v: num(250 * f) },
          { k: 'Estimated CPL', v: gbp(80) },
        ],
        why: `Webinars historically deliver strong lead generation among ${audienceWord(b)} audiences at ${seniorityWord(b)} level.`,
      },
      {
        title: 'Publisher B - Sponsored Content',
        format: 'Sponsored article',
        spend: articleSpend,
        metrics: [
          { k: 'Estimated leads', v: num(200 * f) },
          { k: 'Estimated reach', v: num(90000 * f) },
        ],
        why: 'Builds consideration across the wider buying committee before lead-generation activity.',
      },
      {
        title: 'Publisher C - Lead Generation Programme',
        format: 'Lead generation',
        spend: leadSpend,
        metrics: [
          { k: 'Estimated leads', v: num(500 * f) },
          { k: 'Estimated CPL', v: gbp(100) },
        ],
        why: 'Strongest penetration among the selected audience - the largest performance component.',
      },
    ],
    timing: [
      { label: months[0], activity: 'Sponsored article · display launch' },
      { label: months[1], activity: 'Webinar promotion · webinar' },
      { label: months[2], activity: 'Retargeting · lead-generation activity' },
    ],
  };
}

function awarenessPlan(b: Brief, f: number, weeks: number, months: string[]): Plan {
  const [takeoverSpend, articleSpend, videoSpend] = spends(b.budget ?? 0, [0.35, 0.25, 0.4]);
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Estimated reach', v: num(420000 * f), hl: true },
      { k: 'Estimated impressions', v: `${(1.1 * f).toFixed(1)}m`, hl: true },
      { k: 'Avg. frequency', v: '2.6' },
      { k: 'Duration', v: weeksLabel(weeks) },
    ],
    items: [
      {
        title: `Publisher A - ${b.audiences.join(' / ')} Display Takeover`,
        format: 'Display advertising',
        spend: takeoverSpend,
        metrics: [
          { k: 'Estimated reach', v: num(210000 * f) },
          { k: 'Estimated impressions', v: num(520000 * f) },
        ],
        why: `High-impact display delivers scale and visibility quickly among ${audienceWord(b)} audiences.`,
      },
      {
        title: 'Publisher B - Sponsored Content',
        format: 'Sponsored article',
        spend: articleSpend,
        metrics: [
          { k: 'Estimated reach', v: num(90000 * f) },
          { k: 'Estimated impressions', v: num(260000 * f) },
        ],
        why: 'Builds presence with the wider buying committee around the launch activity.',
      },
      {
        title: 'Publisher C - Video Programme',
        format: 'Video',
        spend: videoSpend,
        metrics: [
          { k: 'Estimated views', v: num(340000 * f) },
          { k: 'Completion', v: '68%' },
        ],
        why: 'Video carries the story to the selected audience at strong expected completion rates.',
      },
    ],
    timing: [
      { label: months[0], activity: 'Display takeover · sponsored article' },
      { label: months[1], activity: 'Video programme launch' },
      { label: months[2], activity: 'Always-on display · retargeting' },
    ],
  };
}

function considerationPlan(b: Brief, f: number, weeks: number, months: string[]): Plan {
  const [webinarSpend, hubSpend, nativeSpend] = spends(b.budget ?? 0, [0.3, 0.4, 0.3]);
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Estimated interactions', v: num(4400 * f), hl: true },
      { k: 'Estimated registrations', v: num(380 * f), hl: true },
      { k: 'Estimated downloads', v: num(1150 * f) },
      { k: 'Duration', v: weeksLabel(weeks) },
    ],
    items: [
      {
        title: `Publisher A - ${b.audiences.join(' / ')} Webinar Series`,
        format: 'Webinar',
        spend: webinarSpend,
        metrics: [
          { k: 'Estimated registrations', v: num(380 * f) },
          { k: 'Per registration', v: gbp(79) },
        ],
        why: `Webinars hold attention longest among ${audienceWord(b)} audiences at ${seniorityWord(b)} level.`,
      },
      {
        title: 'Publisher B - Sponsored Content Hub',
        format: 'Sponsored article',
        spend: hubSpend,
        metrics: [
          { k: 'Estimated interactions', v: num(2900 * f) },
          { k: 'Avg. dwell', v: '3:10' },
        ],
        why: 'A content hub deepens engagement with the buying committee over the campaign period.',
      },
      {
        title: 'Publisher C - Native Content Programme',
        format: 'Native content',
        spend: nativeSpend,
        metrics: [
          { k: 'Estimated downloads', v: num(1150 * f) },
          { k: 'Estimated reach', v: num(120000 * f) },
        ],
        why: 'Native content converts engaged readers into downloadable assets they keep.',
      },
    ],
    timing: [
      { label: months[0], activity: 'Content hub launch · sponsored articles' },
      { label: months[1], activity: 'Webinar promotion · first webinar' },
      { label: months[2], activity: 'Second webinar · native content wave' },
    ],
  };
}

const PLAN_BUILDERS: Record<ObjectiveId, (b: Brief, f: number, weeks: number, months: string[]) => Plan> = {
  awareness: awarenessPlan,
  consideration: considerationPlan,
  performance: performancePlan,
};

export function buildPlan(b: Brief): Plan {
  const f = (b.budget ?? REFERENCE_BUDGET) / REFERENCE_BUDGET;
  const weeks = campaignWeeks(b.start, b.end) || 12;
  const months = timingMonths(b.start, b.end);
  const chosen = b.objectives.length ? b.objectives : (['performance'] as ObjectiveId[]);
  const selected = OBJECTIVES.map((o) => o.id).filter((id) => chosen.includes(id));
  if (selected.length === 1) return PLAN_BUILDERS[selected[0]](b, f, weeks, months);

  // Multiple objectives: compose one illustrative plan from every selected
  // objective's activities, deduplicated, with the budget re-split across the
  // combined set so the spends still sum exactly to the entered budget.
  const plans = selected.map((id) => PLAN_BUILDERS[id](b, f, weeks, months));
  const items: PlanItem[] = [];
  for (const p of plans) {
    for (const item of p.items) {
      const existing = items.find((x) => x.title === item.title);
      if (existing) {
        for (const m of item.metrics) {
          if (!existing.metrics.some((x) => x.k === m.k)) existing.metrics.push(m);
        }
      } else {
        items.push({ ...item, metrics: [...item.metrics], spend: 0 });
      }
    }
  }
  const weights = items.map((it) => {
    let w = 0;
    for (const p of plans) {
      const src = p.items.find((x) => x.title === it.title);
      if (src) {
        const total = p.items.reduce((a, x) => a + x.spend, 0) || 1;
        w = Math.max(w, src.spend / total);
      }
    }
    return w;
  });
  const wsum = weights.reduce((a, n) => a + n, 0) || 1;
  const alloc = spends(b.budget ?? 0, weights.map((w) => w / wsum));
  items.forEach((it, i) => {
    it.spend = alloc[i];
  });

  const hl: PlanMetric[] = [];
  for (const p of plans) {
    for (const m of p.metrics) {
      if (m.hl && !hl.some((x) => x.k === m.k)) hl.push(m);
    }
  }
  const metrics: PlanMetric[] = [
    { k: 'Total budget', v: gbp(b.budget ?? 0) },
    ...hl,
    { k: 'Duration', v: weeksLabel(weeks) },
  ];

  const norm = (s: string) => s.trim().toLowerCase();
  const timing = plans[0].timing.map((t) => ({ ...t }));
  for (const p of plans.slice(1)) {
    p.timing.forEach((t, i) => {
      const have = timing[i].activity.split(' · ').map(norm);
      const extra = t.activity.split(' · ').filter((f) => !have.includes(norm(f)));
      if (extra.length) {
        timing[i] = { label: timing[i].label, activity: `${timing[i].activity} · ${extra.join(' · ')}` };
      }
    });
  }
  return { metrics, items, timing };
}

export function checklistFor(b: Brief): string[] {
  const kpi = b.kpis.length ? b.kpis.join(' + ').toLowerCase() : 'your KPI';
  const efficiency =
    b.objectives.length > 1
      ? 'results across your selected objectives'
      : b.objectives[0] === 'awareness'
        ? 'reach and impressions'
        : b.objectives[0] === 'consideration'
          ? 'engagement and registrations'
          : 'delivery and cost per lead';
  return [
    "Excluding publishers and products that don't fit your brief",
    `Prioritising formats that work for ${kpi}`,
    `Balancing the spend split within your ${gbp(b.budget ?? 0)}`,
    `Calculating expected ${efficiency}`,
  ];
}
