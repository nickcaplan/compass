/** Private demo adapter. Does not claim audience fit, quotes or a complete budget plan. */
export function browseInventory(data, {markets=[], objectives=[]}={}) {
  const selected=data.records.filter(r=>r.structurally_reviewable && markets.includes(r.market) && objectives.includes(r.objective));
  return [...new Set(selected.map(r=>r.tactic))].sort().map(tactic=>({tactic,description:data.descriptions[tactic]['Why this tactic is useful — dashboard summary'],notice:data.notice,options:selected.filter(r=>r.tactic===tactic)}));
}
export function buildRecommendation(data, brief) {
  // Fail closed. These missing decisions must not quietly broaden the shortlist.
  return {status:'needs_business_rules',groups:[],blockers:['Confirm publisher currencies and GBP rates','Approve mappings for the six Compass audiences','Validate availability and complete package/budget rules'],reviewGroups:browseInventory(data,brief)};
}
