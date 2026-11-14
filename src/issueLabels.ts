const ISSUE_LABELS:Record<string,string>={
 unclassified_tactic:'No tactic',
 price_like_product_name:'Price-like product name',
 missing_tactic_rule:'Missing tactic rule',
 missing_tactic_description:'Missing tactic description',
 missing_tactic_rule_or_description:'Missing tactic rule or description',
 cpl_one_unit_cost_not_campaign_budget:'One-unit CPL cost, not campaign budget',
 cpm_over_1000_review_threshold:'CPM over review threshold',
 tactic_kpi_mismatch:'KPI does not match tactic rule',
 invalid_rate_or_volume:'Invalid rate or volume',
 invalid_kpi_fraction:'Invalid KPI fraction',
 cost_formula_mismatch:'Cost formula mismatch',
 result_formula_mismatch:'Result formula mismatch',
};
export function issueLabel(token:string):string{
 return ISSUE_LABELS[token]||token.replaceAll('_',' ');
}
