import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  EMPTY_BRIEF,
  OBJECTIVES,
  PRIMARY_AUDIENCES,
  SENIORITY_LEVELS,
  answeredCount,
  buildPlan,
  campaignWeeks,
  checklistFor,
  demoBrief,
  endBeforeStart,
  formatDate,
  gbp,
  num,
  startNotFuture,
  timingMonths,
  weeksLabel,
  type Brief,
} from './data';

const BASE: Brief = {
  name: 'Test campaign',
  objectives: ['performance'],
  kpis: ['Lead generation'],
  audiences: ['Procurement'],
  seniority: ['Manager'],
  budget: 100000,
  start: '2027-01-05',
  end: '2027-03-30',
};

const isoDaysAhead = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('taxonomy', () => {
  it('keeps KPI options attached to their objective', () => {
    for (const o of OBJECTIVES) {
      expect(o.kpis.length).toBeGreaterThan(0);
    }
    expect(OBJECTIVES.map((o) => o.id)).toEqual(['awareness', 'consideration', 'performance']);
  });

  it('shows the approved priority audiences first, inside the taxonomy', () => {
    for (const a of PRIMARY_AUDIENCES) expect(AUDIENCES).toContain(a);
    expect(SENIORITY_LEVELS).toHaveLength(4);
  });
});

describe('campaign dates', () => {
  it('counts whole weeks, with a one-week minimum', () => {
    expect(campaignWeeks('2027-01-05', '2027-03-30')).toBe(12);
    expect(campaignWeeks('2027-01-05', '2027-01-06')).toBe(1);
  });

  it('rejects impossible ranges', () => {
    expect(campaignWeeks('2027-03-30', '2027-01-05')).toBe(0);
    expect(campaignWeeks('not-a-date', '2027-01-05')).toBe(0);
    expect(endBeforeStart('2027-03-30', '2027-01-05')).toBe(true);
    expect(endBeforeStart('2027-01-05', '2027-03-30')).toBe(false);
    expect(endBeforeStart('', '2027-01-05')).toBe(false);
  });

  it('treats today and earlier as not future', () => {
    expect(startNotFuture(isoDaysAhead(-1))).toBe(true);
    expect(startNotFuture(isoDaysAhead(0))).toBe(true);
    expect(startNotFuture(isoDaysAhead(1))).toBe(false);
    expect(startNotFuture('')).toBe(false);
  });

  it('labels the three timing slots with real month names', () => {
    expect(timingMonths('2027-01-05', '2027-03-30')).toEqual(['January', 'February', 'March']);
    expect(timingMonths('2026-12-01', '2027-02-01')).toEqual(['December', 'January', 'February']);
    expect(timingMonths('bad', 'worse')).toEqual(['Month 1', 'Month 2', 'Month 3']);
  });
});

describe('formatting', () => {
  it('formats money and numbers for the UK', () => {
    expect(gbp(100000)).toBe('£100,000');
    expect(gbp(1234.6)).toBe('£1,235');
    expect(num(950000)).toBe('950,000');
  });

  it('formats dates and durations', () => {
    expect(formatDate('2027-01-05')).toBe('5 Jan 2027');
    expect(formatDate('rubbish')).toBe('');
    expect(weeksLabel(1)).toBe('1 week');
    expect(weeksLabel(12)).toBe('12 weeks');
  });
});

describe('answeredCount', () => {
  it('starts at zero on an empty brief', () => {
    expect(answeredCount(EMPTY_BRIEF)).toBe(0);
  });

  it('reaches six for a complete, future-dated brief', () => {
    expect(answeredCount({ ...BASE, start: isoDaysAhead(30), end: isoDaysAhead(114) })).toBe(6);
  });

  it('does not count a past-dated campaign as answered', () => {
    expect(answeredCount({ ...BASE, start: isoDaysAhead(-10), end: isoDaysAhead(74) })).toBe(5);
  });
});

describe('buildPlan', () => {
  it('splits the entered budget exactly across activities', () => {
    for (const budget of [100000, 37500, 999999, 1]) {
      const plan = buildPlan({ ...BASE, budget });
      const total = plan.items.reduce((a, x) => a + x.spend, 0);
      expect(total).toBe(Math.round(budget));
      expect(plan.metrics[0]).toEqual({ k: 'Total budget', v: gbp(budget) });
    }
  });

  it('scales headline delivery figures with the budget', () => {
    const small = buildPlan({ ...BASE, budget: 50000 });
    const large = buildPlan({ ...BASE, budget: 100000 });
    const leads = (p: typeof small) => p.metrics.find((m) => m.k === 'Estimated leads')!.v;
    expect(leads(large)).toBe(num(950));
    expect(leads(small)).toBe(num(475));
  });

  it('falls back to the performance plan when no objective is chosen', () => {
    const plan = buildPlan({ ...BASE, objectives: [] });
    expect(plan.metrics.some((m) => m.k === 'Estimated leads')).toBe(true);
  });

  it('matches objective-specific headline metrics', () => {
    const awareness = buildPlan({ ...BASE, objectives: ['awareness'] });
    expect(awareness.metrics.some((m) => m.k === 'Estimated impressions')).toBe(true);
    const consideration = buildPlan({ ...BASE, objectives: ['consideration'] });
    expect(consideration.metrics.some((m) => m.k === 'Estimated registrations')).toBe(true);
  });

  it('composes multi-objective plans without duplicate activities, still summing to budget', () => {
    const plan = buildPlan({ ...BASE, objectives: ['awareness', 'consideration', 'performance'] });
    const titles = plan.items.map((i) => i.title);
    expect(new Set(titles).size).toBe(titles.length);
    const total = plan.items.reduce((a, x) => a + x.spend, 0);
    expect(total).toBe(Math.round(BASE.budget!));
    const hlKeys = plan.metrics.filter((m) => m.hl).map((m) => m.k);
    expect(new Set(hlKeys).size).toBe(hlKeys.length);
  });

  it('runs every activity within the three labelled timing slots', () => {
    const plan = buildPlan({ ...BASE });
    expect(plan.timing).toHaveLength(3);
    expect(plan.timing[0].label).toBe('January');
    expect(plan.timing[2].label).toBe('March');
  });
});

describe('demoBrief', () => {
  it('returns a complete future-dated brief', () => {
    const b = demoBrief();
    expect(answeredCount(b)).toBe(6);
    expect(startNotFuture(b.start)).toBe(false);
  });

  it('avoids the excluded variant when alternatives exist', () => {
    const first = demoBrief();
    for (let i = 0; i < 25; i += 1) {
      expect(demoBrief(first.name).name).not.toBe(first.name);
    }
  });

  it('does not share array references with the stored variants', () => {
    const a = demoBrief();
    const b = demoBrief();
    expect(a.objectives).not.toBe(b.objectives);
  });
});

describe('checklistFor', () => {
  it('describes efficiency per single objective', () => {
    expect(checklistFor({ ...BASE, objectives: ['awareness'] })[3]).toContain('reach and impressions');
    expect(checklistFor({ ...BASE, objectives: ['performance'] })[3]).toContain('cost per lead');
  });

  it('generalises efficiency across multiple objectives', () => {
    expect(checklistFor({ ...BASE, objectives: ['awareness', 'performance'] })[3]).toContain('selected objectives');
  });
});
