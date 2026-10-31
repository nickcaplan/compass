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

// Seniority levels from the Compass brief (section 7). Multiple selections allowed.
export const SENIORITY_LEVELS: string[] = [
  'Technician / Practitioner',
  'Manager',
  'Senior Manager / Head',
  'Director / Executive',
];

export interface Brief {
  name: string;
  objective: ObjectiveId | null;
  kpi: string | null;
  audience: string | null;
  seniority: string[];
  budget: number | null;
  start: string; // ISO date or ''
  end: string; // ISO date or ''
}

export const EMPTY_BRIEF: Brief = {
  name: '',
  objective: null,
  kpi: null,
  audience: null,
  seniority: [],
  budget: null,
  start: '',
  end: '',
};

export function answeredCount(b: Brief): number {
  return [
    b.objective !== null,
    b.kpi !== null,
    b.audience !== null,
    b.seniority.length > 0,
    b.budget !== null && b.budget > 0,
    b.start !== '' && b.end !== '',
  ].filter(Boolean).length;
}

export function campaignWeeks(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.max(1, Math.round((e - s) / (7 * 24 * 3600 * 1000)));
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function timingMonths(start: string): string[] {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return ['Month 1', 'Month 2', 'Month 3'];
  const m = d.getMonth();
  return [MONTHS[m], MONTHS[(m + 1) % 12], MONTHS[(m + 2) % 12]];
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
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
  return b.audience ? b.audience.toLowerCase() : 'selected';
}

function seniorityWord(b: Brief): string {
  if (b.seniority.length === 0) return 'senior';
  return b.seniority.join(' + ').toLowerCase();
}

function performancePlan(b: Brief, f: number, weeks: number, months: string[]): Plan {
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Est. reach', v: num(180000 * f) },
      { k: 'Est. leads', v: num(950 * f), hl: true },
      { k: 'Blended CPL', v: gbp(105), hl: true },
      { k: 'Duration', v: `${weeks} weeks` },
    ],
    items: [
      {
        title: `Publisher A - ${b.audience} Webinar`,
        format: 'Webinar',
        spend: (b.budget ?? 0) * 0.2,
        metrics: [
          { k: 'Est. leads', v: num(250 * f) },
          { k: 'Est. CPL', v: gbp(80) },
        ],
        why: `Webinars historically deliver strong lead generation among ${seniorityWord(b)} ${audienceWord(b)} audiences.`,
      },
      {
        title: 'Publisher B - Sponsored Content',
        format: 'Sponsored article',
        spend: (b.budget ?? 0) * 0.3,
        metrics: [
          { k: 'Est. leads', v: num(200 * f) },
          { k: 'Est. reach', v: num(90000 * f) },
        ],
        why: 'Builds consideration across the wider buying committee before lead-generation activity.',
      },
      {
        title: 'Publisher C - Lead Generation Programme',
        format: 'Lead generation',
        spend: (b.budget ?? 0) * 0.5,
        metrics: [
          { k: 'Est. leads', v: num(500 * f) },
          { k: 'Est. CPL', v: gbp(100) },
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
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Est. reach', v: num(420000 * f), hl: true },
      { k: 'Est. impressions', v: `${(1.1 * f).toFixed(1)}m`, hl: true },
      { k: 'Avg. frequency', v: '2.6' },
      { k: 'Duration', v: `${weeks} weeks` },
    ],
    items: [
      {
        title: `Publisher A - ${b.audience} Display Takeover`,
        format: 'Display advertising',
        spend: (b.budget ?? 0) * 0.35,
        metrics: [
          { k: 'Est. reach', v: num(210000 * f) },
          { k: 'Est. impressions', v: num(520000 * f) },
        ],
        why: `High-impact display delivers scale and visibility quickly among ${audienceWord(b)} audiences.`,
      },
      {
        title: 'Publisher B - Sponsored Content',
        format: 'Sponsored article',
        spend: (b.budget ?? 0) * 0.25,
        metrics: [
          { k: 'Est. reach', v: num(90000 * f) },
          { k: 'Est. impressions', v: num(260000 * f) },
        ],
        why: 'Builds presence with the wider buying committee around the launch activity.',
      },
      {
        title: 'Publisher C - Video Programme',
        format: 'Video',
        spend: (b.budget ?? 0) * 0.4,
        metrics: [
          { k: 'Est. views', v: num(340000 * f) },
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
  return {
    metrics: [
      { k: 'Total budget', v: gbp(b.budget ?? 0) },
      { k: 'Est. interactions', v: num(4400 * f), hl: true },
      { k: 'Est. registrations', v: num(380 * f), hl: true },
      { k: 'Est. downloads', v: num(1150 * f) },
      { k: 'Duration', v: `${weeks} weeks` },
    ],
    items: [
      {
        title: `Publisher A - ${b.audience} Webinar Series`,
        format: 'Webinar',
        spend: (b.budget ?? 0) * 0.3,
        metrics: [
          { k: 'Est. registrations', v: num(380 * f) },
          { k: 'Per registration', v: gbp(79) },
        ],
        why: `Webinars hold attention longest among ${seniorityWord(b)} ${audienceWord(b)} audiences.`,
      },
      {
        title: 'Publisher B - Sponsored Content Hub',
        format: 'Sponsored article',
        spend: (b.budget ?? 0) * 0.4,
        metrics: [
          { k: 'Est. interactions', v: num(2900 * f) },
          { k: 'Avg. dwell', v: '3:10' },
        ],
        why: 'A content hub deepens engagement with the buying committee over the campaign period.',
      },
      {
        title: 'Publisher C - Native Content Programme',
        format: 'Native content',
        spend: (b.budget ?? 0) * 0.3,
        metrics: [
          { k: 'Est. downloads', v: num(1150 * f) },
          { k: 'Est. reach', v: num(120000 * f) },
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

export function buildPlan(b: Brief): Plan {
  const f = (b.budget ?? REFERENCE_BUDGET) / REFERENCE_BUDGET;
  const weeks = campaignWeeks(b.start, b.end) || 12;
  const months = timingMonths(b.start);
  if (b.objective === 'awareness') return awarenessPlan(b, f, weeks, months);
  if (b.objective === 'consideration') return considerationPlan(b, f, weeks, months);
  return performancePlan(b, f, weeks, months);
}

export function checklistFor(b: Brief): string[] {
  const kpi = (b.kpi ?? 'your KPI').toLowerCase();
  const efficiency =
    b.objective === 'awareness'
      ? 'reach and impressions'
      : b.objective === 'consideration'
        ? 'engagement and registrations'
        : 'delivery and cost per lead';
  return [
    "Excluding publishers and products that don't fit your brief",
    `Prioritising formats that work for ${kpi}`,
    `Balancing the spend split within your ${gbp(b.budget ?? 0)}`,
    `Calculating expected ${efficiency}`,
  ];
}
