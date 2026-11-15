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
