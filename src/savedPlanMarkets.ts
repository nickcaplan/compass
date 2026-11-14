// Legacy saved briefs may predate the required Market field. New/unsaved
// briefs still require a choice; only saved plans receive this demo default.
export function withSavedMarket<T extends { markets?: string[] }>(brief: T): T {
  return brief.markets?.length ? brief : { ...brief, markets: ['uk'] };
}
