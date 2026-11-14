import type { MarketId } from './data';

// Legacy saved briefs may predate the required Market field. New/unsaved
// briefs still require a choice; only saved-plan loading/persistence receives this safety-net default.
export function withSavedMarket<T extends { markets?: MarketId[] }>(brief: T): Omit<T, 'markets'> & { markets: MarketId[] } {
  return brief.markets?.length ? { ...brief, markets: brief.markets } : { ...brief, markets: ['uk'] };
}
