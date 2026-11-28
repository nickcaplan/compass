import type inventory from './inventory.mock.json';
export type SourceOption = typeof inventory.records[number];
// Source inspection only, not audience matching, ranking or budget allocation.
// Keep whole workbook packages and units. Never infer cross-market coverage or FX.
export function sourceOptions(records: readonly SourceOption[], market: string, objectives: readonly string[]) {
  const slice = market && objectives.length
    ? records.filter(r => r.market === market && objectives.includes(r.objective)) : [];
  const options = slice.filter(r => r.structurally_reviewable && r.structural_issues.length === 0
    && Number.isFinite(r.estimated_source_cost) && r.estimated_source_cost >= 0
    && Number.isFinite(r.expected_result) && r.expected_result >= 0);
  const tactics = [...new Set(options.map(r => r.tactic))].sort();
  return {
    groups: tactics.map(tactic => ({tactic, description: options.find(r => r.tactic === tactic)!.tactic_description,
      options: options.filter(r => r.tactic === tactic)})),
    optionCount: options.length,
    heldCount: slice.length - options.length,
    // A source row passing structural checks is not an approved recommendation.
    recommendationReady: false as const,
  };
}

export interface SelectionInput {
  market: string;
  /** Objective labels with the KPI chip labels each one offers. */
  objectives: readonly {label: string; kpis: readonly string[]}[];
  /** KPI chips the user has selected. Unknown labels (old saved plans) are ignored. */
  kpis: readonly string[];
  /** Audience names. A row matches if it suits ANY of them. */
  audiences: readonly string[];
  /** Workbook Primary KPI values that each KPI chip matches. */
  kpiRowValues: Record<string, readonly string[]>;
}

const isUsable = (r: SourceOption) => r.structurally_reviewable && r.structural_issues.length === 0
  && Number.isFinite(r.estimated_source_cost) && r.estimated_source_cost >= 0
  && Number.isFinite(r.expected_result) && r.expected_result >= 0;

/**
 * Filter by market, objective, KPI and audience (match any), then pick one
 * option per tactic: priority 1 first, then lowest cost, then record ID.
 * The rest of the tactic's matches stay as alternatives. Totals count only the
 * selected options. Source inspection only: not an approved recommendation.
 */
export function selectSourceOptions(records: readonly SourceOption[], input: SelectionInput) {
  const known = input.kpis.filter(k => k in input.kpiRowValues);
  const allowed = new Map<string, Set<string>>();
  for (const o of input.objectives) {
    const values = new Set<string>();
    // No recognised KPI chip selected: do not filter by KPI.
    const chips = known.length ? o.kpis.filter(k => known.includes(k)) : o.kpis;
    for (const k of chips) for (const v of input.kpiRowValues[k] ?? []) values.add(v);
    allowed.set(o.label, values);
  }
  const wanted = input.audiences.filter(a => records.some(r => a in r.audience_fit));
  const matches = !input.market || !input.objectives.length ? [] : records.filter(r => isUsable(r)
    && r.market === input.market
    && allowed.get(r.objective)?.has(r.primary_kpi) === true
    && (wanted.length === 0 || wanted.some(a => (r.audience_fit as Record<string, boolean>)[a])));
  const order = (a: SourceOption, b: SourceOption) =>
    a.priority - b.priority || a.estimated_source_cost - b.estimated_source_cost || a.id.localeCompare(b.id);
  const tactics = [...new Set(matches.map(r => r.tactic))].sort();
  const groups = tactics.map(tactic => {
    const sorted = matches.filter(r => r.tactic === tactic).sort(order);
    return {tactic, description: sorted[0].tactic_description, selected: sorted[0], alternatives: sorted.slice(1)};
  });
  return {
    groups,
    selectedCount: groups.length,
    matchCount: matches.length,
    selectedCost: groups.reduce((sum, g) => sum + g.selected.estimated_source_cost, 0),
    recommendationReady: false as const,
  };
}
